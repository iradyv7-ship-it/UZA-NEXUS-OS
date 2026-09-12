import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/lang";

/** Header affordance that reflects the current session. */
export function AccountLink() {
  const { user, loading } = useAuth();
  const t = useT();

  if (loading) return <span className="h-8 w-20" aria-hidden />;

  return (
    <Button variant={user ? "outline" : "default"} size="sm" asChild>
      {user ? (
        <Link to="/account">{t({ en: "My training", rw: "Amahugurwa yanjye" })}</Link>
      ) : (
        <Link to="/auth">{t({ en: "Sign in", rw: "Injira" })}</Link>
      )}
    </Button>
  );
}
