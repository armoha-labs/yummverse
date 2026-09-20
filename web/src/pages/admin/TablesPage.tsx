import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { api, apiFetch, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTenantSettings } from "@/lib/useTenantSettings";

interface Branch {
  _id: string;
  name: string;
}

interface Table {
  _id: string;
  branchId: string;
  tableNumber: string;
  status: "AVAILABLE" | "OCCUPIED";
  currentOrderId?: string;
  qrToken: string;
}

const schema = z.object({ tableNumber: z.string().min(1), branchId: z.string().optional() });
type FormValues = z.infer<typeof schema>;

function gridCols(isMultiBranch: boolean, tableStatusEnabled: boolean): string {
  if (isMultiBranch) {
    return tableStatusEnabled ? "grid-cols-[1fr_140px_120px_140px_160px]" : "grid-cols-[1fr_140px_160px]";
  }
  return tableStatusEnabled ? "grid-cols-[1fr_120px_140px_160px]" : "grid-cols-[1fr_160px]";
}

export default function TablesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterBranchId, setFilterBranchId] = useState<string>("");
  const [qrTableId, setQrTableId] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);

  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api.get<Branch[]>("/admin/branches") });
  const isMultiBranch = (branches.data?.length ?? 0) > 1;
  const settings = useTenantSettings();
  const tableStatusEnabled = settings.data?.ordering.tableStatusEnabled ?? true;

  const tables = useQuery({
    queryKey: ["tables", filterBranchId],
    queryFn: () => api.get<Table[]>(`/admin/tables${filterBranchId ? `?branchId=${filterBranchId}` : ""}`),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function viewQr(id: string) {
    setQrTableId(id);
    const blob = await apiFetch<Blob>(`/admin/tables/${id}/qr`);
    setQrImageUrl(URL.createObjectURL(blob));
  }

  function closeQrDialog() {
    setQrTableId(null);
    if (qrImageUrl) URL.revokeObjectURL(qrImageUrl);
    setQrImageUrl(null);
  }

  const create = useMutation({
    mutationFn: (data: FormValues) => api.post("/admin/tables", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      form.reset();
      setError(null);
      setOpen(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create table."),
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => api.post(`/admin/tables/${id}/qr/regenerate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tables/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
    onError: (err) => alert(err instanceof ApiError ? err.message : "Could not delete table."),
  });

  async function downloadAllQr() {
    const blob = await apiFetch<Blob>(`/admin/tables/qr/export${filterBranchId ? `?branchId=${filterBranchId}` : ""}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table-qr-codes.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  const branchName = (id: string) => branches.data?.find((b) => b._id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Tables</h1>
        <div className="flex flex-wrap items-center gap-2">
          {isMultiBranch && (
            <Select value={filterBranchId || "ALL"} onValueChange={(v) => setFilterBranchId(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Branches</SelectItem>
                {branches.data?.map((b) => (
                  <SelectItem key={b._id} value={b._id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={downloadAllQr}>
            Download All QR Codes (PDF)
          </Button>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setError(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={15} /> Add Table
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Table</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit((data) =>
                  create.mutate({ ...data, branchId: data.branchId || filterBranchId || undefined }),
                )}
                className="flex flex-col gap-3.5"
              >
                <div className="flex flex-col gap-1.5">
                  <Label>Table Number</Label>
                  <Input {...form.register("tableNumber")} placeholder="e.g. 12" />
                </div>
                {isMultiBranch && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Branch</Label>
                    <Select
                      defaultValue={filterBranchId || undefined}
                      onValueChange={(v) => form.setValue("branchId", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a branch" />
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
                )}
                {error && <div className="rounded-control bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</div>}
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
        <div className="overflow-x-auto">
          <div className={isMultiBranch ? "min-w-[760px]" : "min-w-[620px]"}>
            <div
              className={`grid gap-2 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-text-muted ${gridCols(isMultiBranch, tableStatusEnabled)}`}
            >
              <div>Table</div>
              {isMultiBranch && <div>Branch</div>}
              {tableStatusEnabled && (
                <>
                  <div>Status</div>
                  <div>Current Order</div>
                </>
              )}
              <div>Actions</div>
            </div>
            {tables.data?.map((table) => (
              <div
                key={table._id}
                className={`grid items-center gap-2 border-t border-border px-5 py-3 text-sm ${gridCols(isMultiBranch, tableStatusEnabled)}`}
              >
                <div className="font-semibold">Table {table.tableNumber}</div>
                {isMultiBranch && <div className="text-text-muted">{branchName(table.branchId)}</div>}
                {tableStatusEnabled && (
                  <>
                    <Badge variant={table.status === "OCCUPIED" ? "default" : "outline"}>{table.status}</Badge>
                    <div className="text-text-muted">{table.currentOrderId ?? "—"}</div>
                  </>
                )}
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" title="View QR" onClick={() => viewQr(table._id)}>
                    <QrCode size={15} />
                  </Button>
                  <Button size="icon" variant="ghost" title="Regenerate QR" onClick={() => regenerate.mutate(table._id)}>
                    <RefreshCw size={15} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete"
                    disabled={Boolean(table.currentOrderId)}
                    onClick={() => {
                      if (confirm(`Delete Table ${table.tableNumber}?`)) remove.mutate(table._id);
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            ))}
            {tables.data?.length === 0 && <div className="px-5 py-8 text-center text-sm text-text-muted">No tables yet.</div>}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(qrTableId)} onOpenChange={(open) => !open && closeQrDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Table QR Code</DialogTitle>
          </DialogHeader>
          {qrImageUrl ? (
            <img src={qrImageUrl} alt="Table QR code" className="mx-auto h-56 w-56" />
          ) : (
            <div className="py-10 text-center text-sm text-text-muted">Loading…</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
