import type { ChangeRequest } from '@/types/project';

/** Trade-created variations wait on the client while pending; client requests wait on the client after the trade has priced them. */
export function awaitingClientApproval(variation: Pick<ChangeRequest, 'type' | 'status'>): boolean {
  return variation.type === 'client_request'
    ? variation.status === 'awaiting_client'
    : variation.status === 'pending';
}
