# Mesa Ads - Upgrade Full-Stack

## Fase 1: Upgrade do projeto
- [x] Executar webdev_add_feature para web-db-user
- [x] Verificar que o servidor reiniciou corretamente

## Fase 2: Schema do banco de dados
- [x] Criar tabela restaurants (id, name, address, neighborhood, coasters_allocated, status, created_at)
- [x] Criar tabela clients (id, name, company, contact_email, contact_phone, status, created_at)
- [x] Criar tabela campaigns (id, client_id, name, cpm, start_date, end_date, status, created_at)
- [x] Criar tabela campaign_restaurants (campaign_id, restaurant_id, coasters_count)

## Fase 3: Rotas de API
- [x] CRUD /api/restaurants
- [x] CRUD /api/clients
- [x] CRUD /api/campaigns (com vínculo de restaurantes)
- [x] GET /api/economics/monthly (consolidado do mês)

## Fase 4: Aba Restaurantes
- [x] Listagem com tabela
- [x] Formulário de cadastro/edição
- [x] Status ativo/inativo

## Fase 5: Aba Clientes
- [x] Listagem com tabela
- [x] Formulário de cadastro/edição
- [x] Status ativo/inativo

## Fase 6: Aba Campanhas
- [x] Listagem de campanhas
- [x] Formulário de criação com seleção de cliente
- [x] Seleção de restaurantes da campanha
- [x] Definição de CPM, período, coasters por restaurante

## Fase 7: Economics Mensal
- [x] Visão consolidada de campanhas ativas no mês
- [x] Faturamento total Mesa Ads
- [x] Comissões totais aos restaurantes
- [x] Lucro Mesa Ads
- [x] Breakdown por campanha e por restaurante

## Fase 8: Integração
- [x] Adicionar novas abas na navegação
- [x] Testar todos os fluxos CRUD
- [x] Testar cálculos de economics
- [x] Testes unitários (22 testes passando)

## Novas Features
- [x] Botão na aba Simulador para criar campanha com base nos valores simulados
- [x] Aba Custos de Produção - Schema do banco (fornecedores, orçamentos, itens de preço)
- [x] Aba Custos de Produção - Rotas tRPC para CRUD
- [x] Aba Custos de Produção - Página frontend com gestão de fornecedores e orçamentos
- [x] Aba Custos de Produção - Integração na navegação global
- [x] Aba Custos de Produção - Pré-popular com dados do orçamento Graftech modelo
- [x] Popular banco com fornecedor Graftech e orçamento do PDF
- [x] Vincular orçamentos de produção ao simulador (seletor de orçamento + custo real por coaster)
- [x] Atualizar cálculos do simulador para usar custo real do orçamento selecionado

## Correções
- [ ] Corrigir Economics Mensal retornando valores zerados (campanha com 0 restaurantes e faturamento R$ 0)
- [x] Remover campos Batch Produção e Custo do Batch da sidebar do simulador
- [ ] Persistir valores do simulador com localStorage (não resetar ao trocar de aba)
- [ ] Seletor fixo/variável para comissão do restaurante (fixo = valor R$, variável = percentual %)
- [ ] Detalhar base de cálculo no Economics das campanhas (abrir fórmulas e valores usados)
