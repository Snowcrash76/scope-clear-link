import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RECEIPT_BUCKET, MAX_RECEIPT_BYTES, RECEIPT_TYPES } from '../../shared/jobCosting';
import type { JobCostInput, JobCostList, JobProfitability } from '../../shared/jobCosting';
import type { ReceiptDuplicate, ReceiptScanResult } from '../../shared/receiptScanning';
import type { PreparedReceipt } from '@/lib/receiptImages';
export * from '../../shared/jobCosting';
export * from '../../shared/receiptScanning';
export { prepareReceiptForScan, validateReceiptFile } from '@/lib/receiptImages';

async function costApi<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  if (!body) throw new Error('The cost service returned an invalid response.');
  return body as T;
}

export function useJobCosts(jobId?: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['job-costs', user?.id, jobId],
    queryFn: () => costApi<JobCostList>(`/api/job-costs?jobId=${jobId}`),
    enabled: !!jobId && !!user,
  });
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['job-costs', user?.id, jobId] }),
      client.invalidateQueries({ queryKey: ['job-profitability', user?.id] }),
    ]);
  };
  const save = useMutation({
    mutationFn: ({ id, cost }: { id?: string; cost: JobCostInput }) =>
      costApi(id ? `/api/job-costs/${id}` : '/api/job-costs', {
        method: id ? 'PUT' : 'POST', body: JSON.stringify(cost),
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => costApi(`/api/job-costs/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  return {
    costs: query.data?.costs ?? [],
    quoteLineItems: query.data?.quoteLineItems ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    saveCost: (cost: JobCostInput, id?: string) => save.mutateAsync({ id, cost }),
    deleteCost: remove.mutateAsync,
    saving: save.isPending,
    deleting: remove.isPending,
  };
}

export function useJobProfitability(jobId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['job-profitability', user?.id, jobId ?? 'all'],
    queryFn: () => costApi<JobProfitability[]>(`/api/job-profitability${jobId ? `?jobId=${jobId}` : ''}`),
    enabled: !!user,
  });
}

export async function uploadCostReceipt(jobId: string, file: File): Promise<string> {
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) throw new Error('Use a JPEG, PNG, WebP image or PDF.');
  if (file.size === 0 || file.size > MAX_RECEIPT_BYTES) throw new Error('Choose a receipt smaller than 10 MB.');
  const { path, token } = await costApi<{ path: string; token: string }>('/api/job-costs/receipt-upload', {
    method: 'POST', body: JSON.stringify({ job_id: jobId, content_type: file.type, size: file.size }),
  });
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (error) throw new Error('Receipt upload failed. Please try again.');
  return path;
}

export async function getCostReceiptUrl(costId: string): Promise<string> {
  const { url } = await costApi<{ url: string }>(`/api/job-costs/${costId}/receipt`);
  return url;
}

export function extractCostReceipt(jobId: string, receiptPath: string, prepared: PreparedReceipt): Promise<ReceiptScanResult> {
  return costApi('/api/receipts/extract', {
    method: 'POST',
    body: JSON.stringify({ job_id: jobId, receipt_path: receiptPath, ...prepared }),
    signal: AbortSignal.timeout(100000),
  });
}

export async function findCostDuplicates(input: {
  job_id: string; supplier: string; cost_date: string; amount_inc_gst: number; exclude_cost_id?: string;
}): Promise<ReceiptDuplicate[]> {
  const { duplicates } = await costApi<{ duplicates: ReceiptDuplicate[] }>('/api/job-costs/duplicates', {
    method: 'POST', body: JSON.stringify(input),
  });
  return duplicates;
}
