import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inviteErrorMessage } from '../shared/adminInvites';

test('missing invite table or columns returns actionable setup error', () => {
  for (const code of ['42P01', 'PGRST205', '42703', 'PGRST204']) {
    assert.match(inviteErrorMessage({ code }), /Invite codes need database setup/);
  }
  assert.equal(inviteErrorMessage({ message: 'Permission denied' }), 'Permission denied');
});

test('invite setup restricts access to backend service role and reloads schema', () => {
  const sql = readFileSync('supabase/migrations/20260503_invite_codes.sql', 'utf8');
  assert.match(sql, /create table if not exists public.invite_codes/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /to service_role/);
  assert.match(sql, /drop policy if exists/);
  assert.match(sql, /notify pgrst/);
});
