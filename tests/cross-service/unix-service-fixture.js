import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, join, normalize, relative, sep } from "node:path";

/** Simulated Unix paths appear only in specs; real files belong to this test temporary directory. */
export async function createUnixServiceFixture(
  t,
  prefix,
  directory = tmpdir(),
) {
  const home = await fs.mkdtemp(join(directory, prefix));
  const unixHome = `/octo-fixtures/${basename(home)}`;
  const root = normalize(unixHome);
  const nativePath = (path) => {
    if (typeof path !== "string") return path;
    const normalized = normalize(path);
    if (normalized !== root && !normalized.startsWith(`${root}${sep}`))
      return path;
    return join(home, relative(root, normalized));
  };

  // Keep real backend file I/O; translate fixture paths only at the test boundary.
  // Run cases serially and restore ESM bindings to prevent fixture mappings leaking.
  const mocks = ["mkdir", "readFile", "open", "rm"].map((method) => {
    const original = fs[method];
    return t.mock.method(fs, method, (path, ...args) =>
      original(nativePath(path), ...args),
    );
  });
  const rename = fs.rename;
  mocks.push(
    t.mock.method(fs, "rename", (from, to) =>
      rename(nativePath(from), nativePath(to)),
    ),
  );
  syncBuiltinESMExports();
  t.after(async () => {
    for (const mocked of mocks) mocked.mock.restore();
    syncBuiltinESMExports();
    await fs.rm(home, { recursive: true, force: true });
  });
  return { home, unixHome, nativePath };
}
