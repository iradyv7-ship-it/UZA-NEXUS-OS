import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { curriculum, tracks, glossary } from "@/content";
import { LangToggle, useT } from "@/lib/lang";
import { useProgress } from "@/lib/progress";
import { AccountLink } from "@/components/AccountLink";

export const Route = createFileRoute("/learn/")({
  head: () => ({
    meta: [
      { title: "Course modules — UZA Drive Academy" },
      {
        name: "description",
        content:
          "Ten bilingual modules: daily money records, wallet envelopes, loan servicing, business plan, charging, checks, range and EV safety.",
      },
      { property: "og:title", content: "Course modules — UZA Drive Academy" },
      {
        property: "og:description",
        content: "Ten bilingual driver modules on money skills and electric vehicle care.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Modules,
});

function Modules() {
  const t = useT();
  const { done, signedIn } = useProgress();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t({ en: "Home", rw: "Ahabanza" })}
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <AccountLink />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-3xl font-bold md:text-4xl">
          {t({ en: "The course", rw: "Amasomo" })}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {signedIn
            ? t({
                en: `${done.length} of ${curriculum.length} modules completed — saved to your account.`,
                rw: `Amasomo ${done.length} kuri ${curriculum.length} yarangiye — byabitswe kuri konti yawe.`,
              })
            : t({
                en: `${done.length} of ${curriculum.length} modules completed on this phone.`,
                rw: `Amasomo ${done.length} kuri ${curriculum.length} yarangiye kuri iyi telefone.`,
              })}
        </p>
        {!signedIn && (
          <p className="mt-2 text-sm text-muted-foreground">
            <Link to="/auth" className="font-medium text-foreground underline underline-offset-4">
              {t({ en: "Create a free account", rw: "Fungura konti ya buntu" })}
            </Link>{" "}
            {t({
              en: "to keep your progress, join your cohort and continue on any phone.",
              rw: "kubika aho ugeze, kwinjira mu itsinda ryawe no gukomeza kuri telefone iyo ari yo yose.",
            })}
          </p>
        )}

        {tracks.map((track) => (
          <section key={track.id} className="mt-12">
            <p className="text-eyebrow text-muted-foreground">{t(track.title)}</p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t(track.blurb)}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {curriculum
                .filter((m) => m.track === track.id)
                .map((m) => (
                  <Link key={m.id} to="/learn/$moduleId" params={{ moduleId: m.id }}>
                    <Card className="h-full border-border/70 p-6 shadow-soft transition-shadow hover:shadow-lift">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm font-bold text-muted-foreground">
                          {m.code}
                        </span>
                        {done.includes(m.id) && (
                          <Badge className="surface-volt border-transparent text-xs">✓</Badge>
                        )}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold leading-snug">{t(m.title)}</h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {t(m.why)}
                      </p>
                      <p className="mt-4 text-xs text-muted-foreground">
                        {m.minutes} {t({ en: "minutes", rw: "iminota" })} ·{" "}
                        {m.delivery === "classroom"
                          ? t({ en: "classroom", rw: "mu cyumba" })
                          : t({ en: "phone or classroom", rw: "telefone cyangwa mu cyumba" })}
                      </p>
                    </Card>
                  </Link>
                ))}
            </div>
          </section>
        ))}

        <section className="mt-16">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "Words we use", rw: "Amagambo dukoresha" })}
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {glossary.map((g) => (
              <Card key={g.term.en} className="border-border/70 p-4">
                <p className="font-semibold">{t(g.term)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(g.meaning)}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
