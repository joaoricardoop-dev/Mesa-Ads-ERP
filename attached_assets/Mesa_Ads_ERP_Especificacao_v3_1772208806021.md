# Mesa Ads — Especificação do ERP (v3)

> Reestruturação do sistema existente (React/Next.js)
> Documento de referência para desenvolvimento
> v3 — Fluxo automático de campanhas revisado

---

## 1. VISÃO GERAL DA ARQUITETURA

### Navegação Principal: Sidebar (barra lateral)

Substituir o menu superior atual por sidebar fixa com os seguintes módulos:

```
🏠 Dashboard (Home)
📊 Comercial
📋 Campanhas
📢 Anunciantes
🖼️ Biblioteca
⚙️ Configurações
```

> **Nota:** O cadastro de restaurantes/parceiros permanece como já está na plataforma do Replit. Não há mudanças nesse módulo — ele continua funcionando com a mesma estrutura, campos e fluxo atuais. Se já existe um item na sidebar para parceiros, ele permanece inalterado.

A sidebar deve ter:
- Ícone + label em cada item
- Indicadores visuais de notificação (ex.: "3 cotações pendentes", "2 campanhas aguardando arte")
- Modo colapsado (só ícones) para telas menores
- Usuário logado + perfil no rodapé da sidebar

---

## 2. MÓDULO: DASHBOARD (Home)

A tela inicial do sistema. Visão executiva de tudo que está acontecendo.

### 2.1 Cards de Status Operacional (topo)

| Card | O que mostra | Filtra para |
|------|-------------|-------------|
| Cotações Ativas | Qtd de cotações em aberto (não convertidas) | Lista de cotações com status "ativa" |
| Em Produção | Campanhas no status "Produção" (aguardando upload de arte) | Campanhas filtradas por status |
| Em Trânsito | Campanhas no status "Trânsito" (OS de produção gráfica gerada, material sendo produzido/enviado) | Campanhas filtradas por status |
| Executar | Campanhas no status "Executar" (material chegou, pronto para distribuir) | Campanhas filtradas por status |
| Em Veiculação | Campanhas ativas nos restaurantes neste momento | Campanhas filtradas por status |

Cada card é clicável e leva para a lista filtrada no módulo Campanhas.

### 2.2 Pipeline Visual

Barra horizontal mostrando o volume em cada status:

```
Cotação → Produção → Trânsito → Executar → Em Veiculação → Inativa
  12         5           3          2            8             22
```

### 2.3 Métricas Financeiras

- **Faturamento do mês** (realizado vs. meta)
- **Faturamento acumulado** (últimos 6 meses, gráfico de barras)
- **Custo operacional do mês** (produção + frete + remuneração parceiros)
- **Margem bruta** (faturamento - custo operacional)
- **Inadimplência** (valor em aberto vencido)

### 2.4 Projeções e Forecast

- **Pipeline comercial valorado:** soma das cotações ativas × probabilidade de fechamento
- **Receita projetada próximos 3 meses:** baseada em campanhas confirmadas + pipeline ponderado
- **Forecast de capacidade:** mesas disponíveis na rede vs. mesas alocadas → % de ocupação

### 2.5 Atividade Recente

Feed cronológico dos últimos eventos:
- "Cotação #047 convertida em WIN → Campanha CMP-2026-0047 criada"
- "Campanha CMP-2026-0031 — arte aprovada, OS de produção gerada"
- "Campanha CMP-2026-0019 — material chegou, status: Executar"
- "Campanha CMP-2026-0012 — finalizada, dados arquivados na Biblioteca"

---

## 3. MÓDULO: COMERCIAL

Tudo que envolve vendas, relacionamento e geração de negócios.

### 3.1 Submenu

```
Comercial
├── Cotações
├── Simulador
├── Leads
├── Cadastro de Anunciantes
├── OS para Anunciantes
└── Termos para Restaurantes
```

> **Nota:** O cadastro de restaurantes NÃO fica aqui. Ele permanece como está no Replit, sem alterações.

### 3.2 Cotações

**Lista de cotações** com filtros: status (rascunho, enviada, ativa, win, perdida, expirada), anunciante, data, valor.

**Status da cotação:**

```
Rascunho → Enviada → Ativa (aguardando resposta) → WIN ✓ / Perdida ✗ / Expirada ⏰
```

**Criar nova cotação:**

