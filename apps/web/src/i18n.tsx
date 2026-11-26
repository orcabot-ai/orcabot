import { Select } from "./Select.js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Languages } from "lucide-react";
import { persistLocale, readLocale, translate, type Locale } from "./locale.js";

type I18n = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (message: string, values?: Record<string, string | number>) => string;
};
const I18nContext = createContext<I18n>({
  locale: "en",
  setLocale: () => {},
  t: (message, values) => translate(message, "en", values),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Keep the static shell deterministic; restore tab preferences after hydration.
  const [locale, updateLocale] = useState<Locale>("en");
  useEffect(() => updateLocale(readLocale()), []);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = translate("Orcabot — Your personal assistant", locale);
  }, [locale]);
  const setLocale = useCallback((next: Locale) => {
    persistLocale(next);
    updateLocale(next);
  }, []);
  const t = useCallback(
    (message: string, values?: Record<string, string | number>) =>
      translate(message, locale, values),
    [locale],
  );
  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  return useContext(I18nContext);
}
export function LanguageControl() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="language-control">
      <Languages size={14} aria-hidden="true" />
      <Select
        aria-label={t("Language")}
        value={locale}
        onValueChange={(next) => setLocale(next === "zh" ? "zh" : "en")}
      >
        <option value="en" lang="en">
          EN
        </option>
        <option value="zh" lang="zh-CN">
          中文
        </option>
      </Select>
    </label>
  );
}
