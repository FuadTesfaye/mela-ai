export const languageCodes = ["en", "am", "om", "ti"] as const;
export const speechLocales = {
  en: "en-US",
  am: "am-ET",
  om: "om-ET",
  ti: "ti-ET",
} as const;
export const languages = {
  en: { name: "English", speech: "en-US", status: "source" },
  am: { name: "አማርኛ", speech: "am-ET", status: "ai-draft" },
  om: { name: "Afaan Oromo", speech: "om-ET", status: "source-only" },
  ti: { name: "ትግርኛ", speech: "ti-ET", status: "source-only" },
} as const;
export type Language = keyof typeof languages;
export const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" && languageCodes.includes(value as Language);
export function languageOrEnglish(value: unknown): Language {
  return isLanguage(value) ? value : "en";
}
export function languageNotice(language: Language) {
  return language === "om" || language === "ti"
    ? `${language === "om" ? "Afaan Oromo" : "ትግርኛ"} translations are not yet reviewed or available for this lesson. Showing the original source.`
    : undefined;
}
