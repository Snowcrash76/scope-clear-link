import type { ChangeRequest } from '@/types/project';

/** Trade-created variations wait on the client while pending; client requests wait on the client after the trade has priced them. */
export function awaitingClientApproval(variation: Pick<ChangeRequest, 'type' | 'status'>): boolean {
  return variation.type === 'client_request'
    ? variation.status === 'awaiting_client'
    : variation.status === 'pending';
}

/** Client-raised requests that still need the trade to price or answer them. */
export function needsTradeResponse(variation: Pick<ChangeRequest, 'type' | 'status'>): boolean {
  return variation.type === 'client_request' && variation.status === 'pending';
}
