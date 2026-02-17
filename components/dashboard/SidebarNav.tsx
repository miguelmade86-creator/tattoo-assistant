"use client";

import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

const items: Item[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/appointments", label: "Citas" },
  { href: "/dashboard/reminders", label: "Recordatorios" },
  { href: "/dashboard/clients", label: "Clientes" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 space-y-1">
      {items.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <a
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={[
              "block rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            ].join(" ")}
          >
            {it.label}
          </a>
        );
      })}
    </nav>
  );
}
