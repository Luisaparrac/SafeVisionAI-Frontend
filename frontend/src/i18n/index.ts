import es from "./es";
import en from "./en";

export type Language = "es" | "en";
export type TranslationKey = keyof typeof es;
export type Messages = Record<keyof typeof es, string>;

export const dictionaries: Record<Language, Messages> = { es, en };
export const getStoredLanguage = (): Language => localStorage.getItem("safevision-language") === "en" ? "en" : "es";
export const translate = (language: Language, key: TranslationKey): string => dictionaries[language][key];
export const localeFor = (language: Language): string => language === "es" ? "es-CO" : "en-US";

export function formatDate(value: string, language: Language): string {
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!isoDate) return value;
  const date = new Date(Date.UTC(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]), 12));
  return new Intl.DateTimeFormat(localeFor(language), { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(localeFor(language)).format(value);
}
