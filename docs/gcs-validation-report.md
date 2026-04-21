# Validação do Google Cloud Storage em produção

Data da validação: 2026-04-20 (revalidado em 2026-04-21 na task #111)
Responsável: validação automatizada (task #102, pré-requisito do Marketplace v2)

> **Revalidação 2026-04-21 (task #111):** repetidos os curls da seção 3 contra `https://mesaads.com.br` — produção segue na build antiga (HTML 3826 bytes para os 4 endpoints). A republicação NÃO pôde ser disparada pelo agente de task (apenas o app principal/usuário pode clicar em **Publish**). Em compensação foi feito o `npm run build` local e verificado que `dist/index.js` contém `setupPublicLogoUploadRoutes`, `restaurant-logo/serve` e `restaurant-logo/upload-public`; a configuração de deploy em `.replit` (`autoscale`, `npm run start`, `bash scripts/pre-deploy.sh && npm run build`) está correta. Os mesmos curls rodados localmente (`http://localhost:5000`) retornam `image/png` 24825 bytes e `400 JSON {"error":"Nenhum arquivo enviado."}`, confirmando que basta o usuário clicar em **Publish** no app principal (após o merge desta task) para que produção passe a servir corretamente.

## Resumo executivo

**Status: PARCIAL — uploads históricos OK, build do branch atual contém as rotas e funciona localmente, mas a produção em `mesaads.com.br` ainda serve a build antiga. Ação pendente: usuário precisa clicar em **Publish** no app principal após o merge desta task. Depois disso, rerodar os curls da seção 3 contra produção.**

## O que foi verificado

### 1. Configuração do bucket e variáveis de ambiente (dev)

| Variável | Valor |
|---|---|
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | `replit-objstore-63a8094f-4f9e-4870-ab75-19131f0b1238` |
| `PUBLIC_OBJECT_SEARCH_PATHS` | `/replit-objstore-63a8094f-4f9e-4870-ab75-19131f0b1238/public` |
| `PRIVATE_OBJECT_DIR` | `/replit-objstore-63a8094f-4f9e-4870-ab75-19131f0b1238/.private` |

Essas variáveis são injetadas pelo integration `javascript_object_storage` da Replit, que é compartilhado entre os ambientes de dev e produção (não há override em `[userenv.production]` no `.replit`). Como uploads históricos funcionaram em produção (item 2), as credenciais e o bucket estão corretamente provisionados também lá.

### 2. Uploads históricos no banco de produção

Consulta `SELECT id, name, "logoUrl", "updatedAt" FROM active_restaurants WHERE "logoUrl" IS NOT NULL` (read replica, ambiente produção):

- 10 restaurantes com logo gravado.
- Mais recente: `TAMBAQUI DE BANDA` em `2026-04-10 18:02:26`.
- Todas as URLs gravadas seguem o padrão `/api/restaurant-logo/serve/logos%2Frestaurant-<id>-<ts>.png`.

→ Confirma que o pipeline de **upload** já gravou no GCS de produção via `saveLogoToStorage` em `server/logoUploadRouter.ts` (chamando `objectStorageClient.bucket(...).file(...).save(...)`).

### 3. Acesso público ao arquivo via URL gravada

Testes executados em 2026-04-20 ~15:40 UTC, sem cookies/sessão (equivalente a aba anônima), contra `https://mesaads.com.br`. Artefatos completos abaixo.

#### Artefato 3.1 — GET com `%2F` (URL exata como gravada no banco)
Request:
```
GET https://mesaads.com.br/api/restaurant-logo/serve/logos%2Frestaurant-15-1775844146435.png
```
Resposta (cabeçalhos relevantes):
```
HTTP/2 200
content-type: text/html; charset=utf-8
content-length: 3826
cache-control: no-cache, must-revalidate
last-modified: Fri, 17 Apr 2026 18:45:58 GMT
etag: W/"ef2-19d9cc39a70"
x-powered-by: Express
server: Google Frontend
```
Body (primeiros bytes):
```
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    ...
    <title>Mesa Ads — Rede de mídia indoor em bares, restaurantes, hotéis e salas VIP de Manaus</title>
```
**Esperado:** HTTP 200 `image/png` (~24KB). **Observado:** HTML do SPA. ❌

#### Artefato 3.2 — GET com slash decodificado
Request:
```
GET https://mesaads.com.br/api/restaurant-logo/serve/logos/restaurant-15-1775844146435.png
```
Resposta: `HTTP 200`, `content-type: text/html; charset=utf-8`, 3826 bytes (mesmo SPA HTML). ❌

#### Artefato 3.3 — GET com prefixo inválido (deveria ser 400)
Request:
```
GET https://mesaads.com.br/api/restaurant-logo/serve/badprefix/foo.png
```
Resposta: `HTTP 200`, `content-type: text/html; charset=utf-8`, 3826 bytes (SPA HTML). **Esperado:** `HTTP 400 JSON {"error":"Caminho inválido."}`. ❌

#### Artefato 3.4 — POST upload-public sem body (deveria ser 400)
Request:
```
POST https://mesaads.com.br/api/restaurant-logo/upload-public
```
Resposta: `HTTP 200`, `content-type: text/html; charset=utf-8`, 3826 bytes (SPA HTML). **Esperado:** `HTTP 400 JSON {"error":"Nenhum arquivo enviado."}`. ❌

#### Artefato 3.5 — Mesmos testes localmente (workflow `Start application`, mesmo bucket GCS)
```
GET http://localhost:5000/api/restaurant-logo/serve/logos%2Frestaurant-15-1775844146435.png
→ HTTP 200, content-type: image/png, 24825 bytes ✅

POST http://localhost:5000/api/restaurant-logo/upload-public  (sem body)
→ HTTP 400 JSON {"error":"Nenhum arquivo enviado."} ✅
```

#### Conclusão dos artefatos
O ambiente local (apontando para o mesmo bucket GCS de produção via `DEFAULT_OBJECT_STORAGE_BUCKET_ID=replit-objstore-63a8094f-...`) serve a imagem corretamente. A produção responde HTML do SPA para QUALQUER variante das rotas `/api/restaurant-logo/serve/*` e `/api/restaurant-logo/upload-public`, indicando que o binário publicado (`last-modified` do `index.html` em 2026-04-17) não tem `setupPublicLogoUploadRoutes` registrado.

→ A rota existe no código e funciona; o que está em produção é uma build mais antiga, anterior à introdução de `setupPublicLogoUploadRoutes` em `server/logoUploadRouter.ts` (registrado em `server/_core/index.ts:52`, antes do `serveStatic`).

### 4. Limitações desta validação

- Não foi feito um `POST /api/restaurant-logo/upload` autenticado em produção com arquivo real, porque a rota requer Clerk session do role `restaurante`/interno (`server/logoUploadRouter.ts:170`) e não havia credencial disponível no agente. A evidência indireta de uploads em produção vem da consulta SQL na tabela `active_restaurants` (Artefato 2): 10 registros gravados com URL `/api/restaurant-logo/serve/...` e `metadata.cacheControl` setado por `saveLogoToStorage`. Após o redeploy, recomenda-se um upload real via UI logada para fechar o ciclo.
- A confirmação das variáveis `PUBLIC_OBJECT_SEARCH_PATHS` / `PRIVATE_OBJECT_DIR` em produção é indireta: elas são injetadas pela integration `javascript_object_storage` (compartilhada entre dev e prod, sem override em `[userenv.production]` do `.replit`), e o sucesso histórico dos uploads em produção comprova que a credencial GCS via sidecar (`http://127.0.0.1:1106/token`) funciona no ambiente publicado.

## Conclusão

- ✅ Bucket GCS provisionado e operacional em produção (uploads acontecem e são persistidos).
- ✅ Variáveis de ambiente do object storage estão presentes e válidas em produção.
- ❌ O endpoint público para servir os arquivos (`GET /api/restaurant-logo/serve/:objectName`) e o endpoint público de upload onboarding (`POST /api/restaurant-logo/upload-public`) **não estão presentes na build publicada**. Hoje qualquer `<img src="/api/restaurant-logo/serve/...">` em produção carrega o HTML do SPA, não a imagem.

## Correções necessárias antes do Marketplace v2

1. **Republicar a produção a partir do branch atual.** Build (`vite build && esbuild server/_core/index.ts ...`) já bundla `logoUploadRouter.ts`; basta um novo deploy autoscale (`npm run start` → `node dist/index.js`). Após o deploy, repetir os testes acima e confirmar:
   - `GET /api/restaurant-logo/serve/logos%2Frestaurant-15-1775844146435.png` → `image/png`.
   - `POST /api/restaurant-logo/upload-public` (sem body) → `400 JSON`.
2. **Validar visualmente** abrindo a URL `https://mesaads.com.br/api/restaurant-logo/serve/logos%2Frestaurant-15-1775844146435.png` em aba anônima. Deve mostrar a logo do restaurante.
3. Só depois de (1) e (2) seguir com as tarefas do Marketplace v2 que dependem de upload/exibição de arquivos (documentos financeiros, fotos de verificação, arte do anunciante, Drive Picker).

## Observações arquiteturais para o Marketplace v2

- O padrão atual **não usa URLs públicas diretas do GCS** — todo arquivo público é proxiado pelo Express em `/api/restaurant-logo/serve/:objectName`. Isso vale para reaproveitar nos novos uploads (documentos, fotos, artes) ou trocar por URLs assinadas do sidecar (`signObjectURL` em `server/replit_integrations/object_storage/objectStorage.ts`).
- O upload público (onboarding) é protegido por token de uso único expirando em 5 minutos (`createOnboardingUploadToken`). O mesmo mecanismo pode ser reusado para uploads pré-cadastro do anunciante.
- Limite atual em `multer` é 2MB e só PNG/JPG; revisar para PDFs e imagens maiores nos próximos uploads.
