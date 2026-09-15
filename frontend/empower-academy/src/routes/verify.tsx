import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { BadgeCheck, ShieldAlert, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle, useT } from "@/lib/lang";
import { verifyCertificate } from "@/lib/academy.functions";

const searchSchema = z.object({ id: z.string().trim().optional() });

export const Route = createFileRoute("/verify")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Verify a certificate — Urugendo Rw'Ubukungu" },
      {
        name: "description",
        content:
          "Bank officers and partners can verify a UZA Empower driver training certificate by its certificate ID. No account required.",
      },
      { property: "og:title", content: "Verify a certificate — Urugendo Rw'Ubukungu" },
      {
        property: "og:description",
        content: "Check whether a UZA Empower training certificate is valid, by certificate ID.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const t = useT();
  const navigate = useNavigate({ from: Route.fullPath });
  const { id } = Route.useSearch();
  const [value, setValue] = useState(id ?? "");

  const result = useQuery({
    queryKey: ["verify", id],
    enabled: Boolean(id && id.length >= 4),
    queryFn: () => verifyCertificate({ data: { certificateId: id! } }),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/" className="font-display text-sm font-semibold">
            Urugendo Rw'Ubukungu
          </Link>
          <LangToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold">
          {t({ en: "Verify a certificate", rw: "Genzura impamyabumenyi" })}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          {t({
            en: "Enter the certificate ID printed on the certificate, or scan its QR code. This page shows only whether the certificate is valid — no other learner information.",
            rw: "Andika nomero y'impamyabumenyi yanditse ku mpapuro, cyangwa usome kode ya QR. Uru rupapuro rwerekana gusa ko impamyabumenyi ifite agaciro — nta yandi makuru y'umunyeshuri.",
          })}
        </p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ search: { id: value.trim().toUpperCase() } });
          }}
        >
          <div className="flex-1">
            <Label htmlFor="cert-id">
              {t({ en: "Certificate ID", rw: "Nomero y'impamyabumenyi" })}
            </Label>
            <Input
              id="cert-id"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="UZA-EMP-2026-XXXXXX"
              className="mt-1.5 h-12 font-mono uppercase"
              autoComplete="off"
            />
          </div>
          <Button type="submit" size="lg" className="h-12">
            <Search className="mr-2 size-4" />
            {t({ en: "Verify", rw: "Genzura" })}
          </Button>
        </form>

        <div className="mt-8">
          {result.isLoading && (
            <Card className="h-40 animate-pulse bg-muted/60 p-6" aria-hidden />
          )}

          {result.isError && (
            <Card className="border-destructive/40 p-6">
              <p className="text-sm text-destructive">
                {t({
                  en: "Verification is temporarily unavailable. Please try again.",
                  rw: "Kugenzura ntibishoboka ubu. Ongera ugerageze.",
                })}
              </p>
            </Card>
          )}

          {result.data && !result.data.found && (
            <Card className="border-destructive/40 p-6">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 size-6 text-destructive" />
                <div>
                  <p className="font-display text-lg font-semibold text-destructive">
                    {t({ en: "Not a valid certificate", rw: "Impamyabumenyi itari yo" })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t({
                      en: "No certificate exists with that ID. Check the spelling and try again.",
                      rw: "Nta mpamyabumenyi ifite iyo nomero. Genzura uko wanditse hanyuma wongere ugerageze.",
                    })}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {result.data?.found && (
            <Card
              className={`p-6 ${result.data.valid ? "border-primary/40" : "border-destructive/40"}`}
            >
              <div className="flex items-start gap-3">
                {result.data.valid ? (
                  <BadgeCheck className="mt-0.5 size-6 text-primary" />
                ) : (
                  <ShieldAlert className="mt-0.5 size-6 text-destructive" />
                )}
                <div className="min-w-0">
                  <p
                    className={`font-display text-lg font-semibold ${
                      result.data.valid ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {result.data.valid
                      ? t({ en: "Valid certificate", rw: "Impamyabumenyi ifite agaciro" })
                      : t({ en: "Revoked — not valid", rw: "Yakuweho — ntagaciro" })}
                  </p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field
                      label={t({ en: "Certificate ID", rw: "Nomero" })}
                      value={result.data.certificate_id}
                      mono
                    />
                    <Field
                      label={t({ en: "Learner name", rw: "Amazina y'umunyeshuri" })}
                      value={result.data.learner_name}
                    />
                    <Field
                      label={t({ en: "Cohort", rw: "Itsinda" })}
                      value={result.data.cohort_label ?? "—"}
                    />
                    <Field
                      label={t({ en: "Issued on", rw: "Yatanzwe ku" })}
                      value={new Date(result.data.issued_on).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    />
                  </dl>
                </div>
              </div>
            </Card>
          )}

          {!id && (
            <p className="text-sm text-muted-foreground">
              {t({
                en: "Enter a certificate ID above to check it.",
                rw: "Andika nomero y'impamyabumenyi haruguru kugira ngo uyigenzure.",
              })}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