| Campo | Descrição |
|-------|-----------|
| Anunciante | Selecionar do cadastro ou criar novo |
| Tipo de campanha | Padrão / Premium / Personalizada |
| Volume de coasters | Quantidade total |
| Perfil de rede | Alto giro / Premium / Mix |
| Número de ciclos | 1 batch (4 semanas) ou múltiplos |
| Regiões/Cidades | Onde a campanha será veiculada |
| Valor unitário | Preço por coaster ou por mesa/ciclo |
| Valor total | Calculado automaticamente |
| Inclui produção? | Sim/Não (se o anunciante fornece o material pronto) |
| Observações | Campo livre |
| Validade da cotação | Data limite para aprovação |

**Ações na cotação:**
- Gerar PDF da proposta comercial
- Enviar por e-mail ao anunciante
- Marcar como WIN (dispara conversão automática — ver seção 4)
- Marcar como Perdida (com motivo)
- Duplicar cotação
- Histórico de alterações

### 3.3 Simulador

O simulador atual, realocado como ferramenta dentro do módulo Comercial.

**Funcionalidade principal:** O vendedor monta cenários de campanha rapidamente, testando combinações de volume, rede e preço. O resultado pode ser salvo como rascunho de cotação.

**Fluxo:** Simulador → "Salvar como cotação" → preenche automaticamente os campos da cotação.

### 3.4 Leads (Kanban + CRM)

**Dois kanbans separados:**

**Kanban de Leads — Anunciantes:**

```
Novo Lead → Contato Inicial → Proposta Enviada → Negociação → Fechado ✓ / Perdido ✗
```

**Kanban de Leads — Restaurantes:**

```
Novo Lead → Contato Inicial → Visita/Qualificação → Cadastro → Ativo ✓ / Descartado ✗
```

**Ficha do Lead (CRM):**
- Nome / Razão Social
- Contato principal (nome, telefone, e-mail, WhatsApp)
- Origem do lead (indicação, prospecção ativa, inbound, evento)
- Histórico de interações (registro de cada contato feito, com data e anotação)
- Próximo follow-up agendado
- Responsável (qual vendedor/operador está cuidando)
- Tags / Categorias
- Documentos anexados

### 3.5 Cadastro de Anunciantes

**Ficha completa do anunciante:**

| Seção | Campos |
|-------|--------|
| Dados da empresa | Razão social, CNPJ, nome fantasia, segmento/categoria |
| Contato principal | Nome, cargo, e-mail, telefone, WhatsApp |
| Contatos adicionais | Lista de contatos secundários |
| Endereço | Endereço completo para faturamento |
| Dados bancários/fiscais | Dados para emissão de NF |
| Histórico comercial | Lista de cotações, campanhas, valores totais |
| Status | Ativo / Inativo / Prospect |
| Observações | Campo livre |

### 3.6 Cadastro de Restaurantes/Parceiros

> **⚠️ SEM ALTERAÇÕES. Manter exatamente como está na plataforma do Replit.**
> Este módulo não faz parte do escopo de reestruturação. A estrutura de campos, o fluxo de cadastro e a interface existente permanecem inalterados.

### 3.7 Geração de OS para Anunciantes

Ordem de Serviço que formaliza o que foi contratado pelo anunciante.

**Dados da OS:**
- Número da OS (automático)
- Anunciante (do cadastro)
- Campanha vinculada
- Descrição do serviço
- Volume de coasters
- Rede alocada (lista de restaurantes ou perfil)
- Período de veiculação (data início - data fim)
- Valor total
- Condições de pagamento
- Status: Rascunho → Enviada → Assinada → Em execução → Concluída

**Ações:** Gerar PDF, enviar por e-mail, registrar assinatura.

### 3.8 Geração de Termos para Restaurantes

Termo de parceria/adesão do restaurante à rede.

**Dados do Termo:**
- Número do termo (automático)
- Restaurante (do cadastro existente no Replit)
- Condições gerais da parceria
- Regra de remuneração
- Categorias permitidas/bloqueadas
- Obrigações do restaurante (uso dos coasters, fotos de comprovação)
- Obrigações da Mesa Ads (entrega de material, pagamento)
- Vigência
- Status: Rascunho → Enviado → Assinado → Vigente → Encerrado

**Ações:** Gerar PDF do termo, enviar por e-mail, registrar assinatura.

---

## 4. MÓDULO: CAMPANHAS — FLUXO AUTOMÁTICO COMPLETO

Este é o coração operacional do ERP. O fluxo é **sequencial e automatizado**: cada ação do usuário dispara a transição para o próximo status.

### 4.0 Status da Campanha (definição)

| Status | Significado | Cor sugerida |
|--------|-------------|--------------|
| **Produção** | Campanha criada, aguardando upload de arte (PDF técnico + imagens) | 🟡 Amarelo |
| **Trânsito** | Arte aprovada, OS de produção gráfica gerada, material sendo produzido e enviado | 🟠 Laranja |
| **Executar** | Material chegou, pronto para ser distribuído nos restaurantes | 🔵 Azul |
| **Em Veiculação** | Coasters nas mesas, campanha ativa | 🟢 Verde |
| **Inativa** | Campanha finalizada, dados arquivados na Biblioteca | ⚫ Cinza |

