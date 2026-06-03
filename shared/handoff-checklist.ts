// Centralized rule for the "required qualification fields before handoff to closer".
// Reused by the SDR handoff dialog (frontend checklist) and the server mutation
// (interaction note + closer notification/email) so both agree on what is missing.

export interface HandoffLeadFields {
  name?: string | null;
  contactName?: string | null;
  cargo?: string | null;
  decisionRole?: string | null;
  produtoInteresse?: string | null;
  meetingScheduledAt?: Date | string | null;
  meetingLink?: string | null;
}

export type HandoffChecklistKey = "contato" | "produto" | "reuniao";

export interface HandoffChecklistItem {
  key: HandoffChecklistKey;
  label: string;
  filled: boolean;
  /** Sub-parts (already labeled) that are still missing for this item. */
  missingParts: string[];
}

function has(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/**
 * Returns the handoff qualification checklist for a lead, indicating which
 * required items are filled and which sub-parts are still missing.
 */
export function getHandoffChecklist(lead: HandoffLeadFields): HandoffChecklistItem[] {
  const contatoMissing: string[] = [];
  if (!has(lead.contactName) && !has(lead.name)) contatoMissing.push("nome do contato");
  if (!has(lead.cargo)) contatoMissing.push("cargo");
  if (!has(lead.decisionRole)) contatoMissing.push("papel na decisão");

  const reuniaoMissing: string[] = [];
  if (!has(lead.meetingScheduledAt)) reuniaoMissing.push("data/hora");
  if (!has(lead.meetingLink)) reuniaoMissing.push("link");

  const produtoMissing: string[] = has(lead.produtoInteresse) ? [] : ["produto de interesse"];

  return [
    {
      key: "contato",
      label: "Contato (nome, cargo e papel na decisão)",
      filled: contatoMissing.length === 0,
      missingParts: contatoMissing,
    },
    {
      key: "produto",
      label: "Produto de interesse",
      filled: produtoMissing.length === 0,
      missingParts: produtoMissing,
    },
    {
      key: "reuniao",
      label: "Reunião agendada (data/hora e link)",
      filled: reuniaoMissing.length === 0,
      missingParts: reuniaoMissing,
    },
  ];
}

/** Short labels of the items that are missing, for summaries/messages. */
export function getMissingHandoffLabels(lead: HandoffLeadFields): string[] {
  const labels: Record<HandoffChecklistKey, string> = {
    contato: "contato",
    produto: "produto de interesse",
    reuniao: "reunião",
  };
  return getHandoffChecklist(lead)
    .filter((item) => !item.filled)
    .map((item) => labels[item.key]);
}

/** True when every required handoff item is filled. */
export function isHandoffComplete(lead: HandoffLeadFields): boolean {
  return getHandoffChecklist(lead).every((item) => item.filled);
}
