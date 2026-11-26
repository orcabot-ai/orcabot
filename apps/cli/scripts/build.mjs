import { cp, chmod, rm, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = new URL("../../web/dist/client/", import.meta.url);
await access(new URL("_shell.html", source));
const target = new URL("../dist/web/", import.meta.url);
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
execFileSync(
  process.execPath,
  [join(root, "scripts/write-build-info.mjs"), root],
  { stdio: "inherit" },
);
await chmod(new URL("../dist/index.js", import.meta.url), 0o755);
