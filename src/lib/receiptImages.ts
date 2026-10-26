import { MAX_RECEIPT_BYTES, RECEIPT_TYPES } from '../../shared/jobCosting';

export function validateReceiptFile(file: File) {
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP photo, or a PDF. Convert HEIC photos to JPEG first.');
  if (file.size === 0 || file.size > MAX_RECEIPT_BYTES)
    throw new Error('Choose a receipt smaller than 10 MB.');
}

export type PreparedReceipt = { media_type: 'application/pdf' } | { media_type: 'image/jpeg'; data: string };

export async function prepareReceiptForScan(file: File): Promise<PreparedReceipt> {
  validateReceiptFile(file);
  if (file.type === 'application/pdf') return { media_type: 'application/pdf' };
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    if (!Number.isFinite(scale) || image.naturalWidth <= 0 || image.naturalHeight <= 0)
      throw new Error('Unreadable photo.');
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing unavailable.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
    if (!data || data.length > 7 * 1024 * 1024) throw new Error('Photo is too large to scan.');
    return { media_type: 'image/jpeg', data };
  } catch {
    throw new Error('This photo could not be prepared. Try a JPEG photo, or enter the cost manually.');
  } finally { URL.revokeObjectURL(url); }
}
