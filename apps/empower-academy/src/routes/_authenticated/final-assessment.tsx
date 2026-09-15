import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LangToggle, useLang, useT } from "@/lib/lang";
import {
  getFinalAssessment,
  getFinalStatus,
  submitFinalAttempt,
  type AttemptResult,
} from "@/lib/academy.functions";

export const Route = createFileRoute("/_authenticated/final-assessment")({
  head: () => ({
    meta: [
      { title: "Final assessment — Urugendo Rw'Ubukungu" },
      {
        name: "description",
        content:
          "Pass the UZA Empower final assessment to earn a verifiable certificate of completion. Graded server-side, limited attempts.",
      },
      { property: "og:title", content: "Final assessment — Urugendo Rw'Ubukungu" },
      {
        property: "og:description",
        content: "The bank-facing final exam of the UZA Empower driver programme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinalAssessmentPage,
});

function FinalAssessmentPage() {
  const t = useT();
  const { lang } = useLang();
  const queryClient = useQueryClient();
  const loadStatus = useServerFn(getFinalStatus);
  const submit = useServerFn(submitFinalAttempt);

  const paper = useQuery({ queryKey: ["final-paper"], queryFn: () => getFinalAssessment() });
  const status = useQuery({ queryKey: ["final-status"], queryFn: () => loadStatus() });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [started, setStarted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => submit({ data: { answers } }),
    onSuccess: (r) => {
      setResult(r);
      setStarted(false);
      void queryClient.invalidateQueries({ queryKey: ["final-status"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const questions = paper.data?.questions ?? [];
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = questions.length > 0 && answered === questions.length;
  const attemptsLeft = status.data
    ? Math.max(0, status.data.maxAttempts - status.data.attemptsUsed)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/account" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t({ en: "My training", rw: "Amahugurwa yanjye" })}
          </Link>
          <LangToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 pb-28">
        <h1 className="font-display text-3xl font-bold">
          {t({ en: "Final assessment", rw: "Ikizamini cya nyuma" })}
        </h1>

        {paper.isLoading || status.isLoading ? (
          <div className="mt-6 space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <Card key={i} className="h-28 animate-pulse bg-muted/60" />
            ))}
          </div>
        ) : paper.isError || status.isError ? (
          <Card className="mt-6 border-destructive/40 p-6 text-sm text-destructive">
            {t({
              en: "The assessment could not be loaded. Check your connection and try again.",
              rw: "Ikizamini ntikishoboye kuboneka. Genzura interineti hanyuma wongere ugerageze.",
            })}
          </Card>
        ) : !paper.data ? (
          <Card className="mt-6 p-6 text-sm text-muted-foreground">
            {t({
              en: "No final assessment is published yet.",
              rw: "Nta kizamini cya nyuma cyatangajwe.",
            })}
          </Card>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Badge>
                {t({ en: "Pass mark", rw: "Amanota atsinda" })}: {paper.data.pass_mark}%
              </Badge>
              <Badge>
                {t({ en: "Questions", rw: "Ibibazo" })}: {paper.data.questions.length}
              </Badge>
              <Badge>
                {t({ en: "Attempts left", rw: "Amahirwe asigaye" })}: {attemptsLeft ?? "—"}
              </Badge>
              {status.data?.bestPercent != null && (
                <Badge>
                  {t({ en: "Best score", rw: "Amanota meza" })}: {status.data.bestPercent}%
                </Badge>
              )}
            </div>

            {result && (
              <Card
                className={`mt-6 p-6 ${result.passed ? "border-primary/40" : "border-destructive/40"}`}
              >
                <div className="flex items-start gap-3">
                  {result.passed ? (
                    <CheckCircle2 className="mt-0.5 size-6 text-primary" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-6 text-destructive" />
                  )}
                  <div>
                    <p className="font-display text-lg font-semibold">
                      {result.passed
                        ? t({ en: "You passed", rw: "Watsinze" })
                        : t({ en: "Not passed yet", rw: "Ntiwatsinze ubu" })}
                      {" — "}
                      {result.percent}% ({result.score}/{result.total})
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {result.passed
                        ? t({
                            en: "Your certificate can now be issued from My training.",
                            rw: "Impamyabumenyi yawe ubu ishobora gutangwa ku Mahugurwa yanjye.",
                          })
                        : t({
                            en: "Review the modules you found hard, then try again.",
                            rw: "Subiramo amasomo yakugoye, hanyuma wongere ugerageze.",
                          })}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.passed ? (
                        <Button asChild>
                          <Link to="/certificate">
                            {t({ en: "Go to my certificate", rw: "Jya ku mpamyabumenyi yanjye" })}
                          </Link>
                        </Button>
                      ) : (
                        result.attemptsLeft > 0 && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAnswers({});
                              setResult(null);
                              setStarted(true);
                            }}
                          >
                            {t({ en: "Try again", rw: "Ongera ugerageze" })}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {!started && !result && (
              <Card className="mt-6 space-y-4 p-6">
                <p className="text-sm text-muted-foreground">
                  {t({
                    en: "This exam is marked on our servers, not on your phone. Banks use the result, so answer honestly and take your time. You may leave and return — but a submitted attempt counts.",
                    rw: "Iki kizamini gikosorwa kuri seriveri zacu, atari kuri telefone yawe. Banki zikoresha ibisubizo, ku bw'ibyo subiza mu bunyangamugayo kandi wifate. Ushobora kuvamo ugaruke — ariko ikizamini watanze kibarwa.",
                  })}
                </p>
                {status.data?.passed ? (
                  <p className="text-sm font-semibold text-primary">
                    {t({
                      en: "You have already passed this assessment.",
                      rw: "Usanzwe watsinze iki kizamini.",
                    })}
                  </p>
                ) : attemptsLeft === 0 ? (
                  <p className="text-sm font-semibold text-destructive">
                    {t({
                      en: "No attempts remain. Speak to your facilitator.",
                      rw: "Nta mahirwe asigaye. Vugana n'umutoza wawe.",
                    })}
                  </p>
                ) : (
                  <Button size="lg" onClick={() => setStarted(true)}>
                    {t({ en: "Start the assessment", rw: "Tangira ikizamini" })}
                  </Button>
                )}
                {status.data?.passed && (
                  <Button asChild variant="outline">
                    <Link to="/certificate">
                      {t({ en: "My certificate", rw: "Impamyabumenyi yanjye" })}
                    </Link>
                  </Button>
                )}
              </Card>
            )}

            {started && (
              <>
                <ol className="mt-6 space-y-4">
                  {questions.map((q, index) => {
                    const prompt = lang === "rw" ? q.prompt_rw : q.prompt_en;
                    const options = lang === "rw" ? q.options_rw : q.options_en;
                    return (
                      <li key={q.id}>
                        <Card className="p-5">
                          <p className="font-display text-base font-semibold">
                            {index + 1}. {prompt}
                          </p>
                          <div className="mt-3 space-y-2">
                            {options.map((option, oi) => {
                              const selected = answers[q.id] === oi;
                              return (
                                <button
                                  key={oi}
                                  type="button"
                                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                                  aria-pressed={selected}
                                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                                    selected
                                      ? "border-primary bg-primary/10 font-semibold text-foreground"
                                      : "border-border bg-card text-foreground hover:bg-muted"
                                  }`}
                                >
                                  <span
                                    className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs ${
                                      selected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + oi)}
                                  </span>
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ol>

                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-5 py-3 backdrop-blur">
                  <div className="mx-auto flex max-w-3xl items-center gap-4">
                    <div className="flex-1">
                      <Progress value={(answered / questions.length) * 100} className="h-2" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {answered}/{questions.length}{" "}
                        {t({ en: "answered", rw: "byasubijwe" })}
                      </p>
                    </div>
                    <Button
                      size="lg"
                      disabled={!allAnswered || mutation.isPending}
                      onClick={() => mutation.mutate()}
                    >
                      {mutation.isPending
                        ? t({ en: "Submitting…", rw: "Kohereza…" })
                        : t({ en: "Submit", rw: "Ohereza" })}
                    </Button>
                  </div>
                </div>

                {mutation.isError && (
                  <p className="mt-4 text-sm text-destructive">
                    {t({
                      en: "The attempt could not be submitted. Check your connection and try again.",
                      rw: "Ikizamini ntikishoboye koherezwa. Genzura interineti hanyuma wongere ugerageze.",
                    })}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-muted px-3 py-1 font-semibold text-muted-foreground">
      {children}
    </span>
  );
}
