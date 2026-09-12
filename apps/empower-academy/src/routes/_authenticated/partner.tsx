import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LangToggle, useT } from "@/lib/lang";
import { useCohorts } from "@/lib/learner";
import {
  kindLabel,
  partnerKinds,
  useApplyAsPartner,
  useMyPartnerOrgs,
  usePartnerSessions,
  useSaveSession,
  type PartnerKind,
} from "@/lib/partners";

export const Route = createFileRoute("/_authenticated/partner")({
  head: () => ({
    meta: [
      { title: "Partner portal — UZA Drive Academy" },
      {
        name: "description",
        content:
          "Portal for police, driving schools, banks, garages and employers delivering UZA driver training sessions.",
      },
      { property: "og:title", content: "Partner portal — UZA Drive Academy" },
      {
        property: "og:description",
        content: "Schedule sessions per cohort and record what your organisation delivered.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnerPortal,
});

function PartnerPortal() {
  const t = useT();
  const orgs = useMyPartnerOrgs();
  const rows = orgs.data ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = rows.find((r) => r.partner_orgs!.id === activeId) ?? rows[0];
  const org = active?.partner_orgs ?? null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t({ en: "Home", rw: "Ahabanza" })}
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Button variant="outline" size="sm" asChild>
              <Link to="/account">{t({ en: "My training", rw: "Amahugurwa yanjye" })}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-2xl font-bold md:text-3xl">
          {t({ en: "Partner portal", rw: "Urubuga rw'abafatanyabikorwa" })}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t({
            en: "Schedule and record the sessions your organisation delivers to UZA cohorts. Learner personal details stay private — you see cohorts, sessions and attendance numbers only.",
            rw: "Tegura kandi wandike ibyiciro ishyirahamwe ryawe ritanga ku matsinda ya UZA. Amakuru bwite y'abanyeshuri aguma mu ibanga — ubona amatsinda, ibyiciro n'umubare w'abitabiriye gusa.",
          })}
        </p>

        {rows.length > 1 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {rows.map((r) => (
              <button
                key={r.partner_orgs!.id}
                type="button"
                onClick={() => setActiveId(r.partner_orgs!.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  r.partner_orgs!.id === org?.id
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {r.partner_orgs!.name}
              </button>
            ))}
          </div>
        ) : null}

        {org ? (
          <OrgPanel
            org={org}
            role={active!.role}
          />
        ) : (
          <ApplyForm loading={orgs.isLoading} />
        )}
      </main>
    </div>
  );
}

type Org = {
  id: string;
  name: string;
  kind: string;
  district: string | null;
  about: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
};

function OrgPanel({ org, role }: { org: Org; role: string }) {
  const t = useT();
  const cohorts = useCohorts();
  const sessions = usePartnerSessions(org.id);
  const save = useSaveSession(org.id);

  const [title, setTitle] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [present, setPresent] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pending = org.status !== "approved";

  const submit = async () => {
    setError(null);
    if (!title.trim()) {
      setError(t({ en: "Give the session a title.", rw: "Tanga izina ry'icyiciro." }));
      return;
    }
    try {
      await save.mutateAsync({
        title: title.trim(),
        cohort_id: cohortId || null,
        scheduled_for: date || null,
        location: location.trim() || null,
        learners_present: present ? Number(present) : null,
        notes: notes.trim() || null,
        status: present ? "delivered" : "planned",
      });
      setTitle("");
      setDate("");
      setLocation("");
      setPresent("");
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <Card className="mt-8 border-border/70 p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{org.name}</h2>
          <Badge variant="secondary" className="text-xs">
            {t(kindLabel(org.kind))}
          </Badge>
          <Badge
            className={
              pending
                ? "border-transparent bg-muted text-xs text-muted-foreground"
                : "surface-volt border-transparent text-xs font-semibold"
            }
          >
            {pending
              ? t({ en: "Awaiting UZA approval", rw: "Bitegereje kwemezwa na UZA" })
              : t({ en: "Approved partner", rw: "Umufatanyabikorwa wemewe" })}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {role === "owner" ? t({ en: "Owner", rw: "Nyiri konti" }) : t({ en: "Staff", rw: "Umukozi" })}
          </span>
        </div>
        {org.district ? <p className="mt-2 text-sm text-muted-foreground">{org.district}</p> : null}
        {pending ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t({
              en: "You can already plan sessions. Once UZA approves your organisation it also appears in the public partner directory.",
              rw: "Ushobora gutegura ibyiciro nonaha. UZA nimara kwemeza ishyirahamwe ryawe, rizagaragara no ku rutonde rusange rw'abafatanyabikorwa.",
            })}
          </p>
        ) : null}
      </Card>

      <Card className="mt-6 border-border/70 p-6 shadow-soft">
        <h3 className="font-semibold">
          {t({ en: "Log or plan a session", rw: "Andika cyangwa utegure icyiciro" })}
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="p-title">{t({ en: "Session title", rw: "Izina ry'icyiciro" })}</Label>
            <Input
              id="p-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t({ en: "Signs and priority — practical", rw: "Ibimenyetso n'ubanza — imyitozo" })}
            />
          </div>
          <div>
            <Label htmlFor="p-cohort">{t({ en: "Cohort", rw: "Itsinda" })}</Label>
            <select
              id="p-cohort"
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t({ en: "Not tied to a cohort", rw: "Ntaho bihuriye n'itsinda" })}</option>
              {(cohorts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="p-date">{t({ en: "Date", rw: "Itariki" })}</Label>
            <Input id="p-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-loc">{t({ en: "Place", rw: "Ahantu" })}</Label>
            <Input id="p-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-present">
              {t({ en: "Learners present (after the session)", rw: "Abitabiriye (nyuma y'icyiciro)" })}
            </Label>
            <Input
              id="p-present"
              type="number"
              min={0}
              value={present}
              onChange={(e) => setPresent(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="p-notes">
              {t({ en: "Notes — what to fix next time", rw: "Inyandiko — ibigomba kunozwa ubutaha" })}
            </Label>
            <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button className="mt-4" onClick={submit} disabled={save.isPending}>
          {t({ en: "Save session", rw: "Bika icyiciro" })}
        </Button>
      </Card>

      <section className="mt-8">
        <p className="text-eyebrow text-muted-foreground">
          {t({ en: "Session record", rw: "Inyandiko y'ibyiciro" })}
        </p>
        {sessions.data && sessions.data.length > 0 ? (
          <div className="mt-4 space-y-3">
            {sessions.data.map((s) => (
              <Card key={s.id} className="border-border/70 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h4 className="font-semibold">{s.title}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {s.status === "delivered"
                      ? t({ en: "Delivered", rw: "Cyatanzwe" })
                      : t({ en: "Planned", rw: "Cyateganyijwe" })}
                  </Badge>
                  {s.scheduled_for ? (
                    <span className="text-xs text-muted-foreground">{s.scheduled_for}</span>
                  ) : null}
                  {typeof s.learners_present === "number" ? (
                    <span className="text-xs text-muted-foreground">
                      {s.learners_present} {t({ en: "learners", rw: "abanyeshuri" })}
                    </span>
                  ) : null}
                </div>
                {s.location ? <p className="mt-1 text-sm text-muted-foreground">{s.location}</p> : null}
                {s.notes ? <p className="mt-2 text-sm leading-relaxed">{s.notes}</p> : null}
              </Card>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {t({ en: "No sessions recorded yet.", rw: "Nta cyiciro cyanditswe." })}
          </p>
        )}
      </section>
    </>
  );
}

function ApplyForm({ loading }: { loading: boolean }) {
  const t = useT();
  const apply = useApplyAsPartner();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PartnerKind>("rnp");
  const [district, setDistrict] = useState("");
  const [about, setAbout] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <p className="mt-8 text-sm text-muted-foreground">…</p>;
  }

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError(t({ en: "Enter your organisation name.", rw: "Andika izina ry'ishyirahamwe." }));
      return;
    }
    try {
      await apply.mutateAsync({
        name: name.trim(),
        kind,
        district: district.trim() || null,
        about: about.trim() || null,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card className="mt-8 border-border/70 p-6 shadow-soft">
      <h2 className="text-lg font-semibold">
        {t({ en: "Register your organisation", rw: "Andikisha ishyirahamwe ryawe" })}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t({
          en: "Tell us who you are and what you would teach. UZA reviews every application before an organisation is listed publicly.",
          rw: "Tubwire uwo uri we n'icyo wigisha. UZA isuzuma buri busabe mbere yuko ishyirahamwe rigaragara ku rutonde rusange.",
        })}
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="o-name">{t({ en: "Organisation name", rw: "Izina ry'ishyirahamwe" })}</Label>
          <Input id="o-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="o-kind">{t({ en: "Type of partner", rw: "Ubwoko bw'umufatanyabikorwa" })}</Label>
          <select
            id="o-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as PartnerKind)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {partnerKinds.map((k) => (
              <option key={k.id} value={k.id}>
                {t(k.label)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="o-district">{t({ en: "District", rw: "Akarere" })}</Label>
          <Input id="o-district" value={district} onChange={(e) => setDistrict(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="o-cname">{t({ en: "Contact person", rw: "Uwo tuvugana" })}</Label>
          <Input id="o-cname" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="o-cphone">{t({ en: "Phone", rw: "Telefone" })}</Label>
          <Input id="o-cphone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="o-cemail">{t({ en: "Email", rw: "Imeyili" })}</Label>
          <Input
            id="o-cemail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="o-about">
            {t({ en: "What will you contribute?", rw: "Ni iki uzatanga?" })}
          </Label>
          <Textarea id="o-about" value={about} onChange={(e) => setAbout(e.target.value)} rows={3} />
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <Button className="mt-4" onClick={submit} disabled={apply.isPending}>
        {t({ en: "Send application", rw: "Ohereza ubusabe" })}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        {t({
          en: "You become the owner of the account and can add colleagues later.",
          rw: "Uba nyiri konti kandi ushobora kongeramo bagenzi bawe nyuma.",
        })}
      </p>
    </Card>
  );
}
