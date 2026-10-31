// Keep stored totals aligned with QuoteSection's de-duplicated live totals.
const isVariationTitle = (title = '') =>
  /^variation(?::| |-)/i.test(title.trim());

export function calculateStoredQuoteTotals(scopeItems, lineItems, changes, taxRate) {
  const approved = changes.filter(change => change.status === 'approved');
  const approvedCosts = new Set(approved.map(change => change.cost_impact ?? 0));
  const scopeSubtotal = scopeItems
    .filter(item => item.category === 'included'
      && !isVariationTitle(item.title)
      && !approvedCosts.has(item.cost ?? -1))
    .reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const lineSubtotal = lineItems
    .filter(item => !(item.is_variation ?? isVariationTitle(item.title))
      && !approvedCosts.has(item.cost))
    .reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const subtotal = scopeSubtotal + lineSubtotal
    + approved.reduce((sum, change) => sum + (change.cost_impact ?? 0), 0);
  const tax_amount = subtotal * ((taxRate ?? 0) / 100);
  return { subtotal, tax_amount, total: subtotal + tax_amount };
}
