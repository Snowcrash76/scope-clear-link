import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isVariationItem } from '@/lib/utils';
import { calculateStoredQuoteTotals } from '../../shared/quoteTotals.js';

export interface QuoteLineItem {
  id: string;
  quoteId: string;
  title: string;
  description?: string;
  cost: number;
  sortOrder: number;
  isVariation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type DbQuoteLineItem = {
  id: string;
  quote_id: string;
  title: string;
  description: string | null;
  cost: number;
  sort_order: number;
  is_variation: boolean;
  created_at: string;
  updated_at: string;
};

async function insertHistory(
  rows: Array<{
    line_item_id: string;
    quote_id: string;
    field_changed: string;
    old_value?: string | null;
    new_value?: string | null;
    changed_by?: string;
  }>
) {
  if (rows.length === 0) return;
  // Supabase client returns { error } rather than throwing — check explicitly
  const { error } = await supabase.from('quote_line_item_history').insert(rows);
  if (error) {
    const pgErr = error as { code?: string; message?: string };
    // Silently skip only when the table hasn't been migrated yet (42P01)
    if (pgErr.code === '42P01' || (pgErr.message ?? '').includes('does not exist')) return;
    console.error('Failed to record line item history:', error);
  }
}

export function useQuoteLineItems(quoteId: string | undefined) {
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);
  const revisedToastShown = useRef(false);
  const revisedEmailSent = useRef(false);

