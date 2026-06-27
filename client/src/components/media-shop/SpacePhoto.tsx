import { ImageOff } from "lucide-react";

/**
 * Fonte ÚNICA do placeholder "Foto em breve" exibido em qualquer superfície que
 * mostre um espaço sem foto (card do catálogo, popup do mapa, painel de detalhe).
 * Centralizado aqui para manter a identidade Mesa.ads consistente — se o design
 * mudar, muda só neste arquivo. Há duas saídas equivalentes:
 *   - <SpacePhotoPlaceholder> para superfícies React.
 *   - buildSpacePhotoPlaceholderEl() para o InfoWindow do Google Maps (DOM puro).
 * Ambas reusam a mesma classe-base e o mesmo rótulo abaixo.
 */
export const SPACE_PHOTO_PLACEHOLDER_LABEL = "Foto em breve";

const PLACEHOLDER_BASE_CLASS =
  "bg-gradient-to-br from-muted to-muted/40 flex flex-col items-center justify-center gap-1.5 text-muted-foreground";

/** SVG estático do ícone ImageOff (lucide) para a versão DOM do placeholder. */
const IMAGE_OFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg>`;

export function SpacePhotoPlaceholder({
  className,
  testId,
}: {
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={`${PLACEHOLDER_BASE_CLASS} ${className ?? ""}`}
      data-testid={testId}
    >
      <ImageOff className="h-7 w-7 opacity-50" />
      <span className="label-mono text-[10px]">{SPACE_PHOTO_PLACEHOLDER_LABEL}</span>
    </div>
  );
}

/**
 * Versão DOM do placeholder para uso fora do React (ex.: conteúdo do InfoWindow
 * do Google Maps, montado via document.createElement). Reusa a mesma classe-base
 * e rótulo do componente React acima — fonte única de estilo.
 */
export function buildSpacePhotoPlaceholderEl(
  className?: string,
  testId?: string,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `${PLACEHOLDER_BASE_CLASS} ${className ?? ""}`.trim();
  if (testId) el.setAttribute("data-testid", testId);
  el.innerHTML = IMAGE_OFF_SVG;
  const span = document.createElement("span");
  span.className = "label-mono text-[10px]";
  span.textContent = SPACE_PHOTO_PLACEHOLDER_LABEL;
  el.appendChild(span);
  return el;
}
