// Run the existing unit and isolated-browser suites without real customer data.
import { spawn } from 'node:child_process';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const modulePath = process.env.PLAYWRIGHT_MODULE || '/mnt/pid2/node_modules/playwright';
const browserPath = process.env.CHROMIUM_EXECUTABLE_PATH;
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const results = [];
async function run(command, args, env = {}) {
  return await new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', e => { console.error(e.message); resolve(1); });
    child.on('exit', code => resolve(code ?? 1));
  });
}
const unit = await run('bun', ['test', '--preload', './tests/setup.ts']);
results.push({ suite: 'unit', code: unit });
const available = (await readdir('tests')).filter(f => f.endsWith('.browser.mjs')).sort();
const selected = process.env.UI_SUITES?.split(',').filter(Boolean);
if (selected?.some(file => !available.includes(file))) throw new Error('Unknown UI suite requested');
const files = selected ? available.filter(file => selected.includes(file)) : available;
// Vite broadcasts fixture file changes to connected pages. Run suites serially
// so rebuilding a later fixture cannot interrupt an earlier suite's browser.
for (let i = 0; i < files.length; i += 1) {
  await Promise.all(files.slice(i, i + 1).map(async file => {
    const content = await readFile(`tests/${file}`, 'utf8');
    const dynamic = /await import\(process\.env\.PLAYWRIGHT_MODULE/.test(content);
    const playwright = dynamic ? require.resolve(modulePath).replace(/index\.js$/, 'index.mjs') : modulePath;
    const code = await run('node', [`tests/${file}`], {
      PLAYWRIGHT_MODULE: playwright, MOBILE_TEST_BASE_URL: base,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import ./tests/stableBrowser.mjs`.trim(),
      ...(browserPath ? { CHROMIUM_EXECUTABLE_PATH: browserPath } : {}),
    });
    results.push({ suite: file, code });
  }));
}
await mkdir('generated-artifacts', { recursive: true });
const label = (process.env.SUITE_LABEL || 'latest').replace(/[^a-z0-9-]/gi, '-');
await writeFile(`generated-artifacts/ui-suite-${label}.json`, JSON.stringify(results, null, 2));
console.log(selected ? 'SELECTED SUITE RESULTS' : 'FULL SUITE RESULTS', JSON.stringify(results));
process.exitCode = results.some(r => r.code !== 0) ? 1 : 0;
