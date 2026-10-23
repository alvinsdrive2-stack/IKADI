// Resolves the tsconfig "@/*" alias for plain `node`, plus TS "extensionless" imports.
// With QA_MOCK=1 it also swaps in the in-memory prisma mocks (no MySQL needed).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const withExt = (p) => [p, p + ".ts", p + ".tsx", path.join(p, "index.ts")].find(existsSync);

export async function resolve(specifier, context, next) {
  if (process.env.QA_MOCK === "1") {
    const mock = specifier === "@/lib/prisma" ? "prisma" : specifier === "@prisma/client" ? "prisma-client" : null;
    if (mock) return { url: new URL(`./mock-${mock}.mjs`, import.meta.url).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const hit = withExt(path.join(root, specifier.slice(2)));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:") && !path.extname(specifier)) {
    const hit = withExt(fileURLToPath(new URL(specifier, context.parentURL)));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  return next(specifier, context);
}
