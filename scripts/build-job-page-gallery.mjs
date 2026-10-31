import { readdir, readFile, writeFile } from 'node:fs/promises';
const root='generated-artifacts/job-page-followup';
const files=(await readdir(`${root}/after`)).filter(file=>/-(1440|1280|375)\.png$/.test(file));
if(files.length!==9)throw new Error(`Expected nine after captures, found ${files.length}`);
const label=file=>file.includes('tab-quote')?'Quote':file.includes('tab-changes')?'Variations':'Overview';
const widths=[1440,1280,375],views=['Overview','Quote','Variations'];
const sections=[];
for(const view of views)for(const width of widths){
 const file=files.find(file=>label(file)===view&&file.endsWith(`-${width}.png`));
 if(!file)throw new Error(`Missing ${view} at ${width}px`);
 const images=await Promise.all(['before','after'].map(async phase=>`<figure><figcaption>${phase==='before'?'Before':'After'}</figcaption><img alt="${view} ${phase} at ${width} pixels" loading="lazy" src="data:image/png;base64,${(await readFile(`${root}/${phase}/${file}`)).toString('base64')}"></figure>`));
 sections.push(`<section><h2>${view} · ${width}px</h2><div class="pair">${images.join('')}</div></section>`);
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScopeClear — job page refinements</title><style>
*{box-sizing:border-box}body{margin:0;background:#F8FAFC;color:#111827;font:15px/1.5 Inter,Arial,sans-serif}header,main{max-width:1600px;margin:auto;padding:24px}header{border-bottom:1px solid #E3E8F0}h1{margin:0 0 12px}p{color:#667085;max-width:900px}section{margin-bottom:32px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{margin:0;background:white;border:1px solid #E3E8F0;border-radius:12px;overflow:hidden}figcaption{padding:12px;font-weight:700;color:#2563EB;border-bottom:1px solid #E3E8F0}img{display:block;width:100%;height:auto}@media(max-width:700px){.pair{grid-template-columns:1fr}header,main{padding:16px}}
</style><header><h1>ScopeClear — job page refinements</h1><p>Nine before-and-after comparisons: Overview, Quote and Variations at 1440, 1280 and 375px. Real app components rendered with isolated synthetic data, not live customer accounts. The 375px images use phone-sized Chrome emulation, not a physical handset.</p><p>Compact single client header, shared blue/white surfaces, text-only scrolling tabs, meaningful next actions and overview summaries. Financial calculations, secure links and existing confirmations are preserved.</p></header><main>${sections.join('')}</main></html>`;
await writeFile('generated-artifacts/job-page-followup-comparison.html',html);
console.log('Saved nine job-page before/after comparisons.');
