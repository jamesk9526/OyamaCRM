import { createRequire } from "node:module";
import { copyFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
for (const destination of ["public/vendor/pdfjs", "apps/letters/public/vendor/pdfjs"]) {
  await mkdir(destination, { recursive: true });
  for (const filename of ["pdf.mjs", "pdf.worker.mjs"]) await copyFile(path.join(root, "build", filename), path.join(destination, filename));
  for (const folder of ["standard_fonts", "cmaps", "wasm"]) await cp(path.join(root, folder), path.join(destination, folder), { recursive: true });
}
