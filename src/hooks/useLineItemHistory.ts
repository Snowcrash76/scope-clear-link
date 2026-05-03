import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LineItemHistoryEntry {
  id: string;
  lineItemId: string;
  quoteId: string;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  changeReason: string | null;
  changedBy: string;
  createdAt: Date;
}

function mapHistory(data: Array<Record<string, unknown>>): LineItemHistoryEntry[] {
  return data.map(h => ({
    id: h.id as string,
    lineItemId: h.line_item_id as string,
    quoteId: h.quote_id as string,
    fieldChanged: h.field_changed as string,
    oldValue: h.old_value as string | null,
    newValue: h.new_value as string | null,
    changeReason: h.change_reason as string | null,
    changedBy: h.changed_by as string,
    createdAt: new Date(h.created_at as string),
  }));
}

export function useLineItemHistory(quoteId: string | undefined, quoteToken?: string) {
  const [history, setHistory] = useState<LineItemHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!quoteId) {
      setHistory([]);
      return;
    }
    setLoading(true);
    try {
      const headers: Record<string, string> = {};

      if (quoteToken) {
        const res = await fetch(
          `/api/quotes/${quoteId}/line-item-history?token=${encodeURIComponent(quoteToken)}`,
          { headers }
        );
        if (!res.ok) return;
        setHistory(mapHistory(await res.json()));
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/quotes/${quoteId}/line-item-history`, { headers });
      if (!res.ok) return;
      setHistory(mapHistory(await res.json()));
    } catch (err) {
      console.error('Failed to load line item history:', err);
    } finally {
      setLoading(false);
    }
  }, [quoteId, quoteToken]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, refetch: fetchHistory };
}

export function formatHistoryEntry(entry: LineItemHistoryEntry): string {
  const fmt = (v: string | null) =>
    parseFloat(v ?? '').toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  switch (entry.fieldChanged) {
    case 'added':
      return entry.newValue ? `Added: ${entry.newValue}` : 'Item added';
    case 'deleted':
      return entry.oldValue ? `Removed: ${entry.oldValue}` : 'Item removed';
    case 'title':
      return `Title changed: "${entry.oldValue}" → "${entry.newValue}"`;
    case 'cost':
      return `Cost changed: $${fmt(entry.oldValue)} → $${fmt(entry.newValue)}`;
    case 'description':
      return 'Description updated';
    default:
      return `${entry.fieldChanged} changed`;
  }
}
