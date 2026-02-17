export type WhatsAppProvider = "mock" | "meta";

export type SendResult =
  | { ok: true; provider: WhatsAppProvider; messageId?: string }
  | { ok: false; provider: WhatsAppProvider; error: string };

function hasMetaEnv() {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ACCESS_TOKEN &&
      // template name puede no existir aún en pruebas, pero si lo pones lo usamos
      (process.env.WHATSAPP_TEMPLATE_NAME ?? "appointment_reminder_24h")
  );
}

function getProvider(): WhatsAppProvider {
  const raw = (process.env.WHATSAPP_PROVIDER ?? "mock").toLowerCase();
  return raw === "meta" ? "meta" : "mock";
}

export async function sendWhatsAppReminder(params: {
  toE164: string;
  clientName?: string | null;
  startTimeISO: string;
  studioName?: string | null;
}): Promise<SendResult> {
  const provider = getProvider();

  // ✅ Mock: sin Meta, sin gasto (sirve para dev y para tener todo listo)
  if (provider === "mock") {
    return { ok: true, provider: "mock", messageId: "mock" };
  }

  // ✅ Meta seleccionado pero aún sin credenciales -> fallo controlado
  if (!hasMetaEnv()) {
    return { ok: false, provider: "meta", error: "missing_meta_env" };
  }

  // ✅ Meta real (import dinámico)
  // OJO: este path debe coincidir con el nombre real del archivo:
  // lib/whatsapp/meta.ts
  const mod = await import("./meta");
  const sendWhatsAppTemplateMeta = mod.sendWhatsAppTemplateMeta;

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "appointment_reminder_24h";

  const components = [
    {
      type: "body",
      parameters: [
        { type: "text", text: params.clientName ?? "cliente" },
        { type: "text", text: params.startTimeISO },
        { type: "text", text: params.studioName ?? "tu estudio" },
      ],
    },
  ];

  try {
    const sent = await sendWhatsAppTemplateMeta({
      toE164: params.toE164,
      templateName,
      languageCode: "es",
      components,
    });

    return { ok: true, provider: "meta", messageId: sent.messageId ?? undefined };
  } catch (e: any) {
    return { ok: false, provider: "meta", error: e?.message ?? "meta_send_failed" };
  }
}
