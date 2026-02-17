import type { ReactNode } from "react";
import SidebarNav from "@/components/dashboard/SidebarNav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex w-72 border-r bg-background">
          <div className="w-full p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold leading-none">
                  Tattoo Assistant
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Panel multi-estudio
                </div>
              </div>
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                beta
              </span>
            </div>

            <SidebarNav />

            <div className="mt-8 rounded-2xl border bg-muted/20 p-3">
              <div className="text-xs font-medium">Automatización</div>
              <div className="mt-1 text-xs text-muted-foreground">
                WhatsApp si hay teléfono + consentimiento. Si no, solo dashboard/calendario.
              </div>
            </div>

            <div className="mt-6 text-xs text-muted-foreground">
              Supabase RLS · Cron-ready · Provider-ready
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1">
          {/* Topbar */}
          <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3 md:px-8">
              <div className="flex items-center gap-3">
                <div className="md:hidden">
                  <div className="text-sm font-semibold leading-none">
                    Tattoo Assistant
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Dashboard
                  </div>
                </div>
                <div className="hidden md:block text-sm text-muted-foreground">
                  Panel de gestión
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted transition"
                  href="/dashboard/reminders"
                >
                  Recordatorios
                </a>
                <a
                  className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted transition"
                  href="/dashboard/appointments"
                >
                  Citas
                </a>
              </div>
            </div>
          </header>

          <main className="p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
