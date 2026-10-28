import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptExtraction, receiptWarnings, receiptDescription, receiptCurrencyForReview, type ReceiptExtraction } from '../shared/receiptScanning';
import { jobCostInputSchema } from '../shared/jobCosting';
import { createPerplexityReceiptExtractor, RECEIPT_MODEL, RECEIPT_SYSTEM_PROMPT, RECEIPT_JSON_SCHEMA } from '../server/receiptExtraction';
import { decodeReceiptImage, detectReceiptType } from '../server/receiptRoutes';
import { withApi } from './jobCosting.test';

const owner = '11111111-1111-4111-8111-111111111111';
const jobId = '33333333-3333-4333-8333-333333333333';
const otherJob = '44444444-4444-4444-8444-444444444444';
const costId = '55555555-5555-4555-8555-555555555555';
const fileId = '77777777-7777-4777-8777-777777777777';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
const input = { job_id: jobId, receipt_path: `${owner}/${jobId}/${fileId}.jpg`, media_type: 'image/jpeg', data: jpeg };
const extracted = {
  supplier: 'Building supplies', abn: '00 000 000 000', currency: 'AUD', date: '2026-10-26', reference_number: 'INV-123',
  line_items: [{ description: 'Timber', quantity: 2, unit_price: 50, amount: 100 }],
  subtotal_ex_gst: 100, gst: 10, total_inc_gst: 110, suggested_category: null, confidence: 'medium',
} satisfies ReceiptExtraction;
const providerReceipt = {
  supplier: extracted.supplier, abn: extracted.abn, currency: extracted.currency,
  receipt_date: extracted.date, receipt_number: extracted.reference_number,
  line_items: extracted.line_items, subtotal: extracted.subtotal_ex_gst, gst: extracted.gst, total: extracted.total_inc_gst,
};
const providerResponse = (receipt: unknown = providerReceipt) => ({
  status: 'completed', output: [
    { type: 'reasoning' },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(receipt) }] },
  ],
});

test('structured receipt JSON supports fences and null fields, rejects malformed/invented values', () => {
  assert.deepEqual(parseReceiptExtraction('```json\n' + JSON.stringify(extracted) + '\n```'), extracted);
  assert.equal(parseReceiptExtraction(JSON.stringify({ ...extracted, date: null, supplier: null, gst: null })).date, null);
  for (const text of [
    'not json', '{"supplier":"Truncated"', JSON.stringify({ ...extracted, date: '2026-02-30' }),
    JSON.stringify({ ...extracted, suggested_category: 'Unknown' }),
    JSON.stringify({ ...extracted, total_inc_gst: '110 AUD' }),
    JSON.stringify({ ...extracted, confidence: 'perfect' }),
  ]) assert.throws(() => parseReceiptExtraction(text), /unreadable result/);
});

