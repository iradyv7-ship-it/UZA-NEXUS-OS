import { createFileRoute, Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { LangSwitch } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { ShieldCheck, Wallet, PiggyBank, Bike } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UZA Move — Upfront fares, RWF, MoMo" },
      {
        name: "description",
        content:
          "UZA Move: ride-hailing in Rwanda with a regulated fare shown before you book, payment by MTN MoMo, Airtel Money or cash, and one wallet with savings for drivers.",
      },
      { property: "og:title", content: "UZA Move — The fare you see is the fare you pay" },
      {
        property: "og:description",
        content: "Fixed RURA fares, MoMo and cash, one wallet for trips, charging and loans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useT();
  const { user, ready } = useSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-5 py-4">
        <span className="font-display text-xl font-bold">
          UZA <span className="text-primary">Move</span>
        </span>
        <LangSwitch />
      </header>

      <section className="surface-hero mx-4 rounded-3xl px-6 py-10 text-primary-foreground">
        <h1 className="font-display text-3xl font-bold leading-tight">{t("app.tagline")}</h1>
        <p className="mt-3 text-sm opacity-90">{t("app.promise")}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to={ready && user ? "/rider" : "/auth"}
            className="rounded-xl bg-card px-4 py-3 text-center text-sm font-semibold text-foreground"
          >
            {t("nav.rider")}
          </Link>
          <Link
            to={ready && user ? "/driver" : "/auth"}
            className="surface-gold rounded-xl px-4 py-3 text-center text-sm font-semibold text-accent-foreground"
          >
            {t("nav.driver")}
          </Link>
        </div>
      </section>

      <section className="grid gap-3 px-4 py-6">
        {[
          { icon: ShieldCheck, title: t("rider.fixedfare"), body: t("app.promise") },
          { icon: Wallet, title: t("wallet.title"), body: t("wallet.one") },
          { icon: PiggyBank, title: t("savings.title"), body: t("savings.daysahead") },
          { icon: Bike, title: t("driver.keeps"), body: t("driver.commission") },
        ].map((f) => (
          <div key={f.title} className="card-uza flex gap-3 p-4">
            <f.icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.body}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="flex justify-center gap-5 px-4 pb-10 text-xs text-muted-foreground">
        <Link to="/ads" className="underline">
          Kwamamaza
        </Link>
        <Link to="/ops" className="underline">
          Ops
        </Link>
      </footer>
    </div>
  );
}
