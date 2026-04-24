import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectCard } from '@/components/ProjectCard';
import { ProjectCardSkeletonGrid } from '@/components/ProjectCardSkeleton';
import { DashboardStats } from '@/components/DashboardStats';
import { AppShell } from '@/components/AppShell';
import { ActivityFeed } from '@/components/ActivityFeed';
import { useProjects } from '@/hooks/useProjects';
import { Search, Briefcase } from 'lucide-react';

export default function TradeDashboard() {
  const navigate = useNavigate();
  const { projects, loading, updateProjectStatus, deleteProject } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active');

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

  const handleViewProject = (id: string) => {
    navigate(`/manage/${id}`);
  };

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your jobs and quotes</p>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <DashboardStats projects={projects} />
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs or clients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
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
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
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
                  <EmptyState searchQuery={searchQuery} />
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
                  <EmptyState message="No completed projects yet" searchQuery={searchQuery} />
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
                  <EmptyState message="No draft jobs" searchQuery={searchQuery} />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Activity feed */}
        <div className="mt-10">
          <ActivityFeed />
        </div>
      </main>
    </AppShell>
  );
}

function EmptyState({
  message = 'No projects found',
  searchQuery,
}: {
  message?: string;
  searchQuery?: string;
}) {
  return (
    <div className="text-center py-12">
      <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground mb-4">
        {searchQuery ? `No results for "${searchQuery}"` : message}
      </p>
      {!searchQuery && (
        <p className="text-sm text-muted-foreground">Use the <span className="font-medium">New Job</span> button in the sidebar to get started.</p>
      )}
    </div>
  );
}
