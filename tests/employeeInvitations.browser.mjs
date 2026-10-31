import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { baselineAssets } from './baselineSources.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
await mkdir('generated-artifacts', { recursive: true });
const baseline = await baselineAssets();
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, loader: { '.sql': 'text' }, define: { 'process.env.NODE_ENV': '"development"' },
  outfile: 'generated-artifacts/employee-invitations.js', logLevel: 'error',
  plugins: [{ name: 'isolated-invitation-services', setup(b) {
    b.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => {
      const original = await readFile('tests/redesign.services.tsx', 'utf8');
      assert.ok(original.includes('signIn:async()=>({error:null})'));
      return {
        contents: original.replace('signIn:async()=>({error:null})', `signIn:async(email,password)=>{
          const w=window as any; (w.__invitationLogins??=[]).push({email,password});
          return {error:w.__invitationLoginError?new Error(w.__invitationLoginError):null}
        }`), loader: 'tsx', resolveDir: process.cwd(),
      };
    });
  } }, ...baseline.plugins],
});
await writeFile('generated-artifacts/employee-invitations.html', `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${baseline.css}"><link rel="stylesheet" href="/generated-artifacts/employee-invitations.css"><div id="root"></div><script type="module" src="/generated-artifacts/employee-invitations.js"></script>`);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
const token = 'a'.repeat(64), email = 'staff@example.invalid';
const member = { id: '60000000-0000-4000-8000-000000000001', name: 'Mae Installer', email, role: 'labourer', active: true, auth_user_id: null };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
try {
  for (const width of [375, 1280]) {
    for (const mode of ['new-signin-fails', 'existing', 'outage', 'expired', 'business-owner', 'login', 'revoked', 'team']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [], accepts = [];
      let accepted = false, sends = 0;
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (path.startsWith('/api/employee/invitations/') && req.method() === 'GET') {
          return mode === 'expired' ? respond({ error: 'Invitation is invalid or expired. Ask your employer to send a new invitation.' }, 403)
            : respond({ name: member.name, email, expires_at: new Date(Date.now() + 86400000).toISOString() });
        }
        if (path === '/api/employee/invitations/accept') {
          const body = req.postDataJSON(); accepts.push(body);
          if (mode === 'outage') return respond({ error: 'Employee account creation is temporarily unavailable.', code: 'ACCOUNT_SETUP_UNAVAILABLE' }, 503);
          if (mode === 'existing' && body.password) return respond({ error: 'This email already has an account.', code: 'ACCOUNT_EXISTS' }, 409);
          if (mode === 'business-owner') return respond({ error: 'This email already owns a business account with jobs or team members. Ask your employer to invite a different email.', code: 'BUSINESS_OWNER_ACCOUNT' }, 409);
          accepted = true; return respond({ success: true });
        }
        if (path === '/api/employee/session') return mode === 'revoked'
          ? respond({ error: 'Your employee access has changed. Use the latest invitation from your employer.' }, 403)
          : respond({ employee: accepted ? { ...member, auth_user_id: 'fixture-staff' } : null, canManageTeam: !accepted });
        if (path === '/api/employee/bootstrap') return respond({
          employee: member, hourly_rate: 40, permissions: {}, timezone: 'Australia/Sydney', today,
          jobs: [], assignments: [], entries: [], submissions: [], documents: [], notes: [], notifications: [],
        });
        if (path === '/api/team/bootstrap') return respond({
          employees: [member], jobs: [], appointments: [], assignments: [], entries: [], submissions: [],
          settings: {}, notes: [], documents: [], audit: [], timezone: 'Australia/Sydney',
          invitations: sends ? [{ employee_id: member.id, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(), accepted_at: null }] : [],
        });
        if (/\/api\/team\/employees\/[^/]+\/invite/.test(path)) {
          sends++;
          return respond({ error: 'Email delivery could not be confirmed. Copy the prepared link.', code: 'INVITATION_EMAIL_UNCONFIRMED',
            details: { invitation_url: `https://example.invalid/employee/accept?token=${token}`, delivery: 'unknown' } }, 502);
        }
        return respond([]);
      });
      if (mode === 'new-signin-fails') await page.addInitScript(() => { window.__invitationLoginError = 'Synthetic sign-in unavailable'; });
      const path = mode === 'revoked' ? '/employee' : mode === 'login' ? `/employee/login?email=${encodeURIComponent(email)}` : mode === 'team' ? '/team' : `/employee/accept?token=${token}`;
      await page.goto(`${base}/generated-artifacts/employee-invitations.html?view=${encodeURIComponent(path)}`);
      if (mode === 'login') {
        await page.getByRole('heading', { name: 'Welcome to site.' }).waitFor();
        assert.equal(await page.locator('#emp-email').inputValue(), email);
        await page.getByText(/Currently signed in as/).waitFor();
        await page.getByRole('link', { name: 'Forgot your password?' }).waitFor();
      } else if (mode === 'revoked') {
        await page.getByRole('heading', { name: 'Employee access unavailable' }).waitFor();
        assert.equal(await page.getByText('supabase/migrations/20261029000000_employee_portal.sql').count(), 0);
        await page.getByRole('link', { name: 'Sign in with another account' }).waitFor();
      } else if (mode === 'team') {
        await page.getByText('Not invited', { exact: true }).waitFor();
        page.once('dialog', async dialog => {
          assert.ok(/older|old|previous/i.test(dialog.message()));
          await dialog.accept();
        });
        await page.getByRole('button', { name: 'Actions for Mae Installer' }).click();
        await page.getByRole('menuitem', { name: 'Invite', exact: true }).click();
        await page.getByRole('heading', { name: 'Email delivery needs attention' }).waitFor();
        assert.equal(sends, 1);
        const link = page.getByRole('textbox', { name: /Prepared invitation link for.*staff@example.invalid/ });
        assert.ok((await link.inputValue()).includes(token));
        await page.getByRole('button', { name: 'Copy link', exact: true }).waitFor();
        await page.getByText('Invited', { exact: true }).waitFor();
      } else if (mode === 'expired') {
        await page.getByText('Invitation is invalid or expired. Ask your employer to send a new invitation.').waitFor();
        assert.equal(await page.locator('input[type=password]').count(), 0);
        await page.getByRole('link', { name: 'Already accepted an invitation? Sign in' }).waitFor();
      } else {
        await page.getByRole('heading', { name: 'Set up your employee access' }).waitFor();
        if (mode === 'business-owner') await page.getByRole('button', { name: 'I already have an account', exact: true }).click();
        await page.locator('input[type=password]').fill('synthetic-password-only');
        await page.getByRole('button', { name: mode === 'business-owner' ? 'Sign in and accept' : 'Accept invitation', exact: true }).click();
        if (mode === 'new-signin-fails') {
          await page.getByRole('heading', { name: 'Invitation accepted', exact: true }).waitFor();
          await page.getByRole('link', { name: 'Sign in to employee portal' }).waitFor();
          assert.equal(await page.locator('#new-pass').count(), 0);
          assert.equal(accepts.length, 1);
        } else if (mode === 'outage') {
          await page.getByRole('alert').filter({ hasText: 'Employee account creation is temporarily unavailable.' }).waitFor();
          assert.equal(await page.locator('#new-pass').count(), 1);
          assert.equal(await page.locator('#existing-pass').count(), 0);
        } else if (mode === 'business-owner') {
          await page.getByRole('alert').filter({ hasText: 'This email already owns a business account' }).waitFor();
          assert.deepEqual(accepts, [{ token }]);
        } else {
          await page.locator('#existing-pass').waitFor();
          assert.equal(await page.locator('#existing-pass').inputValue(), '');
          await page.getByRole('link', { name: 'Forgot your password?' }).waitFor();
          await page.locator('#existing-pass').fill('existing-synthetic-password');
          await page.getByRole('button', { name: 'Sign in and accept', exact: true }).click();
          await page.getByRole('heading', { name: 'Today', exact: true }).waitFor();
          assert.equal(accepts.length, 2);
          assert.deepEqual(accepts[1], { token });
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${mode} overflows at ${width}`);
      assert.deepEqual(errors, []);
      if (mode === 'team') await page.screenshot({ path: `generated-artifacts/invitation-delivery-${width}.png`, fullPage: true });
      await page.close();
    }
  }
  console.log('Invitation UI: new/existing accounts, outages, consumed/expired links, owner-account conflicts, signed-in account switching and delivery fallback passed at 375/1280.');
} finally { await browser.close(); }
