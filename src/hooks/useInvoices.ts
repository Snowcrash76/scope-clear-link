import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Invoice, InvoiceLineItem, ProjectStage, Quote } from '@/types/project';
import { getStageBilling } from '@/lib/stageBilling';
import { calculateEditableInvoice, invoiceDisplayStatus, type InvoiceEditInput } from '@/lib/invoiceWorkflow';

type DbInvoice = {
  id: string;
  project_id: string;
  quote_id: string | null;
  stage_id: string | null;
  invoice_number: string;
  type: 'staged' | 'final' | 'deposit';
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total: number | null;
  amount_paid: number | null;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  revision?: number;
  delivery_token?: string | null;
};

type DbInvoiceLineItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
  scope_item_id: string | null;
  change_request_id: string | null;
  created_at: string;
};

export function useInvoices(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const stageInFlight = useRef(new Set<string>());
  const workflowInFlight = useRef(new Set<string>());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  const fetchInvoices = useCallback(async (showLoading = true) => {
    if (!projectId) {
      setError(null);
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Fetch line items for all invoices
      const invoiceIds = (invoicesData as DbInvoice[]).map(i => i.id);
      
      let lineItemsData: DbInvoiceLineItem[] = [];
      if (invoiceIds.length > 0) {
        const { data, error } = await supabase
          .from('invoice_line_items')
          .select('*')
          .in('invoice_id', invoiceIds);
        
        if (error) throw error;
        lineItemsData = data as DbInvoiceLineItem[];
      }

      const mappedInvoices: Invoice[] = (invoicesData as DbInvoice[]).map(inv => ({
        id: inv.id,
        projectId: inv.project_id,
        quoteId: inv.quote_id || undefined,
        stageId: inv.stage_id || undefined,
        invoiceNumber: inv.invoice_number,
        type: inv.type,
        status: invoiceDisplayStatus(inv.status, inv.approved_at) as Invoice['status'],
        subtotal: inv.subtotal || 0,
        taxRate: inv.tax_rate || 0,
        taxAmount: inv.tax_amount || 0,
        total: inv.total || 0,
        amountPaid: inv.amount_paid || 0,
        dueDate: inv.due_date ? new Date(inv.due_date) : undefined,
        paidAt: inv.paid_at ? new Date(inv.paid_at) : undefined,
        approvedAt: inv.approved_at ? new Date(inv.approved_at) : undefined,
        approvedBy: inv.approved_by || undefined,
        revision: inv.revision ?? 0,
        deliveryPending: !!inv.delivery_token,
        notes: inv.notes || undefined,
        terms: inv.terms || undefined,
        lineItems: lineItemsData
          .filter(li => li.invoice_id === inv.id)
          .map(li => ({
            id: li.id,
            invoiceId: li.invoice_id,
            description: li.description,
            quantity: li.quantity || 1,
            unitPrice: li.unit_price || 0,
            total: li.total || 0,
            scopeItemId: li.scope_item_id || undefined,
            changeRequestId: li.change_request_id || undefined,
            createdAt: new Date(li.created_at),
          })),
        createdAt: new Date(inv.created_at),
        updatedAt: new Date(inv.updated_at),
      }));

      setInvoices(mappedInvoices);
      queryClient.invalidateQueries({ queryKey: ['/invoices/all'] });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError(error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [projectId, queryClient]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Polling fallback: silently refresh every 10s
  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(() => fetchInvoices(false), 10000);
    return () => clearInterval(interval);
  }, [projectId, fetchInvoices]);

  // Real-time subscription for invoices table
  useEffect(() => {
    if (!projectId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchInvoices(false), 300);
    };

    const channel = supabase
      .channel(`invoices-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `project_id=eq.${projectId}` }, debouncedRefetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchInvoices]);

  const generateInvoiceNumber = () => {
    const date = new Date();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${random}`;
  };

  const createInvoice = async (invoiceData: {
    type: 'staged' | 'final' | 'deposit';
    quoteId?: string;
    stageId?: string;
    taxRate: number;
    dueDate?: Date;
    notes?: string;
    terms?: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      scopeItemId?: string;
      changeRequestId?: string;
    }>;
  }) => {
    if (!projectId) return null;

    try {
      const subtotal = invoiceData.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const taxAmount = subtotal * (invoiceData.taxRate / 100);
      const total = subtotal + taxAmount;

      // Create invoice
      const { data: invoiceResult, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          project_id: projectId,
          quote_id: invoiceData.quoteId,
          stage_id: invoiceData.stageId,
          invoice_number: generateInvoiceNumber(),
          type: invoiceData.type,
          subtotal,
          tax_rate: invoiceData.taxRate,
          tax_amount: taxAmount,
          total,
          due_date: invoiceData.dueDate?.toISOString(),
          notes: invoiceData.notes,
          terms: invoiceData.terms,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItemsToInsert = invoiceData.lineItems.map(item => ({
        invoice_id: invoiceResult.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.quantity * item.unitPrice,
        scope_item_id: item.scopeItemId,
        change_request_id: item.changeRequestId,
      }));

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      await fetchInvoices();
      toast.success('Invoice created successfully');
      return invoiceResult.id;
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
      return null;
    }
  };

  /** One atomic transaction in Supabase also rechecks owner, quote, stage and duplicate billing. */
  const createStageInvoice = async (
    stage: ProjectStage,
    quote: Quote | null,
    options: { dueDate?: string; notes?: string; terms?: string } = {},
  ): Promise<string | null> => {
    if (!projectId || stageInFlight.current.has(stage.id)) return null;
    stageInFlight.current.add(stage.id);
    try {
      const preview = getStageBilling(stage, quote);
      const { data, error: rpcError } = await supabase.rpc('create_stage_invoice', {
        p_project_id: projectId,
        p_stage_id: stage.id,
        p_expected_quote_id: quote?.id ?? null,
        p_expected_percentage: stage.invoicePercentage ?? null,
        p_expected_amount: stage.invoiceAmount ?? null,
        p_expected_subtotal: preview.subtotal,
        p_expected_tax_rate: preview.taxRate,
        p_due_date: options.dueDate || null,
        p_notes: options.notes?.trim() || null,
        p_terms: options.terms?.trim() || null,
      });
      if (rpcError) {
        if (['PGRST202', '42883'].includes(rpcError.code)) {
          throw new Error('Stage invoicing needs database setup. Apply the stage invoice migration in Supabase, then retry.');
        }
        if (rpcError.code === '23505') {
          throw new Error('This stage has already been invoiced. Refresh the job to view its invoice.');
        }
        if (rpcError.code === 'P0001' || rpcError.code === '42501' || rpcError.code === '23503') {
          throw new Error(rpcError.message);
        }
        throw new Error('Unable to save the stage invoice. Please try again.');
      }
      if (typeof data !== 'string' || !data) throw new Error('Stage invoice was not confirmed. Refresh before retrying.');
      await fetchInvoices(false);
      toast.success('Stage invoice saved · pending approval');
      return data;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the stage invoice.');
      return null;
    } finally {
      stageInFlight.current.delete(stage.id);
    }
  };

  const saveInvoice = async (invoice: Invoice, values: InvoiceEditInput): Promise<boolean> => {
    if (!projectId || workflowInFlight.current.has(invoice.id)) return false;
    workflowInFlight.current.add(invoice.id);
    try {
      if (!['draft', 'approved'].includes(invoice.status) || invoice.deliveryPending) {
        throw new Error('Only unsent invoices can be edited. Confirm any pending delivery first.');
      }
      calculateEditableInvoice(values);
      const { data, error } = await supabase.rpc('save_invoice_for_approval', {
        p_project_id: projectId, p_invoice_id: invoice.id, p_expected_revision: invoice.revision ?? 0,
        p_invoice_number: values.invoiceNumber.trim(), p_due_date: values.dueDate || null,
        p_notes: values.notes, p_terms: values.terms, p_tax_rate: values.taxRate,
        p_line_items: values.lineItems.map(item => ({
          description: item.description, quantity: item.quantity, unit_price: item.unitPrice,
          scope_item_id: item.scopeItemId ?? null, change_request_id: item.changeRequestId ?? null,
        })),
      });
      if (error) throw new Error(['PGRST202', '42883'].includes(error.code)
        ? 'Invoice approval needs database setup. Apply its Supabase migration, then retry.'
        : error.message);
      if (typeof data !== 'string') throw new Error('The invoice save was not confirmed. Refresh before retrying.');
      await fetchInvoices(false);
      toast.success('Invoice saved · pending approval');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save this invoice.');
      return false;
    } finally {
      workflowInFlight.current.delete(invoice.id);
    }
  };

  const approveInvoice = async (invoice: Invoice): Promise<boolean> => {
    if (!projectId || workflowInFlight.current.has(invoice.id)) return false;
    workflowInFlight.current.add(invoice.id);
    try {
      const { data, error } = await supabase.rpc('approve_invoice', {
        p_project_id: projectId, p_invoice_id: invoice.id, p_expected_revision: invoice.revision ?? 0,
      });
      if (error) throw new Error(['PGRST202', '42883'].includes(error.code)
        ? 'Invoice approval needs database setup. Apply its Supabase migration, then retry.'
        : error.message);
      if (typeof data !== 'string') throw new Error('Approval was not confirmed. Refresh before retrying.');
      await fetchInvoices(false);
      toast.success('Invoice approved', { description: 'No email has been sent. Choose Send to client when ready.' });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to approve this invoice.');
      return false;
    } finally {
      workflowInFlight.current.delete(invoice.id);
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: Invoice['status'], silent = false) => {
    try {
      if (!['paid', 'cancelled'].includes(status)) throw new Error('Use Approve invoice or Send to client to progress an invoice.');
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'paid') {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (invoice) {
          updateData.paid_at = new Date().toISOString();
          updateData.amount_paid = invoice.total;
        }
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (error) throw error;

      await fetchInvoices();
      if (!silent) toast.success(`Invoice marked as ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating invoice status:', error);
      toast.error('Failed to update invoice');
      return false;
    }
  };

  const sendInvoice = async (invoiceId: string) => {
    if (!projectId || workflowInFlight.current.has(invoiceId)) return false;
    workflowInFlight.current.add(invoiceId);
    try {
      const invoice = invoices.find(candidate => candidate.id === invoiceId);
      if (!invoice || invoice.status !== 'approved') throw new Error('Approve this invoice before sending it.');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again before sending.');

      const res = await fetch('/api/send-invoice-to-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projectId, invoiceId, expectedRevision: invoice.revision ?? 0 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Email failed');
      const clientName = json.result?.clientName;
      toast.success(json.result?.alreadySent ? 'This invoice was already sent' : `Invoice sent to ${clientName || 'client'}`, {
        description: json.result?.alreadySent ? 'No duplicate email was sent.' : 'Your client has been emailed the invoice.',
      });
      return true;
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      toast.error('Invoice delivery was not confirmed', { description: msg });
      return false;
    } finally {
      await fetchInvoices(false);
      workflowInFlight.current.delete(invoiceId);
    }
  };

  const markAsPaid = async (invoiceId: string) => {
    return updateInvoiceStatus(invoiceId, 'paid');
  };

  const cancelInvoice = async (invoiceId: string) => {
    return updateInvoiceStatus(invoiceId, 'cancelled');
  };

  const updateInvoiceNumber = async (invoiceId: string, invoiceNumber: string) => {
    const invoice = invoices.find(candidate => candidate.id === invoiceId);
    if (!invoice) return false;
    return saveInvoice(invoice, {
      invoiceNumber, dueDate: invoice.dueDate?.toISOString().slice(0, 10),
      notes: invoice.notes ?? '', terms: invoice.terms ?? '', taxRate: invoice.taxRate,
      lineItems: invoice.lineItems,
    });
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      const invoice = invoices.find(candidate => candidate.id === invoiceId);
      if (!invoice) throw new Error('Refresh the invoice list before deleting.');
      if (!['draft', 'approved'].includes(invoice.status)) {
        throw new Error('Issued and cancelled invoices are retained for financial history and cannot be deleted.');
      }
      if (invoice.deliveryPending) throw new Error('Confirm the pending delivery before deleting.');
      // Line items will be cascade deleted
      const { data, error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Deletion was not confirmed. Refresh the invoice list before retrying.');

      await fetchInvoices();
      toast.success('Invoice deleted');
      return true;
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete invoice');
      return false;
    }
  };

  // Calculate totals for the project
  const getTotalInvoiced = () => invoices.reduce((sum, inv) => sum + inv.total, 0);
  const getTotalPaid = () => invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const getOutstandingBalance = () => getTotalInvoiced() - getTotalPaid();

  return {
    invoices,
    loading,
    error,
    refetch: fetchInvoices,
    createInvoice,
    createStageInvoice,
    saveInvoice,
    approveInvoice,
    updateInvoiceStatus,
    updateInvoiceNumber,
    sendInvoice,
    markAsPaid,
    cancelInvoice,
    deleteInvoice,
    getTotalInvoiced,
    getTotalPaid,
    getOutstandingBalance,
  };
}
