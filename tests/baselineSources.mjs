// Optional, genuine pre-redesign screenshots without checking out old code.
// Only invoked with BASELINE_REF; application source and customer data are untouched.
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
let prepared = false;
export async function baselineAssets() {
 if (!process.env.BASELINE_REF) return { plugins: [], css: '/src/index.css' };
 const ref=process.env.BASELINE_REF;
 if (!prepared) {
  const source=execFileSync('git',['show',`${ref}:src/index.css`],{encoding:'utf8'});
  const files=execFileSync('git',['ls-tree','-r','--name-only',ref,'src'],{encoding:'utf8'}).trim().split('\n').filter(f=>/\.(tsx?|jsx?|css)$/.test(f));
  const content=files.map(f=>execFileSync('git',['show',`${ref}:${f}`],{encoding:'utf8'})).join('\n');
  await writeFile('generated-artifacts/baseline-source.txt',content);
  await writeFile('generated-artifacts/baseline-input.css',source);
  await writeFile('generated-artifacts/baseline-tailwind.config.ts',execFileSync('git',['show',`${ref}:tailwind.config.ts`],{encoding:'utf8'}));
  execFileSync('node',['node_modules/tailwindcss/lib/cli.js','--config','generated-artifacts/baseline-tailwind.config.ts','-i','generated-artifacts/baseline-input.css','-o','generated-artifacts/baseline-theme.css','--content','generated-artifacts/baseline-source.txt'],{stdio:'pipe'});
  prepared=true;
 }
 return {
  css:'/generated-artifacts/baseline-theme.css',
  plugins:[{name:'read-only-baseline-sources',setup(b){
   b.onLoad({filter:/\/src\/.*\.(tsx?|jsx?|css)$/},({path})=>{
    const file=relative(process.cwd(),path);
    if (!file.startsWith('src/')) return;
    return {contents:execFileSync('git',['show',`${ref}:${file}`],{encoding:'utf8'}),loader:path.endsWith('.css')?'css':path.endsWith('x')?'tsx':'ts'};
   });
  }}],
 };
}
