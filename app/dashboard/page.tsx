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

type ArtistRow = {
  id: string;
  display_name?: string | null;
  email?: string | null;
};

type AppointmentRow = {
  id: string;
  start_time: string;
  end_time: string;
  tattoo_type: string | null;
  body_part: string | null;
  price: number | null;
  notes: string | null;
  google_event_id: string | null;
  reminder_sent: boolean;
  client: ClientRow[];
  artist: ArtistRow[];
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

export default function OverviewPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [apError, setApError] = useState<string | null>(null);

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

  async function loadAppointments(sessionUserId: string) {
    // Nota: mantenemos tu fetch tal cual, solo lo movemos aquí
    const res = await supabase
      .from("appointments")
      .select(`
        id,
        start_time,
        end_time,
        tattoo_type,
        body_part,
        price,
        notes,
        google_event_id,
        reminder_sent,
        client:clients!appointments_client_id_fkey ( id, name, phone, consent_whatsapp ),
        artist:profiles!appointments_artist_id_fkey ( id )
      `)
      .order("start_time", { ascending: true });

    if (res.error) {
      setApError(res.error.message);
      setAppointments([]);
    } else {
      setApError(null);
      setAppointments(res.data as AppointmentRow[]);
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

      await loadAppointments(data.session.user.id);
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
      if (data.session) await loadAppointments(data.session.user.id);
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

  const stats = useMemo(() => {
    const total = appointments.length;
    const pending = appointments.filter((a) => !a.reminder_sent).length;
    const sent = appointments.filter((a) => a.reminder_sent).length;
    const whatsappReady = appointments.filter((a) => {
      const c = a.client?.[0];
      return !!c?.phone && !!c?.consent_whatsapp;
    }).length;

    return { total, pending, sent, whatsappReady };
  }, [appointments]);

  const next5 = useMemo(() => appointments.slice(0, 5), [appointments]);

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
          <div className="text-2xl font-semibold">Overview</div>
          <a className="block rounded-md px-3 py-2 hover:bg-muted" href="/dashboard/demo">Demo</a>
          <div className="mt-1 text-sm text-muted-foreground">
            Logueado como <span className="font-medium text-foreground">{email}</span>
          </div>
          {apError ? (
            <div className="mt-2 text-sm text-rose-700">Error citas: {apError}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={runSimulatedReminders} disabled={runLoading}>
            {runLoading ? "Simulando…" : "Simular recordatorios (mañana)"}
          </Button>

          <Button variant="ghost" onClick={() => router.push("/dashboard/appointments")}>
            Ver todas las citas
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast ? <div className="rounded-xl border bg-background p-3 text-sm">{toast}</div> : null}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Citas" subtitle="Total en sistema" right={<Badge variant="outline">Atlantic/Canary</Badge>}>
          <div className="text-3xl font-semibold">{stats.total}</div>
          <div className="mt-2 text-xs text-muted-foreground">Ordenadas por start_time.</div>
        </Card>

        <Card title="Pendientes" subtitle="Recordatorios">
          <div className="flex items-end justify-between">
            <div className="text-3xl font-semibold">{stats.pending}</div>
            <Badge>pending</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Listos para el runner.</div>
        </Card>

        <Card title="Enviados" subtitle="Recordatorios (test)">
          <div className="flex items-end justify-between">
            <div className="text-3xl font-semibold">{stats.sent}</div>
            <Badge variant="success">sent</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Marcados desde API.</div>
        </Card>

        <Card title="WhatsApp ready" subtitle="Contacto + consentimiento">
          <div className="flex items-end justify-between">
            <div className="text-3xl font-semibold">{stats.whatsappReady}</div>
            <Badge variant="warning">whatsapp</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Si falta algo, se omite.</div>
        </Card>
      </div>

      {/* Próximas citas */}
      <Card title="Próximas citas" subtitle="Las 5 más cercanas (resumen)" right={<Badge variant="outline">top 5</Badge>}>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Inicio</th>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">WhatsApp</th>
                <th className="px-3 py-2 text-left font-medium">Recordatorio</th>
              </tr>
            </thead>
            <tbody>
              {next5.map((a) => {
                const c = a.client?.[0];
                const waReady = !!c?.phone && !!c?.consent_whatsapp;
                return (
                  <tr key={a.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 whitespace-nowrap">{fmt.format(new Date(a.start_time))}</td>
                    <td className="px-3 py-2">{c?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {waReady ? <Badge variant="warning">Listo</Badge> : <Badge variant="outline">No</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      {a.reminder_sent ? <Badge variant="success">Enviado</Badge> : <Badge>Pendiente</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {appointments.length > 5 ? (
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={() => router.push("/dashboard/appointments")}>
              Ver listado completo
            </Button>
          </div>
        ) : null}
      </Card>

      {/* Runner results (si hay) */}
      {runResult ? (
        <Card
          title="Resultado simulación"
          subtitle={`count: ${runResult.count ?? "—"} · ok: ${String(runResult.ok ?? "—")}`}
          right={<Badge variant="outline">Runner</Badge>}
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
                    <td className="px-3 py-2 whitespace-nowrap">{fmt.format(new Date(r.start_time))}</td>
                    <td className="px-3 py-2">{r.client_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.action === "SIMULATED_SEND" ? <Badge variant="success">Enviar</Badge> : <Badge variant="outline">Omitido</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      {r.channel === "whatsapp" ? <Badge variant="warning">WhatsApp</Badge> : <Badge variant="outline">Calendario</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      {r.ok ? <Badge variant="success">OK</Badge> : <Badge variant="outline">{reasonLabel(r.reason)}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">Ver JSON (debug)</summary>
            <pre className="mt-2 overflow-auto rounded-xl bg-muted/40 p-3 text-xs">
              {JSON.stringify(runResult, null, 2)}
            </pre>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
