import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { coreCurriculum, advancedCurriculum, coreMinutes, tracks } from "@/content";
import { LangToggle, useT } from "@/lib/lang";
import { AccountLink } from "@/components/AccountLink";

export const Route = createFileRoute("/programme")({
  head: () => ({
    meta: [
      { title: "The UZA programme — two pathways to owning an electric taxi" },
      {
        name: "description",
        content:
          "How UZA Drive Academy turns experienced Rwandan taxi drivers into bankable EV entrepreneurs: bank-led financial literacy, police-led road craft, VoltCare garage training, and the UZA Shift earn-first pathway.",
      },
      { property: "og:title", content: "The UZA programme — two pathways to owning an electric taxi" },
      {
        property: "og:description",
        content:
          "Bank, police and garage partners, a signed code of conduct, and a record that makes a driver bankable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Programme,
});

const partners = [
  {
    who: { en: "Partner bank", rw: "Banki ifatanyabikorwa" },
    what: {
      en: "Explains its product in plain Kinyarwanda, walks through the repayment table, and states exactly what a clean repayment record earns the driver next time.",
      rw: "Isobanura umusaruro wayo mu Kinyarwanda gisanzwe, inyura mu mbonerahamwe y'ubwishyu, kandi ivuga neza icyo inyandiko nziza yo kwishyura imarira umushoferi ubutaha.",
    },
    ask: {
      en: "Our ask: recognise UZA training, verified trip records and MoMo inflows as credit evidence, and reward on-time repayment with better terms.",
      rw: "Icyo tubasaba: kwemera amahugurwa ya UZA, inyandiko z'ingendo zagenzuwe, n'amafaranga anyura kuri MoMo nk'ibimenyetso by'ikizere, kandi guhemba abishyura ku gihe amasezerano meza.",
    },
  },
  {
    who: { en: "Traffic police", rw: "Polisi y'umuhanda" },
    what: {
      en: "Leads signs, priority and defensive-driving sessions, and gives closing remarks on discipline. Licence holders leave with practised judgement, not just theory.",
      rw: "Iyobora amasomo ku bimenyetso, ubanza, no gutwara wirinda, kandi itanga ijambo ry'umwanzuro ku myitwarire. Abafite uruhushya basohoka bafite ubushishozi bwimenyerejwe, atari inyigisho gusa.",
    },
    ask: {
      en: "Our ask: a quarterly session per cohort and feedback on the incidents they see most from taxi drivers.",
      rw: "Icyo tubasaba: icyiciro kimwe mu mezi atatu kuri buri tsinda n'ibitekerezo ku bibazo babona kenshi kuri abashoferi ba tagisi.",
    },
  },
  {
    who: { en: "VoltCare by UZA Mobility", rw: "VoltCare ya UZA Mobility" },
    what: {
      en: "The maintenance and garage arm. Free owner tutorials on charging, daily checks and battery health; paid specialist modules for technicians on high-voltage safety and diagnostics.",
      rw: "Ishami ry'ubusanure na garage. Amasomo y'ubuntu ku ba nyir'imodoka ku kuzuza umuriro, isuzuma rya buri munsi, n'ubuzima bwa bateri; amasomo yishyurwa ku batekinisiye ku mutekano w'amashanyarazi menshi n'isuzuma.",
    },
    ask: {
      en: "Our ask: workshop time with a car on the lift, and technicians willing to be certified.",
      rw: "Icyo tubasaba: igihe muri garage n'imodoka iri ku gikoresho ciyizamura, n'abatekinisiye biteguye kwemererwa impamyabushobozi.",
    },
  },
];

function Programme() {
  const t = useT();

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
          {t({ en: "The programme", rw: "Gahunda y'amahugurwa" })}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {t({
            en: `${coreCurriculum.length} core modules, about ${Math.round(coreMinutes / 60)} hours, in Kinyarwanda and English — taught on a phone, in a classroom, on the road and inside the workshop.`,
            rw: `Amasomo y'ibanze ${coreCurriculum.length}, hafi amasaha ${Math.round(coreMinutes / 60)}, mu Kinyarwanda no mu Cyongereza — yigishwa kuri telefone, mu cyumba, ku muhanda, no muri garage.`,
          })}
        </p>

        <section className="mt-12">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "Two pathways", rw: "Inzira ebyiri" })}
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Card className="border-border/70 p-7 shadow-soft">
              <Badge className="surface-volt border-transparent text-xs font-semibold">
                {t({ en: "Pathway A · Finance", rw: "Inzira A · Inguzanyo" })}
              </Badge>
              <h2 className="mt-4 text-xl font-semibold">
                {t({ en: "Own the car", rw: "Kugira imodoka" })}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t({
                  en: "For drivers who can already carry an instalment. Core training, signed code of conduct, bank session, then financing — with a written default-prevention plan before the first payment.",
                  rw: "Ku bashoferi bashobora kwishyura ubwishyu. Amasomo y'ibanze, amahame y'imyitwarire ashyizweho umukono, icyiciro cya banki, hanyuma inguzanyo — hamwe na gahunda yanditse yo kwirinda kutishyura mbere y'ubwishyu bwa mbere.",
                })}
              </p>
            </Card>
            <Card className="border-border/70 p-7 shadow-soft">
              <Badge variant="secondary" className="text-xs font-semibold">
                {t({ en: "Pathway B · Earn first", rw: "Inzira B · Banza winjize" })}
              </Badge>
              <h2 className="mt-4 text-xl font-semibold">UZA Shift</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t({
                  en: "For drivers with nothing bankable yet. Authorised private cars are released by their owners for a few hours or weeks; the driver earns per hour or per kilometre, and six months of trips, MoMo inflows and customer ratings become the file that unlocks Pathway A.",
                  rw: "Ku bashoferi badafite ingwate. Imodoka zigenga zemewe zitangwa na ba nyirazo amasaha cyangwa ibyumweru; umushoferi yinjiza ku isaha cyangwa ku kilometero, kandi amezi atandatu y'ingendo, amafaranga ya MoMo n'amanota y'abakiriya bihinduka dosiye ifungura Inzira A.",
                })}
              </p>
            </Card>
          </div>
        </section>

        <section className="mt-14">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "Who teaches what", rw: "Ninde yigisha iki" })}
          </p>
          <div className="mt-6 space-y-4">
            {partners.map((p) => (
              <Card key={p.who.en} className="border-border/70 p-6 shadow-soft">
                <h3 className="text-lg font-semibold">{t(p.who)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(p.what)}</p>
                <p className="mt-3 text-sm font-medium leading-relaxed">{t(p.ask)}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "The six tracks", rw: "Ibyiciro bitandatu" })}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {tracks.map((track) => (
              <Card key={track.id} className="border-border/70 p-5">
                <h3 className="font-semibold">{t(track.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(track.blurb)}
                </p>
              </Card>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            {t({
              en: `Plus ${advancedCurriculum.length} paid specialist module(s) for technicians, taken after the core programme.`,
              rw: `Byiyongeraho amasomo ${advancedCurriculum.length} yishyurwa yihariye ku batekinisiye, afatwa nyuma y'amasomo y'ibanze.`,
            })}
          </p>
        </section>

        <section className="mt-14">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "Inclusion", rw: "Kubumbatira bose" })}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                h: { en: "Women drivers", rw: "Abashoferi b'abagore" },
                p: {
                  en: "Reserved cohort places, a female mentor per cohort, and owners who specifically request women drivers for family and school runs.",
                  rw: "Imyanya yabugenewe mu matsinda, umujyanama w'umugore kuri buri tsinda, na ba nyir'imodoka basaba abashoferi b'abagore ku ngendo z'imiryango n'amashuri.",
                },
              },
              {
                h: { en: "Youth", rw: "Urubyiruko" },
                p: {
                  en: "Young drivers teach the phone and the map; senior drivers teach the road and the customer. Both leave with something the other needed.",
                  rw: "Abashoferi bakiri bato bigisha telefone n'ikarita; abakuru bigisha umuhanda n'umukiriya. Bombi basohoka bafite ibyo undi yabuze.",
                },
              },
              {
                h: { en: "Placement", rw: "Guhuzwa n'akazi" },
                p: {
                  en: "Graduates with clean records are referred to fleets, hotels and companies hiring professional drivers — a placement fee funds more scholarships.",
                  rw: "Abarangije bafite inyandiko nziza bahuzwa n'amasosiyete, amahoteri n'abakoresha bashaka abashoferi b'umwuga — amafaranga y'iyo serivisi atera inkunga andi masomo y'ubuntu.",
                },
              },
            ].map((c) => (
              <Card key={c.h.en} className="border-border/70 p-5">
                <h3 className="font-semibold">{t(c.h)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(c.p)}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "What we measure", rw: "Ibyo dupima" })}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              {
                h: { en: "On-time repayment rate", rw: "Ijanisha ryo kwishyura ku gihe" },
                p: { en: "Target 95%+ per cohort", rw: "Intego 95%+ kuri buri tsinda" },
              },
              {
                h: { en: "Incidents per 10,000 km", rw: "Impanuka kuri km 10,000" },
                p: { en: "Measured before and after road craft", rw: "Bipimwa mbere na nyuma y'amasomo yo ku muhanda" },
              },
              {
                h: { en: "Monthly net income", rw: "Inyungu ya buri kwezi" },
                p: { en: "From the driver's own daily log", rw: "Bivuye mu gitabo cya buri munsi cy'umushoferi" },
              },
              {
                h: { en: "Litres of fuel replaced", rw: "Litiro za lisansi zasimbuwe" },
                p: { en: "One EV replaces roughly 2,000 L per year", rw: "Imodoka imwe y'amashanyarazi isimbura hafi litiro 2,000 ku mwaka" },
              },
            ].map(({ h, p }) => (
              <div key={h.en}>
                <p className="font-semibold leading-snug">{t(h)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(p)}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-14 flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link to="/learn">{t({ en: "Open the modules", rw: "Fungura amasomo" })}</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/auth">{t({ en: "Create an account", rw: "Fungura konti" })}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/partners">{t({ en: "Partner with us", rw: "Dufatanye" })}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
