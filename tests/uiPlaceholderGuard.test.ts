import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanPlaceholders, forbidden } from '../scripts/check-ui-placeholders.mjs';
test('UI content guard catches every requested screenshot string, including nested/case variants',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ui-guard-'));
 try{
  await mkdir(join(root,'nested'));
  await writeFile(join(root,'nested','example.tsx'), forbidden.map(s=>s.toUpperCase()).join('\n'));
  const result=await scanPlaceholders(root);
  assert.deepEqual(result.map(r=>r.value),forbidden);
  assert.equal(result[0].line,1);
  await writeFile(join(root,'nested','example.tsx'),'export const hint="Enter your email";');
  assert.deepEqual(await scanPlaceholders(root),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('production build runs the content guard before Vite',async()=>{
 const pkg=JSON.parse(await readFile('package.json','utf8'));
 assert.match(pkg.scripts.build,/^node scripts\/check-ui-placeholders.mjs && vite build$/);
});
