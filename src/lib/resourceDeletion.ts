import { supabase } from '@/integrations/supabase/client';

export type DeletionTarget =
  | { kind: 'client'; clientKey: string }
  | { kind: 'quote' | 'invoice'; id: string };

export async function deleteResource(target: DeletionTarget) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in before deleting.');
  const response = await fetch('/api/owner/delete-resource', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ ...target, confirmation: 'DELETE' }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Deletion could not be confirmed. Refresh before retrying.');
  if (result?.deleted !== true || !(result.recordsDeleted > 0)) throw new Error('Deletion was not confirmed. Refresh before retrying.');
  return result as { deleted: true; recordsDeleted: number; filesPending: boolean };
}
