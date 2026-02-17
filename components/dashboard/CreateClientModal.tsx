"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";

export type CreateClientModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

export default function CreateClientModal(props: CreateClientModalProps) {
  const { open, onClose, onCreated } = props;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setSaving(true);
    setErr(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("No session");

      const resp = await fetch("/api/clients/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          phone: phone.trim() || null,
          consent_whatsapp: consent,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error ?? "unknown");

      await onCreated();
      onClose();
      setName("");
      setPhone("");
      setConsent(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Nuevo cliente" onClose={onClose}>
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
          Consentimiento WhatsApp
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
            onClick={create}
            disabled={saving}
          >
            {saving ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
