export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "outline";
}) {
  const cls =
    variant === "success"
      ? "bg-emerald-100 text-emerald-800"
      : variant === "warning"
      ? "bg-amber-100 text-amber-800"
      : variant === "danger"
      ? "bg-rose-100 text-rose-800"
      : variant === "outline"
      ? "border text-foreground"
      : "bg-muted text-foreground";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}
