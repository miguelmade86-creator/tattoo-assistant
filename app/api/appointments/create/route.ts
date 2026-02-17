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
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const u = await authClient.auth.getUser(token);
    if (u.error || !u.data.user) return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });

    const userId = u.data.user.id;

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    // perfil del que está creando (para obtener studio_id)
    const prof = await admin
      .from("profiles")
      .select("id,studio_id,role,user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (prof.error || !prof.data?.id || !prof.data?.studio_id) {
      return NextResponse.json({ ok: false, error: "profile_not_found" }, { status: 403 });
    }

    const body = (await req.json()) as {
      client_id: string;
      artist_id: string; // quién hace la cita
      start_time: string;
      end_time: string;
      tattoo_type?: string | null;
      body_part?: string | null;
      price?: number | null;
      notes?: string | null;
    };

    if (!body.client_id || !body.artist_id) {
      return NextResponse.json({ ok: false, error: "client_id_and_artist_id_required" }, { status: 400 });
    }
    if (!body.start_time || !body.end_time) {
      return NextResponse.json({ ok: false, error: "start_end_required" }, { status: 400 });
    }
    if (new Date(body.end_time).getTime() <= new Date(body.start_time).getTime()) {
      return NextResponse.json({ ok: false, error: "end_must_be_after_start" }, { status: 400 });
    }

    // Validar que el artist_id pertenece al mismo studio
    const artist = await admin
      .from("profiles")
      .select("id,studio_id")
      .eq("id", body.artist_id)
      .maybeSingle();

    if (artist.error || !artist.data?.id) return NextResponse.json({ ok: false, error: "artist_not_found" }, { status: 400 });
    if (artist.data.studio_id !== prof.data.studio_id) {
      return NextResponse.json({ ok: false, error: "artist_not_in_your_studio" }, { status: 403 });
    }

    const ins = await admin
      .from("appointments")
      .insert({
        client_id: body.client_id,
        artist_id: body.artist_id,
        start_time: body.start_time,
        end_time: body.end_time,
        tattoo_type: body.tattoo_type ?? null,
        body_part: body.body_part ?? null,
        price: body.price ?? null,
        notes: body.notes ?? null,

        // clave: siempre elegible
        reminder_status: "pending",
        reminder_sent: false,
        reminder_channel: null,
        reminder_sent_at: null,
        reminder_error: null,
        reminder_provider: null,
        reminder_message_id: null,
      })
      .select("id")
      .single();

    if (ins.error) throw new Error(ins.error.message);

    return NextResponse.json({ ok: true, appointment_id: ins.data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "unknown" }, { status: 500 });
  }
}
