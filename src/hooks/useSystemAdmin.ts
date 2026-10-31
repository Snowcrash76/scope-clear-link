import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export async function platformFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to use system administration.');
  const response = await fetch(`/api/platform${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...options?.headers, Authorization: `Bearer ${session.access_token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'System administration request failed.');
  return body;
}
export function useSystemAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['system-admin-session', user?.id], enabled: !!user,
    queryFn: () => platformFetch<{ admin: boolean }>('/session'),
    retry: false, staleTime: 30_000,
  });
}
