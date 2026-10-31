import { readdir, readFile, writeFile } from 'node:fs/promises';
const root='generated-artifacts';
const before=new Set(await readdir(`${root}/before`));
const files=(await readdir(`${root}/after`)).filter(f=>/-(375|1280)\.png$/.test(f)).sort();
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const image=async(phase,name)=>`<img loading="lazy" alt="${escape(phase+' '+name)}" src="data:image/png;base64,${(await readFile(`${root}/${phase}/${name}`)).toString('base64')}">`;
const sections=[];
for(const name of files){
 const first=before.has(name)?await image('before',name):'<p>No earlier version captured for this screen. The component preview is new.</p>';
 sections.push(`<details><summary>${escape(name.replace('.png','').replaceAll('-',' '))}</summary><div class="pair"><section><h3>Before</h3>${first}</section><section><h3>After</h3>${await image('after',name)}</section></div></details>`);
}
await writeFile(`${root}/scopeclear-ui-comparison.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScopeClear UI comparison</title><style>*{box-sizing:border-box}body{font:16px/1.5 system-ui;margin:0;background:#f8fafc;color:#111827}main{max-width:1500px;margin:auto;padding:24px}h1{font-size:30px}p{color:#4b5563}details{background:white;border:1px solid #e3e8f0;border-radius:14px;margin:12px 0;overflow:hidden}summary{cursor:pointer;padding:18px;font-weight:600}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;border-top:1px solid #e3e8f0}h3{margin-top:0}img{display:block;max-width:100%;height:auto;border:1px solid #e3e8f0}section{min-width:0}@media(max-width:650px){.pair{grid-template-columns:1fr}main{padding:14px}}</style><main><h1>ScopeClear — before &amp; after</h1><p>Desktop (1280px) and phone (375px) comparisons of actual app components, using isolated synthetic data — not customer accounts. The original application source is rebuilt read-only for the public and client baselines. The management baseline was captured before its redesign.</p><p>Expand a screen below. The accompanying validation also checks 320px, 768px and 1440px widths. Screenshots document appearance; interactive workflow checks are reported separately.</p>${sections.join('')}<p>Generated comparison only. No authentication or customer data is embedded in this file.</p></main></html>`);
console.log(`Wrote ${sections.length} comparisons to ${root}/scopeclear-ui-comparison.html`);
