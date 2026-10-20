// Copies the pdf.js worker into /public so page previews work without bundler tricks.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(src, join(root, "public", "pdf.worker.min.mjs"));
