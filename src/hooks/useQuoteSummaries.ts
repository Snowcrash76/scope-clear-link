import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { QuoteSummary } from '@/lib/quoteDisplay';

export function useQuoteSummaries(projectIds: string[]) {
  const { user } = useAuth();
  const idsKey = [...projectIds].sort().join(',');
  return useQuery<QuoteSummary[]>({
    queryKey: ['quote-summaries', user?.id, idsKey],
    enabled: !!user?.id && projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('quotes')
        .select('id, project_id, quote_number, status, subtotal, total, tax_amount, created_at, updated_at, approved_at, declined_at, valid_until')
        .in('project_id', idsKey.split(','));
      if (error) throw error;
      return (data ?? []) as QuoteSummary[];
    },
    staleTime: 30_000,
  });
}
