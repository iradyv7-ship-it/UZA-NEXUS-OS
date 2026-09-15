import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { LangToggle, useLang, useT } from "@/lib/lang";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — UZA Drive Academy" },
      {
        name: "description",
        content:
          "Create a learner account to save your module progress, join your training cohort and continue the course on any phone.",
      },
      { property: "og:title", content: "Sign in — UZA Drive Academy" },
      {
        property: "og:description",
        content: "Save your progress and join your training cohort.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/account", replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone, lang },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage(
            t({
              en: "Check your email and click the link to confirm your account, then sign in.",
              rw: "Reba imeyili yawe ukande kuri link yo kwemeza konti yawe, hanyuma winjire.",
            }),
          );
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(String(result.error));
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/account", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t({ en: "Home", rw: "Ahabanza" })}
          </Link>
          <LangToggle />
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-12">
        <h1 className="font-display text-3xl font-bold">
          {mode === "in"
            ? t({ en: "Continue your training", rw: "Komeza amahugurwa yawe" })
            : t({ en: "Create your learner account", rw: "Fungura konti y'umunyeshuri" })}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t({
            en: "With an account your finished modules are saved, you can join your cohort, and you continue from where you stopped on any phone.",
            rw: "Ufite konti, amasomo warangije abikwa, ushobora kwinjira mu itsinda ryawe, ukomeza aho wagarukiye kuri telefone iyo ari yo yose.",
          })}
        </p>

        <Card className="mt-8 border-border/70 p-6 shadow-soft">
          <Button type="button" variant="outline" className="w-full" onClick={google}>
            {t({ en: "Continue with Google", rw: "Komeza ukoresheje Google" })}
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t({ en: "or", rw: "cyangwa" })}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "up" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">{t({ en: "Full name", rw: "Amazina yombi" })}</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    {t({ en: "Phone number", rw: "Numero ya telefone" })}
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="07.."
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t({ en: "Email", rw: "Imeyili" })}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t({ en: "Password", rw: "Ijambobanga" })}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {mode === "in"
                ? t({ en: "Sign in", rw: "Injira" })
                : t({ en: "Create account", rw: "Fungura konti" })}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setError(null);
              setMessage(null);
            }}
            className="mt-5 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "in"
              ? t({ en: "I don't have an account yet", rw: "Nta konti mfite" })
              : t({ en: "I already have an account", rw: "Nsanzwe mfite konti" })}
          </button>
        </Card>
      </main>
    </div>
  );
}
