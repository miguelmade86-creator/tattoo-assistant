import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const key = req.headers.get("x-demo-key");
    if (!key || key !== mustEnv("DEMO_RESET_KEY")) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { artistId } = (await req.json().catch(() => ({}))) as { artistId?: string };
    if (!artistId) {
      return NextResponse.json({ ok: false, error: "artistId_required" }, { status: 400 });
    }

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // 1) Borrar citas demo
    const delAp = await admin
      .from("appointments")
      .delete()
      .ilike("notes", "DEMO:%")
      .select("id, client_id");

    if (delAp.error) throw new Error(delAp.error.message);

    // 2) Borrar clientes demo (por name o por prefijo de teléfono)
    const delClients = await admin
      .from("clients")
      .delete()
      .or("name.ilike.DEMO:%,phone.ilike.+34999%");

    if (delClients.error) throw new Error(delClients.error.message);

    // 3) Insertar clientes demo
    const demoClients = [
      { name: "DEMO: Carlos Gomez", phone: "+34999000111", consent_whatsapp: true },
      { name: "DEMO: Ana Martinez", phone: "+34999000222", consent_whatsapp: false },
      { name: "DEMO: Sin Telefono", phone: null, consent_whatsapp: true },
      { name: "DEMO: Duplicado 1", phone: "+34999000333", consent_whatsapp: true },
      { name: "DEMO: Duplicado 2", phone: "+34999000333", consent_whatsapp: true },
    ];

    const insClients = await admin.from("clients").insert(demoClients).select("id, name, phone, consent_whatsapp");
    if (insClients.error) throw new Error(insClients.error.message);

    const byName = new Map<string, any>();
    for (const c of insClients.data ?? []) byName.set(c.name, c);

    // Helper: crea ISO en UTC (Canary = UTC)
    const iso = (yyyy: number, mm: number, dd: number, hh: number, min: number) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${yyyy}-${pad(mm)}-${pad(dd)}T${pad(hh)}:${pad(min)}:00.000Z`;
    };

    // Fechas “vendibles”: mañana y pasado
    // (no dependemos del reloj del server para demo; pero si quieres dinámico lo hacemos luego)
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const d = now.getUTCDate();

    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
    const dayAfter = new Date(Date.UTC(y, m - 1, d + 2));

    const tY = tomorrow.getUTCFullYear();
    const tM = tomorrow.getUTCMonth() + 1;
    const tD = tomorrow.getUTCDate();

    const aY = dayAfter.getUTCFullYear();
    const aM = dayAfter.getUTCMonth() + 1;
    const aD = dayAfter.getUTCDate();

    // 4) Insertar citas demo con estados variados
    const appointments = [
      {
        client_id: byName.get("DEMO: Carlos Gomez")?.id,
        artist_id: artistId,
        start_time: iso(tY, tM, tD, 12, 0),
        end_time: iso(tY, tM, tD, 13, 0),
        tattoo_type: "Flash",
        body_part: "Brazo",
        price: 120,
        notes: "DEMO: WhatsApp OK (pending)",
        reminder_status: "pending",
        reminder_sent: false,
      },
      {
        client_id: byName.get("DEMO: Ana Martinez")?.id,
        artist_id: artistId,
        start_time: iso(tY, tM, tD, 15, 0),
        end_time: iso(tY, tM, tD, 16, 0),
        tattoo_type: "Custom",
        body_part: "Espalda",
        price: 200,
        notes: "DEMO: Sin consentimiento (skipped)",
        reminder_status: "skipped",
        reminder_sent: false,
        reminder_channel: "calendar",
        reminder_error: "no_consent_whatsapp",
      },
      {
        client_id: byName.get("DEMO: Sin Telefono")?.id,
        artist_id: artistId,
        start_time: iso(tY, tM, tD, 18, 0),
        end_time: iso(tY, tM, tD, 19, 0),
        tattoo_type: "Flash",
        body_part: "Pierna",
        price: 90,
        notes: "DEMO: Sin teléfono (skipped)",
        reminder_status: "skipped",
        reminder_sent: false,
        reminder_channel: "calendar",
        reminder_error: "missing_phone",
      },
      {
        client_id: byName.get("DEMO: Duplicado 1")?.id,
        artist_id: artistId,
        start_time: iso(aY, aM, aD, 11, 0),
        end_time: iso(aY, aM, aD, 12, 0),
        tattoo_type: "Flash",
        body_part: "Antebrazo",
        price: 110,
        notes: "DEMO: Enviado (sent)",
        reminder_status: "sent",
        reminder_sent: true,
        reminder_channel: "whatsapp",
        reminder_sent_at: new Date().toISOString(),
        reminder_provider: "mock",
        reminder_message_id: "demo-msg-001",
      },
    ];

    const insAp = await admin.from("appointments").insert(appointments).select("id");
    if (insAp.error) throw new Error(insAp.error.message);

    return NextResponse.json({
      ok: true,
      deleted_demo_appointments: delAp.data?.length ?? 0,
      inserted_demo_clients: insClients.data?.length ?? 0,
      inserted_demo_appointments: insAp.data?.length ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "unknown" }, { status: 500 });
  }
}
