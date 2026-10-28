export interface QuoteDraftItem {
  title: string;
  description: string;
  cost: number;
  category: 'included' | 'excluded' | 'assumption';
  imageUrl?: string;
}

/** Include the item still being typed when the user saves the entire quote. */
export function collectQuoteDraftItems(items: QuoteDraftItem[], current: QuoteDraftItem): QuoteDraftItem[] {
  const descriptionText = current.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  if (!current.title.trim() && (descriptionText || current.cost || current.imageUrl)) {
    throw new Error('Please enter a title for the quote item before saving.');
  }
  const result = [...items, ...(current.title.trim() ? [current] : [])];
  return result.map(item => ({
    title: item.title.trim(),
    description: item.description,
    cost: item.cost,
    category: item.category,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
  }));
}

export function quoteDraftTotals(items: QuoteDraftItem[], taxRate: number) {
  const subtotal = items.filter(item => item.category === 'included').reduce((sum, item) => sum + item.cost, 0);
  const taxAmount = subtotal * taxRate / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}
