export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-background shadow-sm">{children}</div>;
}
export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="p-4">
      <div className="text-sm font-semibold">{title}</div>
      {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
    </div>
  );
}
export function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pb-4">{children}</div>;
}
