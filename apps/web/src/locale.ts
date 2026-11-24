import { chinese } from "./messages.js";

export type Locale = "en" | "zh";
export const localeStorageKey = "orcabot.locale";
type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

// This preference belongs to a browser tab session, independently of service credentials.
export function readLocale(storage?: Reader): Locale {
  try {
    return (storage ?? globalThis.sessionStorage).getItem(localeStorageKey) ===
      "zh"
      ? "zh"
      : "en";
  } catch {
    return "en";
  }
}
export function persistLocale(locale: Locale, storage?: Writer): void {
  try {
    (storage ?? globalThis.sessionStorage).setItem(localeStorageKey, locale);
  } catch {
    // The selection remains usable in memory when storage is unavailable.
  }
}
export function translate(
  message: string,
  locale: Locale,
  values: Record<string, string | number> = {},
): string {
  const template =
    locale === "zh" && Object.hasOwn(chinese, message)
      ? chinese[message as keyof typeof chinese]
      : message;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
