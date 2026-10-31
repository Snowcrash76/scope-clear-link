import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { PortalSession } from '../../shared/employeePortal';
import { assistanceMemberFromPath } from '@/lib/employeeAssistance';
import { useEmployeeAssistance } from './useEmployeeAssistance';

export async function portalRequest<T = unknown>(
  path: string, body?: unknown, method = 'POST',
  options: { assistanceId?: string | null; expectedUserId?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const assistanceId = options.assistanceId === undefined
    ? (typeof window === 'undefined' ? null : assistanceMemberFromPath(window.location.pathname))
    : options.assistanceId;
  const requestMethod = body === undefined && method === 'POST' ? 'GET' : method;
  if (assistanceId && requestMethod !== 'GET') throw new Error('Employee portal preview is read-only. Use Help edit to make changes as yourself.');
  const { data: { session } } = await supabase.auth.getSession();
  if (assistanceId && (!session?.access_token ||
    (options.expectedUserId && session.user?.id !== options.expectedUserId))) {
    throw new Error('Your account changed or your session expired. Reopen the preview from Team.');
  }
  const response = await fetch(`/api${path}`, {
    method: requestMethod,
    signal: options.signal,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(assistanceId ? { 'X-Employee-Preview': assistanceId } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({ error: 'Unable to contact the portal. Please retry.' }));
  if (!response.ok) throw new Error(data.error || 'Unable to complete this request');
  return data as T;
}
export function usePortal<T>(path: string, enabled = true) {
  const { user } = useAuth();
  const { memberId } = useEmployeeAssistance();
  // Never reuse the previous owner's private rates/role data after switching
  // accounts in the same browser, even briefly while a request refreshes.
  const query = useQuery<T, Error>({
    queryKey: ['employee-portal', user?.id ?? 'anonymous', memberId ?? 'self', path],
    queryFn: ({ signal }) => portalRequest<T>(path, undefined, 'GET', {
      assistanceId: memberId, expectedUserId: memberId ? user?.id : undefined, signal,
    }),
    enabled, staleTime: 0, gcTime: memberId ? 0 : 5 * 60 * 1000, refetchInterval: 60000,
    // The gate owns this fresh session read. Layout/banner observers must not
    // trigger a stale-on-mount refetch that unmounts and remounts themselves.
    refetchOnMount: memberId && path === '/employee/session' ? false : true,
  });
  // A preview must not flash a previously cached employee's revoked assignments
  // or permissions while the fresh authorisation/data request is still pending.
  return memberId && (query.isFetching || query.isError)
    ? { ...query, data: undefined, isLoading: query.isFetching }
    : query;
}
export function usePortalSession(enabled = true) { return usePortal<PortalSession>('/employee/session', enabled); }
export function useRefreshPortal() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['employee-portal'] });
}
export async function uploadEmployeePhoto(jobId: string, file: File, caption: string, stage: string) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP photo under 10 MB.');
  const result = await portalRequest<{ path: string; token: string }>('/employee/photos/upload', { job_id: jobId, file_name: file.name, file_type: file.type, file_size: file.size });
  const { error } = await supabase.storage.from('employee-photos').uploadToSignedUrl(result.path, result.token, file, { contentType: file.type });
  if (error) throw new Error('The photo could not upload. Please retry.');
  return portalRequest('/employee/photos', { job_id: jobId, path: result.path, caption, stage });
}
