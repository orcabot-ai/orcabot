import test from "node:test";
import assert from "node:assert/strict";
import {
  localeStorageKey,
  persistLocale,
  readLocale,
  translate,
} from "../apps/web/src/locale.js";

function tabStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

test("language choice survives a session reload while another tab keeps its own choice", () => {
  const first = tabStorage(),
    second = tabStorage();
  assert.equal(readLocale(first), "en");
  persistLocale("zh", first);
  assert.equal(readLocale(first), "zh");
  assert.equal(first.getItem(localeStorageKey), "zh");
  assert.equal(readLocale(second), "en");
  persistLocale("en", first);
  assert.equal(readLocale(first), "en");
  first.setItem(localeStorageKey, "fr");
  assert.equal(readLocale(first), "en");
});

test("blocked session storage does not break language selection or substitute prototype properties", () => {
  const blocked = {
    getItem: () => {
      throw new Error("Storage blocked");
    },
    setItem: () => {
      throw new Error("Storage blocked");
    },
  };
  assert.equal(readLocale(blocked), "en");
  assert.doesNotThrow(() => persistLocale("zh", blocked));
  assert.equal(
    translate("{count} tool activities", "zh", { count: 3 }),
    "3 项工具活动",
  );
  assert.equal(
    translate("{count} tool activity", "en", { count: 1 }),
    "1 tool activity",
  );
  assert.equal(
    translate("{missing} {constructor}", "zh"),
    "{missing} {constructor}",
  );
  assert.equal(translate("constructor", "zh"), "constructor");
  assert.equal(
    translate("Original runtime output", "zh"),
    "Original runtime output",
  );
});