test('reconciliation distinguishes GST-free, rounded, missing, low-confidence and inconsistent receipts', () => {
  assert.deepEqual(receiptWarnings(extracted), []);
  assert.deepEqual(receiptWarnings({ ...extracted, gst: 0, total_inc_gst: 100 }), []);
  assert.match(receiptWarnings({ ...extracted, subtotal_ex_gst: 90 }).join(' '), /Totals don't reconcile/);
  assert.deepEqual(receiptWarnings({ ...extracted, gst: 5, total_inc_gst: 105 }), []);
  assert.match(receiptWarnings({ ...extracted, line_items: [{ ...extracted.line_items[0], amount: 99 }] }).join(' '), /Totals don't reconcile/);
  const unreadable = receiptWarnings({ ...extracted, supplier: null, date: null, gst: null, confidence: 'low', line_items: [{ ...extracted.line_items[0], amount: null }] }).join(' ');
  assert.match(unreadable, /could not be read/);
  assert.match(unreadable, /Low-confidence/);
  assert.equal(receiptDescription(extracted), '2 × Timber');
});

test('binary validation rejects fake MIME types and oversized/malformed base64', () => {
  assert.equal(detectReceiptType(Buffer.from('%PDF-1.7')), 'application/pdf');
  assert.equal(detectReceiptType(Buffer.from(jpeg, 'base64')), 'image/jpeg');
  assert.equal(detectReceiptType(Buffer.from('<html>')), null);
  assert.throws(() => decodeReceiptImage('not base64!', 'image/jpeg'));
  assert.throws(() => decodeReceiptImage(jpeg, 'image/png'));
  assert.throws(() => decodeReceiptImage(Buffer.alloc(6 * 1024 * 1024).toString('base64'), 'image/jpeg'));
});

test('GST-inclusive item prices reconcile with the printed total without changing receipt values', () => {
  const receipt = { ...extracted, subtotal_ex_gst: 17.14, gst: 1.71, total_inc_gst: 18.85, line_items: [
    { description: 'Adhesive', quantity: 1, unit_price: 10.575, amount: 10.58 },
    { description: 'Steel post', quantity: 1, unit_price: 6.29, amount: 6.29 },
    { description: 'Nozzle', quantity: 2, unit_price: 0.99, amount: 1.98 },
  ] };
  const before = JSON.stringify(receipt);
  assert.deepEqual(receiptWarnings(receipt), []);
  assert.equal(JSON.stringify(receipt), before);
  assert.match(receiptWarnings({ ...receipt, line_items: [{ ...receipt.line_items[0], amount: 12 }] }).join(' '), /Totals don't reconcile/);
});

test('Perplexity uses vision, a strict receipt JSON schema, private authentication and explicitly no web tools', async () => {
  const requests: any[] = [];
  const extract = createPerplexityReceiptExtractor({
    getKey: () => 'test-key-not-real',
    request: (async (url, init) => {
      requests.push({ url, headers: init!.headers, body: JSON.parse(init!.body as string) });
      return new Response(JSON.stringify(providerResponse()));
    }) as typeof fetch,
  });
  assert.deepEqual(await extract({ mediaType: 'image/jpeg', base64: jpeg }), extracted);
  await extract({ mediaType: 'application/pdf', base64: Buffer.from('%PDF-1.7').toString('base64') });
  assert.equal(requests[0].url, 'https://api.perplexity.ai/v1/agent');
  assert.equal(requests[0].body.model, 'openai/gpt-5.6-luna');
  assert.equal(requests[0].body.model, RECEIPT_MODEL);
  assert.equal(requests[0].body.instructions, RECEIPT_SYSTEM_PROMPT);
  assert.equal(requests[0].headers.Authorization, 'Bearer test-key-not-real');
  assert.deepEqual(requests[0].body.tools, []);
  assert.equal(requests[0].body.tool_choice, 'none');
  assert.equal(requests[0].body.store, false);
  assert.equal(requests[0].body.max_steps, 1);
  assert.equal(requests[0].body.response_format.type, 'json_schema');
  assert.equal(requests[0].body.response_format.json_schema.strict, true);
  assert.deepEqual(requests[0].body.response_format.json_schema.schema, RECEIPT_JSON_SCHEMA);
  assert.equal(JSON.stringify(requests[0].body).includes('test-key-not-real'), false);
  assert.equal(requests[0].body.input[0].content[1].type, 'input_image');
  assert.equal(requests[0].body.input[0].content[1].image_url, `data:image/jpeg;base64,${jpeg}`);
  assert.equal(requests[1].body.input[0].content[1].type, 'input_file');
  assert.equal(requests[1].body.input[0].content[1].filename, 'receipt.pdf');
  assert.equal(requests[1].body.input[0].content[1].file_data, Buffer.from('%PDF-1.7').toString('base64'));
});

test('provider failures and missing key give friendly errors without exposing provider bodies', async () => {
  const absent = createPerplexityReceiptExtractor({ getKey: () => undefined });
  await assert.rejects(absent({ mediaType: 'image/jpeg', base64: jpeg }), /PERPLEXITY_API_KEY/);
  for (const status of [401, 402, 403, 404, 429, 500]) {
    const extract = createPerplexityReceiptExtractor({
      getKey: () => 'test-key-not-real',
      request: (async () => new Response('PRIVATE PROVIDER BODY', { status })) as typeof fetch,
    });
    await assert.rejects(extract({ mediaType: 'image/jpeg', base64: jpeg }), error => {
      assert.equal(String(error).includes('PRIVATE PROVIDER BODY'), false);
      return true;
    });
  }
  const invalid = createPerplexityReceiptExtractor({
    getKey: () => 'test-key-not-real',
    request: (async () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'not JSON' }] }] }))) as typeof fetch,
  });
  await assert.rejects(invalid({ mediaType: 'image/jpeg', base64: jpeg }), /unreadable result/);
});

test('receipt costs always use AUD without per-receipt currency confirmation', () => {
  assert.equal(receiptCurrencyForReview(), 'AUD');
  assert.equal(receiptCurrencyForReview(null), 'AUD');
  assert.equal(receiptCurrencyForReview('AUD'), 'AUD');
  assert.equal(receiptCurrencyForReview('USD'), 'AUD');
});

