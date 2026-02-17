export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { sendWhatsAppReminder } from "@/lib/whatsapp";

export async function POST(req: Request) {
  try {
    // 🔒 Protección por key (cron / producción)
    const auth = req.headers.get("x-reminder-key");
    const expected = process.env.REMINDER_RUNNER_KEY;
    if (expected && auth !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // 🕒 Ventana 48h exactas (cron hourly) en Canarias
    const tz = "Atlantic/Canary";
    const nowCanary = DateTime.now().setZone(tz);

    // Ventana: hora exacta a +48h, redondeada al inicio de hora.
    // Ej: si ahora 10:23, buscamos citas entre (now+48h => 10:00) y 10:59:59.999
    const windowStart = nowCanary.plus({ hours: 48 }).startOf("hour");
    const windowEnd = windowStart.plus({ hours: 1 }).minus({ milliseconds: 1 });

    // DB es timestamptz: comparamos en UTC
    const startISO = windowStart.toUTC().toISO();
    const endISO = windowEnd.toUTC().toISO();

    // 🚀 Query: solo pendientes (más rápido y estable que in(['pending', null]))
    const { data: appts, error: qErr } = await admin
      .from("appointments")
      .select(
        `
        id,
        start_time,
        client:clients!appointments_client_id_fkey ( id, name, phone, consent_whatsapp )
      `
      )
      .gte("start_time", startISO!)
      .lte("start_time", endISO!)
      .eq("reminder_status", "pending")
      .order("start_time", { ascending: true });

    if (qErr) {
      return NextResponse.json({ error: qErr.message, code: qErr.code }, { status: 400 });
    }

    const results: any[] = [];

    for (const a of appts ?? []) {
      const client = Array.isArray((a as any).client) ? (a as any).client[0] : (a as any).client;

      const phone: string | null = client?.phone ?? null;
      const consent = client?.consent_whatsapp === true;
      const canWhatsApp = !!phone && consent;

      if (canWhatsApp) {
        // ✅ Envío vía provider (mock o meta)
        const send = await sendWhatsAppReminder({
          toE164: phone,
          clientName: client?.name ?? null,
          startTimeISO: a.start_time,
          studioName: "Ink Masters", // TODO: sacar del studio real
        });

        if (send.ok) {
          const { error: uErr } = await admin
            .from("appointments")
            .update({
              reminder_status: "sent",
              reminder_channel: "whatsapp",
              reminder_provider: send.provider, // "mock" | "meta"
              reminder_message_id: send.messageId ?? null,
              reminder_sent_at: new Date().toISOString(),
              reminder_error: null,
            })
            .eq("id", a.id);

          results.push({
            start_time: a.start_time,
            client_name: client?.name ?? null,
            client_phone: phone,
            consent_whatsapp: consent,
            action: send.provider === "mock" ? "SIMULATED_SEND" : "SEND",
            channel: "whatsapp",
            reason: null,
            ok: !uErr,
            error: uErr?.message ?? null,
          });
        } else {
          // ✅ Si falla, dejamos pending para reintento (no marcamos sent)
          const { error: uErr } = await admin
            .from("appointments")
            .update({
              reminder_status: "pending",
              reminder_channel: "whatsapp",
              reminder_provider: send.provider,
              reminder_message_id: null,
              reminder_error: send.error,
            })
            .eq("id", a.id);

          results.push({
            start_time: a.start_time,
            client_name: client?.name ?? null,
            client_phone: phone,
            consent_whatsapp: consent,
            action: "SEND",
            channel: "whatsapp",
            reason: null,
            ok: false,
            error: send.error || uErr?.message || "send_failed",
          });
        }
      } else {
        const reason = !phone ? "missing_phone" : "no_consent_whatsapp";

        const { error: uErr } = await admin
          .from("appointments")
          .update({
            reminder_status: "skipped",
            reminder_channel: "calendar_only",
            reminder_sent_at: null,
            reminder_error: reason,
          })
          .eq("id", a.id);

        results.push({
          start_time: a.start_time,
          client_name: client?.name ?? null,
          client_phone: phone,
          consent_whatsapp: consent,
          action: "SKIPPED",
          channel: "calendar_only",
          reason,
          ok: !uErr,
          error: uErr?.message ?? null,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      tz,
      now: nowCanary.toISO(),
      window: {
        startISO,
        endISO,
        windowStartLocal: windowStart.toISO(),
        windowEndLocal: windowEnd.toISO(),
      },
      count: results.length,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
