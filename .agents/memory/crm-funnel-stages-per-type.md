---
name: CRM funnel stages per lead type
description: Lead funnels are stage-set-per-type; which constant drives which lead type and where conversion fires.
---

The CRM has distinct kanban stage sets keyed off `leads.type`, not one generic funnel.

- `anunciante` leads → SDR/pre-sales funnel (`SDR_STAGES`): novo → em_cadencia → conectado → qualificacao_bant → reuniao_agendada → qualificado_handoff / desqualificado.
- `restaurante` leads → venue funnel (`VENUE_STAGES`): novo_mapeado → contato_inicial → visita_agendada → visita_realizada → negociacao → contrato_assinado → ativo_rede / perdido.
- `client/src/pages/Leads.tsx` switches via `stagesForType(type)` and `boardStages`; `ALL_STAGES` (union) is used for label/color lookup so a lead at any stage still renders.

**Conversion triggers (do not break these):**
- Restaurant: moving a lead to `ativo_rede` fires the existing `activeRestaurant.create` flow (convert dialog), and on success sets stage `ativo_rede` + `convertedToId`. The conversion logic itself is untouched — only the trigger stage + dialog opening were wired in.
- Anunciante: `qualificado_handoff` opens the closer handoff dialog (creates an opportunity).

**Why:** CRM restructure (series CRM 1–5) replaced the legacy generic 7-stage funnel (novo/contato/qualificado/proposta/negociacao/ganho/perdido). New leads must be created at the first stage of their type's set (`stagesForType(type)[0].key`), or they fall off the board.

**Partner portal** (`ParceiroLeads.tsx`): partner-referred leads are ALWAYS `type=anunciante` (hardcoded in `parceiroPortalRouter.createLead`), so its STAGES mirror `SDR_STAGES`. `getStageConfig` falls back to a raw-label badge for legacy/unknown stages so old leads (e.g. server `convertLeadToClient` still sets `ganho`) don't vanish.

**How to apply:** when touching lead stages, edit the right per-type constant and keep legacy stages mappable (a custom migration in `server/migrations.ts` remaps old restaurant stages → venue stages). Don't assume one global stage list.
