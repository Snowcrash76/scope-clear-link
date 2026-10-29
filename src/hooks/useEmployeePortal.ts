import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { PortalSession } from '../../shared/employeePortal';

export async function portalRequest<T = unknown>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`/api${path}`, {
    method: body === undefined && method === 'POST' ? 'GET' : method,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({ error: 'Unable to contact the portal. Please retry.' }));
  if (!response.ok) throw new Error(data.error || 'Unable to complete this request');
  return data as T;
}
export function usePortal<T>(path: string, enabled = true) {
  const { user } = useAuth();
  // Never reuse the previous owner's private rates/role data after switching
  // accounts in the same browser, even briefly while a request refreshes.
  return useQuery<T, Error>({ queryKey: ['employee-portal', user?.id ?? 'anonymous', path], queryFn: () => portalRequest<T>(path), enabled, staleTime: 0, refetchInterval: 60000 });
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
