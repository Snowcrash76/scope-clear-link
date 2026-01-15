import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice } from '@/types/project';
import { format } from 'date-fns';

interface ProjectInfo {
  name: string;
  clientName: string;
  clientEmail: string;
  tradeBusinessName?: string;
  tradeName?: string;
}

export function generateInvoicePDF(
  invoice: Invoice,
  project: ProjectInfo
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Colors
  const primaryColor: [number, number, number] = [41, 98, 255];
  const textColor: [number, number, number] = [51, 51, 51];
  const mutedColor: [number, number, number] = [107, 114, 128];
  const successColor: [number, number, number] = [16, 185, 129];
  const warningColor: [number, number, number] = [245, 158, 11];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', margin, 28);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoiceNumber, pageWidth - margin, 24, { align: 'right' });
  doc.setFontSize(10);
  
  // Handle date formatting safely
  const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
  doc.text(`Issued: ${format(createdDate, 'dd MMM yyyy')}`, pageWidth - margin, 32, { align: 'right' });

  yPos = 55;

  // Business & Client Info
  doc.setTextColor(...textColor);
  doc.setFontSize(10);

  // From section
  doc.setFont('helvetica', 'bold');
  doc.text('FROM', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  yPos += 6;
  if (project.tradeBusinessName) {
    doc.text(project.tradeBusinessName, margin, yPos);
    yPos += 5;
  }
  if (project.tradeName) {
    doc.text(project.tradeName, margin, yPos);
    yPos += 5;
  }

  // To section (on the right)
  let toYPos = 55;
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', pageWidth / 2 + 10, toYPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  toYPos += 6;
  doc.text(project.clientName, pageWidth / 2 + 10, toYPos);
  toYPos += 5;
  doc.text(project.clientEmail, pageWidth / 2 + 10, toYPos);

  // Project name and invoice details
  yPos = Math.max(yPos, toYPos) + 10;
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Project: ${project.name}`, margin, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Invoice type badge
  doc.setTextColor(...mutedColor);
  doc.text(`Type: ${invoice.type === 'staged' ? 'Progress Payment' : 'Final Invoice'}`, margin, yPos);
  
  // Due date
  if (invoice.dueDate) {
    yPos += 6;
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate);
    doc.text(`Due Date: ${format(dueDate, 'dd MMM yyyy')}`, margin, yPos);
  }

  // Status badge (on the right side)
  const statusY = yPos - 6;
  const statusColors: Record<string, [number, number, number]> = {
    draft: mutedColor,
    sent: primaryColor,
    paid: successColor,
    overdue: [239, 68, 68],
    cancelled: mutedColor,
  };
  const statusLabels: Record<string, string> = {
    draft: 'DRAFT',
    sent: 'PENDING',
    paid: 'PAID',
    overdue: 'OVERDUE',
    cancelled: 'CANCELLED',
  };
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(statusColors[invoice.status] || mutedColor));
  doc.text(statusLabels[invoice.status] || invoice.status.toUpperCase(), pageWidth - margin, statusY, { align: 'right' });

  yPos += 15;

  // Line Items Table
  if (invoice.lineItems.length > 0) {
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Line Items', margin, yPos);
    yPos += 5;

    const tableData = invoice.lineItems.map(item => [
      item.description,
      item.quantity.toString(),
      `$${item.unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
      `$${item.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: textColor,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Totals Section
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  // Draw totals box
  const totalsBoxY = yPos;
  const totalsBoxHeight = invoice.status === 'paid' ? 62 : 50;
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(pageWidth - margin - 90, totalsBoxY, 90, totalsBoxHeight, 3, 3, 'FD');

  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text('Subtotal:', pageWidth - margin - 85, totalsBoxY + 12);
  doc.setTextColor(...textColor);
  doc.text(`$${invoice.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, totalsBoxY + 12, { align: 'right' });

  doc.setTextColor(...mutedColor);
  doc.text(`Tax (${invoice.taxRate}%):`, pageWidth - margin - 85, totalsBoxY + 24);
  doc.setTextColor(...textColor);
  doc.text(`$${invoice.taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, totalsBoxY + 24, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('TOTAL DUE:', pageWidth - margin - 85, totalsBoxY + 40);
  doc.text(`$${invoice.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, totalsBoxY + 40, { align: 'right' });

  // Amount paid (if applicable)
  if (invoice.status === 'paid' && invoice.amountPaid > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...successColor);
    doc.text('Amount Paid:', pageWidth - margin - 85, totalsBoxY + 52);
    doc.text(`$${invoice.amountPaid.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, totalsBoxY + 52, { align: 'right' });
  }

  yPos = totalsBoxY + totalsBoxHeight + 15;

  // Notes
  if (invoice.notes) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Payment Instructions', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 4 + 10;
  }

  // Terms & Conditions
  if (invoice.terms) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Terms & Conditions', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    const termsLines = doc.splitTextToSize(invoice.terms, pageWidth - margin * 2);
    doc.text(termsLines, margin, yPos);
  }

  // Paid stamp for paid invoices
  if (invoice.status === 'paid') {
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(48);
    doc.setFont('helvetica', 'bold');
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
    
    // Rotate text
    const centerX = pageWidth / 2;
    const centerY = 140;
    doc.text('PAID', centerX, centerY, { 
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
  }

  return doc;
}

export function downloadInvoicePDF(
  invoice: Invoice,
  project: ProjectInfo
): void {
  try {
    const doc = generateInvoicePDF(invoice, project);
    doc.save(`${invoice.invoiceNumber}.pdf`);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw error;
  }
}
