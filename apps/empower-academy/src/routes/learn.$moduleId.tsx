import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { moduleById } from "@/content";
import { LangToggle, useT } from "@/lib/lang";
import { useProgress } from "@/lib/progress";
import { AccountLink } from "@/components/AccountLink";
import { useState } from "react";

export const Route = createFileRoute("/learn/$moduleId")({
  loader: ({ params }) => {
    const mod = moduleById(params.moduleId);
    if (!mod) throw notFound();
    return { moduleId: mod.id };
  },
  head: ({ params }) => {
    const mod = moduleById(params.moduleId);
    const title = mod ? `${mod.code} · ${mod.title.en} — UZA Drive Academy` : "Lesson — UZA Drive Academy";
    const description = mod ? mod.why.en.slice(0, 155) : "Driver training module.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ModulePage,
});

function ModulePage() {
  const { moduleId } = Route.useLoaderData();
  const mod = moduleById(moduleId)!;
  const t = useT();
  const { done, toggle, signedIn } = useProgress();
  const [answers, setAnswers] = useState<Record<string, number>>({});

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/learn" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t({ en: "All modules", rw: "Amasomo yose" })}
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <AccountLink />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <Badge className="surface-volt border-transparent font-display text-xs font-semibold">
          {mod.code} · {mod.minutes} {t({ en: "minutes", rw: "iminota" })}
        </Badge>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">{t(mod.title)}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{t(mod.why)}</p>

        {mod.remember.length > 0 && (
          <Card className="mt-8 border-border/70 p-6 shadow-soft">
            <p className="text-eyebrow text-muted-foreground">
              {t({ en: "Remember", rw: "Ibyo kwibuka" })}
            </p>
            <ul className="mt-3 space-y-2">
              {mod.remember.map((r) => (
                <li key={r.en} className="text-sm font-medium leading-relaxed">
                  • {t(r)}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="mt-12 space-y-10">
          {mod.lessons.map((lesson, i) => (
            <section key={lesson.id}>
              <p className="text-eyebrow text-muted-foreground">
                {t({ en: "Lesson", rw: "Isomo" })} {i + 1}
              </p>
              <h2 className="mt-2 text-2xl font-bold">{t(lesson.title)}</h2>
              <div className="mt-4 space-y-4">
                {lesson.body.map((p) => (
                  <p key={p.en} className="leading-relaxed">
                    {t(p)}
                  </p>
                ))}
              </div>
              <Card className="mt-5 border-transparent bg-accent p-5">
                <p className="text-eyebrow text-accent-foreground/70">
                  {t({ en: "Do this now", rw: "Kora ibi nonaha" })}
                </p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-accent-foreground">
                  {t(lesson.practice)}
                </p>
              </Card>
              {lesson.facilitator && (
                <Card className="mt-3 border-dashed border-border p-5">
                  <p className="text-eyebrow text-muted-foreground">
                    {t({ en: "Facilitator note (classroom)", rw: "Inama y'umutoza (mu cyumba)" })}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(lesson.facilitator)}
                  </p>
                </Card>
              )}
            </section>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-bold">{t({ en: "Check yourself", rw: "Isuzume" })}</h2>
          <div className="mt-5 space-y-5">
            {mod.quiz.map((q) => {
              const chosen = answers[q.id];
              return (
                <Card key={q.id} className="border-border/70 p-6 shadow-soft">
                  <p className="font-semibold">{t(q.question)}</p>
                  <div className="mt-4 space-y-2">
                    {q.options.map((opt, idx) => {
                      const picked = chosen === idx;
                      const correct = idx === q.answer;
                      return (
                        <button
                          key={opt.en}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                          className={`block w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                            picked
                              ? correct
                                ? "border-primary bg-secondary font-semibold"
                                : "border-destructive bg-destructive/10"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {t(opt)}
                        </button>
                      );
                    })}
                  </div>
                  {chosen !== undefined && (
                    <p className="mt-4 text-sm text-muted-foreground">{t(q.explain)}</p>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => toggle(mod.id)}>
            {done.includes(mod.id)
              ? t({ en: "Completed ✓", rw: "Byarangiye ✓" })
              : t({ en: "Mark this module complete", rw: "Shyiraho ko iri somo ryarangiye" })}
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/learn">{t({ en: "Back to modules", rw: "Subira ku masomo" })}</Link>
          </Button>
        </div>
        {!signedIn && (
          <p className="mt-4 text-sm text-muted-foreground">
            <Link to="/auth" className="font-medium text-foreground underline underline-offset-4">
              {t({ en: "Sign in", rw: "Injira" })}
            </Link>{" "}
            {t({
              en: "to save this module to your account and continue later on any phone.",
              rw: "kubika iri somo kuri konti yawe no gukomeza nyuma kuri telefone iyo ari yo yose.",
            })}
          </p>
        )}
      </main>
    </div>
  );
}
