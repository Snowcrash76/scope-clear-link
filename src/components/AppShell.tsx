import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CreateJobModal } from '@/components/CreateJobModal';
import { useCreateProject, type CreateProjectData } from '@/hooks/useCreateProject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Plus,
  Settings,
  LogOut,
  Menu,
  Save,
  UploadCloud,
  X,
  Building2,
  Phone,
  Globe,
  Hash,
  MapPin,
  User,
  Mail,
  Loader2,
  FolderOpen,
  FileText,
  Receipt,
  Users,
  KeyRound,
  ShieldCheck,
  ChartNoAxesCombined,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordInput } from '@/components/PasswordInput';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export function parseDefaultTerms(raw: string | null): { quote: string; invoice: string } {
  if (!raw) return { quote: '', invoice: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { quote: parsed.quote ?? '', invoice: parsed.invoice ?? '' };
    }
  } catch { /* not JSON — legacy plain text */ }
  return { quote: '', invoice: raw };
}

function encodeDefaultTerms(quote: string, invoice: string): string | null {
  const q = quote.trim();
  const i = invoice.trim();
  if (!q && !i) return null;
  return JSON.stringify({ quote: q, invoice: i });
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface SidebarInnerProps {
  authEmail?: string;
  onNewJob: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  currentPath: string;
  onClose?: () => void;
  businessName?: string;
  contactName?: string;
  email?: string;
}

function SidebarInner({
  authEmail,
  onNewJob,
  onOpenSettings,
  onSignOut,
  currentPath,
  onClose,
  businessName,
  contactName,
  email,
}: SidebarInnerProps) {
  const act = (fn: () => void) => { onClose?.(); fn(); };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', active: currentPath === '/dashboard', testId: 'nav-dashboard' },
    { to: '/projects', icon: FolderOpen, label: 'Jobs', active: currentPath.startsWith('/projects') || currentPath.startsWith('/manage'), testId: 'nav-projects' },
    { to: '/profitability', icon: ChartNoAxesCombined, label: 'Profitability', active: currentPath.startsWith('/profitability'), testId: 'nav-profitability' },
    { to: '/quotes', icon: FileText, label: 'Quotes', active: currentPath.startsWith('/quotes'), testId: 'nav-quotes' },
    { to: '/invoices', icon: Receipt, label: 'Invoices', active: currentPath.startsWith('/invoices'), testId: 'nav-invoices' },
    { to: '/clients', icon: Users, label: 'Clients', active: currentPath.startsWith('/clients'), testId: 'nav-clients' },
  ];

  return (
    <div className="flex flex-col h-full bg-white text-zinc-800 border-r border-zinc-200">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 border-b border-zinc-200">
        <div className="flex items-center gap-2.5">
          <span className="font-heading font-black text-xl tracking-tighter text-amber-700">ScopeClear</span>
        </div>
        {businessName && (
          <p className="text-xs text-zinc-600 mt-1 truncate">{businessName}</p>
        )}
      </div>

      {/* New Job CTA */}
      <div className="px-4 pt-5 pb-2">
        <button
          onClick={() => act(onNewJob)}
          className="w-full min-h-11 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-900 font-bold text-sm transition-colors active:scale-95"
          data-testid="button-sidebar-new-job"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      {/* Nav items */}
      <nav className="pt-3 flex-1 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, active, testId }) => (
          <Link
            key={label}
            to={to}
            onClick={() => onClose?.()}
            className={cn(
              'flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-l-4 border-amber-500 bg-amber-50 text-amber-800'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg mx-1'
            )}
            data-testid={testId}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
        {ADMIN_EMAIL && authEmail === ADMIN_EMAIL && (
          <Link
            to="/admin"
            onClick={() => onClose?.()}
            className={cn(
              'flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
              currentPath.startsWith('/admin')
                ? 'border-l-4 border-amber-500 bg-amber-50 text-amber-800'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg mx-1'
            )}
            data-testid="nav-admin"
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            Admin
          </Link>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-zinc-200 pt-3 pb-5 space-y-0.5">
        <button
          onClick={() => act(onOpenSettings)}
          className="w-full min-h-11 flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          data-testid="button-sidebar-settings"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          Settings
        </button>
        {contactName && (
          <div className="flex items-center gap-3 px-4 py-2.5 mt-1">
            <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-zinc-900 text-xs font-bold flex-shrink-0">
              {getInitials(contactName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate text-zinc-800">{contactName}</p>
              {email && <p className="text-xs text-zinc-600 truncate">{email}</p>}
            </div>
            <button
              onClick={() => act(onSignOut)}
              title="Sign out"
              className="h-11 w-11 rounded hover:bg-zinc-100 transition-colors flex-shrink-0 inline-flex items-center justify-center"
              data-testid="button-sidebar-sign-out"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { profile, signOut, user } = useAuth();
  const { createProject } = useCreateProject();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [settingsForm, setSettingsForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    businessAddress: '',
    abn: '',
    website: '',
    quoteTerms: '',
    invoiceTerms: '',
    defaultPaymentInstructions: '',
  });
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [pendingLogoDataUrl, setPendingLogoDataUrl] = useState('');
  const [removeLogo, setRemoveLogo] = useState(false);

  // Account tab state
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwErrors, setPwErrors] = useState({ current: '', next: '', confirm: '', general: '' });

  const loadSettings = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('business_name, contact_name, email, phone, business_address, abn, website, default_terms, default_payment_instructions, logo_url')
      .eq('user_id', user.id)
      .single();
    if (!data) return;
    const row = data as ProfileRow;
    const parsedTerms = parseDefaultTerms(row.default_terms ?? null);
    setSettingsForm({
      businessName: row.business_name || '',
      contactName: row.contact_name || '',
      email: row.email || '',
      phone: row.phone || '',
      businessAddress: row.business_address || '',
      abn: row.abn || '',
      website: row.website || '',
      quoteTerms: parsedTerms.quote,
      invoiceTerms: parsedTerms.invoice,
      defaultPaymentInstructions: row.default_payment_instructions || '',
    });
    const stored = row.logo_url || '';
    setLogoDataUrl(stored.startsWith('data:') ? stored : '');
  };

  useEffect(() => {
    loadSettings();
  }, [user?.id]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 1 * 1024 * 1024) { toast.error('Logo must be under 1 MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => { setPendingLogoDataUrl(reader.result as string); setRemoveLogo(false); };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setPendingLogoDataUrl('');
    setRemoveLogo(true);
    setLogoDataUrl('');
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleSaveSettings = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const newLogoUrl = removeLogo ? null : (pendingLogoDataUrl || logoDataUrl || null);
      const updatePayload: ProfileUpdate = {
        business_name: settingsForm.businessName,
        contact_name: settingsForm.contactName,
        phone: settingsForm.phone || null,
        email: settingsForm.email || null,
        business_address: settingsForm.businessAddress || null,
        abn: settingsForm.abn || null,
        website: settingsForm.website || null,
        default_terms: encodeDefaultTerms(settingsForm.quoteTerms, settingsForm.invoiceTerms),
        default_payment_instructions: settingsForm.defaultPaymentInstructions || null,
        logo_url: newLogoUrl,
      };
      const { error } = await supabase.from('profiles').update(updatePayload).eq('user_id', user.id);
      if (error) throw error;
      toast.success('Settings saved');
      setPendingLogoDataUrl('');
      setRemoveLogo(false);
      setIsSettingsOpen(false);
      await loadSettings();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    toast.success('Signed out successfully');
  };

  const openSettings = () => {
    loadSettings();
    setNewEmail('');
    setEmailSent(false);
    setEmailError('');
    setPwForm({ current: '', next: '', confirm: '' });
    setPwErrors({ current: '', next: '', confirm: '', general: '' });
    setIsSettingsOpen(true);
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed || !user?.email) return;
    setEmailError('');
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setEmailSaving(false);
    if (error) {
      setEmailError(error.message);
    } else {
      setEmailSent(true);
      setNewEmail('');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = { current: '', next: '', confirm: '', general: '' };
    if (pwForm.next.length < 6) errors.next = 'Must be at least 6 characters';
    if (pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm) errors.confirm = 'Passwords do not match';
    if (errors.next || errors.confirm) { setPwErrors(errors); return; }
    if (!user?.email) return;
    setPwErrors({ current: '', next: '', confirm: '', general: '' });
    setPwSaving(true);
    // Verify current password by re-authenticating
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: pwForm.current,
    });
    if (authError) {
      setPwErrors(e => ({ ...e, current: 'Current password is incorrect' }));
      setPwSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    setPwSaving(false);
    if (error) {
      setPwErrors(e => ({ ...e, general: error.message }));
    } else {
      toast.success('Password updated');
      setPwForm({ current: '', next: '', confirm: '' });
    }
  };

  const handleCreateJob = async (jobData: CreateProjectData) => {
    const projectId = await createProject(jobData);
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: ['/activity-feed', user?.id] });
      toast.success('Job & quote created! Review and send to your client.');
      setIsCreateModalOpen(false);
      navigate(`/manage/${projectId}?tab=quote`);
    }
  };

  const sidebarProps: SidebarInnerProps = {
    authEmail: user?.email,
    onNewJob: () => setIsCreateModalOpen(true),
    onOpenSettings: openSettings,
    onSignOut: handleSignOut,
    currentPath: pathname,
    businessName: profile?.business_name,
    contactName: profile?.contact_name,
    email: profile?.email,
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-40">
        <SidebarInner {...sidebarProps} />
      </aside>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-[min(20rem,85vw)] max-w-none border-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarInner {...sidebarProps} onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Page content */}
      <div className="flex-1 lg:pl-64 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex h-16 shrink-0 items-center gap-3 px-4 py-2 border-b border-zinc-200 bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted transition-colors"
            data-testid="button-mobile-menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-bold text-base">ScopeClear</span>
        </div>

        {children}
      </div>

      {/* New Job Modal */}
      <CreateJobModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateJob={handleCreateJob}
        defaultQuoteTerms={settingsForm.quoteTerms}
      />

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Settings
            </DialogTitle>
            <DialogDescription>
              Manage your business details and account credentials.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="business" className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-2">
              <TabsTrigger value="business" data-testid="tab-settings-business">Business</TabsTrigger>
              <TabsTrigger value="account" data-testid="tab-settings-account">Account</TabsTrigger>
            </TabsList>

            {/* ── BUSINESS TAB ── */}
            <TabsContent value="business">
          <div className="space-y-6 py-2">
            {/* Logo */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Business Logo
              </h3>
              <div className="flex items-start gap-4">
                {(pendingLogoDataUrl || logoDataUrl) ? (
                  <div className="relative">
                    <img
                      src={pendingLogoDataUrl || logoDataUrl}
                      alt="Business logo"
                      className="h-20 max-w-[160px] object-contain rounded border bg-muted/30 p-1"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground w-5 h-5 flex items-center justify-center hover:opacity-90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="h-20 w-40 rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <UploadCloud className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Upload logo</span>
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                    <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                    {pendingLogoDataUrl || logoDataUrl ? 'Change logo' : 'Choose file'}
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG or JPG, max 1 MB. Appears on quotes and invoices.</p>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoFileChange} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Business Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Business Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="businessName" className="text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Business Name</Label>
                  <Input id="businessName" value={settingsForm.businessName} onChange={e => setSettingsForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Acme Electrical" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactName" className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Contact Name</Label>
                  <Input id="contactName" value={settingsForm.contactName} onChange={e => setSettingsForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Jane Smith" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settingsPhone" className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
                  <Input id="settingsPhone" value={settingsForm.phone} onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))} placeholder="0400 000 000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settingsEmail" className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                  <Input id="settingsEmail" value={settingsForm.email} onChange={e => setSettingsForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" data-testid="input-settings-email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settingsAbn" className="text-xs flex items-center gap-1"><Hash className="w-3 h-3" /> ABN</Label>
                  <Input id="settingsAbn" value={settingsForm.abn} onChange={e => setSettingsForm(f => ({ ...f, abn: e.target.value }))} placeholder="12 345 678 901" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settingsWebsite" className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> Website</Label>
                  <Input id="settingsWebsite" value={settingsForm.website} onChange={e => setSettingsForm(f => ({ ...f, website: e.target.value }))} placeholder="www.mycompany.com.au" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settingsAddress" className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Business Address</Label>
                <Input id="settingsAddress" value={settingsForm.businessAddress} onChange={e => setSettingsForm(f => ({ ...f, businessAddress: e.target.value }))} placeholder="123 Main St, Sydney NSW 2000" />
              </div>
            </div>

            <Separator />

            {/* Quote Defaults */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Quote Defaults
              </h3>
              <div className="space-y-2">
                <Label htmlFor="quoteTerms" className="text-xs">Quote Terms & Conditions</Label>
                <RichTextEditor
                  value={settingsForm.quoteTerms}
                  onChange={v => setSettingsForm(f => ({ ...f, quoteTerms: v }))}
                  placeholder="e.g. This quote is valid for 30 days. Prices are subject to change..."
                  minHeight="100px"
                />
              </div>
            </div>

            {/* Invoice Defaults */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Invoice Defaults
              </h3>
              <div className="space-y-2">
                <Label htmlFor="invoiceTerms" className="text-xs">Invoice Terms & Conditions</Label>
                <RichTextEditor
                  value={settingsForm.invoiceTerms}
                  onChange={v => setSettingsForm(f => ({ ...f, invoiceTerms: v }))}
                  placeholder="e.g. Payment is due within 14 days of invoice date..."
                  minHeight="100px"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultPaymentInstructions" className="text-xs">Payment Instructions</Label>
                <RichTextEditor
                  value={settingsForm.defaultPaymentInstructions}
                  onChange={v => setSettingsForm(f => ({ ...f, defaultPaymentInstructions: v }))}
                  placeholder="Bank: ANZ, BSB: 123-456, Account: 12345678..."
                  minHeight="100px"
                />
              </div>
            </div>
          </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveSettings} disabled={saving} data-testid="button-save-settings">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </TabsContent>

            {/* ── ACCOUNT TAB ── */}
            <TabsContent value="account">
              <div className="space-y-6 py-2">

                {/* Current login email */}
                <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Signed in as</p>
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                  </div>
                </div>

                {/* Change email */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Change Login Email
                  </h3>
                  {emailSent ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700">
                        Confirmation link sent. Check your new email and click the link to confirm the change.
                      </div>
                      <button
                        onClick={() => setEmailSent(false)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Change a different email
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <form onSubmit={handleChangeEmail} className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="New email address"
                          value={newEmail}
                          onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                          required
                          className={emailError ? 'flex-1 border-destructive focus-visible:ring-destructive' : 'flex-1'}
                          data-testid="input-new-email"
                        />
                        <Button type="submit" disabled={emailSaving || !newEmail.trim()} data-testid="button-update-email">
                          {emailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
                        </Button>
                      </form>
                      {emailError && (
                        <p className="text-xs text-destructive" data-testid="error-email">{emailError}</p>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Change password */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" />
                    Change Password
                  </h3>
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="currentPassword" className="text-xs">Current Password</Label>
                      <PasswordInput
                        id="currentPassword"
                        placeholder="••••••••"
                        value={pwForm.current}
                        onChange={e => { setPwForm(f => ({ ...f, current: e.target.value })); setPwErrors(p => ({ ...p, current: '' })); }}
                        required
                        className={pwErrors.current ? 'border-destructive focus-visible:ring-destructive' : ''}
                        data-testid="input-current-password"
                      />
                      {pwErrors.current && (
                        <p className="text-xs text-destructive" data-testid="error-current-password">{pwErrors.current}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="newPassword" className="text-xs">New Password</Label>
                      <PasswordInput
                        id="newPassword"
                        placeholder="••••••••"
                        value={pwForm.next}
                        onChange={e => { setPwForm(f => ({ ...f, next: e.target.value })); setPwErrors(p => ({ ...p, next: '' })); }}
                        required
                        className={pwErrors.next ? 'border-destructive focus-visible:ring-destructive' : ''}
                        data-testid="input-new-password"
                      />
                      {pwErrors.next ? (
                        <p className="text-xs text-destructive" data-testid="error-new-password">{pwErrors.next}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmNewPassword" className="text-xs">Confirm New Password</Label>
                      <PasswordInput
                        id="confirmNewPassword"
                        placeholder="••••••••"
                        value={pwForm.confirm}
                        onChange={e => { setPwForm(f => ({ ...f, confirm: e.target.value })); setPwErrors(p => ({ ...p, confirm: '' })); }}
                        required
                        className={pwErrors.confirm ? 'border-destructive focus-visible:ring-destructive' : ''}
                        data-testid="input-confirm-new-password"
                      />
                      {pwErrors.confirm && (
                        <p className="text-xs text-destructive" data-testid="error-confirm-password">{pwErrors.confirm}</p>
                      )}
                    </div>
                    {pwErrors.general && (
                      <p className="text-xs text-destructive" data-testid="error-password-general">{pwErrors.general}</p>
                    )}
                    <Button
                      type="submit"
                      disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
                      className="w-full"
                      data-testid="button-update-password"
                    >
                      {pwSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 mr-2" />
                      )}
                      Update Password
                    </Button>
                  </form>
                </div>

              </div>
            </TabsContent>

          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
