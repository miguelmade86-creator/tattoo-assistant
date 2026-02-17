export const runtime = "nodejs";

import { NextResponse } from "next/server";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET() {
  try {
    const baseUrl = mustEnv("APP_BASE_URL");
    const key = mustEnv("REMINDER_RUNNER_KEY");

    const resp = await fetch(`${baseUrl}/api/reminders/run`, {
      method: "POST",
      headers: {
        "x-reminder-key": key,
        "Content-Type": "application/json",
      },
      // body vacío (tu runner no lo necesita)
    });

    const json = await resp.json().catch(() => ({}));

    // Devuelve lo que respondió el runner
    return NextResponse.json(
      {
        ok: resp.ok,
        status: resp.status,
        upstream: json,
      },
      { status: resp.ok ? 200 : 500 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
