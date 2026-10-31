import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, ArrowLeft, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const fromTeam = searchParams.get('fromTeam') === '1';
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-status-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-status-success" />
            </div>
            <h1 className="font-heading text-2xl font-bold">{fromTeam ? 'Reset link requested' : 'Check your email'}</h1>
            <p className="text-muted-foreground mt-2">
               {fromTeam ? 'A password reset link has been requested for ' : "We've sent a password reset link to "}<strong className="break-words [overflow-wrap:anywhere]">{email}</strong>
            </p>
          </div>

          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            <Button
              variant="outline"
              onClick={() => setSent(false)}
              className="w-full"
            >
              Try again
            </Button>
            <div className="mt-4">
              <Link to={fromTeam ? '/team' : '/login'} className="text-primary hover:underline text-sm font-medium">
                {fromTeam ? 'Back to Team' : 'Back to sign in'}
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
          <Link to={fromTeam ? '/team' : '/login'} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />
            {fromTeam ? 'Back to Team' : 'Back to sign in'}
          </Link>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">{fromTeam ? 'Help reset a member’s password' : 'Forgot your password?'}</h1>
          <p className="text-muted-foreground mt-1">
            {fromTeam ? 'Check the recipient below, then send their reset link. You stay signed in as yourself.' : "No worries, we'll send you reset instructions"}
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Reset Link
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Remember your password? </span>
            <Link to={fromTeam ? '/team' : '/login'} className="text-primary hover:underline font-medium">
              {fromTeam ? 'Back to Team' : 'Sign in'}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
