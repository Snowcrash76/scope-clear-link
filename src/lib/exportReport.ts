import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types/project';
import { format } from 'date-fns';

interface ProjectReportRow {
  projectName: string;
  client: string;
  status: string;
  quoteTotal: number;
  invoiceTotal: number;
  amountPaid: number;
  outstandingBalance: number;
}

const STATUS_LABELS: Record<Project['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  completed: 'Completed',
};

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

const FORMULA_INJECTION_CHARS = /^[=+\-@\t\r]/;

function escapeCSV(value: string): string {
  let safe = value;
  if (FORMULA_INJECTION_CHARS.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function buildCSV(rows: ProjectReportRow[]): string {
  const headers = [
    'Project Name',
    'Client',
    'Status',
    'Quote Total ($)',
    'Invoice Total ($)',
    'Amount Paid ($)',
    'Outstanding Balance ($)',
  ];

  const lines: string[] = [headers.map(escapeCSV).join(',')];

  for (const row of rows) {
    lines.push(
      [
        escapeCSV(row.projectName),
        escapeCSV(row.client),
        escapeCSV(row.status),
        formatCurrency(row.quoteTotal),
        formatCurrency(row.invoiceTotal),
        formatCurrency(row.amountPaid),
        formatCurrency(row.outstandingBalance),
      ].join(',')
    );
  }

  const totals = rows.reduce(
    (acc, row) => ({
      quoteTotal: acc.quoteTotal + row.quoteTotal,
      invoiceTotal: acc.invoiceTotal + row.invoiceTotal,
      amountPaid: acc.amountPaid + row.amountPaid,
      outstandingBalance: acc.outstandingBalance + row.outstandingBalance,
    }),
    { quoteTotal: 0, invoiceTotal: 0, amountPaid: 0, outstandingBalance: 0 }
  );

  lines.push(
    [
      'TOTAL',
      '',
      '',
      formatCurrency(totals.quoteTotal),
      formatCurrency(totals.invoiceTotal),
      formatCurrency(totals.amountPaid),
      formatCurrency(totals.outstandingBalance),
    ].join(',')
  );

  return lines.join('\n');
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportProjectsReport(projects: Project[]): Promise<void> {
  if (projects.length === 0) {
    throw new Error('No projects to export');
  }

  const projectIds = projects.map(p => p.id);

  const [quotesRes, invoicesRes] = await Promise.all([
    supabase
      .from('quotes')
      .select('project_id, total, status')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('project_id, total, amount_paid, status')
      .in('project_id', projectIds)
      .neq('status', 'cancelled'),
  ]);

  if (quotesRes.error) throw quotesRes.error;
  if (invoicesRes.error) throw invoicesRes.error;

  const quotes = quotesRes.data || [];
  const invoices = invoicesRes.data || [];

  const rows: ProjectReportRow[] = projects.map(project => {
    const projectQuotes = quotes.filter(q => q.project_id === project.id);
    const activeQuote =
      projectQuotes.find(q => q.status !== 'declined' && q.status !== 'revised') ||
      projectQuotes[0];
    const quoteTotal = activeQuote?.total ?? 0;

    const projectInvoices = invoices.filter(i => i.project_id === project.id);
    const invoiceTotal = projectInvoices.reduce((sum, i) => sum + (i.total ?? 0), 0);
    const amountPaid = projectInvoices.reduce((sum, i) => sum + (i.amount_paid ?? 0), 0);
    const outstandingBalance = invoiceTotal - amountPaid;

    return {
      projectName: project.name,
      client: project.clientName,
      status: STATUS_LABELS[project.status],
      quoteTotal,
      invoiceTotal,
      amountPaid,
      outstandingBalance,
    };
  });

  const csv = buildCSV(rows);
  const date = format(new Date(), 'yyyy-MM-dd');
  downloadCSV(csv, `jobs-report-${date}.csv`);
}
