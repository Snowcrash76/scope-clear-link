import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  image_urls: string[] | null;
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

export interface ProjectDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) throw projectError;

      if (!projectData) {
        setProject(null);
        return;
      }

      const [scopeRes, changeRes, stageRes, profileRes, docsRes] = await Promise.all([
        supabase.from('scope_items').select('*').eq('project_id', projectId),
        supabase.from('change_requests').select('*').eq('project_id', projectId),
        supabase.from('project_stages').select('*').eq('project_id', projectId).order('stage_order'),
        supabase.from('profiles').select('*').eq('user_id', (projectData as DbProject).user_id).maybeSingle(),
        supabase.from('project_documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      ]);

      const scopeItems = (scopeRes.data || []) as DbScopeItem[];
      const changeRequests = (changeRes.data || []) as DbChangeRequest[];
      const projectStages = (stageRes.data || []) as DbProjectStage[];
      const profile = profileRes.data;
      const rawDocuments = (docsRes.data || []) as ProjectDocument[];

      // Generate signed URLs for documents (bucket is now private)
      const projectDocuments = await Promise.all(
        rawDocuments.map(async (doc) => {
          // If it's a full URL (legacy), extract the path; otherwise use as-is
          let filePath = doc.file_url;
          if (doc.file_url.includes('/project-documents/')) {
            filePath = doc.file_url.split('/project-documents/').pop() || doc.file_url;
          }
          
          const { data: signedData } = await supabase.storage
            .from('project-documents')
            .createSignedUrl(filePath, 60 * 60 * 24); // 24 hours
          
          return {
            ...doc,
            file_url: signedData?.signedUrl || doc.file_url,
          };
        })
      );

      // Generate signed URLs for scope item images (bucket is now private)
      const scopeItemsWithSignedUrls = await Promise.all(
        scopeItems.map(async (item) => {
          if (!item.image_url) return item;
          
          // Skip blob URLs and other non-storage URLs (legacy data)
          if (item.image_url.startsWith('blob:') || !item.image_url.includes('supabase')) {
            return { ...item, image_url: null }; // Clear invalid blob URLs
          }
          
          // If it's a full URL, extract the path
          let imagePath = item.image_url;
          if (item.image_url.includes('/scope-images/')) {
            imagePath = item.image_url.split('/scope-images/').pop() || item.image_url;
            // Remove query params if present (from previous signed URLs)
            imagePath = imagePath.split('?')[0];
          }
          
          const { data: signedData } = await supabase.storage
            .from('scope-images')
            .createSignedUrl(imagePath, 60 * 60 * 24); // 24 hours
          
          return {
            ...item,
            image_url: signedData?.signedUrl || item.image_url,
          };
        })
      );

      // Generate signed URLs for change request images
      const changeRequestsWithSignedUrls = await Promise.all(
        changeRequests.map(async (cr) => {
          if (!cr.image_url) return cr;
          
          // Skip blob URLs and other non-storage URLs (legacy data)
          if (cr.image_url.startsWith('blob:') || !cr.image_url.includes('supabase')) {
            return { ...cr, image_url: null }; // Clear invalid blob URLs
          }
          
          // If it's a full URL, extract the path
          let imagePath = cr.image_url;
          if (cr.image_url.includes('/scope-images/')) {
            imagePath = cr.image_url.split('/scope-images/').pop() || cr.image_url;
            // Remove query params if present (from previous signed URLs)
            imagePath = imagePath.split('?')[0];
          }
          
          const { data: signedData } = await supabase.storage
            .from('scope-images')
            .createSignedUrl(imagePath, 60 * 60 * 24); // 24 hours
          
          return {
            ...cr,
            image_url: signedData?.signedUrl || cr.image_url,
          };
        })
      );

      const p = projectData as DbProject;
      const currentStageIndex = projectStages.findIndex(s => s.status === 'current');

      const mappedProject: Project = {
        id: p.id,
        name: p.name,
        clientName: p.client_name,
        clientEmail: p.client_email,
        tradeName: profile?.contact_name || 'Trade',
        tradeBusinessName: profile?.business_name || 'Business',
        status: p.status === 'in_progress' ? 'in_progress' : p.status as Project['status'],
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.updated_at),
        currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
        scopeItems: scopeItemsWithSignedUrls.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description || '',
          category: s.category,
          acknowledged: s.acknowledged,
          imageUrl: s.image_url || undefined,
          imageUrls: s.image_urls || (s.image_url ? [s.image_url] : []),
        })),
        changeRequests: changeRequestsWithSignedUrls.map(c => ({
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
        stages: projectStages.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description || '',
          status: s.status,
        })),
      };

      setProject(mappedProject);
      setDocuments(projectDocuments);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Scope item operations
  const saveScopeItem = async (itemData: Omit<ScopeItem, 'id' | 'acknowledged'> & { id?: string }) => {
    if (!projectId) return false;

    try {
      if (itemData.id) {
        const { error } = await supabase
          .from('scope_items')
          .update({
            title: itemData.title,
            description: itemData.description,
            category: itemData.category,
            image_url: itemData.imageUrl || (itemData.imageUrls?.[0] ?? null),
            image_urls: itemData.imageUrls || [],
          })
          .eq('id', itemData.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('scope_items')
          .insert({
            project_id: projectId,
            title: itemData.title,
            description: itemData.description,
            category: itemData.category,
            image_url: itemData.imageUrl || (itemData.imageUrls?.[0] ?? null),
            image_urls: itemData.imageUrls || [],
          });

        if (error) throw error;
      }

      await fetchProject();
      return true;
    } catch (error) {
      console.error('Error saving scope item:', error);
      toast.error('Failed to save scope item');
      return false;
    }
  };

  const deleteScopeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('scope_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      await fetchProject();
      return true;
    } catch (error) {
      console.error('Error deleting scope item:', error);
      toast.error('Failed to delete scope item');
      return false;
    }
  };

  const acknowledgeScopeItem = async (itemId: string, acknowledged: boolean) => {
    try {
      const { error } = await supabase
        .from('scope_items')
        .update({ acknowledged })
        .eq('id', itemId);

      if (error) throw error;

      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          scopeItems: prev.scopeItems.map(item =>
            item.id === itemId ? { ...item, acknowledged } : item
          ),
        };
      });
      return true;
    } catch (error) {
      console.error('Error acknowledging scope item:', error);
      toast.error('Failed to update acknowledgment');
      return false;
    }
  };

  // Change request operations
  const createChangeRequest = async (requestData: Omit<ChangeRequest, 'id' | 'status' | 'createdAt' | 'resolvedAt'>) => {
    if (!projectId) return false;

    try {
      const { error } = await supabase
        .from('change_requests')
        .insert({
          project_id: projectId,
          type: requestData.type,
          title: requestData.title,
          description: requestData.description,
          reason: requestData.reason,
          cost_impact: requestData.costImpact,
          time_impact: requestData.timeImpact?.toString(),
          image_url: requestData.imageUrl,
        });

      if (error) throw error;

      await fetchProject();
      return true;
    } catch (error) {
      console.error('Error creating change request:', error);
      toast.error('Failed to create change request');
      return false;
    }
  };

  const updateChangeRequest = async (requestData: ChangeRequest) => {
    try {
      const { error } = await supabase
        .from('change_requests')
        .update({
          type: requestData.type,
          title: requestData.title,
          description: requestData.description,
          reason: requestData.reason,
          cost_impact: requestData.costImpact,
          time_impact: requestData.timeImpact?.toString(),
          image_url: requestData.imageUrl,
        })
        .eq('id', requestData.id);

      if (error) throw error;

      await fetchProject();
      return true;
    } catch (error) {
      console.error('Error updating change request:', error);
      toast.error('Failed to update change request');
      return false;
    }
  };

  const deleteChangeRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('change_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      await fetchProject();
      return true;
    } catch (error) {
      console.error('Error deleting change request:', error);
      toast.error('Failed to delete change request');
      return false;
    }
  };

  const updateChangeRequestStatus = async (requestId: string, status: 'approved' | 'declined') => {
    try {
      const { error } = await supabase
        .from('change_requests')
        .update({ 
          status, 
          resolved_at: new Date().toISOString() 
        })
        .eq('id', requestId);

      if (error) throw error;

      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          changeRequests: prev.changeRequests.map(req =>
            req.id === requestId ? { ...req, status, resolvedAt: new Date() } : req
          ),
        };
      });
      return true;
    } catch (error) {
      console.error('Error updating change request:', error);
      toast.error('Failed to update change request');
      return false;
    }
  };

  // Stage operations
  const updateStage = async (stageId: string, status: 'upcoming' | 'current' | 'completed') => {
    try {
      const { error } = await supabase
        .from('project_stages')
        .update({ status })
        .eq('id', stageId);

      if (error) throw error;

      await fetchProject();
      return true;
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Failed to update stage');
      return false;
    }
  };

  // Project status operations
  const updateProjectStatus = async (status: Project['status']) => {
    if (!projectId) return false;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: status === 'acknowledged' ? 'sent' : status })
        .eq('id', projectId);

      if (error) throw error;

      setProject(prev => {
        if (!prev) return prev;
        return { ...prev, status };
      });
      return true;
    } catch (error) {
      console.error('Error updating project status:', error);
      toast.error('Failed to update project status');
      return false;
    }
  };

  return {
    project,
    documents,
    loading,
    refetch: fetchProject,
    saveScopeItem,
    deleteScopeItem,
    acknowledgeScopeItem,
    createChangeRequest,
    updateChangeRequest,
    deleteChangeRequest,
    updateChangeRequestStatus,
    updateStage,
    updateProjectStatus,
  };
}
