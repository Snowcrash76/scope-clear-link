import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from '@/integrations/supabase/client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPublicBaseUrl(): string {
  const configured = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export async function getClientProjectUrl(projectId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in to share a client link.');
  const response = await fetch(`/api/team/jobs/${encodeURIComponent(projectId)}/client-link`, { headers: { Authorization: `Bearer ${session.access_token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The secure client link could not be created.');
  return `${getPublicBaseUrl()}${data.path}`;
}

export function getQuoteShareUrl(quoteToken: string): string {
  return `${getPublicBaseUrl()}/quote/${quoteToken}`;
}

export function cleanVariationTitle(title: string): string {
  return title.replace(/^variation[:\s-]+/i, '').trim();
}

export function isVariationItem(title: string): boolean {
  if (!title || typeof title !== 'string') return false;
  const t = title.toLowerCase().trim();
  return t.startsWith('variation:') ||
    t.startsWith('variation ') ||
    t.startsWith('variation-');
}

export function stripVariationMeta(description: string | null | undefined): string {
  if (!description) return '';
  return description
    .replace(/\n{1,2}Time impact:.*$/im, '')
    .replace(/\n{1,2}Reason:.*$/im, '')
    .trim();
}
