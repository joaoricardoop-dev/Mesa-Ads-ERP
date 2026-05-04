import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage state compartilhado pelo projeto Playwright `setup` (ver
// `e2e/global.setup.ts`) e consumido por specs autenticados como anunciante
// via `test.use({ storageState: ANUNCIANTE_AUTH_FILE })`.
export const ANUNCIANTE_AUTH_FILE = path.resolve(__dirname, "..", ".auth", "anunciante.json");
