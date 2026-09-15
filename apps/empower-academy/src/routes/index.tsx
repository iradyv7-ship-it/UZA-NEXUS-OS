import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { curriculum, tracks, totalMinutes } from "@/content";
import { LangToggle, useT } from "@/lib/lang";
import { AccountLink } from "@/components/AccountLink";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UZA Drive Academy — Money & EV training for Rwandan drivers" },
      {
        name: "description",
        content:
          "A bilingual course for taxi drivers becoming electric vehicle owners: daily records, wallet envelopes, loan servicing, business plan, charging and vehicle care.",
      },
      { property: "og:title", content: "UZA Drive Academy" },
      {
        property: "og:description",
        content:
          "Kinyarwanda and English training that turns experienced drivers into EV-owning entrepreneurs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const t = useT();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <span className="font-display text-lg font-bold tracking-tight">
            UZA<span className="text-muted-foreground"> Drive Academy</span>
          </span>
          <div className="flex items-center gap-2">
            <LangToggle />
            <AccountLink />
          </div>
        </div>
      </header>

      <main>
        <section className="surface-hero">
          <div className="mx-auto max-w-5xl px-5 py-20 md:py-28">
            <Badge className="surface-volt border-transparent font-display text-xs font-semibold">
              {t({ en: "Driver coaching programme", rw: "Gahunda y'amahugurwa y'abashoferi" })}
            </Badge>
            <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.05] md:text-5xl">
              {t({
                en: "You already know the road. Now own the business on it.",
                rw: "Usanzwe uzi umuhanda. Ubu tunge ubucuruzi buri kuwo muhanda.",
              })}
            </h1>
            <p className="mt-6 max-w-2xl text-lg opacity-85">
              {t({
                en: "Ten short modules, in Kinyarwanda and English, on your phone or in a classroom: money you can see, a loan you understand, and an electric car you can look after.",
                rw: "Amasomo icumi magufi, mu Kinyarwanda no mu Cyongereza, kuri telefone cyangwa mu cyumba: amafaranga ubona, inguzanyo wumva, n'imodoka y'amashanyarazi ushobora kwitaho.",
              })}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/learn">{t({ en: "Start the course", rw: "Tangira amasomo" })}</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/programme">{t({ en: "How the programme works", rw: "Uko gahunda ikora" })}</Link>
              </Button>
              <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/partners">{t({ en: "For partners", rw: "Ku bafatanyabikorwa" })}</Link>
              </Button>
              <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/verify" search={{ id: undefined }}>
                  {t({ en: "Verify a certificate", rw: "Genzura impamyabumenyi" })}
                </Link>
              </Button>

            </div>
            <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-8 border-t border-white/15 pt-8 md:grid-cols-3">
              {[
                [`${curriculum.length}`, t({ en: "Modules", rw: "Amasomo" })],
                [`${Math.round(totalMinutes / 60)} h`, t({ en: "Total coaching", rw: "Igihe cyose" })],
                ["2", t({ en: "Languages", rw: "Indimi" })],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl font-bold">{v}</dt>
                  <dd className="mt-1 text-xs opacity-75">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-20">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "Two tracks", rw: "Inzira ebyiri" })}
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {tracks.map((track) => (
              <Card key={track.id} className="border-border/70 p-7 shadow-soft">
                <h2 className="text-xl font-semibold">{t(track.title)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(track.blurb)}
                </p>
                <ul className="mt-5 space-y-2 text-sm">
                  {curriculum
                    .filter((m) => m.track === track.id)
                    .map((m) => (
                      <li key={m.id} className="flex gap-2">
                        <span className="font-display font-bold text-muted-foreground">{m.code}</span>
                        <span>{t(m.title)}</span>
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
          </div>
          <div className="mt-10">
            <Button size="lg" asChild>
              <Link to="/learn">{t({ en: "Open the modules", rw: "Fungura amasomo" })}</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
