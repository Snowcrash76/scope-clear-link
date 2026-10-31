// Fixture bundles are rebuilt between suites. Disable only Vite's HMR client
// in test pages so unrelated fixture writes cannot reload a live interaction.
// This does not disable app scripts, styles, API checks or production auth.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = modulePath.endsWith('.mjs') ? await import(modulePath) : require(modulePath);
const launch = chromium.launch.bind(chromium);
async function stablePage(page) {
  // Page assertions wait for the actual app elements. Do not let an unrelated
  // third-party font/image request hold navigation at the global load event.
  const goto=page.goto.bind(page);
  page.goto=(url,options={})=>goto(url,{waitUntil:'domcontentloaded',...options});
  await page.route('**/@vite/client', route => route.fulfill({ contentType: 'text/javascript', body: `
   export function injectQuery(url, query) { return url + (url.includes('?') ? '&' : '?') + query; }
   export function createHotContext() { return { data:{}, accept(){}, dispose(){}, prune(){}, invalidate(){}, on(){}, off(){} }; }
   export function updateStyle(id, text) { let el=document.getElementById(id); if(!el){el=document.createElement('style');el.id=id;document.head.append(el);}el.textContent=text; }
   export function removeStyle(id) { document.getElementById(id)?.remove(); }
  ` }));
  return page;
}
chromium.launch = async (...args) => {
 const browser = await launch(...args);
 const newPage = browser.newPage.bind(browser);
 browser.newPage = async (...pageArgs) => stablePage(await newPage(...pageArgs));
 const newContext = browser.newContext.bind(browser);
 browser.newContext = async (...contextArgs) => {
  const context = await newContext(...contextArgs);
  const page = context.newPage.bind(context);
  context.newPage = async (...pageArgs) => stablePage(await page(...pageArgs));
  return context;
 };
 return browser;
};
