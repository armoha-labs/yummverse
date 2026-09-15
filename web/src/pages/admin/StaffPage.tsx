import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Branch {
  _id: string;
  name: string;
}

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  role: "WAITER" | "KITCHEN";
  branchId: string;
  active: boolean;
}

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["WAITER", "KITCHEN"]),
  branchId: z.string().min(1, "Choose a branch"),
});
type FormValues = z.infer<typeof schema>;

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("");

  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api.get<Branch[]>("/admin/branches") });
  const staff = useQuery({
    queryKey: ["staff", roleFilter],
    queryFn: () => api.get<StaffMember[]>(`/admin/users${roleFilter ? `?role=${roleFilter}` : ""}`),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: "WAITER" } });

  const create = useMutation({
    mutationFn: (data: FormValues) => api.post("/admin/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      form.reset({ role: "WAITER" });
      setOpen(false);
    },
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.post(`/admin/users/${id}/${active ? "activate" : "deactivate"}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });

  const branchName = (id: string) => branches.data?.find((b) => b._id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Staff</h1>
        <div className="flex flex-wrap gap-2">
          <Select value={roleFilter || "ALL"} onValueChange={(v) => setRoleFilter(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="WAITER">Waiter</SelectItem>
              <SelectItem value="KITCHEN">Kitchen</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={15} /> Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Staff</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit((data) => create.mutate(data))} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <Label>Name</Label>
                  <Input {...form.register("name")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" {...form.register("email")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Phone</Label>
                  <Input {...form.register("phone")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Role</Label>
                    <Select defaultValue="WAITER" onValueChange={(v) => form.setValue("role", v as "WAITER" | "KITCHEN")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WAITER">Waiter</SelectItem>
                        <SelectItem value="KITCHEN">Kitchen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Branch</Label>
                    <Select onValueChange={(v) => form.setValue("branchId", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.data?.map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.formState.errors.branchId && (
                  <div className="text-xs text-danger">{form.formState.errors.branchId.message}</div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    Send Invite
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[1fr_80px_1fr_130px_90px_100px] gap-2 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
              <div>Name</div>
              <div>Role</div>
              <div>Email</div>
              <div>Branch</div>
              <div>Status</div>
              <div />
            </div>
            {staff.data?.map((member) => (
              <div key={member._id} className="grid grid-cols-[1fr_80px_1fr_130px_90px_100px] items-center gap-2 border-t border-border px-5 py-3 text-sm">
                <div className="font-medium">{member.name}</div>
                <div className="text-text-muted">{member.role}</div>
                <div className="truncate text-text-muted">{member.email}</div>
                <div className="text-text-muted">{branchName(member.branchId)}</div>
                <Badge variant={member.active ? "success" : "outline"}>{member.active ? "Active" : "Inactive"}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setActive.mutate({ id: member._id, active: !member.active })}>
                  {member.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ))}
            {staff.data?.length === 0 && <div className="px-5 py-8 text-center text-sm text-text-muted">No staff yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