### 4.1 Numeração Única de Campanhas

Toda campanha recebe um **número único sequencial** gerado automaticamente no momento da conversão:

**Formato:** `CMP-[ANO]-[SEQUENCIAL com 4 dígitos]`

**Exemplos:**
- CMP-2026-0001
- CMP-2026-0002
- CMP-2026-0147

O número é imutável e serve como identificador principal em todas as OS, relatórios e referências.

---

### 4.2 PASSO 1: Conversão da Cotação em WIN → Cria Campanha

**Trigger:** Usuário marca a cotação como "WIN" no módulo Comercial.

**O que o sistema faz automaticamente:**

1. Muda o status da cotação para **WIN**
2. Cria uma nova **Campanha** com número único (CMP-YYYY-NNNN)
3. Puxa todos os dados da cotação para a ficha da campanha:
   - Anunciante
   - Volume de coasters
   - Perfil de rede
   - Regiões
   - Número de ciclos
   - Valor
   - Observações
4. Define o status inicial da campanha como **"Produção"**
5. Registra no log: "Campanha CMP-YYYY-NNNN criada a partir da Cotação #XXX"
6. Notifica o usuário/equipe de operações: "Nova campanha aguardando arte"

**Dados da ficha da campanha (criada automaticamente):**

| Seção | Informações |
|-------|-------------|
| Identificação | Nº da campanha (CMP-YYYY-NNNN), nome/descrição, anunciante |
| Origem | Nº da cotação de origem, data de conversão |
| Dados comerciais | Volume, perfil de rede, regiões, ciclos, valor |
| Rede alocada | Lista de restaurantes (preenchida depois, conforme necessidade) |
| Arquivos de arte | Vazio neste momento — aguardando upload |
| Timeline | Data de criação, datas das transições de status |
| Status atual | **Produção** |
| OS vinculadas | Nenhuma ainda |

---

### 4.3 PASSO 2: Status "Produção" — Upload de Arte

**O que aparece para o usuário:**

A página da campanha mostra uma área de upload com indicação clara do que é necessário:

```
┌─────────────────────────────────────────────────────────┐
│  CAMPANHA CMP-2026-0047 — Status: PRODUÇÃO              │
│  Anunciante: Marca X                                     │
│                                                          │
│  📎 Upload de Arquivos de Arte                           │
│  ┌──────────────────────────────────────────────┐        │
│  │                                              │        │
│  │   📄 PDF Técnico (arquivo para gráfica)      │        │
│  │   Status: ⏳ Pendente                        │        │
│  │   [Fazer upload]                             │        │
│  │                                              │        │
│  │   🖼️ Imagens do Coaster Aprovado             │        │
│  │   (PNG e/ou JPG — arte final aprovada)       │        │
│  │   Status: ⏳ Pendente                        │        │
│  │   [Fazer upload]                             │        │
│  │                                              │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│  [Concluir etapa de Produção →]  (desabilitado até       │
│   todos os uploads estarem completos)                    │
└─────────────────────────────────────────────────────────┘
```

**Regras:**
- O botão "Concluir etapa de Produção" só fica habilitado quando:
  - ✅ Pelo menos 1 arquivo PDF técnico foi enviado
  - ✅ Pelo menos 1 arquivo de imagem (PNG ou JPG) foi enviado
- O usuário pode fazer upload de múltiplos arquivos de cada tipo
- Cada upload registra: nome do arquivo, tamanho, data/hora, usuário que enviou
- Preview do arquivo é exibido após upload (thumbnail para imagens, ícone para PDF)

**Ao clicar "Concluir etapa de Produção":**

O sistema executa automaticamente o PASSO 3.

---

### 4.4 PASSO 3: Transição para "Trânsito" — Geração Automática de OS de Produção Gráfica

**Trigger:** Usuário clica "Concluir etapa de Produção" (com todos os uploads completos).

**O que o sistema faz automaticamente:**

1. Muda o status da campanha para **"Trânsito"**
2. Gera uma **OS de Produção Gráfica** com os seguintes dados:

**OS de Produção Gráfica — Estrutura:**

