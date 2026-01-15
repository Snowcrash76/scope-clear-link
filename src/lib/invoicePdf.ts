import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice } from '@/types/project';
import { format } from 'date-fns';

export interface ProjectInfo {
  name: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  tradeBusinessName?: string;
  tradeName?: string;
  tradeAddress?: string;
  tradePhone?: string;
  abn?: string;
  registeredAddress?: string;
  bsb?: string;
  accountNumber?: string;
  accountName?: string;
}

export function generateInvoicePDF(
  invoice: Invoice,
  project: ProjectInfo
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // Colors - Professional dark text
  const textColor: [number, number, number] = [33, 33, 33];
  const mutedColor: [number, number, number] = [100, 100, 100];
  const lineColor: [number, number, number] = [200, 200, 200];
  const successColor: [number, number, number] = [16, 185, 129];

  // Title - Top Left
  doc.setTextColor(...textColor);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', margin, yPos + 8);

  // Business Name - Top Right
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  if (project.tradeBusinessName) {
    doc.text(project.tradeBusinessName, pageWidth - margin, yPos, { align: 'right' });
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  if (project.tradeAddress) {
    yPos += 5;
    doc.text(project.tradeAddress, pageWidth - margin, yPos, { align: 'right' });
  }
  if (project.tradePhone) {
    yPos += 4;
    doc.text(`Ph: ${project.tradePhone}`, pageWidth - margin, yPos, { align: 'right' });
  }

  yPos = 45;

  // Three column section
  const col1X = margin;
  const col2X = pageWidth / 3 + 10;
  const col3X = (pageWidth * 2) / 3;

  // Column 1: Client details
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(project.clientName, col1X, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  if (project.clientAddress) {
    const addressLines = doc.splitTextToSize(project.clientAddress, 55);
    doc.text(addressLines, col1X, yPos + 5);
  }

  // Column 2: Invoice details
  let col2Y = yPos;
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  
  const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
  doc.text('Invoice Date', col2X, col2Y);
  doc.setTextColor(...textColor);
  doc.text(format(createdDate, 'd MMM yyyy'), col2X + 30, col2Y);
  
  col2Y += 5;
  doc.setTextColor(...mutedColor);
  doc.text('Invoice Number', col2X, col2Y);
  doc.setTextColor(...textColor);
  doc.text(invoice.invoiceNumber, col2X + 30, col2Y);
  
  col2Y += 5;
  doc.setTextColor(...mutedColor);
  doc.text('Reference', col2X, col2Y);
  doc.setTextColor(...textColor);
  doc.text(project.name, col2X + 30, col2Y);

  if (project.abn) {
    col2Y += 5;
    doc.setTextColor(...mutedColor);
    doc.text('ABN', col2X, col2Y);
    doc.setTextColor(...textColor);
    doc.text(project.abn, col2X + 30, col2Y);
  }

  // Column 3: Business contact
  let col3Y = yPos;
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  if (project.tradeBusinessName) {
    doc.text(project.tradeBusinessName, col3X, col3Y);
    col3Y += 5;
  }
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  if (project.tradeAddress) {
    const addrLines = doc.splitTextToSize(project.tradeAddress, 55);
    doc.text(addrLines, col3X, col3Y);
    col3Y += addrLines.length * 4;
  }
  if (project.tradePhone) {
    doc.text(`Ph: ${project.tradePhone}`, col3X, col3Y);
  }

  yPos = 80;

  // Horizontal line
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 10;

  // Line Items Table
  if (invoice.lineItems.length > 0) {
    const tableData = invoice.lineItems.map(item => [
      item.description,
      item.quantity.toFixed(2),
      item.unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 }),
      '10%',
      item.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Quantity', 'Unit Price', 'GST', 'Amount AUD']],
      body: tableData,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [255, 255, 255],
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
        1: { cellWidth: 22, halign: 'right' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.lineWidth = { bottom: 0.5 };
          data.cell.styles.lineColor = lineColor;
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Totals Section - Right aligned
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 10;
  const totalsX = pageWidth - margin - 60;
  const totalsValueX = pageWidth - margin;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Subtotal', totalsX, yPos, { align: 'right' });
  doc.setTextColor(...textColor);
  doc.text(`$${invoice.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, totalsValueX, yPos, { align: 'right' });

  yPos += 7;
  doc.setTextColor(...mutedColor);
  doc.text('TOTAL GST 10%', totalsX, yPos, { align: 'right' });
  doc.setTextColor(...textColor);
  doc.text(`$${invoice.taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, totalsValueX, yPos, { align: 'right' });

  yPos += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...textColor);
  doc.text('TOTAL AUD', totalsX, yPos, { align: 'right' });
  doc.text(`$${invoice.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, totalsValueX, yPos, { align: 'right' });

  // Payment Details Section
  yPos += 25;
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Due date
  if (invoice.dueDate) {
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text('Due Date', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(format(dueDate, 'd MMM yyyy'), margin + 40, yPos);
    yPos += 8;
  }

  // Bank details
  if (project.accountName || project.bsb || project.accountNumber) {
    if (project.accountName) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textColor);
      doc.text(project.accountName, margin, yPos);
      yPos += 6;
    }
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    if (project.bsb) {
      doc.setTextColor(...mutedColor);
      doc.text('BSB:', margin, yPos);
      doc.setTextColor(...textColor);
      doc.text(project.bsb, margin + 30, yPos);
      yPos += 5;
    }
    
    if (project.accountNumber) {
      doc.setTextColor(...mutedColor);
      doc.text('Account Number:', margin, yPos);
      doc.setTextColor(...textColor);
      doc.text(project.accountNumber, margin + 30, yPos);
      yPos += 5;
    }
  }

  // Notes / Payment Instructions
  if (invoice.notes) {
    yPos += 10;
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Payment Instructions', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 4 + 5;
  }

  // Terms & Conditions
  if (invoice.terms) {
    yPos += 5;
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
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
    doc.setTextColor(...successColor);
    doc.setFontSize(48);
    doc.setFont('helvetica', 'bold');
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
    
    const centerX = pageWidth / 2;
    const centerY = 140;
    doc.text('PAID', centerX, centerY, { 
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
  }

  // Footer with ABN
  const pageHeight = doc.internal.pageSize.getHeight();
  if (project.abn || project.registeredAddress) {
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.setFont('helvetica', 'normal');
    let footerText = '';
    if (project.abn) {
      footerText += `ABN: ${project.abn}`;
    }
    if (project.registeredAddress) {
      footerText += footerText ? `. Registered Office: ${project.registeredAddress}` : `Registered Office: ${project.registeredAddress}`;
    }
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
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
