import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ActivityEventType =
  | 'project_created'
  | 'quote_sent'
  | 'quote_approved'
  | 'quote_declined'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'variation_raised'
  | 'variation_approved'
  | 'variation_declined';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  projectId: string;
  projectName: string;
  clientName: string;
  description: string;
  timestamp: Date;
}

async function fetchActivityEvents(userId: string): Promise<ActivityEvent[]> {
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, client_name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (projectsError) throw projectsError;
  if (!projects?.length) return [];

  const projectIds = projects.map(p => p.id);
  const projectMap = new Map(projects.map(p => [p.id, p]));

  const [quotesRes, invoicesRes, changeReqRes] = await Promise.all([
    supabase
      .from('quotes')
      .select('id, project_id, status, updated_at, approved_at, declined_at')
      .in('project_id', projectIds),
    supabase
      .from('invoices')
      .select('id, project_id, status, updated_at, paid_at')
      .in('project_id', projectIds),
    supabase
      .from('change_requests')
      .select('id, project_id, title, status, created_at, resolved_at')
      .in('project_id', projectIds),
  ]);

  if (quotesRes.error) throw quotesRes.error;
  if (invoicesRes.error) throw invoicesRes.error;
  if (changeReqRes.error) throw changeReqRes.error;

  const events: ActivityEvent[] = [];

  for (const project of projects) {
    events.push({
      id: `project_created_${project.id}`,
      type: 'project_created',
      projectId: project.id,
      projectName: project.name,
      clientName: project.client_name,
      description: `New job created for ${project.client_name} — ${project.name}`,
      timestamp: new Date(project.created_at),
    });
  }

  for (const quote of quotesRes.data ?? []) {
    const project = projectMap.get(quote.project_id);
    if (!project) continue;

    if (quote.status === 'sent' || quote.status === 'revised') {
      events.push({
        id: `quote_sent_${quote.id}`,
        type: 'quote_sent',
        projectId: quote.project_id,
        projectName: project.name,
        clientName: project.client_name,
        description: `Quote sent to ${project.client_name} — ${project.name}`,
        timestamp: new Date(quote.updated_at),
      });
    }

    if (quote.approved_at) {
      events.push({
        id: `quote_approved_${quote.id}`,
        type: 'quote_approved',
        projectId: quote.project_id,
        projectName: project.name,
        clientName: project.client_name,
        description: `Quote approved by ${project.client_name} — ${project.name}`,
        timestamp: new Date(quote.approved_at),
      });
    }

    if (quote.declined_at) {
      events.push({
        id: `quote_declined_${quote.id}`,
        type: 'quote_declined',
        projectId: quote.project_id,
        projectName: project.name,
        clientName: project.client_name,
        description: `Quote declined by ${project.client_name} — ${project.name}`,
        timestamp: new Date(quote.declined_at),
      });
    }
  }

  for (const invoice of invoicesRes.data ?? []) {
    const project = projectMap.get(invoice.project_id);
    if (!project) continue;

    if (invoice.status === 'sent' || invoice.status === 'overdue') {
      events.push({
        id: `invoice_sent_${invoice.id}`,
        type: 'invoice_sent',
        projectId: invoice.project_id,
        projectName: project.name,
        clientName: project.client_name,
        description: `Invoice sent to ${project.client_name} — ${project.name}`,
        timestamp: new Date(invoice.updated_at),
      });
    }

    if (invoice.paid_at) {
      events.push({
        id: `invoice_paid_${invoice.id}`,
        type: 'invoice_paid',
        projectId: invoice.project_id,
        projectName: project.name,
        clientName: project.client_name,
        description: `Invoice paid — ${project.name}`,
        timestamp: new Date(invoice.paid_at),
      });
    }
  }

  for (const cr of changeReqRes.data ?? []) {
    const project = projectMap.get(cr.project_id);
    if (!project) continue;

    events.push({
      id: `variation_raised_${cr.id}`,
      type: 'variation_raised',
      projectId: cr.project_id,
      projectName: project.name,
      clientName: project.client_name,
      description: `Variation raised — "${cr.title}" on ${project.name}`,
      timestamp: new Date(cr.created_at),
    });

    if (cr.resolved_at && cr.status === 'approved') {
      events.push({
        id: `variation_approved_${cr.id}`,
        type: 'variation_approved',
        projectId: cr.project_id,
        projectName: project.name,
        clientName: project.client_name,
        description: `Variation approved — "${cr.title}" on ${project.name}`,
        timestamp: new Date(cr.resolved_at),
      });
    }

    if (cr.resolved_at && cr.status === 'declined') {
      events.push({
        id: `variation_declined_${cr.id}`,
        type: 'variation_declined',
        projectId: cr.project_id,
        projectName: project.name,
        clientName: project.client_name,
        description: `Variation declined — "${cr.title}" on ${project.name}`,
        timestamp: new Date(cr.resolved_at),
      });
    }
  }

  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return events.slice(0, 20);
}

export function useActivityFeed() {
  const { user } = useAuth();

  return useQuery<ActivityEvent[]>({
    queryKey: ['/activity-feed', user?.id],
    queryFn: () => fetchActivityEvents(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}
