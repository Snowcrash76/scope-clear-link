import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Project, ScopeItem, ChangeRequest, ProjectStage } from '@/types/project';

type DbProject = {
  id: string;
  user_id: string;
  name: string;
  client_name: string;
  client_email: string;
  status: 'draft' | 'sent' | 'in_progress' | 'completed';
  total_value: number | null;
  created_at: string;
  updated_at: string;
};

type DbScopeItem = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: 'included' | 'excluded' | 'assumption';
  acknowledged: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

type DbChangeRequest = {
  id: string;
  project_id: string;
  type: 'client_request' | 'site_issue' | 'substitution';
  title: string;
  description: string;
  reason: string | null;
  cost_impact: number | null;
  time_impact: string | null;
  status: 'pending' | 'approved' | 'declined';
  image_url: string | null;
  created_at: string;
  resolved_at: string | null;
};

type DbProjectStage = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: 'upcoming' | 'current' | 'completed';
  stage_order: number;
  created_at: string;
  updated_at: string;
};

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProjects();
    } else {
      setProjects([]);
      setLoading(false);
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      if (!projectsData?.length) {
        setProjects([]);
        return;
      }

      const projectIds = projectsData.map(p => p.id);

      const [scopeRes, changeRes, stageRes] = await Promise.all([
        supabase.from('scope_items').select('*').in('project_id', projectIds),
        supabase.from('change_requests').select('*').in('project_id', projectIds),
        supabase.from('project_stages').select('*').in('project_id', projectIds).order('stage_order'),
      ]);

      const scopeItems = (scopeRes.data || []) as DbScopeItem[];
      const changeRequests = (changeRes.data || []) as DbChangeRequest[];
      const projectStages = (stageRes.data || []) as DbProjectStage[];

      const mappedProjects: Project[] = (projectsData as DbProject[]).map(p => {
        const stages = projectStages.filter(s => s.project_id === p.id);
        const currentStageIndex = stages.findIndex(s => s.status === 'current');
        
        return {
          id: p.id,
          name: p.name,
          clientName: p.client_name,
          clientEmail: p.client_email,
          tradeName: '', // Will be populated from profile
          tradeBusinessName: '',
          status: p.status === 'in_progress' ? 'in_progress' : p.status as Project['status'],
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.updated_at),
          currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
          scopeItems: scopeItems
            .filter(s => s.project_id === p.id)
            .map(s => ({
              id: s.id,
              title: s.title,
              description: s.description || '',
              category: s.category,
              acknowledged: s.acknowledged,
              imageUrl: s.image_url || undefined,
            })),
          changeRequests: changeRequests
            .filter(c => c.project_id === p.id)
            .map(c => ({
              id: c.id,
              type: c.type,
              title: c.title,
              description: c.description,
              reason: c.reason || undefined,
              costImpact: c.cost_impact || 0,
              timeImpact: c.time_impact ? parseInt(c.time_impact) : 0,
              status: c.status,
              createdAt: new Date(c.created_at),
              resolvedAt: c.resolved_at ? new Date(c.resolved_at) : undefined,
              imageUrl: c.image_url || undefined,
            })),
          stages: stages.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description || '',
            status: s.status,
          })),
        };
      });

      setProjects(mappedProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (data: {
    name: string;
    clientName: string;
    clientEmail: string;
    scopeItems: Omit<ScopeItem, 'id' | 'acknowledged'>[];
  }) => {
    if (!user) {
      toast.error('You must be logged in to create a project');
      return null;
    }

    try {
      // Create project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: data.name,
          client_name: data.clientName,
          client_email: data.clientEmail,
          status: 'draft',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create scope items
      if (data.scopeItems.length > 0) {
        const { error: scopeError } = await supabase
          .from('scope_items')
          .insert(
            data.scopeItems.map(item => ({
              project_id: projectData.id,
              title: item.title,
              description: item.description,
              category: item.category,
              image_url: item.imageUrl,
            }))
          );

        if (scopeError) throw scopeError;
      }

      // Create default stages
      const defaultStages: Array<{
        project_id: string;
        name: string;
        description: string;
        status: 'upcoming' | 'current' | 'completed';
        stage_order: number;
      }> = [
        { project_id: projectData.id, name: 'Preparation', description: 'Site preparation', status: 'current', stage_order: 0 },
        { project_id: projectData.id, name: 'Construction', description: 'Main work', status: 'upcoming', stage_order: 1 },
        { project_id: projectData.id, name: 'Finishing', description: 'Final touches', status: 'upcoming', stage_order: 2 },
      ];

      const { error: stagesError } = await supabase
        .from('project_stages')
        .insert(defaultStages);

      if (stagesError) throw stagesError;

      // Refresh projects
      await fetchProjects();
      return projectData.id;
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
      return null;
    }
  };

  return {
    projects,
    loading,
    createProject,
    refetch: fetchProjects,
  };
}
