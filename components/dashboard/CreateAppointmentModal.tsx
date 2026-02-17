"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";

type ClientRow = { id: string; name: string | null; phone: string | null; consent_whatsapp: boolean | null };

function isoToDatetimeLocalUTC(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function datetimeLocalToISO_UTC(dt: string) {
  return dt ? `${dt}:00.000Z` : null;
}

export default function CreateAppointmentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState<string>("");

  const [artistId, setArtistId] = useState<string | null>(null);

  const [startLocal, setStartLocal] = useState(() => isoToDatetimeLocalUTC(new Date().toISOString()));
  const [endLocal, setEndLocal] = useState(() => isoToDatetimeLocalUTC(new Date(Date.now() + 60 * 60 * 1000).toISOString()));

  const [tattooType, setTattooType] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [price, setPrice] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        id: c.id,
        label: `${c.name ?? "—"} ${c.phone ? `· ${c.phone}` : ""}`.trim(),
      })),
    [clients]
  );

  useEffect(() => {
    if (!open) return;

    (async () => {
      setErr(null);

      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return;

      const prof = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
      if (!prof.error && prof.data?.id) setArtistId(prof.data.id);

      const c = await supabase.from("clients").select("id,name,phone,consent_whatsapp").order("name", { ascending: true });
      if (!c.error) {
        setClients((c.data ?? []) as ClientRow[]);
        if ((c.data ?? []).length && !clientId) setClientId((c.data ?? [])[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function create() {
    setSaving(true);
    setErr(null);

    try {
      if (!artistId) throw new Error("No artist/profile id");
      if (!clientId) throw new Error("Selecciona un cliente");

      const startISO = datetimeLocalToISO_UTC(startLocal);
      const endISO = datetimeLocalToISO_UTC(endLocal);
      if (!startISO || !endISO) throw new Error("Inicio/Fin obligatorios");
      if (new Date(endISO).getTime() <= new Date(startISO).getTime()) throw new Error("Fin debe ser mayor que inicio");

      const priceVal = price.trim() ? Number(price) : null;
      if (price.trim() && Number.isNaN(priceVal)) throw new Error("Precio inválido");

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("No session");

      const resp = await fetch("/api/appointments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          artist_id: artistId,
          start_time: startISO,
          end_time: endISO,
          tattoo_type: tattooType.trim() || null,
          body_part: bodyPart.trim() || null,
          price: priceVal,
          notes: notes.trim() || null,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error ?? "unknown");

      await onCreated();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Nueva cita" onClose={onClose}>
      <div className="space-y-4">
        {err ? <div className="rounded-xl border bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}

        <div className="rounded-xl border bg-muted/10 p-3 text-xs text-muted-foreground">
          Horas en <b>UTC (Canarias)</b>. La cita se crea con recordatorio en <b>pending</b>.
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Cliente</label>
          <select className="w-full rounded-xl border bg-background px-3 py-2 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clientOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Inicio</label>
            <input type="datetime-local" className="w-full rounded-xl border bg-background px-3 py-2 text-sm" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Fin</label>
            <input type="datetime-local" className="w-full rounded-xl border bg-background px-3 py-2 text-sm" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <input className="w-full rounded-xl border bg-background px-3 py-2 text-sm" value={tattooType} onChange={(e) => setTattooType(e.target.value)} placeholder="Flash / Custom…" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Zona</label>
            <input className="w-full rounded-xl border bg-background px-3 py-2 text-sm" value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} placeholder="Brazo…" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Precio</label>
            <input className="w-full rounded-xl border bg-background px-3 py-2 text-sm" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="120" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Notas</label>
          <textarea className="w-full rounded-xl border bg-background px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="rounded-md border px-3 py-2 text-sm hover:bg-muted" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="rounded-md border bg-foreground px-3 py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-60" onClick={create} disabled={saving}>
            {saving ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
