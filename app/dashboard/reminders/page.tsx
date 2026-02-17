"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ClientRow = {
  id: string;
  name: string | null;
  phone: string | null;
  consent_whatsapp: boolean | null;
};

type AppointmentReminderRow = {
  id: string;
  start_time: string;
  end_time: string;

  // Nuevas columnas (según tu estado actual)
  reminder_status: string | null; // pending | sent | skipped | null
  reminder_channel: string | null; // whatsapp | dashboard | null
  reminder_sent_at: string | null; // timestamptz
  reminder_error: string | null;

  reminder_provider: string | null; // mock | meta | null
  reminder_message_id: string | null;

  client: ClientRow[];
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
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
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
          {subtitle ? (
            <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
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
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "secondary" | "ghost";
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition border";
  const cls =
    variant === "secondary"
      ? "bg-muted hover:bg-muted/80 border-muted"
      : variant === "ghost"
      ? "bg-transparent hover:bg-muted border-transparent"
      : "bg-foreground text-background hover:bg-foreground/90 border-foreground";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${cls} ${
        disabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      {children}
    </button>
  );
}

function statusBadge(status: string | null) {
  if (status === "sent") return <Badge variant="success">sent</Badge>;
  if (status === "skipped") return <Badge variant="outline">skipped</Badge>;
  return <Badge>pending</Badge>; // default
}

function channelBadge(channel: string | null) {
  if (channel === "whatsapp") return <Badge variant="warning">whatsapp</Badge>;
  if (channel === "dashboard") return <Badge variant="outline">dashboard</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function providerBadge(provider: string | null) {
  if (!provider) return <Badge variant="outline">—</Badge>;
  if (provider === "meta") return <Badge variant="success">meta</Badge>;
  return <Badge variant="outline">{provider}</Badge>; // mock u otros
}

export default function RemindersPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [rows, setRows] = useState<AppointmentReminderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"pending" | "sent" | "skipped">("pending");
  const [q, setQ] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  const [runLoading, setRunLoading] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Atlantic/Canary",
      }),
    []
  );

  const fmtDateOnly = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeZone: "Atlantic/Canary",
      }),
    []
  );

  async function load(sessionUserId: string) {
    // Nota: mantenemos un query simple. Filtramos por tab en el cliente.
    // Si quieres optimizar: hacemos .eq("reminder_status", tab) server-side.
    const res = await supabase
      .from("appointments")
      .select(
        `
        id,
        start_time,
        end_time,
        reminder_status,
        reminder_channel,
        reminder_sent_at,
        reminder_error,
        reminder_provider,
        reminder_message_id,
        client:clients!appointments_client_id_fkey ( id, name, phone, consent_whatsapp )
      `
      )
      .order("start_time", { ascending: true });

    if (res.error) {
      setError(res.error.message);
      setRows([]);
    } else {
      setError(null);
      setRows((res.data ?? []) as AppointmentReminderRow[]);
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

      await load(data.session.user.id);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function runSimulatedReminders() {
    try {
      setRunLoading(true);
      setRunResult(null);
      setToast(null);

      const resp = await fetch("/api/reminders/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-reminder-key": "mi_clave_super_secreta",
        },
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error ?? "unknown");

      setRunResult(json);
      setToast("✅ Simulación ejecutada.");

      const { data } = await supabase.auth.getSession();
      if (data.session) await load(data.session.user.id);
    } catch (e: any) {
      setToast(`Error runner: ${e.message}`);
    } finally {
      setRunLoading(false);
    }
  }

  function reasonLabel(reason: string) {
    if (reason === "missing_phone") return "Sin teléfono";
    if (reason === "no_consent_whatsapp") return "Sin consentimiento";
    return reason;
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return rows
      .filter((r) => (r.reminder_status ?? "pending") === tab)
      .filter((r) => {
        if (!query) return true;
        const c = r.client?.[0];
        const name = (c?.name ?? "").toLowerCase();
        const phone = (c?.phone ?? "").toLowerCase();
        const msgId = (r.reminder_message_id ?? "").toLowerCase();
        return (
          name.includes(query) ||
          phone.includes(query) ||
          msgId.includes(query)
        );
      });
  }, [rows, tab, q]);

  const stats = useMemo(() => {
    const norm = (s: string | null) => (s ?? "pending");
    const pending = rows.filter((r) => norm(r.reminder_status) === "pending")
      .length;
    const sent = rows.filter((r) => norm(r.reminder_status) === "sent").length;
    const skipped = rows.filter((r) => norm(r.reminder_status) === "skipped")
      .length;

    const whatsapp = rows.filter((r) => r.reminder_channel === "whatsapp")
      .length;
    const dashboard = rows.filter((r) => r.reminder_channel === "dashboard")
      .length;

    return { pending, sent, skipped, whatsapp, dashboard };
  }, [rows]);

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
          <div className="text-2xl font-semibold">Recordatorios</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Logueado como{" "}
            <span className="font-medium text-foreground">{email}</span>
          </div>
          {error ? (
            <div className="mt-2 text-sm text-rose-700">Error: {error}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={runSimulatedReminders}
            disabled={runLoading}
          >
            {runLoading ? "Simulando…" : "Simular recordatorios (mañana)"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            Volver
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast ? (
        <div className="rounded-xl border bg-background p-3 text-sm">
          {toast}
        </div>
      ) : null}

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card title="pending" subtitle="Pendientes" right={statusBadge("pending")}>
          <div className="text-3xl font-semibold">{stats.pending}</div>
        </Card>
        <Card title="sent" subtitle="Enviados" right={statusBadge("sent")}>
          <div className="text-3xl font-semibold">{stats.sent}</div>
        </Card>
        <Card title="skipped" subtitle="Omitidos" right={statusBadge("skipped")}>
          <div className="text-3xl font-semibold">{stats.skipped}</div>
        </Card>
        <Card title="whatsapp" subtitle="Canal WhatsApp" right={channelBadge("whatsapp")}>
          <div className="text-3xl font-semibold">{stats.whatsapp}</div>
        </Card>
        <Card title="dashboard" subtitle="Canal Dashboard" right={channelBadge("dashboard")}>
          <div className="text-3xl font-semibold">{stats.dashboard}</div>
        </Card>
      </div>

      {/* Tabs + Search */}
      <Card
        title="Listado"
        subtitle="Filtra por estado y busca por cliente / teléfono / message_id"
        right={
          <div className="flex items-center gap-2">
            <Badge variant="outline">Atlantic/Canary</Badge>
          </div>
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Tabs */}
          <div className="inline-flex w-full md:w-auto rounded-xl border bg-muted/20 p-1">
            {(["pending", "sent", "skipped"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 md:flex-none rounded-lg px-3 py-2 text-sm transition ${
                  tab === t
                    ? "bg-background border shadow-sm"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <span className="capitalize">{t}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="w-full md:w-80">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente / teléfono / message_id…"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-muted"
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-left font-medium">Hora</th>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Canal</th>
                <th className="px-3 py-2 text-left font-medium">Provider</th>
                <th className="px-3 py-2 text-left font-medium">Message ID</th>
                <th className="px-3 py-2 text-left font-medium">Sent at</th>
                <th className="px-3 py-2 text-left font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const c = r.client?.[0];
                const status = (r.reminder_status ?? "pending") as string;

                return (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtDateOnly.format(new Date(r.start_time))}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmt.format(new Date(r.start_time))}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{c?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {c?.phone ?? "Sin teléfono"} ·{" "}
                        {c?.consent_whatsapp ? "consent ✅" : "consent ❌"}
                      </div>
                    </td>
                    <td className="px-3 py-2">{statusBadge(status)}</td>
                    <td className="px-3 py-2">{channelBadge(r.reminder_channel)}</td>
                    <td className="px-3 py-2">{providerBadge(r.reminder_provider)}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs">
                        {r.reminder_message_id ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.reminder_sent_at
                        ? fmt.format(new Date(r.reminder_sent_at))
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.reminder_error ? (
                        <Badge variant="danger">{r.reminder_error}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            No hay resultados para <span className="font-medium">{tab}</span>.
          </div>
        ) : null}
      </Card>

      {/* Runner results */}
      {runResult ? (
        <Card
          title="Resultado simulación (runner)"
          subtitle={`count: ${runResult.count ?? "—"} · ok: ${String(runResult.ok ?? "—")}`}
          right={<Badge variant="outline">/api/reminders/run</Badge>}
        >
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Hora</th>
                  <th className="px-3 py-2 text-left font-medium">Cliente</th>
                  <th className="px-3 py-2 text-left font-medium">Acción</th>
                  <th className="px-3 py-2 text-left font-medium">Canal</th>
                  <th className="px-3 py-2 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {runResult.results?.map((r: any, i: number) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmt.format(new Date(r.start_time))}
                    </td>
                    <td className="px-3 py-2">{r.client_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.action === "SIMULATED_SEND" ? (
                        <Badge variant="success">Enviar</Badge>
                      ) : (
                        <Badge variant="outline">Omitido</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.channel === "whatsapp" ? (
                        <Badge variant="warning">WhatsApp</Badge>
                      ) : (
                        <Badge variant="outline">Calendario</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.ok ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <Badge variant="outline">{reasonLabel(r.reason)}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Ver JSON (debug)
            </summary>
            <pre className="mt-2 overflow-auto rounded-xl bg-muted/40 p-3 text-xs">
              {JSON.stringify(runResult, null, 2)}
            </pre>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
