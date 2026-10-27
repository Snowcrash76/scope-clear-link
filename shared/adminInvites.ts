export function inviteErrorMessage(error: { code?: string; message?: string }): string {
  if (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code ?? '')) {
    return 'Invite codes need database setup. Run the invite-code setup SQL in Supabase, then retry.';
  }
  return error.message || 'Unable to load or save invite codes. Please try again.';
}
