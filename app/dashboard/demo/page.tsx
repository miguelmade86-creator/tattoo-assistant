"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DemoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [artistId, setArtistId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }

      // buscamos profile por user_id (como ya haces en dashboard)
      const prof = await supabase
        .from("profiles")
        .select("id,user_id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();

      if (!alive) return;

      if (prof.error || !prof.data?.id) {
        setToast(`Error profile: ${prof.error?.message ?? "no profile"}`);
      } else {
        setArtistId(prof.data.id);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function resetDemo() {
    if (!artistId) return;

    try {
      setBusy(true);
      setToast(null);
      setLastResult(null);

      const resp = await fetch("/api/demo/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-key": "mi_demo_reset_key",
        },
        body: JSON.stringify({ artistId }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error ?? "unknown");

      setLastResult(json);
      setToast("✅ Demo reseteada. Ya puedes enseñar Clientes/Citas/Recordatorios.");
    } catch (e: any) {
      setToast(`Error demo: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-2xl font-semibold">Modo Demo</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Resetea e inserta datos demo para enseñar el producto sin tocar datos reales.
        </div>
      </div>

      {toast ? <div className="rounded-xl border bg-background p-3 text-sm">{toast}</div> : null}

      <div className="rounded-2xl border bg-background p-4">
        <div className="text-sm font-semibold">Reset demo</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Inserta: clientes con casos (OK / sin consentimiento / sin teléfono / duplicados) y citas con estados
          (pending / skipped / sent).
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="rounded-md border bg-foreground px-3 py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-60"
            disabled={!artistId || busy}
            onClick={resetDemo}
          >
            {busy ? "Reseteando…" : "Reset demo"}
          </button>

          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            onClick={() => router.push("/dashboard")}
          >
            Volver
          </button>
        </div>

        {lastResult ? (
          <pre className="mt-4 rounded-xl border bg-muted/20 p-3 text-xs">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="rounded-2xl border bg-muted/10 p-4 text-sm">
        <div className="font-medium">Checklist demo</div>
        <ul className="mt-2 list-disc pl-5 text-muted-foreground">
          <li>Ve a <b>Clientes</b> y filtra “Falta teléfono” / “Sin consentimiento” / “Duplicados”.</li>
          <li>Ve a <b>Citas</b> y prueba “Editar” (se resetea a pending).</li>
          <li>Ve a <b>Dashboard</b> y ejecuta el runner: debe pillar la cita demo pending.</li>
        </ul>
      </div>
    </div>
  );
}
