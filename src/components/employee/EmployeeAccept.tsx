import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { usePortal, portalRequest, PortalRequestError } from "@/hooks/useEmployeePortal";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { shell, card, primary, field, fmtDate, getError } from "./portalShared";
import { LoadState } from "./LoadState";
import { BrandLogo } from "@/components/BrandLogo";

export function EmployeeAccept() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [acceptedEmail, setAcceptedEmail] = useState<string | null>(null);
  const q = usePortal<{ name: string; email: string; expires_at: string }>(
    `/employee/invitations/${encodeURIComponent(token)}`,
    !!token && !acceptedEmail,
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(false);
  const { signIn } = useAuth();
  const nav = useNavigate();
  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const email = q.data?.email;
    if (!email) { setError("Reload the invitation before continuing."); return; }
    if (!existing && password.length < 12) {
      setError("Use at least 12 characters for your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (existing) {
        const login = await signIn(email, password);
        if (login.error) throw login.error;
        await portalRequest("/employee/invitations/accept", { token });
        setAcceptedEmail(email);
      } else {
        await portalRequest("/employee/invitations/accept", { token, password });
        // Acceptance has committed. A subsequent sign-in failure must not offer
        // to create the account again using a now-consumed invitation.
        setAcceptedEmail(email);
        const login = await signIn(email, password);
        if (login.error) throw new Error(`Your invitation was accepted, but automatic sign-in failed. Use Sign in to employee portal below, or reset your password.`);
      }
      setPassword("");
      nav("/employee", { replace: true });
    } catch (err) {
      const msg = getError(err);
      if (err instanceof PortalRequestError && err.code === "ACCOUNT_EXISTS") {
        setExisting(true);
        setPassword("");
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`${shell} portal-grid flex min-h-[100dvh] items-center justify-center p-4`}
    >
      <div className={`${card} w-full max-w-md p-6 sm:p-9`}>
        <Link to="/" className="inline-flex min-h-11 items-center">
          <BrandLogo variant="horizontal" className="w-40" />
        </Link>
        <p className="portal-mono mt-8 text-xs uppercase tracking-[.16em] text-muted-foreground">
          Team invitation
        </p>
        {acceptedEmail ? (
          <section className="mt-5 space-y-4">
            <h1 className="text-2xl font-bold">Invitation accepted</h1>
            <p>Your employee access is connected to <strong className="break-words">{acceptedEmail}</strong>.</p>
            {error && <p role="alert" className="rounded-xl bg-muted p-3 text-sm">{error}</p>}
            <Link className={`${primary} flex min-h-11 items-center justify-center`} to={`/employee/login?email=${encodeURIComponent(acceptedEmail)}`}>Sign in to employee portal</Link>
            <Link className="inline-flex min-h-11 items-center text-sm underline" to={`/forgot-password?email=${encodeURIComponent(acceptedEmail)}`}>Reset password</Link>
          </section>
        ) : !token ? (
          <div className="mt-5">
            <h1 className="text-2xl font-bold">Invitation link missing</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the full link from your invitation email.
            </p>
          </div>
        ) : q.isLoading ? (
          <LoadState retry={() => q.refetch()} />
        ) : q.error ? (
          <div><LoadState error={q.error} retry={() => q.refetch()} />
            <Link className="mt-3 inline-flex min-h-11 items-center text-sm underline" to="/employee/login">Already accepted an invitation? Sign in</Link>
          </div>
        ) : (
          q.data && (
            <>
              <h1 className="mt-2 text-2xl font-bold">
                Set up your employee access
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Invitation for <b>{q.data.email}</b>. Expires{" "}
                {fmtDate(q.data.expires_at)}.
              </p>
              {existing ? (
                <form
                  className="mt-6 space-y-3"
                  onSubmit={accept}
                >
                  <Label htmlFor="existing-pass">
                    Existing account password
                  </Label>
                  <Input
                    id="existing-pass"
                    className={field}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button className={`${primary} w-full`} disabled={busy}>
                    {busy ? "Connecting…" : "Sign in and accept"}
                  </Button>
                </form>
              ) : (
                <form className="mt-6 space-y-3" onSubmit={accept}>
                  <Label htmlFor="new-pass">Create a password</Label>
                  <Input
                    id="new-pass"
                    className={field}
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    At least 12 characters.
                  </p>
                  <Button className={`${primary} w-full`} disabled={busy}>
                    {busy ? "Accepting…" : "Accept invitation"}
                  </Button>
                </form>
              )}
              <button type="button" disabled={busy} className="mt-3 min-h-11 text-sm font-semibold underline" onClick={() => {
                setExisting(value => !value); setPassword(""); setError("");
              }}>{existing ? "Create a new account" : "I already have an account"}</button>
              {existing && <div className="mt-2 text-sm">
                <Link className="inline-flex min-h-11 items-center underline" to={`/forgot-password?email=${encodeURIComponent(q.data.email)}`}>Forgot your password?</Link>
                <p className="text-muted-foreground">After resetting your password, reopen the most recent invitation email and choose “I already have an account”.</p>
              </div>}
              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
                >
                  {error}
                </p>
              )}
              <Link className="mt-3 inline-flex min-h-11 items-center text-sm underline" to={`/employee/login?email=${encodeURIComponent(q.data.email)}`}>Already finished setup? Sign in</Link>
            </>
          )
        )}
      </div>
    </div>
  );
}
