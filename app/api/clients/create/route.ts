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

    // 1) Validar usuario con anon (no service role)
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const u = await authClient.auth.getUser(token);
    if (u.error || !u.data.user) return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });

    // 2) Insert con service role
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const body = (await req.json()) as {
      name?: string | null;
      phone?: string | null;
      consent_whatsapp?: boolean | null;
    };

    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

    const res = await admin
      .from("clients")
      .insert({
        name,
        phone: body.phone ? body.phone.trim() : null,
        consent_whatsapp: !!body.consent_whatsapp,
      })
      .select("id,name,phone,consent_whatsapp")
      .single();

    if (res.error) throw new Error(res.error.message);

    return NextResponse.json({ ok: true, client: res.data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "unknown" }, { status: 500 });
  }
}
