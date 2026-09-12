import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LangToggle, useT } from "@/lib/lang";
import { AccountLink } from "@/components/AccountLink";
import { partnerKinds, kindLabel, usePartnerDirectory } from "@/lib/partners";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Partners — police, driving schools, banks and VoltCare garages" },
      {
        name: "description",
        content:
          "UZA Drive Academy is delivered with partners: traffic police for road craft, driving schools for practical hours, banks for bankability, and VoltCare garages for EV maintenance. Apply for a partner portal account.",
      },
      { property: "og:title", content: "Partner with UZA Drive Academy" },
      {
        property: "og:description",
        content:
          "Police, driving schools, banks, garages and employers each get a portal to schedule sessions and record what they delivered.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnersPage,
});

function PartnersPage() {
  const t = useT();
  const { user } = useAuth();
  const directory = usePartnerDirectory();

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

      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="text-3xl font-bold md:text-4xl">
          {t({ en: "We do not teach this alone", rw: "Ibi ntitwabyigisha twenyine" })}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {t({
            en: "UZA builds the curriculum, the records and the platform. The authority on each subject teaches it: the traffic police, driving schools, the bank, and VoltCare garages. Each partner gets its own portal.",
            rw: "UZA yubaka amasomo, inyandiko, n'urubuga. Ufite ubumenyi kuri buri ngingo ni we uyigisha: Polisi y'umuhanda, amashuri yo gutwara, banki, na garage za VoltCare. Buri mufatanyabikorwa afite urubuga rwe.",
          })}
        </p>

        <section className="mt-12">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "Who does what", rw: "Ninde ukora iki" })}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {partnerKinds.map((k) => (
              <Card key={k.id} className="border-border/70 p-6 shadow-soft">
                <h2 className="font-semibold">{t(k.label)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(k.role)}</p>
                <p className="mt-3 text-sm font-medium leading-relaxed">
                  {t({ en: "In the portal: ", rw: "Ku rubuga: " })}
                  <span className="font-normal text-muted-foreground">{t(k.portal)}</span>
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "Approved partners", rw: "Abafatanyabikorwa bemewe" })}
          </p>
          {directory.data && directory.data.length > 0 ? (
            <div className="mt-6 space-y-3">
              {directory.data.map((org) => (
                <Card key={org.id} className="border-border/70 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold">{org.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {t(kindLabel(org.kind))}
                    </Badge>
                    {org.district ? (
                      <span className="text-xs text-muted-foreground">{org.district}</span>
                    ) : null}
                  </div>
                  {org.about ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{org.about}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t({
                en: "The first partner accounts are being set up. Approved organisations are listed here.",
                rw: "Konti za mbere z'abafatanyabikorwa ziratunganywa. Amashyirahamwe yemewe agaragara hano.",
              })}
            </p>
          )}
        </section>

        <section className="mt-14 rounded-xl border border-border/70 bg-muted/30 p-7">
          <h2 className="text-xl font-semibold">
            {t({ en: "Apply for a partner account", rw: "Saba konti y'umufatanyabikorwa" })}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t({
              en: "Register your organisation, then UZA approves it. You will be able to schedule sessions per cohort and record what you delivered. Partners never see learners' personal details — only cohorts, sessions and attendance numbers.",
              rw: "Andikisha ishyirahamwe ryawe, hanyuma UZA iryemeze. Uzashobora gutegura ibyiciro kuri buri tsinda no kwandika ibyo watanze. Abafatanyabikorwa ntibabona amakuru bwite y'abanyeshuri — amatsinda, ibyiciro n'umubare w'abitabiriye gusa.",
            })}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to={user ? "/partner" : "/auth"}>
                {t({ en: "Open the partner portal", rw: "Fungura urubuga rw'abafatanyabikorwa" })}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/programme">{t({ en: "Read the programme", rw: "Soma gahunda" })}</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
