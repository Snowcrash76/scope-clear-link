export function calculateStoredQuoteTotals(
  scopeItems: ReadonlyArray<{ title: string; category: string; cost?: number | null }>,
  lineItems: ReadonlyArray<{ title: string; cost: number; is_variation?: boolean | null }>,
  changes: ReadonlyArray<{ status: string; cost_impact?: number | null }>,
  taxRate?: number | null,
): { subtotal: number; tax_amount: number; total: number };
