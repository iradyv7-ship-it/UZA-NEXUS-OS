import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { coreCurriculum } from "@/content";
import { LangToggle, useLang, useT } from "@/lib/lang";
import { useProgress } from "@/lib/progress";
import {
  getFinalStatus,
  getMyCertificate,
  issueMyCertificate,
  type CertificateRecord,
} from "@/lib/academy.functions";
import { downloadCertificatePdf, drawCertificate, type CertificateData } from "@/lib/certificate";

export const Route = createFileRoute("/_authenticated/certificate")({
  head: () => ({
    meta: [
      { title: "My certificate — Urugendo Rw'Ubukungu" },
      {
        name: "description",
        content:
          "Download your verifiable UZA Empower certificate of completion as a PDF, with a certificate ID and QR code a bank can check.",
      },
      { property: "og:title", content: "My certificate — Urugendo Rw'Ubukungu" },
      {
        property: "og:description",
        content: "A bank-verifiable certificate of completion for the UZA Empower driver programme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CertificatePage,
});

function CertificatePage() {
  const t = useT();
  const { lang } = useLang();
  const queryClient = useQueryClient();
  const { done } = useProgress();
  const loadCert = useServerFn(getMyCertificate);
  const loadStatus = useServerFn(getFinalStatus);
  const issue = useServerFn(issueMyCertificate);

  const cert = useQuery({ queryKey: ["my-certificate"], queryFn: () => loadCert() });
  const status = useQuery({ queryKey: ["final-status"], queryFn: () => loadStatus() });

  const total = coreCurriculum.length;
  const coreDone = coreCurriculum.filter((m) => done.includes(m.id)).length;
  const modulesComplete = coreDone >= total;
  const passed = status.data?.passed ?? false;

  const mutation = useMutation({
    mutationFn: () => issue(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-certificate"] }),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/account" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t({ en: "My training", rw: "Amahugurwa yanjye" })}
          </Link>
          <LangToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold">
          {t({ en: "Certificate of completion", rw: "Impamyabumenyi yo kurangiza" })}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {t({
            en: "This certificate is what a bank checks. It carries a unique certificate ID and a QR code that anyone can verify without an account.",
            rw: "Iyi mpamyabumenyi ni iyo banki igenzura. Ifite nomero yihariye na kode ya QR umuntu wese ashobora kugenzura nta konti.",
          })}
        </p>

        {cert.isLoading || status.isLoading ? (
          <Card className="mt-8 h-48 animate-pulse bg-muted/60" aria-hidden />
        ) : cert.data ? (
          <IssuedCertificate record={cert.data} lang={lang} />
        ) : (
          <Card className="mt-8 space-y-5 p-6">
            <Requirement
              met={modulesComplete}
              label={t({ en: "All required modules complete", rw: "Amasomo yose asabwa yarangiye" })}
              detail={`${coreDone}/${total}`}
            />
            <Progress value={(coreDone / total) * 100} className="h-2" />
            <Requirement
              met={passed}
              label={t({
                en: "Final assessment passed",
                rw: "Ikizamini cya nyuma cyatsinzwe",
              })}
              detail={
                status.data?.bestPercent != null
                  ? `${status.data.bestPercent}% · ${t({ en: "pass mark", rw: "atsinda" })} ${status.data.passMark}%`
                  : t({ en: "not attempted", rw: "ntikigerageje" })
              }
            />

            <div className="flex flex-wrap gap-2 pt-2">
              {!passed && (
                <Button asChild>
                  <Link to="/final-assessment">
                    {t({ en: "Go to the final assessment", rw: "Jya ku kizamini cya nyuma" })}
                  </Link>
                </Button>
              )}
              {modulesComplete && passed && (
                <Button size="lg" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                  {mutation.isPending
                    ? t({ en: "Issuing…", rw: "Iratangwa…" })
                    : t({ en: "Issue my certificate", rw: "Ntangira impamyabumenyi yanjye" })}
                </Button>
              )}
              {!modulesComplete && (
                <Button asChild variant="outline">
                  <Link to="/learn">{t({ en: "Continue training", rw: "Komeza amahugurwa" })}</Link>
                </Button>
              )}
            </div>

            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message ||
                  t({ en: "The certificate could not be issued.", rw: "Impamyabumenyi ntiyashoboye gutangwa." })}
              </p>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

function Requirement({
  met,
  label,
  detail,
}: {
  met: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold ${
            met ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
          }`}
        >
          {met ? "✓" : "•"}
        </span>
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>
      <p className="whitespace-nowrap text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function IssuedCertificate({
  record,
  lang,
}: {
  record: CertificateRecord;
  lang: "en" | "rw";
}) {
  const t = useT();
  const holder = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify?id=${record.certificate_id}`
      : `/verify?id=${record.certificate_id}`;

  const data: CertificateData = {
    name: record.learner_name,
    cohort: record.cohort_label,
    issuedOn: new Date(record.issued_on),
    moduleCount: record.modules_completed,
    finalScore: record.final_score,
    certificateId: record.certificate_id,
    verifyUrl,
    lang,
  };

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await drawCertificate(data);
      if (cancelled || !holder.current) return;
      canvas.className = "h-auto w-full rounded-lg border border-border/70";
      canvas.setAttribute("role", "img");
      canvas.setAttribute(
        "aria-label",
        t({ en: "Certificate preview", rw: "Igaragaza ry'impamyabumenyi" }),
      );
      holder.current.replaceChildren(canvas);
    };
    void render();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.certificate_id, lang]);

  return (
    <>
      <Card className="mt-8 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldCheck className="size-5 text-primary" />
          <p className="font-mono text-sm font-semibold">{record.certificate_id}</p>
          {record.revoked_at && (
            <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
              {t({ en: "Revoked", rw: "Yakuweho" })}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadCertificatePdf(data);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download className="mr-2 size-4" />
            {busy
              ? t({ en: "Preparing…", rw: "Bitegurwa…" })
              : t({ en: "Download PDF", rw: "Kuramo PDF" })}
          </Button>
          <Button asChild variant="outline">
            <Link to="/verify" search={{ id: record.certificate_id }}>
              {t({ en: "Public verification page", rw: "Urupapuro rwo kugenzura" })}
            </Link>
          </Button>
        </div>
      </Card>
      <div ref={holder} className="mt-6" />
    </>
  );
}
