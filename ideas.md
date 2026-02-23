# Brainstorm de Design — Mesa Ads Simulador Financeiro

## Contexto
Simulador financeiro interativo estilo SaaS para a Mesa Ads, empresa de mídia offline com coasters publicitários. A ferramenta deve transmitir credibilidade, profissionalismo e ser orientada a dados para tomada de decisão comercial e captação de investimento.

---

<response>
<text>
## Ideia 1: "Bloomberg Terminal Reimaginado"

**Design Movement:** Data-Dense Brutalism com toques de FinTech moderna

**Core Principles:**
- Densidade informacional alta sem sacrificar legibilidade
- Contraste extremo entre dados e espaço negativo
- Hierarquia visual por cor e peso tipográfico, não por bordas

**Color Philosophy:** Fundo escuro (slate-950) com acentos em verde-esmeralda (#10B981) para indicadores positivos e vermelho coral (#EF4444) para alertas. Amarelo âmbar (#F59E0B) para neutro. A paleta transmite seriedade financeira e confiança institucional.

**Layout Paradigm:** Layout de painel lateral fixo à esquerda com inputs, e área principal dividida em grid assimétrico de cards de dados. Inspirado em terminais financeiros mas com tipografia moderna.

**Signature Elements:**
- Números grandes em fonte mono com animação de contagem
- Indicadores de margem com barras de progresso coloridas
- Micro-sparklines inline nos KPIs

**Interaction Philosophy:** Feedback imediato — cada alteração de input recalcula tudo em tempo real com transições suaves nos números.

**Animation:** Contagem animada nos valores, fade-in sequencial nos cards, pulse sutil nos alertas de margem.

**Typography System:** JetBrains Mono para números/dados + DM Sans para labels e textos descritivos.
</text>
<probability>0.08</probability>
</response>

<response>
<text>
## Ideia 2: "Notion Meets Stripe Dashboard"

**Design Movement:** Minimalismo Funcional Escandinavo

**Core Principles:**
- Clareza absoluta — cada elemento tem propósito
- Espaçamento generoso entre seções
- Hierarquia por tamanho e peso, não por cor
- Sensação de ferramenta premium e confiável

**Color Philosophy:** Fundo branco quente (stone-50) com texto em grafite escuro. Cor primária em índigo profundo (#4F46E5) para ações e destaques. Verde sage (#059669) para métricas positivas, vermelho suave (#DC2626) para alertas. A paleta é contida e elegante, evocando confiança e sofisticação.

**Layout Paradigm:** Scroll vertical contínuo com seções bem delimitadas por espaço branco. Sidebar colapsável com inputs. Área principal com cards de largura variável em grid responsivo. Tabs para alternar entre visões (Tabelas / Gráficos / Cenários).

**Signature Elements:**
- Cards com sombra suave e borda fina
- Badges de status (margem OK / margem crítica)
- Tooltips informativos em cada métrica

**Interaction Philosophy:** Transições suaves e previsíveis. Hover states claros. Sliders para inputs numéricos com feedback visual imediato.

**Animation:** Slide-up suave ao entrar na viewport, transição de números com easing, hover lift nos cards.

**Typography System:** Plus Jakarta Sans para headings + Inter para corpo. Tabular nums para dados financeiros.
</text>
<probability>0.06</probability>
</response>

<response>
<text>
## Ideia 3: "Pitch Deck Interativo"

**Design Movement:** Neo-Corporate com influência de apresentações de captação

**Core Principles:**
- Visual que impressiona investidores
- Storytelling com dados — cada seção conta uma parte da história
- Gráficos como protagonistas visuais
- Sensação de produto maduro e escalável

**Color Philosophy:** Fundo em navy profundo (#0F172A) com gradientes sutis em azul-petróleo. Acentos em dourado/âmbar (#F59E0B) para métricas de destaque. Verde-menta (#34D399) para crescimento. A paleta evoca autoridade, ambição e sofisticação de startup séria.

**Layout Paradigm:** Full-width sections empilhadas verticalmente, cada uma como um "slide" do pitch. Hero section com KPIs principais. Seções alternando entre dados à esquerda/gráfico à direita e vice-versa.

**Signature Elements:**
- Gradientes sutis nos backgrounds de seção
- Números em destaque com fonte display grande
- Ícones geométricos minimalistas

**Interaction Philosophy:** Scroll-driven storytelling. Elementos aparecem conforme o usuário desce. Interatividade concentrada nos inputs e hover nos gráficos.

**Animation:** Fade-in com parallax suave, contagem animada nos números, gráficos que se desenham ao entrar na tela.

**Typography System:** Space Grotesk para headings + Outfit para corpo e dados.
</text>
<probability>0.07</probability>
</response>

---

## Decisão

Escolho a **Ideia 1: "Bloomberg Terminal Reimaginado"** — um design dark com alta densidade de dados, tipografia mono para números, e acentos em verde-esmeralda. Este estilo é o mais adequado para um simulador financeiro profissional, transmitindo seriedade e competência técnica. O layout com sidebar de inputs e grid de dados permite interação eficiente e visualização simultânea de múltiplas métricas.
