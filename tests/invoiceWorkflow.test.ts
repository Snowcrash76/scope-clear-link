import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEditableInvoice, invoiceDisplayStatus, invoiceStatusLabel } from '../src/lib/invoiceWorkflow';
import { deliverApprovedInvoice, sendInvoiceEmail, InvoiceTransportError } from '../server/invoiceDelivery';

const edit = {
  invoiceNumber: 'INV-100', notes: 'Payment notes', terms: 'Terms', taxRate: 10,
  lineItems: [{ description: 'Preparation', quantity: 2, unitPrice: 125 }],
};
describe('Invoice approval amounts and labels', () => {
  it('rounds lines and GST to AUD cents without changing its input', () => {
    const input = { ...edit, lineItems: [{ description: 'Hours', quantity: 3, unitPrice: 33.335 }] };
    const before = JSON.stringify(input);
    const result = calculateEditableInvoice(input);
    assert.deepEqual([result.subtotal, result.taxAmount, result.total], [100.01, 10, 110.01]);
    assert.equal(JSON.stringify(input), before);
  });
  it('supports zero GST and editable GST rates', () => {
    assert.equal(calculateEditableInvoice({ ...edit, taxRate: 0 }).total, 250);
    assert.equal(calculateEditableInvoice({ ...edit, taxRate: 15 }).total, 287.5);
  });
  it('rejects missing, negative, non-finite and invalid date inputs', () => {
    for (const patch of [
      { invoiceNumber: '' }, { lineItems: [] }, { taxRate: NaN }, { taxRate: -1 },
      { taxRate: 101 }, { dueDate: '2026-02-30' },
      { lineItems: [{ description: '', quantity: 1, unitPrice: 1 }] },
      { lineItems: [{ description: 'Hours', quantity: 0, unitPrice: 1 }] },
      { lineItems: [{ description: 'Hours', quantity: 1, unitPrice: Infinity }] },
      { lineItems: [{ description: 'Hours', quantity: 1, unitPrice: -1 }] },
    ]) assert.throws(() => calculateEditableInvoice({ ...edit, ...patch }));
  });
  it('distinguishes unsent approval from sent and preserves legacy states', () => {
    assert.equal(invoiceDisplayStatus('draft'), 'draft');
    assert.equal(invoiceStatusLabel('draft'), 'Pending approval');
    assert.equal(invoiceDisplayStatus('draft', '2026-10-31'), 'approved');
    assert.equal(invoiceDisplayStatus('sent', '2026-10-31'), 'sent');
    assert.equal(invoiceStatusLabel('approved'), 'Approved');
  });
});

describe('Backend invoice delivery without real email', () => {
  const base = { projectId: 'job', invoiceId: 'invoice', userId: 'owner', expectedRevision: 4,
    payload: { to: ['synthetic@example.test'], html: 'New content' } };
  it('cannot email an unapproved or inaccessible invoice', async () => {
    let calls = 0;
    for (const error of [
      { code: 'P0001', message: 'Approve this invoice before sending.' },
      { code: '42501', message: 'Access denied.' },
      { code: 'PGRST202', message: 'Function missing.' },
    ]) {
      await assert.rejects(deliverApprovedInvoice({ ...base,
        db: { rpc: async () => ({ data: null, error }) },
        send: async () => { calls++; },
      }));
    }
    assert.equal(calls, 0);
  });
  it('does not email an already-sent invoice a second time', async () => {
    let calls = 0;
    assert.deepEqual(await deliverApprovedInvoice({ ...base,
      db: { rpc: async () => ({ data: { already_sent: true }, error: null }) },
      send: async () => { calls++; },
    }), { alreadySent: true });
    assert.equal(calls, 0);
  });
  it('sends the persisted snapshot and only marks sent after provider confirmation', async () => {
    const events: string[] = [];
    const persisted = { html: 'Persisted approved snapshot' };
    const db = { rpc: async (name: string, args: any) => {
      events.push(name);
      if (name === 'claim_invoice_delivery') {
        assert.equal(args.p_actor_id, 'owner');
        assert.equal(args.p_expected_revision, 4);
        return { data: { token: 'delivery-1', payload: persisted }, error: null };
      }
      assert.equal(args.p_success, true);
      return { data: true, error: null };
    } };
    await deliverApprovedInvoice({ ...base, db, send: async (payload, token) => {
      assert.deepEqual(payload, persisted); assert.equal(token, 'delivery-1'); events.push('provider');
    } });
    assert.deepEqual(events, ['claim_invoice_delivery', 'provider', 'finish_invoice_delivery']);
  });
  it('records known rejection without a sent transition', async () => {
    const finishes: any[] = [];
    const db = { rpc: async (name: string, args: any) => {
      if (name === 'claim_invoice_delivery') return { data: { token: 'attempt', payload: {} }, error: null };
      finishes.push(args); return { data: true, error: null };
    } };
    await assert.rejects(deliverApprovedInvoice({ ...base, db,
      send: async () => { throw new InvoiceTransportError('Rejected', true); },
    }), /was not sent/);
    assert.equal(finishes[0].p_success, false);
    assert.equal(finishes[0].p_rejected, true);
  });
  it('retains a retryable token for an ambiguous response or failed confirmation', async () => {
    for (const providerFailed of [true, false]) {
      const finishes: any[] = [];
      const db = { rpc: async (name: string, args: any) => {
        if (name === 'claim_invoice_delivery') return { data: { token: 'attempt', payload: {} }, error: null };
        finishes.push(args);
        return args.p_success ? { error: { message: 'Temporary database issue' } } : { data: true, error: null };
      } };
      await assert.rejects(deliverApprovedInvoice({ ...base, db, send: async () => {
        if (providerFailed) throw new Error('Connection lost');
      } }), /confirmation|status needs confirmation/);
      assert.equal(finishes.at(-1).p_success, false);
      assert.equal(finishes.at(-1).p_rejected, false);
    }
  });
  it('uses the same provider idempotency key and exact payload on retries', async () => {
    const requests: any[] = [];
    const fakeFetch = async (_url: unknown, init: any) => {
      requests.push(init);
      return new Response(JSON.stringify({ id: 'synthetic-email-id' }), { status: 200 });
    };
    await sendInvoiceEmail(base.payload, 'same-attempt', 'synthetic-key', fakeFetch as typeof fetch);
    await sendInvoiceEmail(base.payload, 'same-attempt', 'synthetic-key', fakeFetch as typeof fetch);
    assert.equal(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
    assert.equal(requests[0].body, requests[1].body);
  });
});