test('unreadable values stay null without calculating tax, identifying currency or inventing line items', async () => {
  const missing = Object.fromEntries(Object.keys(providerReceipt).map(key => [key, null]));
  const extract = createPerplexityReceiptExtractor({
    getKey: () => 'test-key-not-real',
    request: (async () => new Response(JSON.stringify(providerResponse(missing)))) as typeof fetch,
  });
  const result = await extract({ mediaType: 'image/jpeg', base64: jpeg });
  for (const key of ['supplier', 'abn', 'currency', 'date', 'reference_number', 'line_items', 'subtotal_ex_gst', 'gst', 'total_inc_gst'] as const)
    assert.equal(result[key], null);
  assert.equal(result.suggested_category, null);
  assert.equal(result.confidence, 'low');
  assert.match(receiptWarnings(result).join(' '), /ABN.*receipt date.*receipt number.*currency/);
  assert.equal(receiptDescription(result), '');
});

test('partial output, refusals, external results and invalid receipt JSON fail closed', async () => {
  for (const reply of [
    { ...providerResponse(), status: 'incomplete' },
    { ...providerResponse(), error: { message: 'PRIVATE CONTENT' } },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', text: 'PRIVATE CONTENT' }] }] },
    { ...providerResponse(), output: [{ type: 'search_results', results: [] }, ...providerResponse().output] },
    providerResponse({ ...providerReceipt, currency: 'Australian dollars' }),
    providerResponse({ ...providerReceipt, abn: 12345678901 }),
    providerResponse({ ...providerReceipt, subtotal: '100.00' }),
    providerResponse({ ...providerReceipt, invented_field: 'not allowed' }),
  ]) {
    const extract = createPerplexityReceiptExtractor({
      getKey: () => 'test-key-not-real',
      request: (async () => new Response(JSON.stringify(reply))) as typeof fetch,
    });
    await assert.rejects(extract({ mediaType: 'image/jpeg', base64: jpeg }), error => {
      assert.equal(String(error).includes('PRIVATE CONTENT'), false);
      return true;
    });
  }
});

test('missing line-item fields remain null and foreign or unknown currency is flagged', () => {
  const result = parseReceiptExtraction(JSON.stringify({
    ...extracted, currency: null, abn: null, reference_number: null,
    line_items: [{ description: null, quantity: null, unit_price: null, amount: null }],
  }));
  assert.equal(result.line_items![0].description, null);
  assert.match(receiptWarnings(result).join(' '), /line item fields/);
  assert.match(receiptWarnings({ ...extracted, currency: 'USD' }).join(' '), /no currency conversion/);
});

test('scanning only returns prefill data, never saves; private PDF originals are supported', async () => {
  let providerCalls = 0;
  await withApi(async (request, fake) => {
    const before = JSON.stringify(fake.tables.job_costs);
    const photo = await request('/receipts/extract', 'POST', input);
    assert.equal(photo.status, 200);
    assert.deepEqual(photo.body.extraction, extracted);
    assert.deepEqual(photo.body.warnings, []);
    const pdf = await request('/receipts/extract', 'POST', {
      job_id: jobId, receipt_path: `${owner}/${jobId}/${fileId}.pdf`, media_type: 'application/pdf',
    });
    assert.equal(pdf.status, 200);
    assert.equal(providerCalls, 2);
    assert.equal(JSON.stringify(fake.tables.job_costs), before);
  }, false, async image => {
    providerCalls++;
    assert.ok(image.base64);
    return extracted;
  });
});

test('scan access validates session, job ownership, private paths, MIME and database setup before inference', async () => {
  let providerCalls = 0;
  await withApi(async (request, fake) => {
    assert.equal((await request('/receipts/extract', 'POST', input, null)).status, 401);
    assert.equal((await request('/receipts/extract', 'POST', input, 'invalid')).status, 401);
    assert.equal((await request('/receipts/extract', 'POST', { ...input, job_id: otherJob })).status, 404);
    assert.equal((await request('/receipts/extract', 'POST', { ...input, receipt_path: 'https://evil.test/receipt.jpg' })).status, 400);
    assert.equal((await request('/receipts/extract', 'POST', { ...input, receipt_path: `${owner}/${otherJob}/${fileId}.jpg` })).status, 400);
    assert.equal((await request('/receipts/extract', 'POST', { ...input, data: 'bad base64!' })).status, 400);
    fake.files.set(input.receipt_path, new Blob(['<script>not a receipt</script>']));
    assert.equal((await request('/receipts/extract', 'POST', input)).status, 400);
    assert.equal(providerCalls, 0);
  }, false, async () => { providerCalls++; return extracted; });
  await withApi(async request => {
    assert.equal((await request('/receipts/extract', 'POST', input)).status, 503);
    assert.equal(providerCalls, 0);
  }, true, async () => { providerCalls++; return extracted; });
});

