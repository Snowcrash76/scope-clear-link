import { supabase } from '@/integrations/supabase/client';
import { clientAccessHeaders } from '@/lib/clientAccess';

export async function sendClientDocumentUploadNotification(
  projectId: string,
  documentNames: string[]
): Promise<void> {
  try {
    const res = await fetch('/api/send-client-document-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientAccessHeaders() },
      body: JSON.stringify({ projectId, documentNames }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Failed to send client document notification:', err);
    }
  } catch (error) {
    console.error('Error sending client document notification:', error);
  }
}

export async function sendDocumentUploadNotification(
  projectId: string,
  documentNames: string[]
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch('/api/send-document-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ projectId, documentNames }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Failed to send document notification:', err);
    }
  } catch (error) {
    console.error('Error sending document notification:', error);
  }
}
