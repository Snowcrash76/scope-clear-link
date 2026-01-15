import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, ScopeItem, ChangeRequest, QuoteLineItem } from '@/types/project';
import { format } from 'date-fns';

interface ProjectInfo {
  name: string;
  clientName: string;
  clientEmail: string;
  tradeBusinessName?: string;
  tradeName?: string;
}

export function generateQuotePDF(
  quote: Quote,
  project: ProjectInfo,
  scopeItems: ScopeItem[],
  changeRequests: ChangeRequest[] = [],
  quoteLineItems: QuoteLineItem[] = []
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Colors
  const primaryColor: [number, number, number] = [41, 98, 255];
  const textColor: [number, number, number] = [51, 51, 51];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTE', margin, 28);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.quoteNumber, pageWidth - margin, 24, { align: 'right' });
  doc.setFontSize(10);
  
  // Handle date formatting safely
  const createdDate = quote.createdAt instanceof Date ? quote.createdAt : new Date(quote.createdAt);
  doc.text(`Created: ${format(createdDate, 'dd MMM yyyy')}`, pageWidth - margin, 32, { align: 'right' });

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
  doc.text('TO', pageWidth / 2 + 10, toYPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  toYPos += 6;
  doc.text(project.clientName, pageWidth / 2 + 10, toYPos);
  toYPos += 5;
  doc.text(project.clientEmail, pageWidth / 2 + 10, toYPos);

  // Project name
  yPos = Math.max(yPos, toYPos) + 10;
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Project: ${project.name}`, margin, yPos);
  
  if (quote.validUntil) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...mutedColor);
    yPos += 6;
    const validDate = quote.validUntil instanceof Date ? quote.validUntil : new Date(quote.validUntil);
    doc.text(`Valid Until: ${format(validDate, 'dd MMM yyyy')}`, margin, yPos);
  }

  yPos += 15;

  // Included Items Table
  const includedItems = scopeItems.filter(item => item.category === 'included');
  if (includedItems.length > 0) {
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Included Items', margin, yPos);
    yPos += 5;

    const tableData = includedItems.map(item => [
      item.title,
      item.description || '',
      `$${(item.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Description', 'Amount']],
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
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Custom Quote Line Items
  if (quoteLineItems.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Additional Items', margin, yPos);
    yPos += 5;

    const customData = quoteLineItems.map(item => [
      item.title,
      item.description || '',
      `$${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Description', 'Amount']],
      body: customData,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: textColor,
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Approved Changes
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');
  if (approvedChanges.length > 0) {
    // Check if we need a new page
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Approved Changes', margin, yPos);
    yPos += 5;

    const changeData = approvedChanges.map(change => [
      change.title,
      change.description,
      `${change.costImpact >= 0 ? '+' : ''}$${change.costImpact.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Change', 'Description', 'Impact']],
      body: changeData,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: textColor,
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Exclusions
  const excludedItems = scopeItems.filter(item => item.category === 'excluded');
  if (excludedItems.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Exclusions', margin, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);

    excludedItems.forEach(item => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textColor);
      doc.text(`• ${item.title}`, margin, yPos);
      if (item.description) {
        yPos += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedColor);
        const lines = doc.splitTextToSize(item.description, pageWidth - margin * 2 - 5);
        doc.text(lines, margin + 5, yPos);
        yPos += lines.length * 4;
      }
      yPos += 5;
    });
    yPos += 5;
  }

  // Assumptions
  const assumptionItems = scopeItems.filter(item => item.category === 'assumption');
  if (assumptionItems.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Assumptions', margin, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    assumptionItems.forEach(item => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textColor);
      doc.text(`• ${item.title}`, margin, yPos);
      if (item.description) {
        yPos += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedColor);
        const lines = doc.splitTextToSize(item.description, pageWidth - margin * 2 - 5);
        doc.text(lines, margin + 5, yPos);
        yPos += lines.length * 4;
      }
      yPos += 5;
    });
    yPos += 5;
  }

  // Totals Section
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  // Draw totals box
  const totalsBoxY = yPos;
  const totalsBoxHeight = 50;
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(pageWidth - margin - 90, totalsBoxY, 90, totalsBoxHeight, 3, 3, 'FD');

  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text('Subtotal:', pageWidth - margin - 85, totalsBoxY + 12);
  doc.setTextColor(...textColor);
  doc.text(`$${quote.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, totalsBoxY + 12, { align: 'right' });

  doc.setTextColor(...mutedColor);
  doc.text(`Tax (${quote.taxRate}%):`, pageWidth - margin - 85, totalsBoxY + 24);
  doc.setTextColor(...textColor);
  doc.text(`$${quote.taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, totalsBoxY + 24, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('TOTAL:', pageWidth - margin - 85, totalsBoxY + 40);
  doc.text(`$${quote.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, totalsBoxY + 40, { align: 'right' });

  yPos = totalsBoxY + totalsBoxHeight + 15;

  // Notes
  if (quote.notes) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Notes', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    const notesLines = doc.splitTextToSize(quote.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 4 + 10;
  }

  // Terms & Conditions
  if (quote.terms) {
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
    const termsLines = doc.splitTextToSize(quote.terms, pageWidth - margin * 2);
    doc.text(termsLines, margin, yPos);
  }

  return doc;
}

export function downloadQuotePDF(
  quote: Quote,
  project: ProjectInfo,
  scopeItems: ScopeItem[],
  changeRequests: ChangeRequest[] = [],
  quoteLineItems: QuoteLineItem[] = []
): void {
  try {
    console.log('Starting PDF generation...', { quote, project, scopeItems, changeRequests, quoteLineItems });
    const doc = generateQuotePDF(quote, project, scopeItems, changeRequests, quoteLineItems);
    console.log('PDF generated successfully, saving...');
    doc.save(`${quote.quoteNumber}.pdf`);
    console.log('PDF saved successfully');
  } catch (error) {
    console.error('Error generating PDF:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw error;
  }
}
