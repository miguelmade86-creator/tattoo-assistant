"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/ui/Modal";

type AppointmentEditRow = {
  id: string;
  start_time: string;
  end_time: string;
  tattoo_type: string | null;
  body_part: string | null;
  price: number | null;
  notes: string | null;
};

function isoToDatetimeLocalUTC(iso: string) {
  // Convierte ISO -> "YYYY-MM-DDTHH:mm" usando UTC (para que sea "hora Canarias")
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function datetimeLocalToISO_UTC(dt: string) {
  // dt viene como "YYYY-MM-DDTHH:mm"
  // lo interpretamos como UTC y guardamos con Z (perfecto para Canary)
  if (!dt) return null;
  return `${dt}:00.000Z`;
}

export default function EditAppointmentModal({
  open,
  appointment,
  onClose,
  onSaved,
}: {
  open: boolean;
  appointment: AppointmentEditRow | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [tattooType, setTattooType] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [price, setPrice] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!appointment) return;
    setStartLocal(isoToDatetimeLocalUTC(appointment.start_time));
    setEndLocal(isoToDatetimeLocalUTC(appointment.end_time));
    setTattooType(appointment.tattoo_type ?? "");
    setBodyPart(appointment.body_part ?? "");
    setPrice(appointment.price == null ? "" : String(appointment.price));
    setNotes(appointment.notes ?? "");
    setErr(null);
  }, [appointment]);

  async function save() {
    if (!appointment) return;

    setSaving(true);
    setErr(null);

    try {
      const startISO = datetimeLocalToISO_UTC(startLocal);
      const endISO = datetimeLocalToISO_UTC(endLocal);

      if (!startISO || !endISO) throw new Error("Inicio/Fin obligatorios.");
      if (new Date(endISO).getTime() <= new Date(startISO).getTime()) {
        throw new Error("La hora de fin debe ser mayor que la de inicio.");
      }

      const priceVal = price.trim() ? Number(price) : null;
      if (price.trim() && Number.isNaN(priceVal)) throw new Error("Precio inválido.");

      // 🔁 Reset de recordatorio para que el runner la vuelva a coger
      const res = await supabase
        .from("appointments")
        .update({
          start_time: startISO,
          end_time: endISO,
          tattoo_type: tattooType.trim() || null,
          body_part: bodyPart.trim() || null,
          price: priceVal,
          notes: notes.trim() || null,

          reminder_status: "pending",
          reminder_sent: false,
          reminder_channel: null,
          reminder_sent_at: null,
          reminder_error: null,
          reminder_provider: null,
          reminder_message_id: null,
        })
        .eq("id", appointment.id);

      if (res.error) throw new Error(res.error.message);

      await onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message ?? "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Editar cita" onClose={onClose}>
      {!appointment ? (
        <div className="text-sm text-muted-foreground">Sin cita seleccionada.</div>
      ) : (
        <div className="space-y-4">
          {err ? (
            <div className="rounded-xl border bg-rose-50 p-3 text-sm text-rose-900">
              {err}
            </div>
          ) : null}

          <div className="rounded-xl border bg-muted/10 p-3 text-xs text-muted-foreground">
            Horas en <b>UTC (Canarias)</b>. Al guardar, el recordatorio se reinicia a{" "}
            <b>pending</b>.
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Inicio</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Fin</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={tattooType}
                onChange={(e) => setTattooType(e.target.value)}
                placeholder="Flash / Custom…"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Zona</label>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={bodyPart}
                onChange={(e) => setBodyPart(e.target.value)}
                placeholder="Brazo…"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Precio</label>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="numeric"
                placeholder="120"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Notas</label>
            <textarea
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles de la cita…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              className="rounded-md border bg-foreground px-3 py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-60"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
