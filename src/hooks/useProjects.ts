import { useState, useEffect, useCallback } from 'react';
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
  client_address: string | null;
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
  cost: number | null;
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

interface QuoteLineItem {
  title: string;
  description: string;
  cost: number;
  category: 'included' | 'excluded' | 'assumption';
  imageUrl?: string;
}

interface QuoteData {
  lineItems: QuoteLineItem[];
  taxRate: number;
  validUntil: Date | null;
  notes: string;
  terms: string;
}

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user?.id) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
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
              cost: s.cost || 0,
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
  }, [user?.id]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const generateQuoteNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `QT-${timestamp}`;
  };

  const createProject = async (data: {
    name: string;
    clientName: string;
    clientEmail: string;
    clientAddress?: string;
    quoteData: QuoteData;
  }) => {
    if (!user) {
      toast.error('You must be logged in to create a project');
      return null;
    }

    try {
      // Calculate quote totals from line items
      const subtotal = data.quoteData.lineItems
        .filter(item => item.category === 'included')
        .reduce((sum, item) => sum + (item.cost || 0), 0);
      const taxAmount = subtotal * (data.quoteData.taxRate / 100);
      const total = subtotal + taxAmount;

      // Create project with draft status (quote first workflow)
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: data.name,
          client_name: data.clientName,
          client_email: data.clientEmail,
          ...(data.clientAddress ? { client_address: data.clientAddress } : {}),
          status: 'sent',
          total_value: total,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create the quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          project_id: projectData.id,
          quote_number: generateQuoteNumber(),
          status: 'draft',
          subtotal,
          tax_rate: data.quoteData.taxRate,
          tax_amount: taxAmount,
          total,
          valid_until: data.quoteData.validUntil?.toISOString().split('T')[0] || null,
          notes: data.quoteData.notes || null,
          terms: data.quoteData.terms || null,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Link quote to project
      const { error: linkError } = await supabase
        .from('projects')
        .update({ active_quote_id: quoteData.id })
        .eq('id', projectData.id);

      if (linkError) throw linkError;

      // Create scope items from quote line items
      if (data.quoteData.lineItems.length > 0) {
        const { error: scopeError } = await supabase
          .from('scope_items')
          .insert(
            data.quoteData.lineItems.map(item => ({
              project_id: projectData.id,
              title: item.title,
              description: item.description || '',
              category: item.category,
              cost: item.category === 'included' ? item.cost : null,
              image_url: item.imageUrl || null,
            }))
          );

        if (scopeError) throw scopeError;
      }

      // No default stages - trades can add custom stages as needed

      // Refresh projects
      await fetchProjects();
      return projectData.id;
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
      return null;
    }
  };

  const updateProjectStatus = async (projectId: string, newStatus: 'draft' | 'sent' | 'in_progress' | 'completed') => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', projectId);

      if (error) throw error;
      await fetchProjects();
      return true;
    } catch (error) {
      console.error('Error updating project status:', error);
      toast.error('Failed to update project status');
      return false;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      // First get invoice IDs for this project to delete line items
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('project_id', projectId);

      const invoiceIds = invoices?.map(i => i.id) || [];

      // Delete related records in correct order (respecting foreign keys)
      if (invoiceIds.length > 0) {
        await supabase.from('invoice_line_items').delete().in('invoice_id', invoiceIds);
      }
      
      await Promise.all([
        supabase.from('invoices').delete().eq('project_id', projectId),
        supabase.from('quotes').delete().eq('project_id', projectId),
        supabase.from('scope_items').delete().eq('project_id', projectId),
        supabase.from('change_requests').delete().eq('project_id', projectId),
        supabase.from('project_documents').delete().eq('project_id', projectId),
        supabase.from('project_stages').delete().eq('project_id', projectId),
      ]);

      // Clear the active_quote_id reference before deleting project
      await supabase
        .from('projects')
        .update({ active_quote_id: null })
        .eq('id', projectId);

      // Delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      
      await fetchProjects();
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
      return false;
    }
  };

  return {
    projects,
    loading,
    createProject,
    updateProjectStatus,
    deleteProject,
    refetch: fetchProjects,
  };
}
