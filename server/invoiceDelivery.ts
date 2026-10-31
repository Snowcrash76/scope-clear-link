/** Invoice email lifecycle. Dependencies are injected so tests never email clients. */
export class InvoiceDeliveryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export class InvoiceTransportError extends Error {
  constructor(message: string, public confirmedRejected: boolean) { super(message); }
}

export async function sendInvoiceEmail(
  payload: Record<string, unknown>, token: string, apiKey: string,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`,
      'Idempotency-Key': `invoice-delivery/${token}`,
    },
    body: JSON.stringify(payload),
  });
  let data: { id?: string; message?: string } = {};
  try { data = await response.json(); } catch { /* Missing confirmation remains uncertain. */ }
  if (!response.ok) {
    const rejected = [400, 401, 403, 404, 429].includes(response.status);
    throw new InvoiceTransportError(data.message || 'The email provider could not confirm delivery.', rejected);
  }
  if (!data.id) throw new InvoiceTransportError('The email provider did not confirm an email ID.', false);
  return data;
}

function databaseError(error: { code?: string; message?: string }) {
  if (['42883', 'PGRST202', '42703', '42P01'].includes(error.code ?? '')) {
    return new InvoiceDeliveryError(503, 'Invoice approval needs database setup. Apply its Supabase migration, then retry.');
  }
  return new InvoiceDeliveryError(error.code === '42501' ? 403 : 409,
    error.message || 'The invoice changed. Refresh and review it before sending.');
}

export async function deliverApprovedInvoice(input: {
  db: any;
  projectId: string;
  invoiceId: string;
  userId: string;
  expectedRevision: number;
  payload: Record<string, unknown>;
  send: (payload: Record<string, unknown>, token: string) => Promise<unknown>;
}) {
  const { db, invoiceId, projectId, userId, expectedRevision } = input;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new InvoiceDeliveryError(400, 'Refresh the invoice before sending it.');
  }
  const claim = await db.rpc('claim_invoice_delivery', {
    p_project_id: projectId, p_invoice_id: invoiceId, p_actor_id: userId,
    p_expected_revision: expectedRevision, p_payload: input.payload,
  });
  if (claim.error) throw databaseError(claim.error);
  if (claim.data?.already_sent === true) return { alreadySent: true };
  const { token, payload } = claim.data ?? {};
  if (!token || !payload) throw new InvoiceDeliveryError(503, 'Invoice delivery could not be prepared.');
  const finish = (success: boolean, rejected = false) => db.rpc('finish_invoice_delivery', {
    p_invoice_id: invoiceId, p_token: token, p_actor_id: userId, p_success: success, p_rejected: rejected,
  });
  try {
    await input.send(payload, token);
  } catch (error) {
    const rejected = error instanceof InvoiceTransportError && error.confirmedRejected;
    let recorded = false;
    try { recorded = !(await finish(false, rejected)).error; } catch { /* Keep the delivery locked. */ }
    if (rejected && recorded) {
      throw new InvoiceDeliveryError(502, 'The email was not sent. Check the client email and sender setup, then retry.');
    }
    throw new InvoiceDeliveryError(502, 'Delivery confirmation is pending. Use Retry delivery to check again; do not create another invoice.');
  }
  try {
    const result = await finish(true);
    if (result.error) throw result.error;
  } catch {
    try { await finish(false); } catch { /* Retain the original delivery token for safe retry. */ }
    throw new InvoiceDeliveryError(503, 'The email was accepted but its saved status needs confirmation. Use Retry delivery; it will not send a duplicate email.');
  }
  return { alreadySent: false };
}
