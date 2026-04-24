import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ProjectCard } from '@/components/ProjectCard';
import { ProjectCardSkeletonGrid } from '@/components/ProjectCardSkeleton';
import { DashboardStats } from '@/components/DashboardStats';
import { CreateJobModal } from '@/components/CreateJobModal';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Search, 
  Briefcase,
  ArrowLeft,
  LogOut,
  Loader2,
  Settings,
  FileText,
  Save,
  UploadCloud,
  X,
  Building2,
  Phone,
  Globe,
  Hash,
  MapPin,
  User,
  Mail
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function TradeDashboard() {
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { projects, loading, createProject, updateProjectStatus, deleteProject, refetch } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Settings form state
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
  // logoDataUrl holds the current saved base64 logo (or empty string)
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  // pendingLogoDataUrl holds a newly selected logo not yet saved
  const [pendingLogoDataUrl, setPendingLogoDataUrl] = useState<string>('');
  const [removeLogo, setRemoveLogo] = useState(false);

  const loadSettings = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('business_name, contact_name, email, phone, business_address, abn, website, default_terms, default_payment_instructions, logo_url')
      .eq('user_id', user.id)
      .single();
    if (!data) return;
    setSettingsForm({
      businessName: data.business_name || '',
      contactName: data.contact_name || '',
      email: data.email || '',
      phone: data.phone || '',
      businessAddress: (data as any).business_address || '',
      abn: (data as any).abn || '',
      website: (data as any).website || '',
      defaultTerms: data.default_terms || '',
      defaultPaymentInstructions: data.default_payment_instructions || '',
    });
    const stored = (data as any).logo_url || '';
    // Support both legacy storage paths (no data: prefix) and new base64 data URLs
    setLogoDataUrl(stored.startsWith('data:') ? stored : '');
  };

  useEffect(() => {
    loadSettings();
  }, [user?.id]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Logo must be under 1 MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingLogoDataUrl(reader.result as string);
      setRemoveLogo(false);
    };
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

      const { error } = await supabase
        .from('profiles')
        .update({
          business_name: settingsForm.businessName,
          contact_name: settingsForm.contactName,
          phone: settingsForm.phone || null,
          business_address: settingsForm.businessAddress || null,
          abn: settingsForm.abn || null,
          website: settingsForm.website || null,
          default_terms: settingsForm.defaultTerms || null,
          default_payment_instructions: settingsForm.defaultPaymentInstructions || null,
          logo_url: newLogoUrl,
        } as any)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Settings saved');
      setPendingLogoDataUrl('');
      setRemoveLogo(false);
      setIsSettingsOpen(false);
      await loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'active') {
      return matchesSearch && (project.status === 'in_progress' || project.status === 'acknowledged' || project.status === 'sent');
    } else if (activeTab === 'completed') {
      return matchesSearch && project.status === 'completed';
    } else if (activeTab === 'drafts') {
      return matchesSearch && project.status === 'draft';
    }
    return matchesSearch;
  });

  const handleCreateJob = async (jobData: {
    name: string;
    clientName: string;
    clientEmail: string;
    clientAddress?: string;
    quoteData: {
      lineItems: { title: string; description: string; cost: number; category: 'included' | 'excluded' | 'assumption'; imageUrl?: string }[];
      taxRate: number;
      validUntil: Date | null;
      notes: string;
      terms: string;
    };
  }) => {
    const projectId = await createProject(jobData);
    if (projectId) {
      toast.success('Job & quote created! Review and send to your client.');
      // Navigate to project manage page with quote tab active
      navigate(`/manage/${projectId}?tab=quote`);
    }
  };

  const handleViewProject = (id: string) => {
    navigate(`/manage/${id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-heading text-xl sm:text-2xl font-bold">Dashboard</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  {profile?.business_name || 'My Business'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="accent"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Job</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                    {profile ? getInitials(profile.contact_name) : '??'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="font-medium text-sm">{profile?.contact_name}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  </div>
                <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Business Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats */}
        <div className="mb-8">
          <DashboardStats projects={projects} />
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="active" className="gap-2">
              <Briefcase className="w-4 h-4" />
              Active
              <Badge variant="secondary" className="ml-1">
                {projects.filter(p => ['in_progress', 'acknowledged', 'sent'].includes(p.status)).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed
            </TabsTrigger>
            <TabsTrigger value="drafts">
              Drafts
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <ProjectCardSkeletonGrid />
          ) : (
            <>
              <TabsContent value="active" className="mt-0">
                {filteredProjects.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map(project => (
                      <ProjectCard 
                        key={project.id} 
                        project={project}
                        onViewProject={handleViewProject}
                        onUpdateStatus={updateProjectStatus}
                        onDeleteProject={deleteProject}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState 
                    searchQuery={searchQuery}
                    onCreateJob={() => setIsCreateModalOpen(true)}
                  />
                )}
              </TabsContent>

              <TabsContent value="completed" className="mt-0">
                {filteredProjects.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map(project => (
                      <ProjectCard 
                        key={project.id} 
                        project={project}
                        onViewProject={handleViewProject}
                        onUpdateStatus={updateProjectStatus}
                        onDeleteProject={deleteProject}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState 
                    message="No completed projects yet"
                    searchQuery={searchQuery}
                  />
                )}
              </TabsContent>

              <TabsContent value="drafts" className="mt-0">
                {filteredProjects.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map(project => (
                      <ProjectCard 
                        key={project.id} 
                        project={project}
                        onViewProject={handleViewProject}
                        onUpdateStatus={updateProjectStatus}
                        onDeleteProject={deleteProject}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState 
                    message="No draft jobs"
                    searchQuery={searchQuery}
                    onCreateJob={() => setIsCreateModalOpen(true)}
                  />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                    {pendingLogoDataUrl || logoDataUrl ? 'Change logo' : 'Choose file'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    PNG or JPG, max 1 MB. Appears on quotes and invoices.
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
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
                  <Label htmlFor="businessName" className="text-xs flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Business Name
                  </Label>
                  <Input
                    id="businessName"
                    value={settingsForm.businessName}
                    onChange={(e) => setSettingsForm(f => ({ ...f, businessName: e.target.value }))}
                    placeholder="Acme Electrical"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactName" className="text-xs flex items-center gap-1">
                    <User className="w-3 h-3" /> Contact Name
                  </Label>
                  <Input
                    id="contactName"
                    value={settingsForm.contactName}
                    onChange={(e) => setSettingsForm(f => ({ ...f, contactName: e.target.value }))}
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settingsPhone" className="text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </Label>
                  <Input
                    id="settingsPhone"
                    value={settingsForm.phone}
                    onChange={(e) => setSettingsForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="0400 000 000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settingsEmail" className="text-xs flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </Label>
                  <Input
                    id="settingsEmail"
                    value={settingsForm.email}
                    disabled
                    className="opacity-60"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settingsAbn" className="text-xs flex items-center gap-1">
                    <Hash className="w-3 h-3" /> ABN
                  </Label>
                  <Input
                    id="settingsAbn"
                    value={settingsForm.abn}
                    onChange={(e) => setSettingsForm(f => ({ ...f, abn: e.target.value }))}
                    placeholder="12 345 678 901"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settingsWebsite" className="text-xs flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Website
                  </Label>
                  <Input
                    id="settingsWebsite"
                    value={settingsForm.website}
                    onChange={(e) => setSettingsForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="www.mycompany.com.au"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settingsAddress" className="text-xs flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Business Address
                </Label>
                <Input
                  id="settingsAddress"
                  value={settingsForm.businessAddress}
                  onChange={(e) => setSettingsForm(f => ({ ...f, businessAddress: e.target.value }))}
                  placeholder="123 Main St, Sydney NSW 2000"
                />
              </div>
            </div>

            <Separator />

            {/* Quote/Invoice Defaults */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Quote & Invoice Defaults
              </h3>
              <div className="space-y-2">
                <Label htmlFor="defaultTerms" className="text-xs">Default Terms & Conditions</Label>
                <Textarea
                  id="defaultTerms"
                  placeholder="Payment is due within 14 days..."
                  value={settingsForm.defaultTerms}
                  onChange={(e) => setSettingsForm(f => ({ ...f, defaultTerms: e.target.value }))}
                  className="min-h-[100px] text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultPaymentInstructions" className="text-xs">Default Payment Instructions</Label>
                <Textarea
                  id="defaultPaymentInstructions"
                  placeholder="Bank: ANZ&#10;BSB: 123-456&#10;Account: 12345678"
                  value={settingsForm.defaultPaymentInstructions}
                  onChange={(e) => setSettingsForm(f => ({ ...f, defaultPaymentInstructions: e.target.value }))}
                  className="min-h-[100px] text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving} data-testid="button-save-settings">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ 
  message = "No projects found",
  searchQuery,
  onCreateJob
}: { 
  message?: string;
  searchQuery?: string;
  onCreateJob?: () => void;
}) {
  return (
    <div className="text-center py-12">
      <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground mb-4">
        {searchQuery ? `No results for "${searchQuery}"` : message}
      </p>
      {onCreateJob && !searchQuery && (
        <Button variant="outline" onClick={onCreateJob}>
          <Plus className="w-4 h-4 mr-2" />
          Create your first job
        </Button>
      )}
    </div>
  );
}
