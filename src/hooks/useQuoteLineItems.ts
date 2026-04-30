import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isVariationItem } from '@/lib/utils';

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

export function useQuoteLineItems(quoteId: string | undefined) {
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // After every mutation, re-read all cost sources and write the correct
  // subtotal / tax_amount / total back to the quotes row.
  // Mirrors the QuoteSection formula: scope items (included, non-variation,
  // not already captured as an approved change) + approved change requests +
  // custom quote line items (non-variation, not already captured as a change).
  const recalculateQuoteTotals = useCallback(async () => {
    if (!quoteId) return;
    try {
      const quoteRes = await supabase
        .from('quotes')
        .select('tax_rate, project_id')
        .eq('id', quoteId)
        .single();
      if (quoteRes.error) throw quoteRes.error;

      const taxRate = Number(quoteRes.data?.tax_rate) || 0;
      const projectId = quoteRes.data?.project_id;

      const [lineItemsRes, scopeItemsRes, changesRes] = await Promise.all([
        supabase.from('quote_line_items').select('cost, title, is_variation').eq('quote_id', quoteId),
        supabase.from('scope_items').select('cost, title').eq('project_id', projectId).eq('category', 'included'),
        supabase.from('change_requests').select('cost_impact').eq('project_id', projectId).eq('status', 'approved'),
      ]);

      const approvedChangeCosts = new Set(
        (changesRes.data || []).map(cr => Number(cr.cost_impact) || 0)
      );
      const changesImpact = (changesRes.data || []).reduce(
        (sum, cr) => sum + (Number(cr.cost_impact) || 0), 0
      );
      const scopeSubtotal = (scopeItemsRes.data || [])
        .filter(item => !isVariationItem(item.title ?? '') && !approvedChangeCosts.has(Number(item.cost) || 0))
        .reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
      // Use is_variation column; fall back to title heuristic for rows not yet migrated
      const customItemsTotal = (lineItemsRes.data || [])
        .filter(item => {
          const flagged = (item as { is_variation?: boolean }).is_variation;
          const isVar = flagged !== undefined ? flagged : isVariationItem(item.title ?? '');
          return !isVar && !approvedChangeCosts.has(Number(item.cost) || 0);
        })
        .reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

      const subtotal = scopeSubtotal + changesImpact + customItemsTotal;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      const { error: updateError } = await supabase
        .from('quotes')
        .update({ subtotal, tax_amount: taxAmount, total })
        .eq('id', quoteId);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error recalculating quote totals:', err);
    }
  }, [quoteId]);

  const fetchLineItems = useCallback(async () => {
    if (!quoteId) {
      setLineItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

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
      toast.error('Failed to load quote line items');
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    fetchLineItems();
  }, [fetchLineItems]);

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

      // If column not yet migrated, retry without is_variation
      if (res.error?.code === 'PGRST204' || res.error?.message?.includes('is_variation')) {
        const { is_variation: _, ...withoutFlag } = insertPayload;
        res = await supabase
          .from('quote_line_items')
          .insert(withoutFlag as never)
          .select()
          .single();
      }

      if (res.error) throw res.error;

      await Promise.all([fetchLineItems(), recalculateQuoteTotals()]);
      return res.data.id;
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

      // If column not yet migrated, retry without is_variation
      if (res.error?.code === 'PGRST204' || res.error?.message?.includes('is_variation')) {
        const { is_variation: _, ...withoutFlag } = updateData;
        res = await supabase
          .from('quote_line_items')
          .update(withoutFlag as never)
          .eq('id', itemId);
      }

      if (res.error) throw res.error;

      await Promise.all([fetchLineItems(), recalculateQuoteTotals()]);
      return true;
    } catch (error) {
      console.error('Error updating quote line item:', error);
      toast.error('Failed to update line item');
      return false;
    }
  };

  const deleteLineItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('quote_line_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      await Promise.all([fetchLineItems(), recalculateQuoteTotals()]);
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
    refetch: fetchLineItems,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  };
}
