import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectCard } from '@/components/ProjectCard';
import { ProjectCardSkeletonGrid } from '@/components/ProjectCardSkeleton';
import { DashboardStats } from '@/components/DashboardStats';
import { CreateJobModal } from '@/components/CreateJobModal';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { 
  Plus, 
  Search, 
  Briefcase,
  ArrowLeft,
  LogOut,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function TradeDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { projects, loading, createProject, updateProjectStatus, deleteProject, refetch } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  // Refetch projects when dashboard mounts to ensure fresh data
  useEffect(() => {
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