test('scan rate limits repeated requests for the same account', async () => {
  await withApi(async request => {
    for (let i = 0; i < 6; i++) assert.equal((await request('/receipts/extract', 'POST', input)).status, 200);
    assert.equal((await request('/receipts/extract', 'POST', input)).status, 429);
  }, false, async () => extracted);
});

test('only one scan per account can be in flight, and a failed scan releases the lock', async () => {
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  let release!: () => void;
  const finish = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await withApi(async request => {
    const pending = request('/receipts/extract', 'POST', input);
    await started;
    assert.equal((await request('/receipts/extract', 'POST', input)).status, 429);
    release();
    assert.equal((await pending).status, 200);
    assert.equal((await request('/receipts/extract', 'POST', input)).status, 200);
    assert.equal(calls, 2);
  }, false, async () => {
    calls++;
    entered();
    await finish;
    return extracted;
  });
});

test('duplicates match normalized supplier/date/total across owned jobs only and allow edit exclusion', async () => {
  await withApi(async (request, fake) => {
    const secondJob = '99999999-9999-4999-8999-999999999999';
    const secondCost = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    fake.tables.projects.push({ id: secondJob, name: 'Second job', user_id: owner });
    fake.tables.job_costs.push({ ...fake.tables.job_costs[0], id: secondCost, job_id: secondJob, supplier: ' Building   Supplies ' });
    const check = { job_id: jobId, supplier: 'BUILDING supplies', cost_date: '2026-10-26', amount_inc_gst: 110 };
    const result = await request('/job-costs/duplicates', 'POST', check);
    assert.equal(result.status, 200);
    assert.equal(result.body.duplicates.length, 2);
    assert.equal(result.body.duplicates.some((row: any) => row.job_name === 'Second job'), true);
    const edited = await request('/job-costs/duplicates', 'POST', { ...check, exclude_cost_id: costId });
    assert.equal(edited.body.duplicates.length, 1);
    assert.equal(edited.body.duplicates[0].id, secondCost);
    assert.equal((await request('/job-costs/duplicates', 'POST', { ...check, job_id: otherJob })).status, 404);
    assert.equal((await request('/job-costs/duplicates', 'POST', { ...check, cost_date: '2026-10-25' })).body.duplicates.length, 0);
  });
});

test('reviewed line items including discounts persist only with an explicit save and are validated', async () => {
  await withApi(async (request, fake) => {
    const original = fake.tables.job_costs[0];
    const payload = {
      job_id: jobId, supplier: original.supplier, description: original.description, cost_date: original.cost_date,
      category: original.category, amount_ex_gst: 100, gst_amount: 10, amount_inc_gst: 110, gst_applies: true,
      status: 'draft', receipt_line_items: [...extracted.line_items, { description: 'Discount', quantity: null, unit_price: null, amount: -5 }], receipt_confidence: 'medium',
      receipt_abn: extracted.abn, receipt_currency: 'AUD',
    };
    assert.equal(jobCostInputSchema.safeParse(payload).success, true);
    const response = await request('/job-costs', 'POST', payload);
    assert.equal(response.status, 200);
    assert.equal(response.body.receipt_line_items.length, 2);
    assert.equal(response.body.receipt_confidence, 'medium');
    assert.equal(response.body.receipt_abn, extracted.abn);
    assert.equal(response.body.receipt_currency, 'AUD');
    const edited = await request(`/job-costs/${response.body.id}`, 'PUT', { ...payload, receipt_abn: null });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.receipt_abn, null);
    assert.equal((await request('/job-costs', 'POST', { ...payload, receipt_currency: 'USD' })).status, 400);
    assert.equal((await request('/job-costs', 'POST', { ...payload, receipt_currency: null })).status, 400);
    const mixed = await request('/job-costs', 'POST', { ...payload, gst_amount: 5, amount_inc_gst: 105 });
    assert.equal(mixed.status, 200);
    assert.equal(mixed.body.gst_amount, 5);
    assert.equal((await request('/job-costs', 'POST', { ...payload, receipt_line_items: [{ description: 'Bad amount', quantity: 1, amount: 'AUD 99', unit_price: 99 }] })).status, 400);
  });
});
