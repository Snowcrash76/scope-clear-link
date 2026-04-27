import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Quote } from '@/types/project';

type DbQuote = {
  id: string;
  project_id: string;
  quote_number: string;
  quote_token?: string;
  token_updated_at: string | null;
  token_regenerated: boolean;
  status: 'draft' | 'sent' | 'approved' | 'declined' | 'revised';
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total: number | null;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  client_comment: string | null;
  approved_at: string | null;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useQuotes(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedQuotes: Quote[] = (data as DbQuote[]).map(q => ({
        id: q.id,
        projectId: q.project_id,
        quoteNumber: q.quote_number,
        quoteToken: q.quote_token,
        tokenUpdatedAt: q.token_updated_at ? new Date(q.token_updated_at) : undefined,
        tokenRegenerated: q.token_regenerated,
        status: q.status,
        subtotal: q.subtotal || 0,
        taxRate: q.tax_rate || 0,
        taxAmount: q.tax_amount || 0,
        total: q.total || 0,
        validUntil: q.valid_until ? new Date(q.valid_until) : undefined,
        notes: q.notes || undefined,
        terms: q.terms || undefined,
        clientComment: q.client_comment || undefined,
        approvedAt: q.approved_at ? new Date(q.approved_at) : undefined,
        declinedAt: q.declined_at ? new Date(q.declined_at) : undefined,
        createdAt: new Date(q.created_at),
        updatedAt: new Date(q.updated_at),
      }));

      setQuotes(mappedQuotes);
      
      // Set the active quote (most recent non-declined, or most recent overall)
      const active = mappedQuotes.find(q => q.status !== 'declined') || mappedQuotes[0] || null;
      setActiveQuote(active);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const generateQuoteNumber = () => {
    const date = new Date();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `Q-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${random}`;
  };

  const createQuote = async (quoteData: {
    subtotal: number;
    taxRate: number;
    notes?: string;
    terms?: string;
    validUntil?: Date;
  }) => {
    if (!projectId) return null;

    try {
      const taxAmount = quoteData.subtotal * (quoteData.taxRate / 100);
      const total = quoteData.subtotal + taxAmount;

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          project_id: projectId,
          quote_number: generateQuoteNumber(),
          subtotal: quoteData.subtotal,
          tax_rate: quoteData.taxRate,
          tax_amount: taxAmount,
          total,
          notes: quoteData.notes,
          terms: quoteData.terms,
          valid_until: quoteData.validUntil?.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update project with active quote
      await supabase
        .from('projects')
        .update({ active_quote_id: data.id })
        .eq('id', projectId);

      await fetchQuotes();
      toast.success('Quote created successfully');
      return data.id;
    } catch (error) {
      console.error('Error creating quote:', error);
      toast.error('Failed to create quote');
      return null;
    }
  };

  const updateQuote = async (quoteId: string, quoteData: Partial<{
    quoteNumber: string;
    subtotal: number;
    taxRate: number;
    notes: string;
    terms: string;
    validUntil: Date;
    status: Quote['status'];
  }>) => {
    try {
      const updateData: Record<string, unknown> = {};

      if (quoteData.quoteNumber !== undefined) updateData.quote_number = quoteData.quoteNumber;

      if (quoteData.subtotal !== undefined) {
        updateData.subtotal = quoteData.subtotal;
        const taxRate = quoteData.taxRate ?? activeQuote?.taxRate ?? 0;
        updateData.tax_amount = quoteData.subtotal * (taxRate / 100);
        updateData.total = quoteData.subtotal + (updateData.tax_amount as number);
      }
      
      if (quoteData.taxRate !== undefined) {
        updateData.tax_rate = quoteData.taxRate;
        const subtotal = quoteData.subtotal ?? activeQuote?.subtotal ?? 0;
        updateData.tax_amount = subtotal * (quoteData.taxRate / 100);
        updateData.total = subtotal + (updateData.tax_amount as number);
      }
      
      if (quoteData.notes !== undefined) updateData.notes = quoteData.notes;
      if (quoteData.terms !== undefined) updateData.terms = quoteData.terms;
      if (quoteData.validUntil !== undefined) updateData.valid_until = quoteData.validUntil.toISOString();
      if (quoteData.status !== undefined) updateData.status = quoteData.status;

      const { error } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', quoteId);

      if (error) throw error;

      await fetchQuotes();
      queryClient.invalidateQueries({ queryKey: ['/quotes/all'] });
      return true;
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error('Failed to update quote');
      return false;
    }
  };

  const sendQuote = async (quoteId: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'sent' })
        .eq('id', quoteId);

      if (error) throw error;

      await fetchQuotes();

      // Send email to client with quote link and project page link
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token && projectId) {
          const res = await fetch('/api/send-quote-to-client', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ projectId, quoteId }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Email failed');
          toast.success('Quote sent', { description: 'Your client has been emailed the quote link.' });
        } else {
          toast.success('Quote sent to client');
        }
      } catch (emailErr) {
        console.error('Quote email error:', emailErr);
        toast.success('Quote marked as sent', { description: 'Could not send the email notification — share the quote link manually.' });
      }

      return true;
    } catch (error) {
      console.error('Error sending quote:', error);
      toast.error('Failed to send quote');
      return false;
    }
  };

  const approveQuote = async (quoteId: string, comment?: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString(),
          client_comment: comment || null,
        })
        .eq('id', quoteId);

      if (error) throw error;

      // Update project status to in_progress when quote is approved
      if (projectId) {
        await supabase
          .from('projects')
          .update({ status: 'in_progress' })
          .eq('id', projectId);
      }

      await fetchQuotes();
      toast.success('Quote approved');
      return true;
    } catch (error) {
      console.error('Error approving quote:', error);
      toast.error('Failed to approve quote');
      return false;
    }
  };

  const declineQuote = async (quoteId: string, comment?: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ 
          status: 'declined',
          declined_at: new Date().toISOString(),
          client_comment: comment || null,
        })
        .eq('id', quoteId);

      if (error) throw error;

      await fetchQuotes();
      toast.success('Quote declined');
      return true;
    } catch (error) {
      console.error('Error declining quote:', error);
      toast.error('Failed to decline quote');
      return false;
    }
  };

  const reviseQuote = async (quoteId: string) => {
    try {
      // Mark current quote as revised
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'revised' })
        .eq('id', quoteId);

      if (error) throw error;

      await fetchQuotes();
      return true;
    } catch (error) {
      console.error('Error revising quote:', error);
      toast.error('Failed to revise quote');
      return false;
    }
  };

  const respondByToken = async (
    token: string,
    action: 'approved' | 'declined',
    comment?: string
  ): Promise<boolean> => {
    try {
      const { data: success, error } = await supabase.rpc('respond_to_quote_by_token', {
        p_token: token,
        p_status: action,
        p_comment: comment || null,
      });

      if (error) throw error;

      if (!success) {
        toast.error('Unable to submit your response. The quote may have already been actioned.');
        return false;
      }

      await fetchQuotes();
      return true;
    } catch (error) {
      console.error('Error responding to quote by token:', error);
      toast.error('Failed to respond to quote');
      return false;
    }
  };

  const regenerateQuoteToken = async (quoteId: string): Promise<string | null> => {
    try {
      const newToken = crypto.randomUUID();
      const now = new Date().toISOString();

      // If the quote already has a token, mark it as explicitly regenerated
      const existingQuote = quotes.find(q => q.id === quoteId);
      const isRegeneration = !!existingQuote?.quoteToken;

      const { error } = await supabase
        .from('quotes')
        .update({
          quote_token: newToken,
          token_updated_at: now,
          ...(isRegeneration ? { token_regenerated: true } : {}),
        })
        .eq('id', quoteId);

      if (error) throw error;

      await fetchQuotes();
      return newToken;
    } catch (error) {
      console.error('Error regenerating quote token:', error);
      toast.error('Failed to regenerate quote link');
      return null;
    }
  };

  return {
    quotes,
    activeQuote,
    loading,
    refetch: fetchQuotes,
    createQuote,
    updateQuote,
    sendQuote,
    approveQuote,
    declineQuote,
    reviseQuote,
    respondByToken,
    regenerateQuoteToken,
  };
}
