import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Project, ScopeItem, ChangeRequest, ProjectStage } from '@/types/project';

// Helper function to send change notification emails
const sendChangeNotification = async (
  projectId: string,
  changeRequestId: string,
  notificationType: 'created' | 'approved' | 'declined',
  recipientType: 'trade' | 'client',
  changeTitle: string,
  changeDescription: string,
  costImpact?: number,
  timeImpact?: string
) => {
  try {
    const response = await supabase.functions.invoke('send-change-notification', {
      body: {
        projectId,
        changeRequestId,
        notificationType,
        recipientType,
        changeTitle,
        changeDescription,
        costImpact,
        timeImpact,
      },
    });

    if (response.error) {
      console.error('Failed to send notification:', response.error);
    } else {
      console.log('Notification sent successfully');
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

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
  image_urls: string[] | null;
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
  resolution_comment: string | null;
};

type DbProjectStage = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: 'upcoming' | 'current' | 'completed';
  stage_order: number;
  invoice_amount: number | null;
  invoice_percentage: number | null;
  created_at: string;
  updated_at: string;
};

export interface ProjectDocument {
  id: string;
  file_name: string;
  display_name: string | null;
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

      const storedLogo = (profile as any)?.logo_url || '';
      const mappedProject: Project = {
        id: p.id,
        name: p.name,
        clientName: p.client_name,
        clientEmail: p.client_email,
        clientAddress: p.client_address || undefined,
        tradeName: profile?.contact_name || 'Trade',
        tradeBusinessName: profile?.business_name || 'Business',
        tradeAddress: (profile as any)?.business_address || undefined,
        tradePhone: profile?.phone || undefined,
        tradeWebsite: (profile as any)?.website || undefined,
        tradeAbn: (profile as any)?.abn || undefined,
        tradeLogoUrl: storedLogo.startsWith('data:') ? storedLogo : undefined,
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
          cost: s.cost || undefined,
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
          resolutionComment: c.resolution_comment || undefined,
        })),
        stages: projectStages.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description || '',
          status: s.status,
          invoiceAmount: s.invoice_amount || undefined,
          invoicePercentage: s.invoice_percentage || undefined,
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
            cost: itemData.cost ?? null,
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
            cost: itemData.cost ?? null,
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
  const createChangeRequest = async (
    requestData: Omit<ChangeRequest, 'id' | 'status' | 'createdAt' | 'resolvedAt'>,
    recipientType: 'trade' | 'client' = 'client'
  ) => {
    if (!projectId) return false;

    try {
      const { data, error } = await supabase
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
        })
        .select()
        .single();

      if (error) throw error;

      // Send email notification to the recipient
      await sendChangeNotification(
        projectId,
        data.id,
        'created',
        recipientType,
        requestData.title,
        requestData.description,
        requestData.costImpact,
        requestData.timeImpact?.toString()
      );

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

  const updateChangeRequestStatus = async (
    requestId: string,
    status: 'approved' | 'declined',
    recipientType: 'trade' | 'client' = 'trade',
    comment?: string
  ) => {
    try {
      const { error } = await supabase
        .from('change_requests')
        .update({ 
          status, 
          resolved_at: new Date().toISOString(),
          resolution_comment: comment || null
        })
        .eq('id', requestId);

      if (error) throw error;

      // Find the change request to get its details for the notification
      const changeRequest = project?.changeRequests.find(cr => cr.id === requestId);

      // When a change is approved, fold it into the agreed scope and active quote
      // so the project's scope of work and quote total stay in sync with reality.
      // This requires the user to be authenticated (project owner) — unauthenticated
      // client approvals skip this step silently; the trade's next open will be correct.
      if (status === 'approved' && changeRequest && projectId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try {
            await applyApprovedChangeToScopeAndQuote(projectId, changeRequest);
          } catch (applyError) {
            console.error('Error applying approved change to scope/quote:', applyError);
            toast.error('Approved, but failed to update scope/quote automatically');
          }
        }
      }

      if (changeRequest && projectId) {
        // Notify BOTH parties — run in parallel and let either fail silently
        // so a delivery issue never blocks the approval completing.
        try {
          await Promise.allSettled([
            sendChangeNotification(
              projectId, requestId, status, 'trade',
              changeRequest.title, changeRequest.description,
              changeRequest.costImpact, changeRequest.timeImpact?.toString()
            ),
            sendChangeNotification(
              projectId, requestId, status, 'client',
              changeRequest.title, changeRequest.description,
              changeRequest.costImpact, changeRequest.timeImpact?.toString()
            ),
          ]);
        } catch (notifyError) {
          console.warn('Notification failed (non-blocking):', notifyError);
        }
      }

      // Refetch so scope items, change requests and totals all stay consistent
      await fetchProject();
      return true;
    } catch (error) {
      console.error('Error updating change request:', error);
      toast.error('Failed to update change request');
      return false;
    }
  };

  // Adds the approved change as a new included scope item and a new quote
  // line item on the project's active quote, then recalculates the quote totals.
  const applyApprovedChangeToScopeAndQuote = async (
    pid: string,
    changeRequest: ChangeRequest
  ) => {
    const cost = Number(changeRequest.costImpact) || 0;
    const titlePrefix = 'Variation: ';
    const cleanedTitle = changeRequest.title.replace(/\s+variation$/i, '').trim();
    const scopeTitle = `${titlePrefix}${cleanedTitle}`;
    const descriptionParts = [changeRequest.description];
    if (changeRequest.timeImpact) {
      descriptionParts.push(`Time impact: ${changeRequest.timeImpact} day(s).`);
    }
    if (changeRequest.reason) {
      descriptionParts.push(`Reason: ${changeRequest.reason}`);
    }
    const scopeDescription = descriptionParts.filter(Boolean).join('\n\n');

    // 1. Add an "included" scope item so the agreed scope reflects the change
    const { error: scopeErr } = await supabase
      .from('scope_items')
      .insert({
        project_id: pid,
        title: scopeTitle,
        description: scopeDescription,
        category: 'included',
        image_url: changeRequest.imageUrl || null,
        image_urls: changeRequest.imageUrl ? [changeRequest.imageUrl] : [],
        cost: cost > 0 ? cost : null,
        acknowledged: true,
      });
    if (scopeErr) throw scopeErr;

    // 2. Find the active quote for this project (if any) and append a line item
    const { data: projectRow, error: projectErr } = await supabase
      .from('projects')
      .select('active_quote_id')
      .eq('id', pid)
      .single();
    if (projectErr) throw projectErr;
    const activeQuoteId: string | null = projectRow?.active_quote_id || null;
    if (!activeQuoteId) return;

    const { data: existingItems, error: itemsErr } = await supabase
      .from('quote_line_items')
      .select('sort_order')
      .eq('quote_id', activeQuoteId)
      .order('sort_order', { ascending: false })
      .limit(1);
    if (itemsErr) throw itemsErr;
    const nextSortOrder = (existingItems?.[0]?.sort_order ?? -1) + 1;

    const { error: lineErr } = await supabase
      .from('quote_line_items')
      .insert({
        quote_id: activeQuoteId,
        title: scopeTitle,
        description: changeRequest.description || null,
        cost,
        sort_order: nextSortOrder,
      });
    if (lineErr) throw lineErr;

    // 3. Recalculate quote totals from the full set of line items
    const { data: quoteRow, error: quoteErr } = await supabase
      .from('quotes')
      .select('tax_rate')
      .eq('id', activeQuoteId)
      .single();
    if (quoteErr) throw quoteErr;
    const taxRate = Number(quoteRow?.tax_rate) || 0;

    const { data: allItems, error: allItemsErr } = await supabase
      .from('quote_line_items')
      .select('cost')
      .eq('quote_id', activeQuoteId);
    if (allItemsErr) throw allItemsErr;
    const newSubtotal = (allItems || []).reduce(
      (sum, it: { cost: number | null }) => sum + (Number(it.cost) || 0),
      0
    );
    const newTaxAmount = newSubtotal * (taxRate / 100);
    const newTotal = newSubtotal + newTaxAmount;

    const { error: updateQuoteErr } = await supabase
      .from('quotes')
      .update({
        subtotal: newSubtotal,
        tax_amount: newTaxAmount,
        total: newTotal,
      })
      .eq('id', activeQuoteId);
    if (updateQuoteErr) throw updateQuoteErr;
  };

  // Trade responds to a client request with cost/time details
  const respondToClientRequest = async (
    requestId: string,
    responseData: {
      title: string;
      description: string;
      costImpact: number;
      timeImpact: number;
      reason?: string;
      imageUrl?: string;
    }
  ) => {
    try {
      const { error } = await supabase
        .from('change_requests')
        .update({
          title: responseData.title,
          description: responseData.description,
          cost_impact: responseData.costImpact,
          time_impact: responseData.timeImpact.toString(),
          reason: responseData.reason || null,
          image_url: responseData.imageUrl || null,
          status: 'awaiting_client',
        })
        .eq('id', requestId);

      if (error) throw error;

      // Find the change request to get its details for the notification
      const changeRequest = project?.changeRequests.find(cr => cr.id === requestId);
      
      if (changeRequest && projectId) {
        // Send notification to client about the response
        await sendChangeNotification(
          projectId,
          requestId,
          'created', // Using 'created' to indicate new info available
          'client',
          responseData.title,
          responseData.description,
          responseData.costImpact,
          responseData.timeImpact.toString()
        );
      }

      await fetchProject();
      return true;
    } catch (error) {
      console.error('Error responding to client request:', error);
      toast.error('Failed to send response to client');
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

  const addStage = async (stageData: { name: string; description: string; invoiceAmount?: number; invoicePercentage?: number }) => {
    if (!projectId) return false;

    try {
      const stageOrder = project?.stages?.length || 0;
      const status = stageOrder === 0 ? 'current' : 'upcoming';

      const { error } = await supabase
        .from('project_stages')
        .insert({
          project_id: projectId,
          name: stageData.name,
          description: stageData.description,
          status,
          stage_order: stageOrder,
          invoice_amount: stageData.invoiceAmount || null,
          invoice_percentage: stageData.invoicePercentage || null,
        });

      if (error) throw error;

      await fetchProject();
      toast.success('Stage added');
      return true;
    } catch (error) {
      console.error('Error adding stage:', error);
      toast.error('Failed to add stage');
      return false;
    }
  };

  const editStage = async (stageId: string, data: { name: string; description: string; invoiceAmount?: number; invoicePercentage?: number }) => {
    try {
      const { error } = await supabase
        .from('project_stages')
        .update({ 
          name: data.name, 
          description: data.description,
          invoice_amount: data.invoiceAmount || null,
          invoice_percentage: data.invoicePercentage || null,
        })
        .eq('id', stageId);

      if (error) throw error;

      await fetchProject();
      toast.success('Stage updated');
      return true;
    } catch (error) {
      console.error('Error editing stage:', error);
      toast.error('Failed to update stage');
      return false;
    }
  };

  const deleteStage = async (stageId: string) => {
    if (!projectId) return false;

    try {
      // Get the stage being deleted
      const stageToDelete = project?.stages.find(s => s.id === stageId);
      
      const { error } = await supabase
        .from('project_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;

      // If deleted stage was current, make the previous or next stage current
      if (stageToDelete?.status === 'current' && project?.stages) {
        const remainingStages = project.stages.filter(s => s.id !== stageId);
        if (remainingStages.length > 0) {
          const firstUpcoming = remainingStages.find(s => s.status === 'upcoming');
          const lastCompleted = [...remainingStages].reverse().find(s => s.status === 'completed');
          const newCurrentId = firstUpcoming?.id || lastCompleted?.id || remainingStages[0].id;
          
          await supabase
            .from('project_stages')
            .update({ status: 'current' })
            .eq('id', newCurrentId);
        }
      }

      // Reorder remaining stages
      const { data: remainingStages } = await supabase
        .from('project_stages')
        .select('id')
        .eq('project_id', projectId)
        .order('stage_order');

      if (remainingStages) {
        for (let i = 0; i < remainingStages.length; i++) {
          await supabase
            .from('project_stages')
            .update({ stage_order: i })
            .eq('id', remainingStages[i].id);
        }
      }

      await fetchProject();
      toast.success('Stage deleted');
      return true;
    } catch (error) {
      console.error('Error deleting stage:', error);
      toast.error('Failed to delete stage');
      return false;
    }
  };

  const reorderStages = async (stageIds: string[]) => {
    try {
      for (let i = 0; i < stageIds.length; i++) {
        const { error } = await supabase
          .from('project_stages')
          .update({ stage_order: i })
          .eq('id', stageIds[i]);

        if (error) throw error;
      }

      await fetchProject();
      return true;
    } catch (error) {
      console.error('Error reordering stages:', error);
      toast.error('Failed to reorder stages');
      return false;
    }
  };

  const clearAllStages = async () => {
    if (!projectId) return false;

    try {
      const { error } = await supabase
        .from('project_stages')
        .delete()
        .eq('project_id', projectId);

      if (error) throw error;

      await fetchProject();
      toast.success('All stages cleared');
      return true;
    } catch (error) {
      console.error('Error clearing stages:', error);
      toast.error('Failed to clear stages');
      return false;
    }
  };

  // Client details operations
  const updateClientDetails = async (details: { clientName: string; clientEmail: string; clientAddress?: string }) => {
    if (!projectId) return false;

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          client_name: details.clientName,
          client_email: details.clientEmail,
          client_address: details.clientAddress || null,
        })
        .eq('id', projectId);

      if (error) throw error;

      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          clientName: details.clientName,
          clientEmail: details.clientEmail,
          clientAddress: details.clientAddress,
        };
      });
      toast.success('Client details updated');
      return true;
    } catch (error) {
      console.error('Error updating client details:', error);
      toast.error('Failed to update client details');
      return false;
    }
  };

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
    respondToClientRequest,
    updateStage,
    addStage,
    editStage,
    deleteStage,
    reorderStages,
    clearAllStages,
    updateProjectStatus,
    updateClientDetails,
  };
}
