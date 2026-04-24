import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types/project';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

function generateReportPDF(rows: ProjectReportRow[], fromDate?: Date, toDate?: Date): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const textColor: [number, number, number] = [33, 33, 33];
  const mutedColor: [number, number, number] = [100, 100, 100];
  const headerFill: [number, number, number] = [245, 245, 245];

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('Jobs Report', margin, 20);

  // Date range subtitle
  let subtitle = '';
  if (fromDate && toDate) {
    subtitle = `${format(fromDate, 'd MMM yyyy')} – ${format(toDate, 'd MMM yyyy')}`;
  } else if (fromDate) {
    subtitle = `From ${format(fromDate, 'd MMM yyyy')}`;
  } else if (toDate) {
    subtitle = `To ${format(toDate, 'd MMM yyyy')}`;
  } else {
    subtitle = format(new Date(), 'd MMM yyyy');
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text(subtitle, margin, 28);

  // Totals row
  const totals = rows.reduce(
    (acc, row) => ({
      quoteTotal: acc.quoteTotal + row.quoteTotal,
      invoiceTotal: acc.invoiceTotal + row.invoiceTotal,
      amountPaid: acc.amountPaid + row.amountPaid,
      outstandingBalance: acc.outstandingBalance + row.outstandingBalance,
    }),
    { quoteTotal: 0, invoiceTotal: 0, amountPaid: 0, outstandingBalance: 0 }
  );

  const tableData = rows.map(row => [
    row.projectName,
    row.client,
    row.status,
    `$${formatCurrency(row.quoteTotal)}`,
    `$${formatCurrency(row.invoiceTotal)}`,
    `$${formatCurrency(row.amountPaid)}`,
    `$${formatCurrency(row.outstandingBalance)}`,
  ]);

  // Totals row appended
  tableData.push([
    'TOTAL',
    '',
    '',
    `$${formatCurrency(totals.quoteTotal)}`,
    `$${formatCurrency(totals.invoiceTotal)}`,
    `$${formatCurrency(totals.amountPaid)}`,
    `$${formatCurrency(totals.outstandingBalance)}`,
  ]);

  autoTable(doc, {
    startY: 34,
    head: [['Project Name', 'Client', 'Status', 'Quote Total', 'Invoice Total', 'Amount Paid', 'Outstanding']],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: headerFill,
      textColor: textColor,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 30, halign: 'right' },
    },
    didParseCell: (data) => {
      // Bold the totals row
      if (data.row.index === tableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = headerFill;
      }
    },
  });

  // Page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  return doc;
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

async function buildReportRows(
  projects: Project[],
  fromDate?: Date,
  toDate?: Date,
): Promise<{ rows: ProjectReportRow[]; filtered: Project[] }> {
  if (projects.length === 0) {
    throw new Error('No projects to export');
  }

  let filtered = projects;
  if (fromDate || toDate) {
    const from = fromDate
      ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0)
      : null;
    const to = toDate
      ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999)
      : null;
    filtered = projects.filter(p => {
      const createdAt = new Date(p.createdAt);
      const updatedAt = new Date(p.updatedAt);
      const inRange = (d: Date) =>
        (!from || d >= from) && (!to || d <= to);
      return inRange(createdAt) || inRange(updatedAt);
    });
  }

  if (filtered.length === 0) {
    throw new Error('No projects found in the selected date range');
  }

  const projectIds = filtered.map(p => p.id);

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

  const rows: ProjectReportRow[] = filtered.map(project => {
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

  return { rows, filtered };
}

export async function exportProjectsReport(
  projects: Project[],
  fromDate?: Date,
  toDate?: Date,
): Promise<void> {
  const { rows } = await buildReportRows(projects, fromDate, toDate);
  const csv = buildCSV(rows);
  let filename: string;
  if (fromDate && toDate) {
    filename = `jobs-report-${format(fromDate, 'yyyy-MM-dd')}-to-${format(toDate, 'yyyy-MM-dd')}.csv`;
  } else if (fromDate) {
    filename = `jobs-report-from-${format(fromDate, 'yyyy-MM-dd')}.csv`;
  } else if (toDate) {
    filename = `jobs-report-to-${format(toDate, 'yyyy-MM-dd')}.csv`;
  } else {
    filename = `jobs-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  }
  downloadCSV(csv, filename);
}

export async function exportProjectsReportPDF(
  projects: Project[],
  fromDate?: Date,
  toDate?: Date,
): Promise<void> {
  const { rows } = await buildReportRows(projects, fromDate, toDate);
  const doc = generateReportPDF(rows, fromDate, toDate);
  let filename: string;
  if (fromDate && toDate) {
    filename = `jobs-report-${format(fromDate, 'yyyy-MM-dd')}-to-${format(toDate, 'yyyy-MM-dd')}.pdf`;
  } else if (fromDate) {
    filename = `jobs-report-from-${format(fromDate, 'yyyy-MM-dd')}.pdf`;
  } else if (toDate) {
    filename = `jobs-report-to-${format(toDate, 'yyyy-MM-dd')}.pdf`;
  } else {
    filename = `jobs-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  }
  doc.save(filename);
}
