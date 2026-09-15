import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang, T } from "@/content/types";

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "rw",
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("rw");

  useEffect(() => {
    const stored = localStorage.getItem("uza-lang");
    if (stored === "en" || stored === "rw") setLang(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("uza-lang", lang);
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function useT() {
  const { lang } = useLang();
  return (value: T) => value[lang];
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-border text-xs">
      {(["rw", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`px-3 py-1.5 font-semibold uppercase tracking-wider transition-colors ${
            lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {l === "rw" ? "Kinyarwanda" : "English"}
        </button>
      ))}
    </div>
  );
}
