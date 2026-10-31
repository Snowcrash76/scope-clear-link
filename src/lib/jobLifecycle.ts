import type { SupabaseClient } from '@supabase/supabase-js';

/** Completion archives a job without changing any associated financial records. */
export function isArchivedJob(project: { status: string }): boolean {
  return project.status === 'completed';
}

export function filterJobArchive<T extends { status: string }>(projects: T[], archived: boolean): T[] {
  return projects.filter(project => isArchivedJob(project) === archived);
}

/**
 * One database statement: FK cascades and retention triggers either all succeed
 * or all roll back. Never manually delete children before deleting the parent.
 */
export async function deleteJobRecord(client: SupabaseClient, ownerId: string, jobId: string): Promise<void> {
  if (!ownerId || !jobId) throw new Error('Sign in before deleting a job.');
  const { data, error } = await client.from('projects').delete()
    .eq('id', jobId).eq('user_id', ownerId).select('id');
  if (error) {
    if (error.code === '23503' || /retained for financial history|issued and cancelled invoices|staff assignments before changing/i.test(error.message)) {
      throw new Error('This job has protected invoice or staff history and cannot be deleted. Mark it as completed to move it to the archive instead.');
    }
    throw new Error('The job deletion could not be confirmed. Refresh the jobs list before trying again.');
  }
  if (!data || data.length !== 1) {
    throw new Error('This job was not found or you no longer have permission to delete it.');
  }
}
