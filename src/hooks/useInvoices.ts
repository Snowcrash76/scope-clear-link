import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Invoice, InvoiceLineItem } from '@/types/project';

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

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
        status: inv.status,
        subtotal: inv.subtotal || 0,
        taxRate: inv.tax_rate || 0,
        taxAmount: inv.tax_amount || 0,
        total: inv.total || 0,
        amountPaid: inv.amount_paid || 0,
        dueDate: inv.due_date ? new Date(inv.due_date) : undefined,
        paidAt: inv.paid_at ? new Date(inv.paid_at) : undefined,
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
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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

  const updateInvoiceStatus = async (invoiceId: string, status: Invoice['status'], silent = false) => {
    try {
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
    const ok = await updateInvoiceStatus(invoiceId, 'sent', true); // silent — toast handled below
    if (!ok || !projectId) {
      if (!ok) toast.error('Failed to send invoice');
      return ok;
    }

    // Send email to client
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return ok;

      const res = await fetch('/api/send-invoice-to-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projectId, invoiceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Email failed');
      const clientName = json.result?.clientName;
      toast.success(`Invoice sent to ${clientName || 'client'}`, {
        description: 'Your client has been emailed the invoice.',
      });
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error('Invoice email error:', msg);
      if (msg.includes('Client email not set')) {
        toast.warning('Invoice marked as sent', {
          description: 'No client email on file — add a client email in the project details to deliver invoices by email.',
        });
      } else if (msg.includes('verify a domain') || msg.includes('testing emails') || msg.includes('403')) {
        toast.warning('Invoice marked as sent', {
          description: 'Email delivery requires a verified sender domain in Resend — invoices are saved but emails are paused until this is configured.',
        });
      } else {
        toast.warning('Invoice marked as sent', {
          description: `Email could not be delivered: ${msg}`,
        });
      }
    }

    return ok;
  };

  const markAsPaid = async (invoiceId: string) => {
    return updateInvoiceStatus(invoiceId, 'paid');
  };

  const cancelInvoice = async (invoiceId: string) => {
    return updateInvoiceStatus(invoiceId, 'cancelled');
  };

  const updateInvoiceNumber = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ invoice_number: invoiceNumber })
        .eq('id', invoiceId);

      if (error) throw error;

      await fetchInvoices();
      queryClient.invalidateQueries({ queryKey: ['/invoices/all'] });
      toast.success('Invoice reference updated');
      return true;
    } catch (error) {
      console.error('Error updating invoice number:', error);
      toast.error('Failed to update invoice reference');
      return false;
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      // Line items will be cascade deleted
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      await fetchInvoices();
      toast.success('Invoice deleted');
      return true;
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice');
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
    refetch: fetchInvoices,
    createInvoice,
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
