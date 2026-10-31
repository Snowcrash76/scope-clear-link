// Reference screenshots are not a source of business data. Enforced by npm build.
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
export const forbidden = [
 'Carlton', 'South Yarra', 'Brunswick', 'Prahran', 'FX-8', 'Stripe EFT',
 'Marcus Sterling', 'Diana Rostova', 'Senior Estimator', 'Dext', 'MYOB', 'example.com',
];
export async function scanPlaceholders(root = 'src') {
 const matches = [];
 async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
   const full = resolve(path, entry.name);
   if (entry.isDirectory()) await visit(full);
   else if (/\.(?:tsx?|jsx?|css|html|json|svg)$/i.test(entry.name)) {
    const lines = (await readFile(full, 'utf8')).split('\n');
    for (let index = 0; index < lines.length; index++) {
     for (const value of forbidden) {
      if (lines[index].toLowerCase().includes(value.toLowerCase())) matches.push({file:relative(process.cwd(),full),line:index+1,value});
     }
    }
   }
  }
 }
 await visit(resolve(root));
 return matches;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const matches = await scanPlaceholders();
 if(matches.length) {
  console.error('Screenshot placeholder content is not allowed in application source:');
  for(const m of matches)console.error(`${m.file}:${m.line}: ${m.value}`);
  process.exitCode=1;
 } else console.log('UI placeholder guard passed.');
}