| Campo | Valor |
|-------|-------|
| Nº da OS | Automático (OS-PROD-YYYY-NNNN) |
| Campanha vinculada | CMP-YYYY-NNNN |
| Anunciante | [Nome do anunciante] |
| Descrição | Produção de [X] coasters para campanha [CMP-YYYY-NNNN] |
| Quantidade | [Volume total de coasters da campanha] |
| Especificações técnicas | Formato padrão coaster, material, acabamento (campos configuráveis) |
| **PDF Técnico anexado** | ✅ O PDF enviado na etapa anterior é automaticamente anexado à OS |
| **Imagens de referência anexadas** | ✅ Os arquivos PNG/JPG enviados são automaticamente anexados à OS |
| Prazo estimado | [Configurável ou preenchido manualmente] |
| Fornecedor gráfico | [Se aplicável — campo opcional] |
| Status da OS | Gerada |
| Data de geração | Automática |

3. Registra no log: "OS de Produção OS-PROD-YYYY-NNNN gerada para campanha CMP-YYYY-NNNN"
4. Os arquivos (PDF + imagens) ficam acessíveis diretamente na OS para download

**O que o usuário vê na página da campanha durante o status "Trânsito":**

```
┌─────────────────────────────────────────────────────────┐
│  CAMPANHA CMP-2026-0047 — Status: TRÂNSITO              │
│                                                          │
│  📦 Material em produção/trânsito                        │
│                                                          │
│  OS de Produção: OS-PROD-2026-0047                       │
│  📄 PDF Técnico: coaster_marca_x_v2.pdf  [Baixar]       │
│  🖼️ Imagens: coaster_frente.png, coaster_verso.jpg      │
│                                                          │
│  Quantidade: 5.000 coasters                              │
│  Fornecedor: [se preenchido]                             │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │  O material chegou?                          │        │
│  │  [✅ Confirmar chegada do material]           │        │
│  └──────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**Ao clicar "Confirmar chegada do material":**

O sistema executa automaticamente o PASSO 4.

---

### 4.5 PASSO 4: Transição para "Executar"

**Trigger:** Usuário confirma que o material chegou.

**O que o sistema faz automaticamente:**

1. Muda o status da campanha para **"Executar"**
2. Registra a data de chegada do material
3. Registra no log: "Material da campanha CMP-YYYY-NNNN recebido. Status: Executar"

**O que o usuário vê:**

Neste status, a campanha está pronta para ser distribuída nos restaurantes. A página mostra:

```
┌─────────────────────────────────────────────────────────┐
│  CAMPANHA CMP-2026-0047 — Status: EXECUTAR               │
│                                                          │
│  🏪 Distribuição para restaurantes                       │
│                                                          │
│  Restaurantes alocados: [lista / ou campo para alocar]   │
│                                                          │
│  Aqui o usuário pode:                                    │
│  - Alocar restaurantes da rede à campanha                │
│  - Definir quantidade de coasters por restaurante        │
│  - Gerar OS de entrega por restaurante (opcional)        │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │  Distribuição concluída? Iniciar veiculação.  │        │
│  │  [▶️ Iniciar Veiculação]                      │        │
│  └──────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**Ações disponíveis neste status:**
- Alocar restaurantes à campanha (selecionar do cadastro existente no Replit)
- Definir quantidade de coasters por restaurante
- Gerar OS de entrega para cada restaurante (com endereço, quantidade, campanha de referência)

**Ao clicar "Iniciar Veiculação":**

O sistema executa automaticamente o PASSO 5.

---

### 4.6 PASSO 5: Transição para "Em Veiculação"

**Trigger:** Usuário clica "Iniciar Veiculação".

**O que o sistema faz automaticamente:**

1. Muda o status da campanha para **"Em Veiculação"**
2. Registra a **data de início da veiculação**
3. Calcula automaticamente a **data de fim** (data de início + 4 semanas)
4. Registra no log: "Campanha CMP-YYYY-NNNN em veiculação. Início: DD/MM/YYYY. Fim previsto: DD/MM/YYYY"

**O que o usuário vê durante a veiculação:**

