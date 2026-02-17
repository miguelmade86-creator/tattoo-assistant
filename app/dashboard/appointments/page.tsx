"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import EditAppointmentModal from "@/components/dashboard/EditAppointmentModal";

type ClientRow = {
  id: string;
  name: string | null;
  phone: string | null;
  consent_whatsapp: boolean | null;
};

type AppointmentRow = {
  id: string;
  start_time: string;
  end_time: string;
  tattoo_type: string | null;
  body_part: string | null;
  price: number | null;
  notes: string | null;

  reminder_sent: boolean | null;
  reminder_status: string | null;

  client: ClientRow[]; // llega como array por PostgREST
};

function Badge({
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
      ? "bg-amber-100 text-amber-900"
      : variant === "danger"
      ? "bg-rose-100 text-rose-900"
      : variant === "outline"
      ? "border border-muted-foreground/30 text-foreground"
      : "bg-muted text-foreground";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background shadow-sm">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "secondary" | "ghost";
}) {
  const base = "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition border";
  const cls =
    variant === "secondary"
      ? "bg-muted hover:bg-muted/80 border-muted"
      : variant === "ghost"
      ? "bg-transparent hover:bg-muted border-transparent"
      : "bg-foreground text-background hover:bg-foreground/90 border-foreground";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${cls} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

export default function AppointmentsPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent" | "skipped">("all");

  const [toast, setToast] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAp, setSelectedAp] = useState<any>(null);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Atlantic/Canary",
      }),
    []
  );

  async function load() {
    const res = await supabase
      .from("appointments")
      .select(
        `
        id,
        start_time,
        end_time,
        tattoo_type,
        body_part,
        price,
        notes,
        reminder_sent,
        reminder_status,
        client:clients!appointments_client_id_fkey ( id, name, phone, consent_whatsapp )
      `
      )
      .order("start_time", { ascending: true });

    if (res.error) {
      setError(res.error.message);
      setRows([]);
    } else {
      setError(null);
      setRows((res.data ?? []) as AppointmentRow[]);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      if (!alive) return;

      setEmail(data.session.user.email ?? null);
      setLoading(false);
      await load();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function getStatus(a: AppointmentRow) {
    // Prioriza reminder_status si existe
    const s = (a.reminder_status ?? "").toLowerCase().trim();
    if (s === "pending" || s === "sent" || s === "skipped") return s as any;
    // fallback a reminder_sent boolean
    if (a.reminder_sent) return "sent";
    return "pending";
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => getStatus(r) === "pending").length;
    const sent = rows.filter((r) => getStatus(r) === "sent").length;
    const skipped = rows.filter((r) => getStatus(r) === "skipped").length;

    const waReady = rows.filter((r) => {
      const c = r.client?.[0];
      return !!c?.phone && !!c?.consent_whatsapp;
    }).length;

    return { total, pending, sent, skipped, waReady };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return rows
      .filter((r) => {
        if (statusFilter === "all") return true;
        return getStatus(r) === statusFilter;
      })
      .filter((r) => {
        if (!query) return true;
        const c = r.client?.[0];
        const hay =
          (c?.name ?? "").toLowerCase() +
          " " +
          (c?.phone ?? "").toLowerCase() +
          " " +
          (r.tattoo_type ?? "").toLowerCase() +
          " " +
          (r.body_part ?? "").toLowerCase();
        return hay.includes(query);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, statusFilter]);

  async function sendReminderNow(appointmentId: string) {
    try {
      setSendingId(appointmentId);
      setToast(null);

      const resp = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error ?? "unknown");

      setToast("✅ Recordatorio marcado como enviado (TEST).");
      await load();
    } catch (e: any) {
      setToast(`Error: ${e.message}`);
    } finally {
      setSendingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold">Citas</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Logueado como <span className="font-medium text-foreground">{email}</span>
          </div>
          {error ? <div className="mt-2 text-sm text-rose-700">Error: {error}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => load()}>
            Recargar
          </Button>
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            Volver
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast ? <div className="rounded-xl border bg-background p-3 text-sm">{toast}</div> : null}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card title="Total" subtitle="Citas en sistema" right={<Badge variant="outline">appointments</Badge>}>
          <div className="text-3xl font-semibold">{stats.total}</div>
        </Card>
        <Card title="Pendientes" subtitle="Para runner" right={<Badge variant="outline">pending</Badge>}>
          <div className="text-3xl font-semibold">{stats.pending}</div>
        </Card>
        <Card title="Enviados" subtitle="OK" right={<Badge variant="outline">sent</Badge>}>
          <div className="text-3xl font-semibold">{stats.sent}</div>
        </Card>
        <Card title="Omitidos" subtitle="Sin WhatsApp" right={<Badge variant="outline">skipped</Badge>}>
          <div className="text-3xl font-semibold">{stats.skipped}</div>
        </Card>
        <Card title="WhatsApp ready" subtitle="Teléfono + consentimiento" right={<Badge variant="warning">whatsapp</Badge>}>
          <div className="text-3xl font-semibold">{stats.waReady}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card
        title="Listado"
        subtitle="Filtra por estado y busca por cliente/tipo/zona."
        right={<Badge variant="outline">{filtered.length} resultados</Badge>}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:w-96">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-muted"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "sent", "skipped"] as const).map((k) => (
              <button
                key={k}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  statusFilter === k ? "bg-muted" : "bg-background hover:bg-muted/40",
                ].join(" ")}
                onClick={() => setStatusFilter(k)}
              >
                {k === "all" ? "Todos" : k === "pending" ? "Pendientes" : k === "sent" ? "Enviados" : "Omitidos"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Inicio</th>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">WhatsApp</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((a) => {
                const c = a.client?.[0];
                const status = getStatus(a);
                const waReady = !!c?.phone && !!c?.consent_whatsapp;

                return (
                  <tr key={a.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 whitespace-nowrap">{fmt.format(new Date(a.start_time))}</td>

                    <td className="px-3 py-2">
                      <div className="font-medium">{c?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c?.phone ?? "—"}</div>
                    </td>

                    <td className="px-3 py-2">
                      {waReady ? <Badge variant="warning">LISTO</Badge> : <Badge variant="outline">NO</Badge>}
                    </td>

                    <td className="px-3 py-2">
                      {status === "sent" ? (
                        <Badge variant="success">sent</Badge>
                      ) : status === "skipped" ? (
                        <Badge variant="outline">skipped</Badge>
                      ) : (
                        <Badge variant="outline">pending</Badge>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                          onClick={() => {
                            setSelectedAp({
                              id: a.id,
                              start_time: a.start_time,
                              end_time: a.end_time,
                              tattoo_type: a.tattoo_type,
                              body_part: a.body_part,
                              price: a.price,
                              notes: a.notes,
                            });
                            setEditOpen(true);
                          }}
                        >
                          Editar
                        </button>

                        <button
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted transition disabled:opacity-60"
                          disabled={status === "sent" || sendingId === a.id}
                          onClick={() => sendReminderNow(a.id)}
                        >
                          {sendingId === a.id ? "Enviando…" : "Enviar (test)"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            No hay resultados con esos filtros.
          </div>
        ) : null}
      </Card>

      <EditAppointmentModal
        open={editOpen}
        appointment={selectedAp}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          await load();
          setToast("✅ Cita actualizada (recordatorio reiniciado a pending)");
        }}
      />
    </div>
  );
}
