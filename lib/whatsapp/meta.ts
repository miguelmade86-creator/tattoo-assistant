export async function sendWhatsAppTemplateMeta(params: {
  toE164: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
}) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const version = process.env.WHATSAPP_API_VERSION ?? "v20.0";

  if (!phoneNumberId || !token) {
    throw new Error("missing_meta_env");
  }

  const to = params.toE164
    .replace(/^whatsapp:/, "")
    .replace(/\s/g, "");

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode ?? "es" },
      components: params.components ?? [],
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json();

  if (!resp.ok) {
    throw new Error(json?.error?.message ?? "meta_send_failed");
  }

  return {
    messageId: (json?.messages?.[0]?.id as string | undefined) ?? undefined,
    raw: json,
  };
}
