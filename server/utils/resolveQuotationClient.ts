import { eq } from "drizzle-orm";
import { quotations, clients, leads } from "../../drizzle/schema";

/**
 * Fonte única de verdade para resolver o cliente de uma cotação na conversão.
 *
 * Cotações nascidas de lead (checkout aberto / SDR) podem ter `leadId`
 * preenchido mas `clientId = NULL`. Tanto a assinatura pública quanto os
 * fluxos internos (`signOS`, `markWin`) precisam resolver esse cliente antes
 * de inserir em `campaigns` (cujo `clientId` é NOT NULL + FK).
 *
 * Comportamento:
 *  1. Se a cotação já tem `clientId`, retorna-o inalterado.
 *  2. Senão, se tem `leadId`: procura cliente existente pelo e-mail do lead;
 *     se não achar, cria um cliente a partir dos dados do lead.
 *  3. Grava o `clientId` resolvido de volta na cotação.
 *  4. Retorna o `clientId` resolvido, ou `null` quando não há como resolver
 *     (sem cliente e sem lead, ou lead inexistente).
 *
 * Aceita tanto a conexão `db` quanto uma transação `tx` (ambas expõem a mesma
 * API do Drizzle), permitindo uso dentro ou fora de transações.
 */
export async function resolveQuotationClientId(
  db: any,
  quotation: { id: number; clientId: number | null; leadId: number | null },
): Promise<number | null> {
  if (quotation.clientId) return quotation.clientId;
  if (!quotation.leadId) return null;

  const [lead] = await db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      cnpj: leads.cnpj,
      contactEmail: leads.contactEmail,
      contactPhone: leads.contactPhone,
    })
    .from(leads)
    .where(eq(leads.id, quotation.leadId));

  if (!lead) return null;

  let resolvedClientId: number | null = null;

  // Procura cliente existente pelo e-mail do lead.
  if (lead.contactEmail) {
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.contactEmail, lead.contactEmail))
      .limit(1);
    if (existing) resolvedClientId = existing.id;
  }

  // Se ainda não achou, cria um cliente a partir do lead.
  if (!resolvedClientId) {
    const [newClient] = await db
      .insert(clients)
      .values({
        name: lead.name || lead.company || "Cliente",
        company: lead.company,
        cnpj: lead.cnpj,
        contactEmail: lead.contactEmail,
        contactPhone: lead.contactPhone,
        status: "active",
      })
      .returning({ id: clients.id });
    resolvedClientId = newClient.id;
  }

  // Atualiza a cotação com o clientId resolvido.
  await db
    .update(quotations)
    .set({ clientId: resolvedClientId, updatedAt: new Date() })
    .where(eq(quotations.id, quotation.id));

  return resolvedClientId;
}
