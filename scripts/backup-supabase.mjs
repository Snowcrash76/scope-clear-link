// One-off, read-only backup. Never logs credentials or writes plaintext backups
// inside the workspace (Vite can serve workspace files during development).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, mkdtempSync, chmodSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, pbkdf2Sync, createCipheriv, createHash, webcrypto } from 'node:crypto';

const PROJECT = 'aswmcyldowvpugmfmykf';
const ITERATIONS = 600000;
process.umask(0o077);
let temporary;
function run(binary, args, env) {
  return execFileSync(binary, args, { env, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
function html(payload, manifest) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; connect-src 'none'">
<title>ScopeClear — encrypted database backup</title>
<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f6f8f6;color:#183326;font:16px/1.6 system-ui,sans-serif}
main{max-width:720px;margin:32px auto;padding:28px;background:white;border:1px solid #dce4dd;border-radius:16px}
h1{font-size:28px;line-height:1.2}p{overflow-wrap:anywhere}.muted{color:#58675d}label{display:block;font-weight:650;margin-top:22px}
input,button{font:inherit;width:100%;padding:13px;border-radius:8px;border:1px solid #b9c9bd;margin-top:8px}button{background:#315640;color:white;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}code{overflow-wrap:anywhere;font-size:12px}#status{min-height:26px}</style></head>
<body><main><p class="muted">ScopeClear · recovery copy</p><h1>Encrypted database backup</h1>
<p>Created ${manifest.createdAt} (UTC).</p>
<p>This file contains an encrypted PostgreSQL archive of the <b>public, auth and storage</b> schemas: application data, user records, database definitions, permissions and file metadata.</p>
<p class="muted">Receipt/photo file contents, database-role passwords and Supabase project settings are not included. Keep the existing file storage. Restore into a compatible Supabase environment with its platform roles and extensions.</p>
<p><b>Save this HTML file and keep it private.</b> Its encryption password is the new Supabase database password used when this backup was created. Keep that password in your password manager, even if you later change the database password.</p>
<p>This page works offline in a browser supporting Web Crypto. Your password is used only on your device; it is never sent anywhere.</p>
<label for="password">Backup password</label><input id="password" type="password" autocomplete="off">
<button id="decrypt" type="button">Decrypt and download database archive</button><p id="status" role="status"></p>
<p class="muted">The downloaded .dump file is unencrypted and may contain private customer and account data. Keep it private. This page does not restore or change a database.</p>
<p class="muted">Archive size: ${manifest.archiveBytes.toLocaleString()} bytes. Readability and encryption checks passed; a full restore has not been tested.</p>
<details><summary>Verification details</summary><p>Archive SHA-256:<br><code>${manifest.archiveSha256}</code></p>
<p>Encryption: AES-256-GCM; PBKDF2-HMAC-SHA-256, ${ITERATIONS.toLocaleString()} iterations; random salt and nonce.</p></details>
</main><script>
const encoded='${payload}';
document.getElementById('decrypt').addEventListener('click',async()=>{
 const button=document.getElementById('decrypt'),status=document.getElementById('status'),password=document.getElementById('password');
 if(!password.value){status.textContent='Enter the password used when this backup was created.';return;}
 button.disabled=true;status.textContent='Decrypting locally…';
 try {
  if(!globalThis.crypto?.subtle)throw new Error('crypto');
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password.value),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes.slice(8,24),iterations:${ITERATIONS},hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(24,36),tagLength:128},key,bytes.slice(36));
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',clear)),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!=='${manifest.archiveSha256}')throw new Error('integrity');
  const url=URL.createObjectURL(new Blob([clear],{type:'application/octet-stream'}));
  const link=document.createElement('a');link.href=url;link.download='${manifest.archiveName}';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);password.value='';status.textContent='Verified archive downloaded. Keep the unencrypted file private.';
 } catch {status.textContent='Unable to decrypt. Check the password and use a modern browser with Web Crypto support.';}
 finally {button.disabled=false;}
});
</script></body></html>`;
}

try {
  // Parse the saved URI template without requiring the password to be edited
  // into a URL. The actual password is supplied separately and never printed.
  const template = (process.env.SUPABASE_BACKUP_DATABASE_URL || '').trim().replace(/\[(YOUR-PASSWORD|YOUR_PASSWORD)\]/gi, 'placeholder');
  const url = new URL(template);
  const user = decodeURIComponent(url.username);
  const password = process.env.SUPABASE_BACKUP_DATABASE_PASSWORD;
  const hostMatches = url.hostname === `db.${PROJECT}.supabase.co` ||
    url.hostname.endsWith('.pooler.supabase.com') && user === `postgres.${PROJECT}`;
  if (!hostMatches || !['postgres:', 'postgresql:'].includes(url.protocol) || !password || url.port === '6543') throw new Error('INVALID_TARGET');
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: user,
    PGPASSWORD: password, PGDATABASE: url.pathname.slice(1) || 'postgres', PGSSLMODE: 'require',
    PGCONNECT_TIMEOUT: '15', PGAPPNAME: 'scope-clear-read-only-backup' };
  const install = readdirSync('/nix/store').find(name => /-postgresql-17\./.test(name) && existsSync(`/nix/store/${name}/bin/pg_dump`));
  if (!install) throw new Error('POSTGRES_17_TOOLS_REQUIRED');
  const bin = `/nix/store/${install}/bin`;
  const summary = JSON.parse(run(`${bin}/psql`, ['-XqAt', '--no-password', '-c', `BEGIN READ ONLY;
    SELECT json_build_object('transaction_read_only',current_setting('transaction_read_only'),
      'server_version',current_setting('server_version_num'),
      'public_tables',(SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'),
      'available_cron',(SELECT count(*)>0 FROM pg_available_extensions WHERE name='pg_cron'),
      'employee_setup_present',to_regclass('public.employee_week_submissions') IS NOT NULL);
    COMMIT;`], env));
  if (summary.transaction_read_only !== 'on') throw new Error('READ_ONLY_CHECK_FAILED');
  if (Number(summary.server_version) >= 180000) throw new Error('POSTGRES_18_TOOLS_REQUIRED');
  temporary = mkdtempSync(join(tmpdir(), 'scopeclear-private-backup-'));
  chmodSync(temporary, 0o700);
  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[:.]/g, '-');
  const archiveName = `scopeclear-pre-employee-${stamp}.dump`;
  const archive = join(temporary, archiveName);
  // pg_dump explicitly opens its export transaction READ ONLY. No --create,
  // restore, schema change, role change or application mutation is executed.
  run(`${bin}/pg_dump`, ['--no-password', '--format=custom', '--no-owner', '--lock-wait-timeout=5000',
    '--schema=public', '--schema=auth', '--schema=storage', '--file', archive], env);
  chmodSync(archive, 0o600);
  const toc = run(`${bin}/pg_restore`, ['--list', archive], env);
  for (const table of ['projects', 'quotes', 'invoices', 'profiles']) {
    if (!toc.includes(`TABLE DATA public ${table} `)) throw new Error('CORE_TABLE_MISSING');
  }
  // Parse and decompress the entire archive without connecting to a database.
  run(`${bin}/pg_restore`, ['--file=/dev/null', archive], env);
  const clear = readFileSync(archive);
  const archiveSha256 = createHash('sha256').update(clear).digest('hex');
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([Buffer.from('SCBKUP01'), salt, iv, cipher.update(clear), cipher.final(), cipher.getAuthTag()]);
  // Independently verify using the browser-compatible Web Crypto operations.
  const material = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const browserKey = await webcrypto.subtle.deriveKey({name:'PBKDF2',salt:encrypted.subarray(8,24),iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const roundTrip = await webcrypto.subtle.decrypt({name:'AES-GCM',iv:encrypted.subarray(24,36),tagLength:128},browserKey,encrypted.subarray(36));
  if (createHash('sha256').update(Buffer.from(roundTrip)).digest('hex') !== archiveSha256) throw new Error('ENCRYPTION_CHECK_FAILED');
  key.fill(0);
  const manifest = { createdAt, project: PROJECT, schemas: ['public','auth','storage'], archiveName,
    archiveBytes: clear.length, archiveSha256, encryptedSha256: createHash('sha256').update(encrypted).digest('hex'),
    archiveReadable: true, encryptionVerified: true, restoreTested: false, summary };
  const output = 'generated-artifacts/backups';
  mkdirSync(output, {recursive:true});
  const filePath = `${output}/scopeclear-encrypted-backup-${stamp}.html`;
  writeFileSync(filePath, html(encrypted.toString('base64'), manifest), {mode:0o600});
  writeFileSync(`${output}/latest-backup-manifest.json`, JSON.stringify({...manifest,filePath},null,2), {mode:0o600});
  clear.fill(0);
  console.log(JSON.stringify({ ...manifest, filePath }));
} catch (error) {
  // PostgreSQL error objects can contain connection details or SQL context.
  // Return only fixed identifiers, never raw errors, commands or credentials.
  const fixed = ['INVALID_TARGET','POSTGRES_17_TOOLS_REQUIRED','POSTGRES_18_TOOLS_REQUIRED','READ_ONLY_CHECK_FAILED','CORE_TABLE_MISSING','ENCRYPTION_CHECK_FAILED'];
  const raw = `${error?.message || ''} ${error?.stderr || ''}`.toLowerCase();
  const reason = fixed.includes(error?.message) ? error.message :
    raw.includes('password authentication failed') ? 'AUTHENTICATION_REJECTED' :
    raw.includes('permission denied') ? 'BACKUP_PERMISSION_DENIED' :
    raw.includes('timeout') ? 'BACKUP_TIMEOUT' : 'BACKUP_FAILED';
  console.error(JSON.stringify({error:reason,databaseChanged:false}));
  process.exitCode=1;
} finally {
  if (temporary) rmSync(temporary,{recursive:true,force:true});
}
