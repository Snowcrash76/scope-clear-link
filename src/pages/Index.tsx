import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { 
  CheckCircle2, 
  Shield, 
  MessageSquare, 
  Clock, 
  ArrowRight,
  Package,
  RefreshCw,
  Users,
  Sparkles
} from 'lucide-react';

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-4 px-4 py-1.5">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Built for Trades
            </Badge>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Keep clients on the same page —{' '}
              <span className="text-accent">every change, every job</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
              Stop scope creep. Prevent disputes. The client-facing workspace that turns 
              accepted quotes into shared understanding.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Button size="lg" variant="accent" asChild>
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" variant="accent" asChild>
                    <Link to="/signup">
                      Get Started Free
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/login">
                      Sign In
                    </Link>
                  </Button>
                </>
              )}
            </div>
            <div className="mt-4">
              <Link to="/demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Or view the client demo →
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Problem Section */}
      <section className="py-16 sm:py-24 bg-secondary/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
              The problem with PDFs and emails
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Clients say "yes" to quotes they barely understand. Different mental models 
              lead to disputes before work even begins.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2">
                "I thought that was included"
              </h3>
              <p className="text-sm text-muted-foreground">
                Scope misunderstandings cause 80% of trade disputes
              </p>
            </Card>
            
            <Card className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2">
                Hours of explanation
              </h3>
              <p className="text-sm text-muted-foreground">
                Endless texts and calls explaining what's happening and why
              </p>
            </Card>
            
            <Card className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2">
                Scope creep stress
              </h3>
              <p className="text-sm text-muted-foreground">
                Awkward money conversations when changes aren't documented
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
              A living project page your clients actually use
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              No client accounts. No app downloads. Just a persistent link that keeps 
              everyone aligned.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-approved/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-approved" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-1">
                    Visual Scope Breakdown
                  </h3>
                  <p className="text-muted-foreground">
                    Included, excluded, and assumptions — crystal clear. Clients acknowledge 
                    each section before work begins.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-pending/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-pending-foreground" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-1">
                    Variation Approvals
                  </h3>
                  <p className="text-muted-foreground">
                    Site issues, substitutions, client requests — all tracked with cost 
                    and time impacts. One-click approvals.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-1">
                    Audit Trail
                  </h3>
                  <p className="text-muted-foreground">
                    Every change, every approval, every timestamp. Protection if things 
                    ever go sideways.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-1">
                    Zero Client Friction
                  </h3>
                  <p className="text-muted-foreground">
                    No passwords, no apps. Just a link they can check anytime. Works on 
                    any device.
                  </p>
                </div>
              </div>
            </div>

            <Card className="p-6 bg-card shadow-elevated">
              <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                <div className="text-center px-4">
                  <CheckCircle2 className="w-16 h-16 text-approved mx-auto mb-4" />
                  <p className="font-heading font-semibold text-lg">
                    Interactive Demo Below
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    See how clients view and interact with their project
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
            Stop explaining. Start approving.
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Keep using Tradify for quotes and invoices. Use this to make sure 
            clients understand and approve every change.
          </p>
          <Button size="lg" variant="accent" asChild>
            <Link to="/demo">
              Try the Demo
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm text-muted-foreground">
          <p>Built for trades who value clarity over chaos.</p>
        </div>
      </footer>
    </div>
  );
}
