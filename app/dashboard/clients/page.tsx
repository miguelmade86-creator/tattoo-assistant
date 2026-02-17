"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import EditClientModal from "@/components/dashboard/EditClientModal";

type ClientRow = {
  id: string;
  name: string | null;
  phone: string | null;
  consent_whatsapp: boolean | null;
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

function Chip({
  children,
  onClick,
  variant = "outline",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "outline" | "warning" | "danger";
  title?: string;
}) {
  const cls =
    variant === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
      : variant === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
      : "border-muted-foreground/25 bg-background hover:bg-muted/40";

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${cls}`}
    >
      {children}
    </button>
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "secondary" | "ghost";
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

function formatPhone(phone: string | null) {
  if (!phone) return "—";
  return phone.replace(/\s+/g, " ").trim();
}

function normalizePhoneForDup(phone: string | null) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.length ? cleaned : null;
}

async function copyToClipboard(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export default function ClientsPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [onlyWhatsappReady, setOnlyWhatsappReady] = useState(false);
  const [sortReadyFirst, setSortReadyFirst] = useState(true);

  const [toast, setToast] = useState<string | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);

  async function load() {
    const res = await supabase
      .from("clients")
      .select("id,name,phone,consent_whatsapp")
      .order("name", { ascending: true });

    if (res.error) {
      setError(res.error.message);
      setClients([]);
    } else {
      setError(null);
      setClients((res.data ?? []) as ClientRow[]);
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

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const stats = useMemo(() => {
    const total = clients.length;
    const withPhone = clients.filter((c) => !!c.phone).length;
    const withConsent = clients.filter((c) => !!c.consent_whatsapp).length;
    const whatsappReady = clients.filter(
      (c) => !!c.phone && !!c.consent_whatsapp
    ).length;
    const missingPhone = clients.filter((c) => !c.phone).length;
    const noConsent = clients.filter((c) => !c.consent_whatsapp).length;

    const map = new Map<string, number>();
    for (const c of clients) {
      const p = normalizePhoneForDup(c.phone);
      if (!p) continue;
      map.set(p, (map.get(p) ?? 0) + 1);
    }
    const dupPhones = Array.from(map.entries()).filter(([, n]) => n > 1);
    const dupCountClients = dupPhones.reduce((acc, [, n]) => acc + n, 0);

    return {
      total,
      withPhone,
      withConsent,
      whatsappReady,
      missingPhone,
      noConsent,
      dupPhones,
      dupCountClients,
    };
  }, [clients]);

  const [healthFilter, setHealthFilter] = useState<
    "all" | "missing_phone" | "no_consent" | "dup_phone"
  >("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const dupSet = new Set<string>();
    if (healthFilter === "dup_phone") {
      const counts = new Map<string, number>();
      for (const c of clients) {
        const p = normalizePhoneForDup(c.phone);
        if (!p) continue;
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
      for (const [p, n] of counts.entries()) {
        if (n > 1) dupSet.add(p);
      }
    }

    let list = clients.slice();

    list = list.filter((c) => {
      const hasPhone = !!c.phone;
      const hasConsent = !!c.consent_whatsapp;
      const waReady = hasPhone && hasConsent;

      if (onlyWhatsappReady && !waReady) return false;

      if (healthFilter === "missing_phone") return !hasPhone;
      if (healthFilter === "no_consent") return !hasConsent;
      if (healthFilter === "dup_phone") {
        const p = normalizePhoneForDup(c.phone);
        return !!p && dupSet.has(p);
      }
      return true;
    });

    list = list.filter((c) => {
      if (!query) return true;
      const name = (c.name ?? "").toLowerCase();
      const phone = (c.phone ?? "").toLowerCase();
      const id = (c.id ?? "").toLowerCase();
      return name.includes(query) || phone.includes(query) || id.includes(query);
    });

    if (sortReadyFirst) {
      list.sort((a, b) => {
        const aReady = !!a.phone && !!a.consent_whatsapp ? 1 : 0;
        const bReady = !!b.phone && !!b.consent_whatsapp ? 1 : 0;
        if (aReady !== bReady) return bReady - aReady;
        const an = (a.name ?? "").toLowerCase();
        const bn = (b.name ?? "").toLowerCase();
        return an.localeCompare(bn);
      });
    }

    return list;
  }, [clients, q, onlyWhatsappReady, sortReadyFirst, healthFilter]);

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
          <div className="text-2xl font-semibold">Clientes</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Logueado como{" "}
            <span className="font-medium text-foreground">{email}</span>
          </div>
          {error ? (
            <div className="mt-2 text-sm text-rose-700">Error: {error}</div>
          ) : null}
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
      {toast ? (
        <div className="rounded-xl border bg-background p-3 text-sm">
          {toast}
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card
          title="Total"
          subtitle="Clientes en sistema"
          right={<Badge variant="outline">clients</Badge>}
        >
          <div className="text-3xl font-semibold">{stats.total}</div>
        </Card>

        <Card
          title="Con teléfono"
          subtitle="Contactables"
          right={<Badge variant="outline">phone</Badge>}
        >
          <div className="text-3xl font-semibold">{stats.withPhone}</div>
        </Card>

        <Card
          title="Con consentimiento"
          subtitle="WhatsApp opt-in"
          right={<Badge variant="outline">consent</Badge>}
        >
          <div className="text-3xl font-semibold">{stats.withConsent}</div>
        </Card>

        <Card
          title="WhatsApp ready"
          subtitle="Teléfono + consentimiento"
          right={<Badge variant="warning">whatsapp</Badge>}
        >
          <div className="text-3xl font-semibold">{stats.whatsappReady}</div>
        </Card>

        <Card
          title="Duplicados"
          subtitle="Por teléfono"
          right={<Badge variant="outline">quality</Badge>}
        >
          <div className="text-3xl font-semibold">{stats.dupPhones.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Clientes afectados: {stats.dupCountClients}
          </div>
        </Card>

        <Card
          title="Sin datos"
          subtitle="Acciones recomendadas"
          right={<Badge variant="outline">cleanup</Badge>}
        >
          <div className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Falta teléfono</span>
              <span className="font-semibold">{stats.missingPhone}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Sin consentimiento</span>
              <span className="font-semibold">{stats.noConsent}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Health checklist */}
      <Card
        title="Health checklist"
        subtitle="Haz clic para filtrar y arreglar datos rápido"
        right={<Badge variant="outline">{filtered.length} resultados</Badge>}
      >
        <div className="flex flex-wrap gap-2">
          <Chip
            onClick={() => setHealthFilter("all")}
            variant={healthFilter === "all" ? "warning" : "outline"}
            title="Mostrar todo"
          >
            Todo
          </Chip>

          <Chip
            onClick={() => setHealthFilter("missing_phone")}
            variant={
              healthFilter === "missing_phone"
                ? "warning"
                : stats.missingPhone > 0
                ? "danger"
                : "outline"
            }
            title="Clientes sin teléfono (runner los omitirá para WhatsApp)"
          >
            Falta teléfono <span className="opacity-70">({stats.missingPhone})</span>
          </Chip>

          <Chip
            onClick={() => setHealthFilter("no_consent")}
            variant={
              healthFilter === "no_consent"
                ? "warning"
                : stats.noConsent > 0
                ? "danger"
                : "outline"
            }
            title="Clientes sin consentimiento (runner los omitirá para WhatsApp)"
          >
            Sin consentimiento{" "}
            <span className="opacity-70">({stats.noConsent})</span>
          </Chip>

          <Chip
            onClick={() => setHealthFilter("dup_phone")}
            variant={
              healthFilter === "dup_phone"
                ? "warning"
                : stats.dupPhones.length > 0
                ? "danger"
                : "outline"
            }
            title="Posibles duplicados (mismo teléfono)"
          >
            Duplicados por teléfono{" "}
            <span className="opacity-70">({stats.dupPhones.length})</span>
          </Chip>

          <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={onlyWhatsappReady}
                onChange={(e) => setOnlyWhatsappReady(e.target.checked)}
              />
              Solo WhatsApp ready
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={sortReadyFirst}
                onChange={(e) => setSortReadyFirst(e.target.checked)}
              />
              Ready primero
            </label>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:w-96">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre / teléfono / id…"
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-muted"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Consejo: empieza por{" "}
            <span className="font-medium text-foreground">Falta teléfono</span>{" "}
            y <span className="font-medium text-foreground">Sin consentimiento</span>{" "}
            para maximizar WhatsApp.
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">Teléfono</th>
                <th className="px-3 py-2 text-left font-medium">Consent</th>
                <th className="px-3 py-2 text-left font-medium">WhatsApp ready</th>
                <th className="px-3 py-2 text-left font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((c) => {
                const hasPhone = !!c.phone;
                const hasConsent = !!c.consent_whatsapp;
                const waReady = hasPhone && hasConsent;

                return (
                  <tr key={c.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{c.id}</span>
                      </div>
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      {hasPhone ? (
                        <span className="font-medium">{formatPhone(c.phone)}</span>
                      ) : (
                        <Badge variant="outline">Sin teléfono</Badge>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      {hasConsent ? (
                        <Badge variant="success">true</Badge>
                      ) : (
                        <Badge variant="outline">false</Badge>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      {waReady ? (
                        <Badge variant="warning">LISTO</Badge>
                      ) : hasConsent ? (
                        <Badge variant="outline">Falta teléfono</Badge>
                      ) : (
                        <Badge variant="outline">Falta consentimiento</Badge>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                          onClick={() => {
                            setSelectedClient(c);
                            setEditOpen(true);
                          }}
                        >
                          Editar
                        </button>

                        <button
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                          onClick={async () => {
                            await copyToClipboard(c.id);
                            setToast("✅ ID copiado");
                          }}
                        >
                          Copiar ID
                        </button>

                        <button
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                          disabled={!c.phone}
                          onClick={async () => {
                            await copyToClipboard(c.phone ?? "");
                            setToast("✅ Teléfono copiado");
                          }}
                        >
                          Copiar teléfono
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

        {/* Duplicates detail */}
        {stats.dupPhones.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Ver teléfonos duplicados ({stats.dupPhones.length})
            </summary>
            <div className="mt-2 rounded-xl border bg-muted/20 p-3 text-xs">
              {stats.dupPhones.slice(0, 30).map(([phone, n]) => (
                <div
                  key={phone}
                  className="flex items-center justify-between border-b last:border-b-0 py-1"
                >
                  <span className="font-mono">{phone}</span>
                  <Badge variant="danger">{n} clientes</Badge>
                </div>
              ))}

              {stats.dupPhones.length > 30 ? (
                <div className="mt-2 text-muted-foreground">
                  Mostrando 30 de {stats.dupPhones.length}. Usa el filtro “Duplicados por teléfono” + búsqueda.
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </Card>

      <EditClientModal
        open={editOpen}
        client={selectedClient}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          await load();
          setToast("✅ Cliente actualizado");
        }}
      />
    </div>
  );
}
