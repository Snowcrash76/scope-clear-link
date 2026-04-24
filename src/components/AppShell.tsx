import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CreateJobModal } from '@/components/CreateJobModal';
import { useCreateProject, type CreateProjectData } from '@/hooks/useCreateProject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Briefcase,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface SidebarInnerProps {
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
    { to: '/projects', icon: FolderOpen, label: 'Projects', active: currentPath.startsWith('/projects') || currentPath.startsWith('/manage'), testId: 'nav-projects' },
    { to: '/quotes', icon: FileText, label: 'Quotes', active: currentPath.startsWith('/quotes'), testId: 'nav-quotes' },
    { to: '/invoices', icon: Receipt, label: 'Invoices', active: currentPath.startsWith('/invoices'), testId: 'nav-invoices' },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">ScopeClear</span>
        </div>
        {businessName && (
          <p className="text-xs text-sidebar-foreground/50 mt-1 ml-[42px] truncate">{businessName}</p>
        )}
      </div>

      {/* New Job CTA */}
      <div className="px-4 pt-5 pb-2">
        <button
          onClick={() => act(onNewJob)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          data-testid="button-sidebar-new-job"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      {/* Nav items */}
      <nav className="px-3 pt-3 flex-1 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label, active, testId }) => (
          <Link
            key={label}
            to={to}
            onClick={() => onClose?.()}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
            )}
            data-testid={testId}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border px-3 pt-3 pb-5 space-y-0.5">
        <button
          onClick={() => act(onOpenSettings)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground transition-colors"
          data-testid="button-sidebar-settings"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          Settings
        </button>
        {contactName && (
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
            <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold flex-shrink-0">
              {getInitials(contactName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate text-sidebar-foreground">{contactName}</p>
              {email && <p className="text-xs text-sidebar-foreground/50 truncate">{email}</p>}
            </div>
            <button
              onClick={() => act(onSignOut)}
              title="Sign out"
              className="p-1.5 rounded hover:bg-sidebar-accent/70 transition-colors flex-shrink-0"
              data-testid="button-sidebar-sign-out"
            >
              <LogOut className="w-3.5 h-3.5 text-sidebar-foreground/50" />
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
    defaultTerms: '',
    defaultPaymentInstructions: '',
  });
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [pendingLogoDataUrl, setPendingLogoDataUrl] = useState('');
  const [removeLogo, setRemoveLogo] = useState(false);

  const loadSettings = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('business_name, contact_name, email, phone, business_address, abn, website, default_terms, default_payment_instructions, logo_url')
      .eq('user_id', user.id)
      .single();
    if (!data) return;
    const row = data as ProfileRow;
    setSettingsForm({
      businessName: row.business_name || '',
      contactName: row.contact_name || '',
      email: row.email || '',
      phone: row.phone || '',
      businessAddress: row.business_address || '',
      abn: row.abn || '',
      website: row.website || '',
      defaultTerms: row.default_terms || '',
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
        business_address: settingsForm.businessAddress || null,
        abn: settingsForm.abn || null,
        website: settingsForm.website || null,
        default_terms: settingsForm.defaultTerms || null,
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
    setIsSettingsOpen(true);
  };

  const handleCreateJob = async (jobData: CreateProjectData) => {
    const projectId = await createProject(jobData);
    if (projectId) {
      toast.success('Job & quote created! Review and send to your client.');
      setIsCreateModalOpen(false);
      navigate(`/manage/${projectId}?tab=quote`);
    }
  };

  const sidebarProps: SidebarInnerProps = {
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
        <SheetContent side="left" className="p-0 w-64 border-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarInner {...sidebarProps} onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Page content */}
      <div className="flex-1 lg:pl-64 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
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
      />

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Business Settings
            </DialogTitle>
            <DialogDescription>
              Customise your brand and default content for quotes and invoices.
            </DialogDescription>
          </DialogHeader>

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
              <div className="grid grid-cols-2 gap-3">
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
                  <Input id="settingsEmail" value={settingsForm.email} disabled className="opacity-60" placeholder="you@example.com" />
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

            {/* Quote/Invoice Defaults */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Quote & Invoice Defaults
              </h3>
              <div className="space-y-2">
                <Label htmlFor="defaultTerms" className="text-xs">Default Terms & Conditions</Label>
                <Textarea id="defaultTerms" placeholder="Payment is due within 14 days..." value={settingsForm.defaultTerms} onChange={e => setSettingsForm(f => ({ ...f, defaultTerms: e.target.value }))} className="min-h-[100px] text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultPaymentInstructions" className="text-xs">Default Payment Instructions</Label>
                <Textarea id="defaultPaymentInstructions" placeholder={"Bank: ANZ\nBSB: 123-456\nAccount: 12345678"} value={settingsForm.defaultPaymentInstructions} onChange={e => setSettingsForm(f => ({ ...f, defaultPaymentInstructions: e.target.value }))} className="min-h-[100px] text-sm" />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings} disabled={saving} data-testid="button-save-settings">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
