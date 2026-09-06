import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";
import { customerApi } from "@/lib/customerApiClient";
import { useCustomerAuth } from "@/lib/customerAuth";
import { cartStore, useCart } from "@/lib/cartStore";
import { formatMoney } from "@/lib/utils";

interface Category {
  _id: string;
  name: string;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  taxPercentage: number;
  isAvailable: boolean;
}

const GRADIENTS = [
  "linear-gradient(135deg, oklch(80% 0.09 45), oklch(68% 0.12 35))",
  "linear-gradient(135deg, oklch(88% 0.05 95), oklch(78% 0.08 85))",
  "linear-gradient(135deg, oklch(78% 0.1 60), oklch(66% 0.13 40))",
  "linear-gradient(135deg, oklch(82% 0.06 30), oklch(72% 0.09 20))",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length] ?? "linear-gradient(135deg, oklch(80% 0.09 45), oklch(68% 0.12 35))";
}

export default function MenuBrowsingPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const auth = useCustomerAuth();
  const navigate = useNavigate();
  const items = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const categories = useQuery({
    queryKey: ["customer-categories", auth?.tenantId],
    queryFn: () => customerApi.get<Category[]>("/public/categories"),
  });
  const menu = useQuery({
    queryKey: ["customer-menu", auth?.tenantId, auth?.branchId],
    queryFn: () => customerApi.get<MenuItem[]>("/public/menu"),
  });

  const filtered = useMemo(() => {
    const list = menu.data ?? [];
    return list.filter((item) => {
      const inCategory = selectedCategory === "all" || item.categoryId === selectedCategory;
      const matchesSearch = search.trim().length === 0 || item.name.toLowerCase().includes(search.trim().toLowerCase());
      return inCategory && matchesSearch;
    });
  }, [menu.data, selectedCategory, search]);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-accent font-display text-[15px] font-extrabold text-white">
            {(auth?.tenantName ?? "Café").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-display text-base font-extrabold leading-tight">{auth?.tenantName}</div>
            <div className="text-xs text-text-muted">Table {auth?.tableNumber}</div>
          </div>
        </div>
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-border bg-surface text-text-muted"
        >
          <Search size={18} strokeWidth={1.75} />
        </button>
      </div>

      {searchOpen && (
        <div className="px-5 pb-3">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the menu"
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto px-5 pb-3.5">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`shrink-0 rounded-full px-[18px] py-[9px] font-display text-[13.5px] font-semibold ${
            selectedCategory === "all" ? "bg-accent text-white" : "border border-border bg-surface text-text-muted"
          }`}
        >
          All
        </button>
        {(categories.data ?? []).map((cat) => (
          <button
            key={cat._id}
            onClick={() => setSelectedCategory(cat._id)}
            className={`shrink-0 rounded-full px-[18px] py-[9px] font-display text-[13.5px] font-semibold ${
              selectedCategory === cat._id ? "bg-accent text-white" : "border border-border bg-surface text-text-muted"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3.5 px-5 pb-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm2"
            style={{ opacity: item.isAvailable ? 1 : 0.5 }}
          >
            <div
              className="h-[110px] w-full bg-cover bg-center"
              style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : { background: gradientFor(item.id) }}
            />
            <div className="px-3 pb-3 pt-2.5">
              <div className="text-[13.5px] font-semibold">{item.name}</div>
              <div className="mt-0.5 text-[13px] text-text-muted">
                {item.isAvailable ? formatMoney(item.price, auth?.currency) : "Sold out"}
              </div>
            </div>
            {item.isAvailable && (
              <button
                onClick={() => cartStore.addItem({ menuItemId: item.id, name: item.name, price: item.price, taxPercentage: item.taxPercentage })}
                className="absolute right-2.5 top-[92px] flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-md2"
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
        {menu.isSuccess && filtered.length === 0 && (
          <div className="col-span-2 py-10 text-center text-sm text-text-muted">No items match.</div>
        )}
      </div>

      {cartCount > 0 && (
        <button
          onClick={() => navigate(`/t/${qrToken}/cart`)}
          className="fixed bottom-5 left-4 right-4 mx-auto flex h-14 max-w-[448px] items-center justify-between rounded-full bg-accent pl-5 pr-2.5 text-white shadow-md2"
        >
          <span className="font-display text-[14.5px] font-bold">
            {cartCount} item{cartCount === 1 ? "" : "s"} &middot; {formatMoney(cartTotal, auth?.currency)}
          </span>
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
