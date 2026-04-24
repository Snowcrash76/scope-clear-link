import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the public-facing base URL used for client links.
 * Set VITE_PUBLIC_BASE_URL (e.g. "https://yourdomain.com") to force all
 * client-facing links to that domain regardless of where the trade dashboard
 * is being viewed. Falls back to the current window origin.
 */
export function getPublicBaseUrl(): string {
  const configured = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function getClientProjectUrl(projectId: string): string {
  return `${getPublicBaseUrl()}/project/${projectId}`;
}

export function getQuoteShareUrl(quoteToken: string): string {
  return `${getPublicBaseUrl()}/quote/${quoteToken}`;
}
