import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice } from '@/types/project';
import { format } from 'date-fns';

function stripHtml(html: string): string {
  if (!html) return '';
  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!isHtml) return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const lines: string[] = [];
  let currentLine = '';
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      currentLine += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName.toLowerCase();
      if (['p', 'li', 'br', 'h1', 'h2', 'h3'].includes(tag)) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = '';
        if (tag === 'li') currentLine = '• ';
      }
    }
    node = walker.nextNode();
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.join('\n');
}

export interface ProjectInfo {
  name: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  tradeBusinessName?: string;
  tradeName?: string;
  tradeAddress?: string;
  tradePhone?: string;
  tradeWebsite?: string;
  abn?: string;
  registeredAddress?: string;
  bsb?: string;
  accountNumber?: string;
  accountName?: string;
  logoUrl?: string;
  logoBase64?: string;
  logoNaturalW?: number;
  logoNaturalH?: number;
  paymentInstructions?: string;
  defaultTermsText?: string;
}

interface LoadedLogo {
  base64: string;
  naturalW: number;
  naturalH: number;
}

async function loadLogoForPDF(url: string): Promise<LoadedLogo | null> {
  try {
    let base64 = url;
    if (!url.startsWith('data:')) {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    const { naturalW, naturalH } = await new Promise<{ naturalW: number; naturalH: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ naturalW: img.naturalWidth, naturalH: img.naturalHeight });
      img.onerror = () => resolve({ naturalW: 0, naturalH: 0 });
      img.src = base64;
    });
    return { base64, naturalW, naturalH };
  } catch {
    return null;
  }
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

  // Logo — Top Right only (no business text here)
  let logoBottomY = yPos;
  let logoLeftX = pageWidth - margin - 65; // fallback if no logo or on error
  let logoMidX = pageWidth - margin - 32.5; // fallback: centre of fallback logo area
  let logoRenderW = 65; // fallback width
  if (project.logoBase64) {
    try {
      const logoMaxW = 70;
      const logoMaxH = 35;
      let renderW = logoMaxW;
      let renderH = logoMaxH;
      if (project.logoNaturalW && project.logoNaturalH && project.logoNaturalH > 0) {
        const aspect = project.logoNaturalW / project.logoNaturalH;
        renderH = renderW / aspect;
        if (renderH > logoMaxH) {
          renderH = logoMaxH;
          renderW = renderH * aspect;
        }
      }
      logoLeftX = pageWidth - margin - renderW;
      logoMidX = logoLeftX + renderW / 2;
      logoRenderW = renderW;
      doc.addImage(project.logoBase64, logoLeftX, yPos - 2, renderW, renderH);
      logoBottomY = yPos + renderH;
    } catch {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textColor);
      if (project.tradeBusinessName) {
        doc.text(project.tradeBusinessName, pageWidth - margin, yPos, { align: 'right' });
        logoBottomY = yPos + 8;
      }
    }
  } else if (project.tradeBusinessName) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(project.tradeBusinessName, pageWidth - margin, yPos, { align: 'right' });
    logoBottomY = yPos + 8;
  }

  // Info section starts just below the logo
  yPos = logoBottomY + 4;

  // Three-column info section — all columns start at the same infoStartY
  const col1X = margin;
  const col2X = 75;
  const col3X = logoMidX; // centre point for centred text
  const col3W = logoRenderW; // wrap width = logo width
  const infoStartY = yPos;

  // Column 1: Client details
  let col1Y = infoStartY;
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(project.clientName, col1X, col1Y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  if (project.clientAddress) {
    const addressLines = doc.splitTextToSize(project.clientAddress, 55);
    doc.text(addressLines, col1X, col1Y + 5);
    col1Y += 5 + addressLines.length * 4.2;
  }

  // Column 2: Invoice Date, Number, Reference, ABN — label stacked above value
  let col2Y = infoStartY;
  const createdDate = invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedColor);
  doc.text('Invoice Date', col2X, col2Y);
  col2Y += 4;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text(format(createdDate, 'd MMM yyyy'), col2X, col2Y);
  col2Y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedColor);
  doc.text('Invoice Number', col2X, col2Y);
  col2Y += 4;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text(invoice.invoiceNumber, col2X, col2Y);
  col2Y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedColor);
  doc.text('Reference', col2X, col2Y);
  col2Y += 4;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text(project.name, col2X, col2Y);
  col2Y += 8;

  if (project.abn) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedColor);
    doc.text('ABN', col2X, col2Y);
    col2Y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(project.abn, col2X, col2Y);
    col2Y += 4;
  }

  // Column 3: Business contact details — centred under the logo
  let col3Y = infoStartY;
  if (project.tradeBusinessName) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(project.tradeBusinessName, col3X, col3Y, { align: 'center' });
    col3Y += 5;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  if (project.tradeAddress) {
    const addrLines = doc.splitTextToSize(project.tradeAddress, col3W);
    doc.text(addrLines, col3X, col3Y, { align: 'center' });
    col3Y += addrLines.length * 4.2;
  }
  if (project.tradePhone) {
    doc.text(`Ph: ${project.tradePhone}`, col3X, col3Y, { align: 'center' });
    col3Y += 4.2;
  }
  if (project.tradeWebsite) {
    doc.text(project.tradeWebsite, col3X, col3Y, { align: 'center' });
    col3Y += 4.2;
  }

  yPos = Math.max(col1Y, col2Y, col3Y) + 8;

  // Horizontal line
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 10;

  // Line Items Table
  if (invoice.lineItems.length > 0) {
    const tableData = invoice.lineItems.map(item => [
      stripHtml(item.description),
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
  yPos += 12;
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

  // Notes / Payment Instructions (use invoice.notes, fall back to project default)
  const paymentText = invoice.notes || project.paymentInstructions || '';
  if (paymentText) {
    yPos += 5;
    if (yPos > 255) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Payment Instructions', margin, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    const notesLines = doc.splitTextToSize(stripHtml(paymentText), pageWidth - margin * 2);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 4;
  }

  // Terms & Conditions (use invoice.terms, fall back to project default)
  const termsText = invoice.terms || project.defaultTermsText || '';
  if (termsText) {
    yPos += 5;
    if (yPos > 265) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Terms & Conditions', margin, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    const termsLines = doc.splitTextToSize(stripHtml(termsText), pageWidth - margin * 2);
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

export async function downloadInvoicePDF(
  invoice: Invoice,
  project: ProjectInfo
): Promise<void> {
  try {
    let enriched = { ...project };
    if (project.logoUrl) {
      const loaded = await loadLogoForPDF(project.logoUrl);
      if (loaded) {
        enriched = {
          ...enriched,
          logoBase64: loaded.base64,
          logoNaturalW: loaded.naturalW,
          logoNaturalH: loaded.naturalH,
        };
      }
    }
    const doc = generateInvoicePDF(invoice, enriched);
    doc.save(`${invoice.invoiceNumber}.pdf`);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw error;
  }
}
