import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { usePortal, portalRequest } from "@/hooks/useEmployeePortal";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { shell, card, primary, field, fmtDate, getError } from "./portalShared";
import { LoadState } from "./LoadState";

export function EmployeeAccept() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const q = usePortal<{ name: string; email: string; expires_at: string }>(
    `/employee/invitations/${encodeURIComponent(token)}`,
    !!token,
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(false);
  const { signIn } = useAuth();
  const nav = useNavigate();
  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 12) {
      setError("Use at least 12 characters for your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await portalRequest("/employee/invitations/accept", { token, password });
      const login = await signIn(q.data!.email, password);
      if (login.error) throw login.error;
      nav("/employee", { replace: true });
    } catch (err) {
      const msg = getError(err);
      if (/already|registered|exists|conflict/i.test(msg)) setExisting(true);
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
        <Link to="/" className="font-bold">
          ScopeClear
        </Link>
        <p className="portal-mono mt-8 text-[10px] uppercase tracking-[.16em] text-muted-foreground">
          Team invitation
        </p>
        {!token ? (
          <div className="mt-5">
            <h1 className="text-2xl font-bold">Invitation link missing</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the full link from your invitation email.
            </p>
          </div>
        ) : q.isLoading ? (
          <LoadState retry={() => q.refetch()} />
        ) : q.error ? (
          <LoadState error={q.error} retry={() => q.refetch()} />
        ) : (
          q.data && (
            <>
              <h1 className="mt-2 text-2xl font-bold">
                Join {q.data.name ? `${q.data.name}’s team` : "your team"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Invitation for <b>{q.data.email}</b>. Expires{" "}
                {fmtDate(q.data.expires_at)}.
              </p>
              {existing ? (
                <form
                  className="mt-6 space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    const r = await signIn(q.data!.email, password);
                    if (r.error) {
                      setError(r.error.message);
                      setBusy(false);
                      return;
                    }
                    try {
                      await portalRequest("/employee/invitations/accept", {
                        token,
                      });
                      nav("/employee", { replace: true });
                    } catch (err) {
                      setError(getError(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Label htmlFor="existing-pass">
                    Existing account password
                  </Label>
                  <Input
                    id="existing-pass"
                    className={field}
                    type="password"
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
              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
                >
                  {error}
                </p>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