```
┌─────────────────────────────────────────────────────────┐
│  CAMPANHA CMP-2026-0047 — Status: EM VEICULAÇÃO  🟢     │
│                                                          │
│  📅 Início: 01/03/2026                                   │
│  📅 Fim previsto: 29/03/2026                             │
│  ⏳ Progresso: ████████░░░░ Semana 2 de 4                │
│                                                          │
│  🏪 Restaurantes ativos: 15                              │
│  📸 Provas de execução:                                  │
│  ┌────────────┬──────┬──────┬──────┬──────┐              │
│  │Restaurante │ S1   │ S2   │ S3   │ S4   │              │
│  │Bar do Zé   │ ✅   │ ✅   │ ⏳   │ —    │              │
│  │Cantina Boa │ ✅   │ ⏳   │ —    │ —    │              │
│  └────────────┴──────┴──────┴──────┴──────┘              │
│                                                          │
│  [📸 Registrar comprovação]                              │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │  [🏁 Finalizar Campanha]                     │        │
│  │  (habilitado a qualquer momento, sugerido     │        │
│  │   após semana 4)                              │        │
│  └──────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**Funcionalidades durante "Em Veiculação":**
- Upload de fotos de comprovação por restaurante, organizadas por semana
- Barra de progresso visual (semana atual / 4 semanas)
- Alertas: se um restaurante não tem foto registrada na semana, aparece flag
- O botão "Finalizar Campanha" fica disponível a qualquer momento, mas é destacado quando o prazo de 4 semanas é atingido

**Ao clicar "Finalizar Campanha":**

O sistema executa automaticamente o PASSO 6.

---

### 4.7 PASSO 6: Transição para "Inativa" — Finalização e Arquivamento

**Trigger:** Usuário clica "Finalizar Campanha".

**O que o sistema faz automaticamente:**

1. Muda o status da campanha para **"Inativa"**
2. Registra a **data de finalização real**
3. **Arquiva os dados da campanha na Biblioteca:**
   - Cria um registro na Biblioteca de Coasters com:
     - Thumbnail(s) gerado(s) a partir das imagens enviadas na etapa de Produção
     - Anunciante vinculado
     - Nº da campanha de origem
     - Arquivos: PDF técnico + PNG/JPG (os mesmos da etapa de produção)
     - Status: "Arquivado"
     - Tags automáticas: nome do anunciante, período, regiões
   - Se o coaster já existe na Biblioteca (mesma arte reutilizada), adiciona a campanha ao histórico do coaster existente
4. Gera o **Relatório Final** da campanha:
   - Dados gerais (anunciante, período, volume)
   - Lista de restaurantes que participaram
   - Provas de execução consolidadas (fotos)
   - Métricas: nº de pontos ativados, % de comprovação
   - Estimativa de impactos (baseada no fluxo dos restaurantes)
5. Registra no log: "Campanha CMP-YYYY-NNNN finalizada e arquivada na Biblioteca"

**A campanha fica acessível na lista de campanhas com status "Inativa" — somente leitura.**

---

### 4.8 RESUMO DO FLUXO AUTOMÁTICO

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO AUTOMÁTICO DE CAMPANHAS                        │
│                                                                         │
│  COTAÇÃO                                                                │
│    │                                                                    │
│    │  Usuário marca como "WIN"                                          │
│    ▼                                                                    │
│  ══════════════════════════════════════════════                          │
│  ║ AUTOMÁTICO: Cria campanha CMP-YYYY-NNNN  ║                          │
│  ║ Puxa dados da cotação                     ║                          │
│  ══════════════════════════════════════════════                          │
│    │                                                                    │
│    ▼                                                                    │
│  STATUS: PRODUÇÃO  🟡                                                   │
│    │  Usuário faz upload de:                                            │
│    │  • PDF técnico (arquivo para gráfica)                              │
│    │  • Imagens do coaster aprovado (PNG/JPG)                           │
│    │                                                                    │
│    │  Clica "Concluir etapa de Produção"                                │
│    ▼                                                                    │
│  ══════════════════════════════════════════════                          │
│  ║ AUTOMÁTICO: Gera OS de Produção Gráfica  ║                          │
│  ║ Anexa PDF + imagens à OS                  ║                          │
│  ══════════════════════════════════════════════                          │
│    │                                                                    │
│    ▼                                                                    │
│  STATUS: TRÂNSITO  🟠                                                   │
│    │  Usuário aguarda produção e entrega                                │
│    │                                                                    │
│    │  Clica "Confirmar chegada do material"                             │
│    ▼                                                                    │
│  ══════════════════════════════════════════════                          │
│  ║ AUTOMÁTICO: Registra data de chegada      ║                          │
│  ══════════════════════════════════════════════                          │
│    │                                                                    │
│    ▼                                                                    │
│  STATUS: EXECUTAR  🔵                                                   │
│    │  Usuário aloca restaurantes                                        │
│    │  Distribui material                                                │
│    │                                                                    │
│    │  Clica "Iniciar Veiculação"                                        │
│    ▼                                                                    │
│  ══════════════════════════════════════════════                          │
│  ║ AUTOMÁTICO: Registra início + calcula     ║                          │
│  ║ data de fim (+ 4 semanas)                 ║                          │
│  ══════════════════════════════════════════════                          │
│    │                                                                    │
│    ▼                                                                    │
│  STATUS: EM VEICULAÇÃO  🟢                                              │
│    │  Campanha ativa por 4 semanas                                      │
│    │  Upload de fotos de comprovação                                    │
│    │                                                                    │
│    │  Clica "Finalizar Campanha"                                        │
│    ▼                                                                    │
│  ══════════════════════════════════════════════                          │
│  ║ AUTOMÁTICO: Arquiva na Biblioteca         ║                          │
│  ║ Gera Relatório Final                      ║                          │
│  ║ Marca como Inativa                        ║                          │
│  ══════════════════════════════════════════════                          │
│    │                                                                    │
│    ▼                                                                    │
│  STATUS: INATIVA  ⚫                                                    │
│    Campanha finalizada. Dados na Biblioteca.                            │
│    Somente leitura.                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 4.9 Lista de Campanhas

Tabela com todas as campanhas, filtráveis por:
- Status (Produção, Trânsito, Executar, Em Veiculação, Inativa)
- Anunciante
- Período
- Nº da campanha

Cada linha mostra: Nº campanha, anunciante, status (com cor), data de criação, volume, próxima ação necessária.

---

## 5. MÓDULO: BIBLIOTECA DE COASTERS

Repositório central de todos os arquivos de arte. **Alimentado automaticamente** quando campanhas são finalizadas (status "Inativa").

### 5.1 Estrutura

Cada registro na biblioteca tem:

| Campo | Descrição | Origem |
|-------|-----------|--------|
| Thumbnail | Preview visual do coaster | Gerado da imagem PNG/JPG da campanha |
| Anunciante | Marca/anunciante vinculado | Da campanha |
| Campanha(s) | Em qual(is) campanha(s) foi usado | Automático |
| Arquivos | PDF técnico, PNG e JPG | Upload da etapa de Produção |
| Status | Arquivado / Reutilizável | Automático ao finalizar campanha |
| Data de arquivamento | Quando a campanha foi finalizada | Automático |
| Tags | Anunciante, período, regiões | Automático + manual |
| Métricas da campanha | Volume, nº de restaurantes, período | Da campanha finalizada |

### 5.2 Funcionalidades

- **Alimentação automática:** quando uma campanha é finalizada, os arquivos de arte são automaticamente arquivados aqui
- Visualização em grid (galeria) ou lista
- Busca por anunciante, campanha, tag ou data
- Download individual ou em lote (PDF, PNG, JPG)
- Vincular arte existente a uma nova campanha (reutilização)
- Histórico: ver todas as campanhas em que aquele coaster foi usado
- Upload manual também permitido (para casos fora do fluxo padrão)

---

## 6. PERFIS DE ACESSO E PERMISSÕES

### 6.1 Perfis

| Perfil | Descrição | Acesso |
|--------|-----------|--------|
| **Admin** | Gestor geral | Tudo — todos os módulos, configurações, dados financeiros, gestão de usuários |
| **Comercial** | Vendedores | Simulador, Cotações (incluindo marcar WIN), Leads, Cadastro Anunciantes, OS Anunciantes, Termos. Dashboard comercial |
| **Operações** | Produção e logística | Campanhas (todas as etapas e transições), OS de Produção, Biblioteca, Provas de execução. Dashboard operacional |
| **Financeiro** | Controladoria | Dashboard financeiro, Relatórios, Pagamentos, Faturamento |
| **Parceiro (futuro)** | Restaurante | Ver campanhas ativas no seu estabelecimento, enviar fotos, consultar pagamentos |

### 6.2 Quem faz o quê no fluxo de campanha

| Ação no fluxo | Quem pode fazer |
|----------------|-----------------|
| Marcar cotação como WIN | Admin, Comercial |
| Upload de arte (Produção) | Admin, Operações |
| Concluir etapa de Produção | Admin, Operações |
| Confirmar chegada (Trânsito → Executar) | Admin, Operações |
| Alocar restaurantes | Admin, Operações |
| Iniciar Veiculação | Admin, Operações |
| Registrar fotos de comprovação | Admin, Operações, Parceiro (futuro) |
| Finalizar Campanha | Admin, Operações |

### 6.3 Matriz de Permissões (resumo)

| Módulo | Admin | Comercial | Operações | Financeiro | Parceiro |
|--------|-------|-----------|-----------|------------|----------|
| Dashboard completo | ✅ | — | — | — | — |
| Dashboard comercial | ✅ | ✅ | — | — | — |
| Dashboard operacional | ✅ | — | ✅ | — | — |
| Dashboard financeiro | ✅ | — | — | ✅ | — |
| Cotações (criar/WIN) | ✅ | ✅ | — | 👁️ | — |
| Simulador | ✅ | ✅ | — | — | — |
| Leads/CRM | ✅ | ✅ | — | — | — |
| Cadastro Anunciantes | ✅ | ✅ | 👁️ | 👁️ | — |
| Cadastro Restaurantes | ⚠️ Sem alterações — manter Replit | | | | |
| Campanhas (operar) | ✅ | 👁️ | ✅ | 👁️ | 👁️ próprias |
| OS Produção Gráfica | ✅ | — | ✅ | 👁️ | — |
| Biblioteca | ✅ | ✅ | ✅ | — | — |
| Relatórios finais | ✅ | ✅ | ✅ | ✅ | 👁️ próprios |
| Pagamentos | ✅ | — | — | ✅ | 👁️ próprios |
| Configurações | ✅ | — | — | — | — |

Legenda: ✅ = acesso total | 👁️ = somente leitura | — = sem acesso

---

## 7. PORTAL DO ANUNCIANTE (Acesso Externo)

O anunciante acessa o mesmo sistema com login próprio, mas enxerga **exclusivamente** seus dados: suas campanhas e uma ferramenta simplificada para orçar e solicitar novas campanhas. Ele não vê nada do ERP interno (leads, outros anunciantes, financeiro, operações).

### 7.1 Login e Acesso

- O anunciante recebe credenciais criadas pelo time da Mesa Ads (ou convite por e-mail)
- Ao entrar, é direcionado automaticamente para o seu painel
- Não tem acesso à sidebar completa do ERP — vê apenas seu menu próprio:

```
📊 Minhas Campanhas
🧮 Nova Campanha (Simulador)
👤 Meu Cadastro
```

### 7.2 Minhas Campanhas

Tela principal do anunciante. Lista todas as campanhas vinculadas a ele.

**Visão em cards ou tabela, com filtro por status:**

| Campanha | Status | Restaurantes | Volume | Período |
|----------|--------|-------------|--------|---------|
| CMP-2026-0047 | 🟢 Em Veiculação | 15 casas | 5.000 | 01/03 — 29/03 |
| CMP-2026-0031 | 🟠 Trânsito | 8 casas | 3.000 | Aguardando |
| CMP-2026-0012 | ⚫ Inativa | 12 casas | 4.000 | 01/01 — 29/01 |

**Ao clicar em uma campanha, o anunciante vê (somente leitura):**

- Status atual com barra de progresso visual
- Lista de restaurantes alocados (nome e bairro/cidade — sem dados sensíveis do parceiro)
- Volume de coasters
- Período de veiculação (início e fim)
- Preview da arte do coaster (imagens PNG/JPG enviadas)
- Provas de execução: galeria de fotos por restaurante e por semana (quando em veiculação ou inativa)
- Relatório final (quando a campanha estiver inativa) — visualizar e baixar PDF

**O anunciante NÃO vê:**
- Valores de remuneração dos restaurantes
- Dados operacionais internos (OS de produção, custos)
- Dados de outros anunciantes
- Pipeline comercial ou leads

### 7.3 Nova Campanha — Ferramenta de Solicitação

Ferramenta simplificada para o anunciante montar e enviar uma solicitação de campanha.

**Passo 1 — Selecionar restaurantes**

O anunciante vê a lista de restaurantes disponíveis na rede Mesa Ads, com informações públicas:

| Dado visível | Exemplo |
|-------------|---------|
| Nome do estabelecimento | Bar do Zé |
| Tipo | Bar / Restaurante / Café |
| Bairro e cidade | Pinheiros, São Paulo |
| Nº de mesas | 25 |
| Perfil de público | Jovem / Premium / Casual |

**O anunciante NÃO vê:** CNPJ, dados financeiros, contato do dono, score interno, restrições de categoria (o sistema filtra automaticamente — só mostra restaurantes compatíveis com a categoria do anunciante).

**Funcionalidades de seleção:**
- Filtrar por cidade, bairro, tipo de estabelecimento, perfil de público
- Selecionar restaurantes individualmente (checkbox)
- Ou selecionar por perfil ("todos os bares de São Paulo com perfil jovem")
- Mapa visual com os pontos disponíveis (opcional/futuro)

**Passo 2 — Definir quantidade de coasters**

Após selecionar os restaurantes, o anunciante define:

| Campo | Descrição |
|-------|-----------|
| Quantidade total de coasters | Número total desejado |
| Distribuição | Automática (proporcional ao nº de mesas) ou manual (definir por restaurante) |
| Número de ciclos | 1 batch (4 semanas) ou múltiplos |

O sistema calcula automaticamente e mostra um resumo:

```
┌─────────────────────────────────────────────────────┐
│  RESUMO DA SOLICITAÇÃO                               │
│                                                      │
│  Restaurantes selecionados: 12                       │
│  Total de mesas na seleção: 180                      │
│  Coasters solicitados: 5.000                         │
│  Ciclos: 1 (4 semanas)                               │
│                                                      │
│  Distribuição:                                       │
│  • Bar do Zé (25 mesas) — 420 coasters               │
│  • Cantina Boa (30 mesas) — 500 coasters             │
│  • ...                                               │
│                                                      │
│  💰 Valor estimado: R$ XX.XXX,XX                     │
│  (baseado na tabela de preços vigente)               │
│                                                      │
│  [Enviar Solicitação]                                │
└─────────────────────────────────────────────────────┘
```

**Passo 3 — Enviar solicitação**

Ao clicar "Enviar Solicitação":

1. O sistema cria uma **cotação automática** no módulo Comercial do ERP interno, com status "Nova — via Portal"
2. O time comercial da Mesa Ads recebe notificação: "Anunciante X solicitou nova campanha via portal"
3. O anunciante vê confirmação: "Solicitação enviada! Nossa equipe entrará em contato para finalizar."
4. A solicitação aparece no painel do anunciante com status "Aguardando aprovação"

**Fluxo completo da solicitação:**

```
Anunciante seleciona restaurantes + volume
         │
         ▼
  Envia solicitação pelo portal
         │
         ▼
  ═══════════════════════════════════════
  ║ AUTOMÁTICO: Cria cotação no ERP    ║
  ║ interno com status "Via Portal"    ║
  ═══════════════════════════════════════
         │
         ▼
  Time Comercial analisa e ajusta
         │
         ▼
  Comercial marca como WIN
         │
         ▼
  (Fluxo normal de campanhas se inicia)
