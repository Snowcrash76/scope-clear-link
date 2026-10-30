import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardInvoice {
  id: string;
  project_id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  total: number | null;
  due_date: string | null;
  updated_at: string;
}

export function useDashboardInvoices(projectIds: string[]) {
  return useQuery<DashboardInvoice[]>({
    queryKey: ['dashboard-invoices', projectIds],
    enabled: projectIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      if (!projectIds.length) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, project_id, invoice_number, status, total, due_date, updated_at')
        .in('project_id', projectIds);
      if (error) throw error;
      return (data ?? []).map(invoice => ({ ...invoice, status: invoice.status as DashboardInvoice['status'] }));
    },
  });
}
