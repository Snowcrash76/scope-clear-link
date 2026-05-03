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

export interface QuoteActivityChangeRequest {
  id: string;
  title: string;
  status: string;
  costImpact: number | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface QuoteActivitySummary {
  id: string;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  declinedAt: Date | null;
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

function mapChangeRequests(data: Array<Record<string, unknown>>): QuoteActivityChangeRequest[] {
  return data.map(cr => ({
    id: cr.id as string,
    title: cr.title as string,
    status: cr.status as string,
    costImpact: cr.cost_impact as number | null,
    createdAt: new Date(cr.created_at as string),
    resolvedAt: cr.resolved_at ? new Date(cr.resolved_at as string) : null,
  }));
}

export function useLineItemHistory(quoteId: string | undefined, quoteToken?: string) {
  const [history, setHistory] = useState<LineItemHistoryEntry[]>([]);
  const [changeRequests, setChangeRequests] = useState<QuoteActivityChangeRequest[]>([]);
  const [quote, setQuote] = useState<QuoteActivitySummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!quoteId) {
      setHistory([]);
      setChangeRequests([]);
      setQuote(null);
      return;
    }
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      let url = `/api/quotes/${quoteId}/line-item-history`;

      if (quoteToken) {
        url += `?token=${encodeURIComponent(quoteToken)}`;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch(url, { headers });
      if (!res.ok) return;

      const json = await res.json();

      // Support both old array format (fallback) and new unified object format
      if (Array.isArray(json)) {
        setHistory(mapHistory(json));
        setChangeRequests([]);
        setQuote(null);
      } else {
        setHistory(mapHistory(json.history || []));
        setChangeRequests(mapChangeRequests(json.changeRequests || []));
        const q = json.quote as Record<string, unknown> | null;
        setQuote(q ? {
          id: q.id as string,
          status: q.status as string,
          createdAt: new Date(q.createdAt as string),
          approvedAt: q.approvedAt ? new Date(q.approvedAt as string) : null,
          declinedAt: q.declinedAt ? new Date(q.declinedAt as string) : null,
        } : null);
      }
    } catch (err) {
      console.error('Failed to load line item history:', err);
    } finally {
      setLoading(false);
    }
  }, [quoteId, quoteToken]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, changeRequests, quote, loading, refetch: fetchHistory };
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