```

### 7.4 Meu Cadastro

Área onde o anunciante visualiza e edita seus dados básicos:

- Nome fantasia / Razão social
- Contato principal (nome, e-mail, telefone)
- Endereço
- Logo da empresa (upload)

> **Nota:** Dados sensíveis como CNPJ e dados fiscais são editáveis apenas pelo time interno da Mesa Ads.

### 7.5 Atualização nos Perfis de Acesso

Adicionar o perfil **Anunciante** à matriz de permissões:

| Perfil | Descrição | Acesso |
|--------|-----------|--------|
| **Anunciante** | Cliente anunciante com login próprio | Apenas suas campanhas (leitura), ferramenta de solicitação, seu cadastro |

**Matriz atualizada com o perfil Anunciante:**

| Módulo | Admin | Comercial | Operações | Financeiro | Parceiro | Anunciante |
|--------|-------|-----------|-----------|------------|----------|------------|
| Dashboard completo | ✅ | — | — | — | — | — |
| Dashboard comercial | ✅ | ✅ | — | — | — | — |
| Dashboard operacional | ✅ | — | ✅ | — | — | — |
| Dashboard financeiro | ✅ | — | — | ✅ | — | — |
| Cotações (criar/WIN) | ✅ | ✅ | — | 👁️ | — | — |
| Simulador completo | ✅ | ✅ | — | — | — | — |
| Leads/CRM | ✅ | ✅ | — | — | — | — |
| Cadastro Anunciantes | ✅ | ✅ | 👁️ | 👁️ | — | — |
| Cadastro Restaurantes | ⚠️ Sem alterações — manter Replit | | | | | |
| Campanhas (operar) | ✅ | 👁️ | ✅ | 👁️ | 👁️ próprias | — |
| Campanhas (ver próprias) | — | — | — | — | — | 👁️ próprias |
| Nova Campanha (solicitar) | — | — | — | — | — | ✅ |
| OS Produção Gráfica | ✅ | — | ✅ | 👁️ | — | — |
| Biblioteca | ✅ | ✅ | ✅ | — | — | — |
| Relatórios finais | ✅ | ✅ | ✅ | ✅ | 👁️ próprios | 👁️ próprios |
| Pagamentos | ✅ | — | — | ✅ | 👁️ próprios | — |
| Configurações | ✅ | — | — | — | — | — |
| Meu Cadastro (próprio) | — | — | — | — | — | ✅ |

Legenda: ✅ = acesso total | 👁️ = somente leitura | — = sem acesso

---

## 8. MÓDULO: CONFIGURAÇÕES

### 7.1 Gestão de Usuários
- Criar/editar/desativar usuários
- Atribuir perfis de acesso
- Log de atividades por usuário

### 7.2 Parâmetros do Sistema
- Especificações técnicas padrão de coasters (formato, material, acabamento)
- Regras de remuneração de restaurantes
- Templates de OS (produção gráfica, entrega, anunciante)
- Templates de Termos (restaurante)
- Templates de cotação/proposta comercial
- Etapas do pipeline de leads (customizável)
- Formato de numeração de campanhas e OS

---

*Documento de especificação — Mesa Ads ERP v3 — Fevereiro 2026*
*Fluxo automático de campanhas revisado conforme definição do produto*
