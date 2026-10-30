import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clientAccessHeaders } from '@/lib/clientAccess';
import { toast } from 'sonner';
import { Project, ScopeItem, ChangeRequest, ProjectStage } from '@/types/project';

// Fire-and-forget: notify client when a scope item is added, updated, or removed.
const sendScopeChangeNotification = async (
  projectId: string,
  changeType: 'added' | 'updated' | 'removed',
  itemTitle: string
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    fetch('/api/send-scope-change-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ projectId, changeType, itemTitle }),
    }).catch(() => {});
  } catch {
    // Non-blocking — never surface to the user
  }
};

// Helper function to send change notification emails.
// Works for both authenticated (trade) and unauthenticated (client) callers.
const sendChangeNotification = async (
  projectId: string,
  changeRequestId: string,
  notificationType: 'created' | 'approved' | 'declined' | 'updated' | 'deleted',
  recipientType: 'trade' | 'client',
  changeTitle: string,
  changeDescription: string,
  costImpact?: number,
  timeImpact?: string
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...clientAccessHeaders() };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const res = await fetch('/api/send-change-notification', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId,
        changeRequestId,
        notificationType,
        recipientType,
        changeTitle,
        changeDescription,
        costImpact,
        timeImpact,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Failed to send notification:', err);
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
  type: 'client_request' | 'site_issue' | 'substitution' | 'addition';
  related_scope_item_id?: string | null;
  related_quote_line_item_id?: string | null;
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
  const [error, setError] = useState<unknown | null>(null);

  const fetchProject = useCallback(async (showLoading = true) => {
    if (!projectId) {
      setError(null);
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);
      
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
      const relatedError = scopeRes.error || changeRes.error || stageRes.error || profileRes.error || docsRes.error;
      if (relatedError) throw relatedError;

      const scopeItems = (scopeRes.data || []) as DbScopeItem[];
      const changeRequests = (changeRes.data || []) as DbChangeRequest[];
      const projectStages = (stageRes.data || []) as DbProjectStage[];
      const profile = profileRes.data;
      const rawDocuments = (docsRes.data || []).filter((doc: any) => doc.purpose !== 'employee_photo') as ProjectDocument[];

      // Generate signed URLs for documents (bucket is now private)
      const projectDocuments = await Promise.all(
        rawDocuments.map(async (doc) => {
          if (doc.file_url.startsWith('/api/client/files/')) return doc;
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
          relatedScopeItemId: c.related_scope_item_id || undefined,
          relatedQuoteLineItemId: c.related_quote_line_item_id || undefined,
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
      setError(error);
      toast.error('Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Polling fallback: silently refresh every 10s
  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(() => fetchProject(false), 10000);
    return () => clearInterval(interval);
  }, [projectId, fetchProject]);

  // Real-time subscriptions for project core tables (scope, changes, stages, project row)
  useEffect(() => {
    if (!projectId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchProject(false), 300);
    };

    const channel = supabase
      .channel(`project-core-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scope_items', filter: `project_id=eq.${projectId}` }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'change_requests', filter: `project_id=eq.${projectId}` }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_stages', filter: `project_id=eq.${projectId}` }, debouncedRefetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchProject]);

  // Lightweight document-only refresh — no full project reload, no loading flash
  const fetchDocumentsOnly = useCallback(async () => {
    if (!projectId) return;
    try {
      const docsRes = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      const rawDocuments = (docsRes.data || []).filter((doc: any) => doc.purpose !== 'employee_photo') as ProjectDocument[];

      const projectDocuments = await Promise.all(
        rawDocuments.map(async (doc) => {
          if (doc.file_url.startsWith('/api/client/files/')) return doc;
          let filePath = doc.file_url;
          if (doc.file_url.includes('/project-documents/')) {
            filePath = doc.file_url.split('/project-documents/').pop() || doc.file_url;
          }
          const { data: signedData } = await supabase.storage
            .from('project-documents')
            .createSignedUrl(filePath, 60 * 60 * 24);
          return {
            ...doc,
            file_url: signedData?.signedUrl || doc.file_url,
          };
        })
      );

      setDocuments(projectDocuments);
    } catch (error) {
      console.error('Error refreshing documents:', error);
    }
  }, [projectId]);

  // Real-time subscription: refresh documents when any insert/update/delete occurs
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-documents-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_documents',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchDocumentsOnly();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchDocumentsOnly]);

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
        sendScopeChangeNotification(projectId, 'updated', itemData.title);
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
        sendScopeChangeNotification(projectId, 'added', itemData.title);
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
    let itemTitle = project?.scopeItems.find(i => i.id === itemId)?.title ?? '';
    if (!itemTitle) {
      const { data } = await supabase.from('scope_items').select('title').eq('id', itemId).single();
      itemTitle = data?.title ?? '';
    }
    try {
      const { error } = await supabase
        .from('scope_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      if (projectId && itemTitle) sendScopeChangeNotification(projectId, 'removed', itemTitle);
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
          ...(requestData.relatedScopeItemId ? { related_scope_item_id: requestData.relatedScopeItemId } : {}),
          ...(requestData.relatedQuoteLineItemId ? { related_quote_line_item_id: requestData.relatedQuoteLineItemId } : {}),
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
          ...((requestData.relatedScopeItemId !== undefined || requestData.relatedQuoteLineItemId !== undefined)
            ? { related_scope_item_id: requestData.relatedScopeItemId || null, related_quote_line_item_id: requestData.relatedQuoteLineItemId || null } : {}),
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

  // When a variation is approved, clean up any "Variation: X" scope/line items
  // that were created by older code (they cause duplication) and recalculate
  // the quote total from base line items + ALL approved change requests.
  const applyApprovedChangeToScopeAndQuote = async (
    pid: string,
    changeRequest: ChangeRequest
  ) => {
    // Clean up any existing "Variation: " scope items and quote line items that
    // were created by old versions of this function — they are the source of
    // duplication because the approved change requests already serve as the
    // single source of truth for variation display and financial totals.
    await supabase
      .from('scope_items')
      .delete()
      .eq('project_id', pid)
      .ilike('title', 'Variation:%');

    // Find the active quote and clean its variation line items too
    const { data: projectRow, error: projectErr } = await supabase
      .from('projects')
      .select('active_quote_id')
      .eq('id', pid)
      .single();
    if (projectErr) throw projectErr;
    const activeQuoteId: string | null = projectRow?.active_quote_id || null;
    if (!activeQuoteId) return;

    await supabase
      .from('quote_line_items')
      .delete()
      .eq('quote_id', activeQuoteId)
      .ilike('title', 'Variation:%');

    // Recalculate quote totals: base line items + ALL approved change requests
    const [quoteRes, baseItemsRes, approvedChangesRes] = await Promise.all([
      supabase.from('quotes').select('tax_rate').eq('id', activeQuoteId).single(),
      supabase.from('quote_line_items').select('cost').eq('quote_id', activeQuoteId),
      supabase.from('change_requests').select('cost_impact').eq('project_id', pid).eq('status', 'approved'),
    ]);
    if (quoteRes.error) throw quoteRes.error;

    const taxRate = Number(quoteRes.data?.tax_rate) || 0;
    const baseSubtotal = (baseItemsRes.data || []).reduce(
      (sum, it: { cost: number | null }) => sum + (Number(it.cost) || 0),
      0
    );
    const changesSubtotal = (approvedChangesRes.data || []).reduce(
      (sum, cr: { cost_impact: number | null }) => sum + (Number(cr.cost_impact) || 0),
      0
    );
    // Include the current change request's cost (it's approved but fetchProject
    // hasn't run yet so it may not appear in the DB query above)
    const thisCost = Number(changeRequest.costImpact) || 0;
    const newSubtotal = baseSubtotal + changesSubtotal + thisCost;
    const newTaxAmount = newSubtotal * (taxRate / 100);
    const newTotal = newSubtotal + newTaxAmount;

    const { error: updateQuoteErr } = await supabase
      .from('quotes')
      .update({ subtotal: newSubtotal, tax_amount: newTaxAmount, total: newTotal })
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
      toast.error('Failed to update job status');
      return false;
    }
  };

  return {
    project,
    documents,
    loading,
    error,
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
