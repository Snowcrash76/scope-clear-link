import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { shell, card, primary, field, getError } from "./portalShared";
import { BrandLogo } from "@/components/BrandLogo";

export function EmployeeLogin() {
  const { signIn, user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await signIn(email.trim(), password);
      if (res.error) throw res.error;
      nav("/employee", { replace: true });
    } catch (error) {
      setError(getError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`${shell} portal-grid flex min-h-[100dvh] items-center justify-center p-4`}
    >
      <div className={`${card} portal-enter w-full max-w-md p-6 sm:p-9`}>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center"
        >
          <BrandLogo variant="horizontal" className="w-40" />
        </Link>
        <p className="portal-mono mt-8 text-xs uppercase tracking-[.16em] text-muted-foreground">
          Employee sign in
        </p>
        <h1 className="mt-2 text-3xl font-bold">Welcome to site.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with the email address on your invitation.
        </p>
        {user && <aside className="mt-4 rounded-xl border border-border p-3 text-sm">
          <p className="break-words">Currently signed in as {user.email}. Enter the invited account below to switch.</p>
          <Link className="inline-flex min-h-11 items-center underline" to="/employee">Continue with current account</Link>
        </aside>}
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="emp-email">Email address</Label>
            <Input
              id="emp-email"
              className={`${field} mt-1.5`}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="emp-password">Password</Label>
            <Input
              id="emp-password"
              className={`${field} mt-1.5`}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-muted p-3 text-sm text-muted-foreground"
            >
              {error}
            </p>
          )}
          <Button className={`${primary} w-full`} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline" to={`/forgot-password?email=${encodeURIComponent(email.trim())}`}>Forgot your password?</Link>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Have an invite?{" "}
          <Link
            className="font-semibold text-muted-foreground underline"
            to={`/employee/accept${location.search}`}
          >
            Accept invitation
          </Link>
        </p>
      </div>
    </div>
  );
}
