import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, ScopeItem, ChangeRequest, QuoteLineItem } from '@/types/project';
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
  tradeWebsite?: string;
  abn?: string;
  registeredAddress?: string;
  logoBase64?: string;
  logoNaturalW?: number;
  logoNaturalH?: number;
}

interface LoadedLogo {
  base64: string;
  naturalW: number;
  naturalH: number;
}

async function loadLogoForPDF(url: string): Promise<LoadedLogo | null> {
  try {
    let base64 = url;

    // If it's not already a data URL, fetch and convert
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

export function generateQuotePDF(
  quote: Quote,
  project: ProjectInfo,
  scopeItems: ScopeItem[],
  changeRequests: ChangeRequest[] = [],
  quoteLineItems: QuoteLineItem[] = []
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // Colors - Professional dark text
  const textColor: [number, number, number] = [33, 33, 33];
  const mutedColor: [number, number, number] = [100, 100, 100];
  const lineColor: [number, number, number] = [200, 200, 200];

  // Title - Top Left
  doc.setTextColor(...textColor);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTE', margin, yPos + 8);

  // Logo or Business Name - Top Right
  let rightColY = yPos;
  if (project.logoBase64) {
    try {
      const logoMaxW = 55;
      const logoMaxH = 25;
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
      doc.addImage(project.logoBase64, pageWidth - margin - renderW, rightColY - 2, renderW, renderH);
      rightColY += renderH + 3;
    } catch {
      // fallback to text if image fails
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      if (project.tradeBusinessName) {
        doc.setTextColor(...textColor);
        doc.text(project.tradeBusinessName, pageWidth - margin, rightColY, { align: 'right' });
        rightColY += 6;
      }
    }
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    if (project.tradeBusinessName) {
      doc.setTextColor(...textColor);
      doc.text(project.tradeBusinessName, pageWidth - margin, rightColY, { align: 'right' });
      rightColY += 6;
    }
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  if (project.tradeAddress) {
    doc.text(project.tradeAddress, pageWidth - margin, rightColY, { align: 'right' });
    rightColY += 4;
  }
  if (project.tradePhone) {
    doc.text(`Ph: ${project.tradePhone}`, pageWidth - margin, rightColY, { align: 'right' });
    rightColY += 4;
  }
  if (project.tradeWebsite) {
    doc.text(project.tradeWebsite, pageWidth - margin, rightColY, { align: 'right' });
  }

  // Push yPos below the tallest header element (logo block or title)
  yPos = Math.max(45, rightColY + 6);

  // Two column section (client details + quote meta)
  const col1X = margin;
  const col2X = pageWidth / 2;

  // Column 1: Client details
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(project.clientName, col1X, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  if (project.clientAddress) {
    const addressLines = doc.splitTextToSize(project.clientAddress, 80);
    doc.text(addressLines, col1X, yPos + 5);
  }

  // Column 2: Quote details
  let col2Y = yPos;
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  
  const createdDate = quote.createdAt instanceof Date ? quote.createdAt : new Date(quote.createdAt);
  doc.text('Date', col2X, col2Y);
  doc.setTextColor(...textColor);
  doc.text(format(createdDate, 'd MMM yyyy'), col2X + 35, col2Y);
  
  col2Y += 5;
  doc.setTextColor(...mutedColor);
  doc.text('Quote Number', col2X, col2Y);
  doc.setTextColor(...textColor);
  doc.text(quote.quoteNumber, col2X + 35, col2Y);
  
  if (project.abn) {
    col2Y += 5;
    doc.setTextColor(...mutedColor);
    doc.text('ABN', col2X, col2Y);
    doc.setTextColor(...textColor);
    doc.text(project.abn, col2X + 35, col2Y);
  }

  yPos = Math.max(75, rightColY + 15);

  // Horizontal line
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 10;

  // Combine all items into one table
  const allItems: { description: string; details?: string; quantity: number; unitPrice: number; gst: string; amount: number }[] = [];

  // Included Items
  const includedItems = scopeItems.filter(item => item.category === 'included');
  includedItems.forEach(item => {
    allItems.push({
      description: item.title,
      details: item.description,
      quantity: 1,
      unitPrice: item.cost || 0,
      gst: '10%',
      amount: item.cost || 0
    });
  });

  // Quote Line Items
  quoteLineItems.forEach(item => {
    allItems.push({
      description: item.title,
      details: item.description,
      quantity: 1,
      unitPrice: item.cost,
      gst: '10%',
      amount: item.cost
    });
  });

  // Approved Changes
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');
  approvedChanges.forEach(change => {
    allItems.push({
      description: `Variation: ${change.title}`,
      details: change.description,
      quantity: 1,
      unitPrice: change.costImpact,
      gst: '10%',
      amount: change.costImpact
    });
  });

  // Main items table
  if (allItems.length > 0) {
    const tableData = allItems.map(item => {
      let descriptionText = item.description;
      if (item.details) {
        descriptionText += `\n${item.details}`;
      }
      return [
        descriptionText,
        item.quantity.toFixed(2),
        item.unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 }),
        item.gst,
        item.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })
      ];
    });

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
      didDrawPage: (data) => {
        // Draw header underline
        doc.setDrawColor(...lineColor);
        doc.setLineWidth(0.5);
        const headerY = data.table.head?.[0]?.cells?.[0]?.y ?? 0;
        if (headerY > 0) {
          doc.line(margin, headerY + 8, pageWidth - margin, headerY + 8);
        }
      },
      didParseCell: (data) => {
        // Add underline under header row
        if (data.section === 'head') {
          data.cell.styles.lineWidth = { bottom: 0.5 };
          data.cell.styles.lineColor = lineColor;
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  // Exclusions section
  const excludedItems = scopeItems.filter(item => item.category === 'excluded');
  if (excludedItems.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 10;
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
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
  }

  // Assumptions section
  const assumptionItems = scopeItems.filter(item => item.category === 'assumption');
  if (assumptionItems.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 5;
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
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
  }

  // Totals Section - Right aligned
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 15;
  const totalsX = pageWidth - margin - 60;
  const totalsValueX = pageWidth - margin;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('Subtotal', totalsX, yPos, { align: 'right' });
  doc.setTextColor(...textColor);
  doc.text(`$${quote.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, totalsValueX, yPos, { align: 'right' });

  yPos += 7;
  doc.setTextColor(...mutedColor);
  doc.text('TOTAL GST 10%', totalsX, yPos, { align: 'right' });
  doc.setTextColor(...textColor);
  doc.text(`$${quote.taxAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, totalsValueX, yPos, { align: 'right' });

  yPos += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...textColor);
  doc.text('TOTAL AUD', totalsX, yPos, { align: 'right' });
  doc.text(`$${quote.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, totalsValueX, yPos, { align: 'right' });

  // Notes
  if (quote.notes) {
    yPos += 20;
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Notes', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    const notesLines = doc.splitTextToSize(quote.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 4 + 5;
  }

  // Terms & Conditions
  if (quote.terms) {
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
    const termsLines = doc.splitTextToSize(quote.terms, pageWidth - margin * 2);
    doc.text(termsLines, margin, yPos);
    yPos += termsLines.length * 4;
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

export async function downloadQuotePDF(
  quote: Quote,
  project: ProjectInfo,
  scopeItems: ScopeItem[],
  changeRequests: ChangeRequest[] = [],
  quoteLineItems: QuoteLineItem[] = [],
  logoUrl?: string
): Promise<void> {
  try {
    let projectWithLogo: ProjectInfo = project;
    if (logoUrl) {
      const loaded = await loadLogoForPDF(logoUrl);
      if (loaded) {
        projectWithLogo = {
          ...project,
          logoBase64: loaded.base64,
          logoNaturalW: loaded.naturalW,
          logoNaturalH: loaded.naturalH,
        };
      }
    }
    const doc = generateQuotePDF(quote, projectWithLogo, scopeItems, changeRequests, quoteLineItems);
    doc.save(`${quote.quoteNumber}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}
