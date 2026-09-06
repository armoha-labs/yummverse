import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

interface Table {
  _id: string;
  tableNumber: string;
  status: "AVAILABLE" | "OCCUPIED";
  currentOrderId?: string;
}

export default function WaiterTablesPage() {
  const tables = useQuery({
    queryKey: ["waiter-tables"],
    queryFn: () => api.get<Table[]>("/waiter/tables"),
    refetchInterval: 8000,
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      {tables.data?.map((table) => (
        <div
          key={table._id}
          className={`flex flex-col gap-2 rounded-card border bg-surface p-3.5 shadow-sm2 ${
            table.status === "OCCUPIED" ? "border-2 border-accent" : "border-border"
          }`}
        >
          <div className="font-display text-[15px] font-bold">Table {table.tableNumber}</div>
          {table.status === "OCCUPIED" ? (
            <span className="w-fit rounded-full bg-accent px-2.5 py-1 text-[10.5px] font-bold text-white">
              Occupied
            </span>
          ) : (
            <span className="w-fit rounded-full bg-success-soft px-2.5 py-1 text-[10.5px] font-bold text-success">
              Available
            </span>
          )}
        </div>
      ))}
      {tables.data?.length === 0 && (
        <div className="col-span-2 py-10 text-center text-sm text-text-muted">No tables in this branch yet.</div>
      )}
    </div>
  );
}
