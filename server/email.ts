import { Resend } from "resend";

// Infra de email transacional (Resend). Degradação graciosa: sem
// RESEND_API_KEY configurado, apenas logamos e seguimos — nunca lançamos,
// para não bloquear fluxos de negócio (ex.: handoff SDR → closer).

const FROM_FALLBACK = "Mesa Ads <onboarding@resend.dev>";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const client = getClient();
    if (!client) {
      console.warn(
        `[email] RESEND_API_KEY ausente — email "${params.subject}" não enviado (degradação graciosa).`,
      );
      return { sent: false, reason: "missing_api_key" };
    }

    const configuredFrom = process.env.RESEND_FROM;
    const from = configuredFrom || FROM_FALLBACK;
    if (!configuredFrom) {
      const warning =
        `[email] RESEND_FROM ausente — usando remetente de teste "${FROM_FALLBACK}". ` +
        `O Resend só entrega esse remetente ao dono da conta (403 para qualquer outro destinatário). ` +
        `Verifique um domínio no painel do Resend e defina RESEND_FROM para um endereço desse domínio.`;
      if (process.env.NODE_ENV === "production") {
        console.error(warning);
      } else {
        console.warn(warning);
      }
    }
    const { error } = await client.emails.send({
      from,
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error("[email] Falha ao enviar via Resend:", error);
      return { sent: false, reason: String((error as any)?.message ?? error) };
    }

    return { sent: true };
  } catch (err) {
    console.error("[email] Erro inesperado ao enviar email:", err);
    return { sent: false, reason: "exception" };
  }
}
