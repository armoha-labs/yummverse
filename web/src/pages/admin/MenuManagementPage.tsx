import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Category {
  _id: string;
  name: string;
  description?: string;
  displayOrder: number;
  active: boolean;
}

interface MenuItem {
  _id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  taxPercentage: number;
  isAvailable: boolean;
  active: boolean;
}

const categorySchema = z.object({ name: z.string().min(1), description: z.string().optional() });
type CategoryForm = z.infer<typeof categorySchema>;

const itemSchema = z.object({
  categoryId: z.string().min(1, "Choose a category"),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  taxPercentage: z.coerce.number().min(0).max(100),
});
type ItemForm = z.infer<typeof itemSchema>;

export default function MenuManagementPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Menu Management</h1>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="items" className="mt-4">
          <ItemsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/admin/categories"),
  });

  const form = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) });

  const create = useMutation({
    mutationFn: (data: CategoryForm) => api.post("/admin/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      form.reset();
      setOpen(false);
    },
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => api.put("/admin/categories/reorder", { orderedIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  const sorted = [...(categories.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  function move(index: number, dir: -1 | 1) {
    const next = [...sorted];
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
    reorder.mutate(next.map((c) => c._id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((data) => create.mutate(data))} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input {...form.register("name")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Description</Label>
                <Textarea rows={2} {...form.register("description")} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
        {sorted.map((cat, i) => (
          <div key={cat._id} className="flex items-center gap-3 border-t border-border px-5 py-3 text-sm first:border-t-0">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-text-muted disabled:opacity-30">
                <ArrowUp size={13} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === sorted.length - 1} className="text-text-muted disabled:opacity-30">
                <ArrowDown size={13} />
              </button>
            </div>
            <div className="flex-1 font-medium">{cat.name}</div>
            <div className="text-xs text-text-muted">{cat.active ? "Active" : "Inactive"}</div>
          </div>
        ))}
        {sorted.length === 0 && <div className="px-5 py-8 text-center text-sm text-text-muted">No categories yet.</div>}
      </div>
    </div>
  );
}

function ItemsTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/admin/categories") });
  const items = useQuery({ queryKey: ["menu-items"], queryFn: () => api.get<MenuItem[]>("/admin/menu-items") });
  // Tax is charged per menu item's own Tax % (a GST-style per-item slab) — the tenant-wide
  // percentage set in Settings is only ever a starting point for items that don't have one
  // yet, prefilled here rather than defaulting new items to 0%.
  const tenantSettings = useQuery({
    queryKey: ["tenant-settings-tax-default"],
    queryFn: () => api.get<{ tax: { enabled: boolean; percentage: number } }>("/tenant/settings"),
  });
  const defaultTaxPercentage = tenantSettings.data?.tax.percentage ?? 0;

  const form = useForm<ItemForm>({ resolver: zodResolver(itemSchema), defaultValues: { taxPercentage: defaultTaxPercentage } });
  const editForm = useForm<ItemForm>({ resolver: zodResolver(itemSchema) });

  useEffect(() => {
    if (editingItem) {
      editForm.reset({
        categoryId: editingItem.categoryId,
        name: editingItem.name,
        description: editingItem.description ?? "",
        price: editingItem.price,
        taxPercentage: editingItem.taxPercentage,
      });
    }
  }, [editingItem, editForm]);

  const create = useMutation({
    mutationFn: (data: ItemForm) => api.post("/admin/menu-items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      form.reset({ taxPercentage: defaultTaxPercentage });
      setOpen(false);
    },
  });

  const update = useMutation({
    mutationFn: (data: ItemForm) => api.put(`/admin/menu-items/${editingItem!._id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      setEditingItem(null);
    },
  });

  const toggleAvailability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      api.patch(`/admin/menu-items/${id}/availability`, { isAvailable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu-items"] }),
  });

  const categoryName = (id: string) => categories.data?.find((c) => c._id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) form.reset({ taxPercentage: defaultTaxPercentage });
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((data) => create.mutate(data))} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select onValueChange={(v) => form.setValue("categoryId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.data?.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.categoryId && (
                  <div className="text-xs text-danger">{form.formState.errors.categoryId.message}</div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input {...form.register("name")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Description</Label>
                <Textarea rows={2} {...form.register("description")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Price (₹)</Label>
                  <Input type="number" step="0.01" {...form.register("price")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>GST %</Label>
                  <Input type="number" step="0.01" {...form.register("taxPercentage")} />
                  {defaultTaxPercentage > 0 && (
                    <div className="text-xs text-text-muted">Defaults to your GST setting ({defaultTaxPercentage}%).</div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
        <div className="overflow-x-auto">
          <div className="min-w-[580px]">
            <div className="grid grid-cols-[1fr_130px_90px_90px_50px] gap-2 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
              <div>Name</div>
              <div>Category</div>
              <div>Price</div>
              <div>Available</div>
              <div />
            </div>
            {items.data?.map((item) => (
              <div key={item._id} className="grid grid-cols-[1fr_130px_90px_90px_50px] items-center gap-2 border-t border-border px-5 py-3 text-sm">
                <div className="font-medium">{item.name}</div>
                <div className="text-text-muted">{categoryName(item.categoryId)}</div>
                <div>₹{item.price}</div>
                <Switch
                  checked={item.isAvailable}
                  onCheckedChange={(checked) => toggleAvailability.mutate({ id: item._id, isAvailable: checked })}
                />
                <button
                  onClick={() => setEditingItem(item)}
                  className="flex h-7 w-7 items-center justify-center rounded-[8px] text-text-muted hover:bg-bg hover:text-text"
                  title="Edit item"
                >
                  <Pencil size={14} />
                </button>
              </div>
            ))}
            {items.data?.length === 0 && <div className="px-5 py-8 text-center text-sm text-text-muted">No items yet.</div>}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(editingItem)} onOpenChange={(o) => !o && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit((data) => update.mutate(data))} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={editForm.watch("categoryId")} onValueChange={(v) => editForm.setValue("categoryId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.data?.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editForm.formState.errors.categoryId && (
                <div className="text-xs text-danger">{editForm.formState.errors.categoryId.message}</div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input {...editForm.register("name")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea rows={2} {...editForm.register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Price (₹)</Label>
                <Input type="number" step="0.01" {...editForm.register("price")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>GST %</Label>
                <Input type="number" step="0.01" {...editForm.register("taxPercentage")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
