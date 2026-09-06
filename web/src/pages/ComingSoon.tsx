export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      <div className="rounded-card border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
        This screen is being built next.
      </div>
    </div>
  );
}
