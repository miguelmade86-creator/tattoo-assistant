"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";

type ClientRow = {
  id: string;
  name: string | null;
  phone: string | null;
  consent_whatsapp: boolean | null;
};

export default function EditClientModal({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: ClientRow | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    setName(client.name ?? "");
    setPhone(client.phone ?? "");
    setConsent(!!client.consent_whatsapp);
    setErr(null);
  }, [client]);

  async function save() {
    if (!client) return;

    setSaving(true);
    setErr(null);

    try {
      const res = await supabase
        .from("clients")
        .update({
          name: name.trim() || null,
          phone: phone.trim() || null,
          consent_whatsapp: consent,
        })
        .eq("id", client.id);

      if (res.error) throw new Error(res.error.message);

      await onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Editar cliente" onClose={onClose}>
      {!client ? (
        <div className="text-sm text-muted-foreground">Sin cliente seleccionado.</div>
      ) : (
        <div className="space-y-4">
          {err ? (
            <div className="rounded-xl border bg-rose-50 p-3 text-sm text-rose-900">
              {err}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Nombre</label>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Teléfono</label>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34600111222"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Consentimiento para WhatsApp
          </label>

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
