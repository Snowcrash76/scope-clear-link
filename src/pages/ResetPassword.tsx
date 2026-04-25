import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { PasswordInput } from '@/components/PasswordInput';
import { supabase } from '@/integrations/supabase/client';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let settled = false;

    const settle = (sessionFound: boolean) => {
      if (settled) return;
      settled = true;
      setHasSession(sessionFound);
      setChecking(false);
    };

    // Listen for PASSWORD_RECOVERY or SIGNED_IN events triggered by the
    // token/code in the URL. This fires after the Supabase client processes
    // the URL fragment or PKCE code, so it's more reliable than getSession().
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        settle(!!session);
      }
    });

    // Also call getSession() in case the session was already established
    // (e.g. user refreshed the page after the token was exchanged).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) settle(true);
    });

    // Fallback: if neither fires within 3 s, treat as no session.
    const timeout = setTimeout(() => settle(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      await supabase.auth.signOut();
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-status-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-status-success" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Password updated!</h1>
            <p className="text-muted-foreground mt-2">
              Your password has been successfully reset
            </p>
          </div>

          <Card className="p-6 text-center">
            <Button onClick={() => navigate('/login')} className="w-full">
              Sign in with new password
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Verifying reset link…</p>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Invalid or expired link</h1>
            <p className="text-muted-foreground mt-2">
              This password reset link is no longer valid
            </p>
          </div>

          <Card className="p-6 text-center">
            <Button onClick={() => navigate('/forgot-password')} className="w-full">
              Request a new reset link
            </Button>
            <div className="mt-4">
              <Link to="/login" className="text-primary hover:underline text-sm font-medium">
                Back to sign in
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Set new password</h1>
          <p className="text-muted-foreground mt-1">
            Choose a strong password for your account
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
