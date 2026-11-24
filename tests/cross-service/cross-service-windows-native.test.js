import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { WindowsUserTaskBackend } from "../../packages/orcabot-cross-service/dist/index.js";
import {
  readDefinition,
  writeDefinition,
} from "../../packages/orcabot-cross-service/dist/common.js";

test("service definition I/O migrates UTF-8 to UTF-16LE BOM atomically and stays idempotent", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "octo-task-encoding-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "task.xml");
  const content =
    '<?xml version="1.0" encoding="UTF-16"?><Task>中文 &amp; spaces</Task>';
  await writeFile(path, content, "utf8");
  assert.equal(await readDefinition(path), content);
  assert.equal(await writeDefinition(path, content, "utf16le"), true);
  const bytes = await readFile(path);
  assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xfe]);
  assert.equal(await readDefinition(path), content);
  assert.equal(await writeDefinition(path, content, "utf16le"), false);
  assert.equal(await writeDefinition(path, content), true);
  assert.equal(await readFile(path, "utf8"), content);
});

for (const suffix of ["ascii", "中文 home with spaces"]) {
  for (const enabled of [false, true]) {
    test(
      `native Windows backend install/query/delete: ${suffix}, autostart=${enabled}`,
      {
        skip:
          process.platform !== "win32" ||
          process.env.ORCABOT_TEST_NATIVE_SERVICES !== "1",
        timeout: 180_000,
      },
      async (t) => {
        const directory = await mkdtemp(join(tmpdir(), "octo-task-native-"));
        const home = join(directory, suffix);
        await mkdir(home);
        const backend = new WindowsUserTaskBackend({
          windowsDefinitionDirectory: join(home, "definitions"),
        });
        const spec = {
          id: `octo-fixture-${randomUUID()}`,
          command: process.execPath,
          args: [
            "--version",
            "中文 argument",
            'quoted"value',
            "trailing space\\",
          ],
          workingDirectory: home,
          enabled,
        };
        // Clean only this random task and isolated directory; verify absence even after partial installation.
        t.after(async () => {
          await backend.uninstall(spec);
          assert.equal((await backend.inspect(spec)).state, "not_installed");
          await rm(directory, { recursive: true, force: true });
        });
        await backend.install(spec);
        const installed = await backend.inspect(spec);
        assert.equal(installed.state, "stopped");
        assert.equal(installed.enabled, enabled);
        assert.deepEqual(installed.drift, []);
        await backend.install(spec);
        assert.deepEqual((await backend.inspect(spec)).drift, []);
      },
    );
  }
}
