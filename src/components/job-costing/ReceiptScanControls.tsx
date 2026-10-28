import { useEffect, useState } from 'react';
import { Camera, FileText, ScanLine, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateReceiptFile } from '@/hooks/useJobCosts';

type ReceiptScanControlsProps = {
  file: File | null;
  busy: boolean;
  uploaded: boolean;
  onFileChange: (file: File | null) => void;
  onScan: () => void;
};

export function ReceiptScanControls({ file, busy, uploaded, onFileChange, onScan }: ReceiptScanControlsProps) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectFile = (candidate: File | null) => {
    setError('');
    if (!candidate) return;
    try {
      validateReceiptFile(candidate);
      onFileChange(candidate);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Choose a valid receipt file.');
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-3 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Scan a receipt</p>
          <p className="mt-0.5 text-xs text-muted-foreground">A scan creates a draft for you to review — it never posts an automatic financial entry.</p>
        </div>
        {file && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { onFileChange(null); setError(''); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Clear file</Button>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted/40 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <Camera className="mr-2 h-4 w-4" />Take photo
          <input data-testid="input-receipt-camera" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={event => { selectFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} />
        </label>
        <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted/40 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <UploadCloud className="mr-2 h-4 w-4" />Upload photo or PDF
          <input data-testid="input-receipt-upload" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={event => { selectFile(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} />
        </label>
      </div>
      {file && (
        <div className="min-w-0 max-w-full rounded-md border bg-muted/20 p-3">
          {file.type.startsWith('image/') ? <img src={previewUrl} alt="Selected receipt preview" className="mb-3 block h-auto max-h-64 w-full min-w-0 max-w-full rounded object-contain" /> : (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><FileText className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 break-words">{file.name}</span><a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-amber-800 underline">Open PDF preview</a></div>
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <span className="min-w-0 break-words text-xs text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              {uploaded && <span className="text-[11px] text-muted-foreground">Original attached privately</span>}
              <Button type="button" size="sm" className="min-h-11 w-full sm:w-auto" onClick={onScan} disabled={busy} data-testid="button-scan-receipt"><ScanLine className="mr-2 h-4 w-4" />{busy ? 'Scanning…' : uploaded ? 'Scan again' : 'Scan receipt'}</Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">When you press Scan, the receipt file is sent to Perplexity and the selected AI provider for reading. The original file is stored privately with this job.</p>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