  const recalculateQuoteTotals = useCallback(async () => {
    if (!quoteId) return;
    try {
      const quoteRes = await supabase
        .from('quotes')
        .select('tax_rate, project_id, status')
        .eq('id', quoteId)
        .single();
      if (quoteRes.error) throw quoteRes.error;

      const taxRate = Number(quoteRes.data?.tax_rate) || 0;
      const projectId = quoteRes.data?.project_id;
      const currentStatus = quoteRes.data?.status as string;

      const [lineItemsRes, scopeItemsRes, changesRes] = await Promise.all([
        supabase.from('quote_line_items').select('cost, title, is_variation').eq('quote_id', quoteId),
        supabase.from('scope_items').select('cost, title, category').eq('project_id', projectId).eq('category', 'included'),
        supabase.from('change_requests').select('cost_impact, status').eq('project_id', projectId).eq('status', 'approved'),
      ]);
      const readError = lineItemsRes.error || scopeItemsRes.error || changesRes.error;
      if (readError) throw readError;
      const totals = calculateStoredQuoteTotals(
        scopeItemsRes.data, lineItemsRes.data, changesRes.data, taxRate
      );

      const needsRevision = currentStatus === 'sent' || currentStatus === 'approved';

      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          ...totals,
          ...(needsRevision ? { status: 'revised' } : {}),
        })
        .eq('id', quoteId);

      if (updateError) throw updateError;

      if (needsRevision && !revisedToastShown.current) {
        revisedToastShown.current = true;
        toast.info('Quote saved — notify the client to request their re-approval.');
        setTimeout(() => { revisedToastShown.current = false; }, 5000);
      }
    } catch (err) {
      console.error('Error recalculating quote totals:', err);
    }
  }, [quoteId]);

  const fetchLineItems = useCallback(async (showLoading = true) => {
    if (!quoteId) {
      setLineItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const mapped: QuoteLineItem[] = (data as DbQuoteLineItem[]).map(item => ({
        id: item.id,
        quoteId: item.quote_id,
        title: item.title,
        description: item.description || undefined,
        cost: item.cost || 0,
        sortOrder: item.sort_order,
        isVariation: item.is_variation ?? isVariationItem(item.title ?? ''),
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
      }));

      setLineItems(mapped);
    } catch (error) {
      console.error('Error fetching quote line items:', error);
      setError(error);
      toast.error('Failed to load quote line items');
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    fetchLineItems();
  }, [fetchLineItems]);

  useEffect(() => {
    if (!quoteId) return;
    const interval = setInterval(() => fetchLineItems(false), 10000);
    return () => clearInterval(interval);
  }, [quoteId, fetchLineItems]);

  useEffect(() => {
    if (!quoteId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchLineItems(false), 300);
    };

    const channel = supabase
      .channel(`quote-line-items-${quoteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_line_items', filter: `quote_id=eq.${quoteId}` }, debouncedRefetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [quoteId, fetchLineItems]);

  const addLineItem = async (itemData: {
    title: string;
    description?: string;
    cost: number;
    isVariation?: boolean;
  }) => {
    if (!quoteId) return null;

    try {
      const maxOrder = lineItems.reduce((max, item) => Math.max(max, item.sortOrder), -1);

      const insertPayload: Record<string, unknown> = {
        quote_id: quoteId,
        title: itemData.title,
        description: itemData.description,
        cost: itemData.cost,
        sort_order: maxOrder + 1,
        is_variation: itemData.isVariation ?? false,
      };

      let res = await supabase
        .from('quote_line_items')
        .insert(insertPayload as never)
        .select()
        .single();

      if (res.error?.code === 'PGRST204' || res.error?.message?.includes('is_variation')) {
        const { is_variation: _, ...withoutFlag } = insertPayload;
        res = await supabase
          .from('quote_line_items')
          .insert(withoutFlag as never)
          .select()
          .single();
      }

      if (res.error) throw res.error;

      const newItemId = res.data.id;

      await Promise.all([
        fetchLineItems(),
        recalculateQuoteTotals(),
        insertHistory([{
          line_item_id: newItemId,
          quote_id: quoteId,
          field_changed: 'added',
          old_value: null,
          new_value: `${itemData.title} — $${Number(itemData.cost).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
          changed_by: 'trade',
        }]),
      ]);

      return newItemId;
    } catch (error) {
      console.error('Error adding quote line item:', error);
      toast.error('Failed to add line item');
      return null;
    }
  };

  const updateLineItem = async (itemId: string, itemData: Partial<{
    title: string;
    description: string;
    cost: number;
    sortOrder: number;
    isVariation: boolean;
  }>) => {
    const oldItem = lineItems.find(i => i.id === itemId);

    try {
      const updateData: Record<string, unknown> = {};

      if (itemData.title !== undefined) updateData.title = itemData.title;
      if (itemData.description !== undefined) updateData.description = itemData.description;
      if (itemData.cost !== undefined) updateData.cost = itemData.cost;
      if (itemData.sortOrder !== undefined) updateData.sort_order = itemData.sortOrder;
      if (itemData.isVariation !== undefined) updateData.is_variation = itemData.isVariation;

      let res = await supabase
        .from('quote_line_items')
        .update(updateData as never)
        .eq('id', itemId);

      if (res.error?.code === 'PGRST204' || res.error?.message?.includes('is_variation')) {
        const { is_variation: _, ...withoutFlag } = updateData;
        res = await supabase
          .from('quote_line_items')
          .update(withoutFlag as never)
          .eq('id', itemId);
      }

      if (res.error) throw res.error;

      const historyRows: Array<{
        line_item_id: string;
        quote_id: string;
        field_changed: string;
        old_value: string | null;
        new_value: string | null;
        changed_by: string;
      }> = [];

      if (oldItem) {
        if (itemData.title !== undefined && itemData.title !== oldItem.title) {
          historyRows.push({
            line_item_id: itemId,
            quote_id: quoteId,
            field_changed: 'title',
            old_value: oldItem.title,
            new_value: itemData.title,
            changed_by: 'trade',
          });
        }
        if (itemData.cost !== undefined && itemData.cost !== oldItem.cost) {
          historyRows.push({
            line_item_id: itemId,
            quote_id: quoteId,
            field_changed: 'cost',
            old_value: String(oldItem.cost),
            new_value: String(itemData.cost),
            changed_by: 'trade',
          });
        }
        if (
          itemData.description !== undefined &&
          itemData.description !== (oldItem.description ?? '')
        ) {
          historyRows.push({
            line_item_id: itemId,
            quote_id: quoteId,
            field_changed: 'description',
            old_value: oldItem.description ?? null,
            new_value: itemData.description || null,
            changed_by: 'trade',
          });
        }
      }

      await Promise.all([
        fetchLineItems(),
        recalculateQuoteTotals(),
        insertHistory(historyRows),
      ]);

      return true;
    } catch (error) {
      console.error('Error updating quote line item:', error);
      toast.error('Failed to update line item');
      return false;
    }
  };

  const deleteLineItem = async (itemId: string) => {
    const oldItem = lineItems.find(i => i.id === itemId);

    try {
      const { error } = await supabase
        .from('quote_line_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      await Promise.all([
        fetchLineItems(),
        recalculateQuoteTotals(),
        insertHistory([{
          line_item_id: itemId,
          quote_id: quoteId!,
          field_changed: 'deleted',
          old_value: oldItem
            ? `${oldItem.title} — $${Number(oldItem.cost).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
            : null,
          new_value: null,
          changed_by: 'trade',
        }]),
      ]);

      return true;
    } catch (error) {
      console.error('Error deleting quote line item:', error);
      toast.error('Failed to delete line item');
      return false;
    }
  };

  return {
    lineItems,
    loading,
    error,
    refetch: fetchLineItems,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  };
}
