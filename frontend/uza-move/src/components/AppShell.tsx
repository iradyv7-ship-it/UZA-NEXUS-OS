import { Link, useRouterState } from "@tanstack/react-router";
import { useT, LANGS, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Home, Wallet, User } from "lucide-react";
import type { ReactNode } from "react";

export function LangSwitch() {
  const { lang, setLang } = useT();
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code as Lang)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/rider", icon: User, label: t("nav.rider") },
    { to: "/driver", icon: Bike, label: t("nav.driver") },
    { to: "/wallet", icon: Wallet, label: t("nav.wallet") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="font-display text-lg font-bold text-foreground">
          UZA <span className="text-primary">Move</span>
        </Link>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {t("auth.signout")}
          </button>
        </div>
      </header>

      {title ? (
        <h1 className="px-4 pt-4 font-display text-2xl font-bold text-foreground">{title}</h1>
      ) : null}

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card">
        {tabs.map((tab) => {
          const active = path === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="size-5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
