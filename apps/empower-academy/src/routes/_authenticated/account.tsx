import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { coreCurriculum as curriculum, curriculum as allModules, tracks } from "@/content";
import { LangToggle, useT } from "@/lib/lang";
import { useAuth, signOutEverything } from "@/lib/auth";
import { useProgress } from "@/lib/progress";
import { useCohorts, useProfile, useSaveProfile } from "@/lib/learner";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My training — UZA Drive Academy" },
      {
        name: "description",
        content: "Your saved progress, your training cohort and the next module to continue with.",
      },
      { property: "og:title", content: "My training — UZA Drive Academy" },
      { property: "og:description", content: "Saved progress and cohort for UZA driver training." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const t = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { done } = useProgress();
  const profile = useProfile();
  const cohorts = useCohorts();
  const save = useSaveProfile();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setFullName(profile.data.full_name ?? "");
    setPhone(profile.data.phone ?? "");
  }, [profile.data]);

  const cohort = profile.data?.cohorts ?? null;
  const percent = Math.round((done.length / curriculum.length) * 100);
  const next = curriculum.find((m) => !done.includes(m.id));

  const saveDetails = async () => {
    setSaved(false);
    await save.mutateAsync({ full_name: fullName, phone });
    setSaved(true);
  };

  const join = async () => {
    setJoinError(null);
    const match = (cohorts.data ?? []).find(
      (c) => c.code.toLowerCase() === code.trim().toLowerCase(),
    );
    if (!match) {
      setJoinError(
        t({
          en: "We can't find that cohort code. Ask your facilitator.",
          rw: "Ntitwabonye kode y'itsinda. Baza umutoza wawe.",
        }),
      );
      return;
    }
    await save.mutateAsync({ cohort_id: match.id });
    setCode("");
  };

  const leave = async () => {
    await save.mutateAsync({ cohort_id: null });
  };

  const signOut = async () => {
    await signOutEverything(queryClient);
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/learn" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t({ en: "All modules", rw: "Amasomo yose" })}
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              {t({ en: "Sign out", rw: "Sohoka" })}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold">
          {t({ en: "My training", rw: "Amahugurwa yanjye" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>

        <Card className="mt-8 border-border/70 p-6 shadow-soft">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-eyebrow text-muted-foreground">
                {t({ en: "Progress saved to your account", rw: "Aho ugeze bibitswe kuri konti yawe" })}
              </p>
              <p className="mt-2 font-display text-2xl font-bold">
                {done.length}/{curriculum.length} · {percent}%
              </p>
            </div>
            {next && (
              <Button asChild>
                <Link to="/learn/$moduleId" params={{ moduleId: next.id }}>
                  {t({ en: "Continue", rw: "Komeza" })}
                </Link>
              </Button>
            )}
          </div>
          <Progress value={percent} className="mt-5" />
          {next ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {t({ en: "Next:", rw: "Ikurikira:" })} {next.code} · {t(next.title)}
            </p>
          ) : (
            <div className="mt-4">
              <p className="text-sm font-medium">
                {t({
                  en: "All required modules complete. Pass the final assessment to earn your certificate.",
                  rw: "Amasomo yose asabwa yarangiye. Tsinda ikizamini cya nyuma ubone impamyabumenyi.",
                })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/final-assessment">
                    {t({ en: "Final assessment", rw: "Ikizamini cya nyuma" })}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/certificate">
                    {t({ en: "My certificate", rw: "Impamyabumenyi yanjye" })}
                  </Link>
                </Button>
              </div>
            </div>
          )}
          {next && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t({
                en: "Finish every required module, then pass the final assessment, to earn a certificate a bank can verify.",
                rw: "Rangiza buri somo risabwa, hanyuma utsinde ikizamini cya nyuma, ubone impamyabumenyi banki ishobora kugenzura.",
              })}
            </p>
          )}

        </Card>

        <Card className="mt-6 border-border/70 p-6 shadow-soft">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "My cohort", rw: "Itsinda ryanjye" })}
          </p>
          {cohort ? (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <Badge className="surface-volt border-transparent font-display text-xs">
                  {cohort.code}
                </Badge>
                <span className="font-semibold">{cohort.name}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {[cohort.location, cohort.facilitator, cohort.starts_on]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <Button variant="ghost" size="sm" className="mt-3 px-0" onClick={leave}>
                {t({ en: "Leave this cohort", rw: "Sohoka mu itsinda" })}
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                {t({
                  en: "Enter the cohort code your facilitator gave you, for example KGL-01.",
                  rw: "Andika kode y'itsinda umutoza yaguhaye, urugero KGL-01.",
                })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="KGL-01"
                  className="max-w-[180px] uppercase"
                />
                <Button onClick={join} disabled={save.isPending || !code.trim()}>
                  {t({ en: "Join cohort", rw: "Injira mu itsinda" })}
                </Button>
              </div>
              {joinError && <p className="mt-2 text-sm text-destructive">{joinError}</p>}
              {(cohorts.data ?? []).length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t({ en: "Open cohorts:", rw: "Amatsinda afunguye:" })}{" "}
                  {(cohorts.data ?? []).map((c) => c.code).join(", ")}
                </p>
              )}
            </div>
          )}
        </Card>

        <Card className="mt-6 border-border/70 p-6 shadow-soft">
          <p className="text-eyebrow text-muted-foreground">
            {t({ en: "My details", rw: "Umwirondoro wanjye" })}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acc-name">{t({ en: "Full name", rw: "Amazina yombi" })}</Label>
              <Input
                id="acc-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-phone">{t({ en: "Phone number", rw: "Numero ya telefone" })}</Label>
              <Input
                id="acc-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={saveDetails} disabled={save.isPending}>
              {t({ en: "Save", rw: "Bika" })}
            </Button>
            {saved && (
              <span className="text-sm text-muted-foreground">
                {t({ en: "Saved.", rw: "Byabitswe." })}
              </span>
            )}
          </div>
        </Card>

        {tracks.map((track) => (
          <section key={track.id} className="mt-10">
            <p className="text-eyebrow text-muted-foreground">{t(track.title)}</p>
            <ul className="mt-4 divide-y divide-border/60 rounded-lg border border-border/70">
              {allModules
                .filter((m) => m.track === track.id)
                .map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        done.includes(m.id)
                          ? "surface-volt"
                          : "border border-border text-muted-foreground"
                      }`}
                    >
                      {done.includes(m.id) ? "✓" : ""}
                    </span>
                    <Link
                      to="/learn/$moduleId"
                      params={{ moduleId: m.id }}
                      className="hover:underline"
                    >
                      <span className="font-display font-bold text-muted-foreground">{m.code}</span>{" "}
                      {t(m.title)}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
