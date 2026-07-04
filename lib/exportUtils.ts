import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Company Branding ───────────────────────────────────────────────
export const COMPANY_BRAND = {
  name: 'Nexlify',
  address: '',
  phone: '',
  tin: '',
  color: { r: 23, g: 79, b: 73 }, // #174f49
  colorHex: '#174f49',
  lightBg: { r: 248, g: 250, b: 252 },
  textDark: { r: 30, g: 41, b: 59 },
  textMuted: { r: 100, g: 116, b: 139 },
  textLight: { r: 148, g: 163, b: 184 },
  border: { r: 226, g: 232, b: 240 },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) || 23,
    g: parseInt(clean.substring(2, 4), 16) || 79,
    b: parseInt(clean.substring(4, 6), 16) || 73,
  };
}

export interface BrandOverride {
  name?: string;
  address?: string;
  phone?: string;
  tin?: string;
  colorHex?: string;
  showLogo?: boolean;
  showAddress?: boolean;
  showPhone?: boolean;
  showTin?: boolean;
  footerText?: string;
}

function resolveBrand(override?: BrandOverride) {
  const colorHex = override?.colorHex || COMPANY_BRAND.colorHex;
  return {
    ...COMPANY_BRAND,
    name: override?.name || COMPANY_BRAND.name,
    address: override?.address ?? COMPANY_BRAND.address,
    phone: override?.phone ?? COMPANY_BRAND.phone,
    tin: override?.tin ?? COMPANY_BRAND.tin,
    colorHex,
    color: hexToRgb(colorHex),
    showLogo: override?.showLogo ?? true,
    showAddress: override?.showAddress ?? true,
    showPhone: override?.showPhone ?? true,
    showTin: override?.showTin ?? true,
    footerText: override?.footerText ?? '',
  };
}

// ─── Types ──────────────────────────────────────────────────────────
export interface ExportColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: any) => string;
  width?: number;
}

export interface InfoBlockRow {
  label: string;
  value: string;
  valueColor?: 'green' | 'red' | 'orange' | 'blue';
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: any[];
  filename: string;
  logo?: string | null;
  summary?: { label: string; value: string | number }[];
  filters?: { label: string; value: string }[];
  infoBlock?: {
    leftTitle?: string;
    rightTitle?: string;
    left: InfoBlockRow[];
    right: InfoBlockRow[];
  };
  totalsRows?: { label: string; value: string; bold?: boolean; accent?: boolean }[];
  watermark?: {
    text: string;
    color?: 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gray';
  };
  companyName?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyTin?: string | null;
  orientation?: 'portrait' | 'landscape';
  brand?: BrandOverride;
}

// ─── Helpers ────────────────────────────────────────────────────────
function formatCell(col: ExportColumn, row: any): string {
  const raw = row[col.key];
  if (col.format) return col.format(raw, row);
  if (raw == null || raw === '') return '—';
  if (typeof raw === 'number') return raw.toLocaleString();
  return String(raw);
}

function buildTableData(columns: ExportColumn[], data: any[]) {
  const headers = columns.map(c => c.label);
  const rows = data.map(row => columns.map(c => formatCell(c, row)));
  return { headers, rows };
}

const C = {
  green:  { r: 16,  g: 185, b: 129 },
  red:    { r: 239, g: 68,  b: 68  },
  orange: { r: 249, g: 115, b: 22  },
  blue:   { r: 59,  g: 130, b: 246 },
  purple: { r: 139, g: 92,  b: 246 },
  gray:   { r: 100, g: 116, b: 139 },
};

function valueColor(vc?: InfoBlockRow['valueColor']) {
  if (!vc) return COMPANY_BRAND.textDark;
  return (C as any)[vc] ?? COMPANY_BRAND.textDark;
}

function watermarkColor(color?: string) {
  return (C as any)[color ?? 'gray'] ?? C.gray;
}

// ─── PDF Export — Meridian template ─────────────────────────────────
export function exportToPDF(options: ExportOptions): void {
  const {
    title,
    subtitle,
    columns,
    data,
    filename,
    logo,
    filters,
    infoBlock,
    totalsRows,
    watermark,
    companyName,
    companyAddress,
    companyPhone,
    companyTin,
    orientation = 'portrait',
    brand: brandOverride,
    summary,
  } = options;

  const brand = resolveBrand({
    ...brandOverride,
    name:    companyName    ?? brandOverride?.name,
    address: companyAddress ?? brandOverride?.address,
    phone:   companyPhone   ?? brandOverride?.phone,
    tin:     companyTin     ?? brandOverride?.tin,
  });

  const { r: cr, g: cg, b: cb } = brand.color;
  const resolvedName = brand.name;
  const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

  const footerLeft = brand.footerText || [
    brand.showAddress && brand.address ? brand.address : '',
    brand.showPhone && brand.phone ? brand.phone : '',
    brand.showTin && brand.tin ? `TIN: ${brand.tin}` : '',
  ].filter(Boolean).join('  ·  ') || resolvedName;

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth  = orientation === 'landscape' ? 297 : 210;
  const pageHeight = orientation === 'landscape' ? 210 : 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // ── DARK HEADER BAND ──────────────────────────────────────────────
  const HEADER_H = 28;
  doc.setFillColor(cr, cg, cb);
  doc.rect(0, 0, pageWidth, HEADER_H, 'F');

  // Logo
  const showLogo = brand.showLogo !== false && !!logo;
  let textX = margin;
  if (showLogo) {
    try {
      let logoData = logo!;
      if (!logoData.startsWith('data:image')) logoData = `data:image/png;base64,${logoData}`;
      doc.addImage(logoData, 'PNG', margin, 5, 18, 18);
      textX = margin + 22;
    } catch { /* skip bad logo data */ }
  }

  // Company name — left side
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(resolvedName.toUpperCase(), textX, 14);

  const headerSub = [
    brand.showAddress && brand.address ? brand.address : '',
    brand.showPhone  && brand.phone   ? brand.phone   : '',
  ].filter(Boolean).join('  ·  ');
  if (headerSub) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text(headerSub, textX, 20);
  }

  // Document title — right side
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), pageWidth - margin, 17, { align: 'right' });

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(subtitle, pageWidth - margin, 23, { align: 'right' });
  }

  // ── STATUS BAR ────────────────────────────────────────────────────
  const STATUS_Y = HEADER_H;
  const STATUS_H = 14;
  doc.setFillColor(245, 247, 249);
  doc.rect(0, STATUS_Y, pageWidth, STATUS_H, 'F');

  const statusFields: { label: string; value: string }[] = [
    { label: 'GENERATED', value: today },
    { label: 'RECORDS',   value: `${data.length}` },
    ...(summary?.map(s => ({ label: String(s.label).toUpperCase(), value: String(s.value) })) || []),
  ];

  const fieldW = Math.min(58, contentWidth / statusFields.length);
  statusFields.forEach((field, idx) => {
    const fx = margin + idx * fieldW;
    if (idx > 0) {
      doc.setDrawColor(210, 215, 222);
      doc.setLineWidth(0.2);
      doc.line(fx, STATUS_Y + 3, fx, STATUS_Y + STATUS_H - 3);
    }
    const ox = idx > 0 ? 4 : 0;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(130, 140, 152);
    doc.text(field.label, fx + ox, STATUS_Y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(field.value, fx + ox, STATUS_Y + 11.5);
  });

  let y = STATUS_Y + STATUS_H;

  // ── FILTERS BAND ──────────────────────────────────────────────────
  if (filters && filters.length > 0) {
    const FILTER_H = 9;
    doc.setFillColor(245, 248, 251);
    doc.rect(0, y, pageWidth, FILTER_H, 'F');
    doc.setDrawColor(215, 225, 238);
    doc.setLineWidth(0.2);
    doc.line(0, y + FILTER_H, pageWidth, y + FILTER_H);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(cr, cg, cb);
    doc.text('FILTERS APPLIED', margin, y + 5.8);

    const filterStr = filters.map(f => `${f.label}: ${f.value}`).join('   ·   ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(55, 70, 90);
    const labelW = doc.getTextWidth('FILTERS APPLIED') + 6;
    doc.text(filterStr, margin + labelW, y + 5.8, { maxWidth: pageWidth - margin * 2 - labelW });
    y += FILTER_H;
  }

  y += 6;

  // ── INFO BLOCK (two-column) ───────────────────────────────────────
  if (infoBlock) {
    const colW = (contentWidth - 4) / 2;
    const leftX  = margin;
    const rightX = margin + colW + 4;
    const maxRows = Math.max(infoBlock.left.length, infoBlock.right.length);
    const blockH  = maxRows * 5.5 + 14;

    // Left panel
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(leftX, y, colW, blockH, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(leftX, y, colW, blockH, 1.5, 1.5, 'S');
    doc.setFillColor(cr, cg, cb);
    doc.rect(leftX, y, colW, 1.5, 'F');

    // Right panel
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(rightX, y, colW, blockH, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(rightX, y, colW, blockH, 1.5, 1.5, 'S');
    doc.setFillColor(cr, cg, cb);
    doc.rect(rightX, y, colW, 1.5, 'F');

    // Panel titles
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(cr, cg, cb);
    doc.text((infoBlock.leftTitle  || 'DETAILS').toUpperCase(),     leftX  + 4, y + 8);
    doc.text((infoBlock.rightTitle || 'INFORMATION').toUpperCase(), rightX + 4, y + 8);

    let rowY = y + 14;
    infoBlock.left.forEach(row => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(120, 130, 142);
      doc.text(row.label, leftX + 4, rowY);
      doc.setFont('helvetica', 'bold');
      const vc = valueColor(row.valueColor);
      doc.setTextColor(vc.r, vc.g, vc.b);
      doc.text(row.value, leftX + 35, rowY);
      rowY += 5.5;
    });

    rowY = y + 14;
    infoBlock.right.forEach(row => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(120, 130, 142);
      doc.text(row.label, rightX + 4, rowY);
      doc.setFont('helvetica', 'bold');
      const vc = valueColor(row.valueColor);
      doc.setTextColor(vc.r, vc.g, vc.b);
      doc.text(row.value, rightX + 35, rowY);
      rowY += 5.5;
    });

    y += blockH + 6;
  }

  // ── SECTION LABEL ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(cr, cg, cb);
  const sectionLabel = 'LINE ITEMS';
  const labelW = doc.getTextWidth(sectionLabel);
  doc.text(sectionLabel, margin, y + 1);
  doc.setDrawColor(cr, cg, cb);
  doc.setLineWidth(0.3);
  doc.line(margin + labelW + 3, y + 0.5, pageWidth - margin, y + 0.5);
  y += 5;

  // ── TABLE ─────────────────────────────────────────────────────────
  const { headers, rows } = buildTableData(columns, data);

  const columnStyles: Record<number, any> = {};
  columns.forEach((col, i) => {
    columnStyles[i] = { cellWidth: col.width ?? 'auto' };
    if (col.align) columnStyles[i].halign = col.align;
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: y,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [cr, cg, cb],
      fontSize: 7,
      fontStyle: 'bold',
      cellPadding: { top: 2, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      fontSize: 7.5,
      textColor: [COMPANY_BRAND.textDark.r, COMPANY_BRAND.textDark.g, COMPANY_BRAND.textDark.b],
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    columnStyles,
    styles: { font: 'helvetica', overflow: 'linebreak' },
    didDrawCell: (hookData: any) => {
      if (hookData.section === 'head') {
        // Accent bottom rule under header row
        doc.setDrawColor(cr, cg, cb);
        doc.setLineWidth(0.5);
        doc.line(
          hookData.cell.x,
          hookData.cell.y + hookData.cell.height,
          hookData.cell.x + hookData.cell.width,
          hookData.cell.y + hookData.cell.height,
        );
      } else if (hookData.section === 'body') {
        // Thin light separator between rows
        doc.setDrawColor(COMPANY_BRAND.border.r, COMPANY_BRAND.border.g, COMPANY_BRAND.border.b);
        doc.setLineWidth(0.15);
        doc.line(
          hookData.cell.x,
          hookData.cell.y + hookData.cell.height,
          hookData.cell.x + hookData.cell.width,
          hookData.cell.y + hookData.cell.height,
        );
      }
    },
    margin: { left: margin, right: margin, top: 12 },
    didDrawPage: (hookData: any) => {
      if (hookData.pageNumber > 1) {
        // Compact header on continuation pages
        doc.setFillColor(cr, cg, cb);
        doc.rect(0, 0, pageWidth, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text(resolvedName.toUpperCase(), margin, 5.5);
        doc.text(title.toUpperCase(), pageWidth - margin, 5.5, { align: 'right' });
      }
    },
  });

  // ── TOTALS ────────────────────────────────────────────────────────
  if (totalsRows && totalsRows.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? y + 10;
    let ty = finalY + 6;
    const totalColW = 80;
    const totalX = pageWidth - margin - totalColW;

    totalsRows.forEach(row => {
      if (row.accent) {
        doc.setFillColor(cr, cg, cb);
        doc.rect(totalX - 2, ty - 4.5, totalColW + margin + 2, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(row.label.toUpperCase(), totalX + 1, ty);
        doc.text(row.value, pageWidth - margin - 1, ty, { align: 'right' });
      } else {
        doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
        doc.setFontSize(8);
        doc.setTextColor(COMPANY_BRAND.textDark.r, COMPANY_BRAND.textDark.g, COMPANY_BRAND.textDark.b);
        doc.text(row.label, totalX + 1, ty);
        doc.setFont('helvetica', 'bold');
        doc.text(row.value, pageWidth - margin - 1, ty, { align: 'right' });
        doc.setDrawColor(COMPANY_BRAND.border.r, COMPANY_BRAND.border.g, COMPANY_BRAND.border.b);
        doc.setLineWidth(0.15);
        doc.line(totalX - 2, ty + 1.5, pageWidth - margin, ty + 1.5);
      }
      ty += 7;
    });
  }

  // ── FOOTER on every page ──────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  const FOOTER_H = 11;
  const FOOTER_Y = pageHeight - FOOTER_H;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(cr, cg, cb);
    doc.rect(0, FOOTER_Y, pageWidth, FOOTER_H, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(footerLeft, margin, FOOTER_Y + 7);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, FOOTER_Y + 7, { align: 'right' });
  }

  // ── WATERMARK ────────────────────────────────────────────────────
  if (watermark?.text) {
    const wc = watermarkColor(watermark.color);
    const totalPages = doc.getNumberOfPages();
    const cx = pageWidth / 2;
    const cy = pageHeight / 2;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      (doc as any).saveGraphicsState?.();
      (doc as any).setGState?.(new (doc as any).GState({ opacity: 0.08 }));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(62);
      doc.setTextColor(wc.r, wc.g, wc.b);
      doc.text(watermark.text.toUpperCase(), cx, cy, { align: 'center', angle: 45 });
      (doc as any).restoreGraphicsState?.();
    }
  }

  doc.save(`${filename}.pdf`);
}

// ─── Print — Meridian HTML template ─────────────────────────────────
export function printElement(elementId: string, brandOverride?: BrandOverride): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const brand = resolveBrand(brandOverride);
  const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const footerText = brand.footerText || brand.name;
  const contactLine = [
    brand.showAddress && brand.address ? brand.address : '',
    brand.showPhone  && brand.phone   ? brand.phone   : '',
    brand.showTin    && brand.tin     ? `TIN: ${brand.tin}` : '',
  ].filter(Boolean).join('  ·  ');

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${brand.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }
    .ph { background: ${brand.colorHex}; color: #fff; padding: 14px 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .ph-left .co { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .ph-left .co-sub { font-size: 6.5px; opacity: .75; margin-top: 3px; }
    .ph-right .dt { font-size: 19px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; text-align: right; }
    .ph-right .dt-sub { font-size: 6.5px; text-align: right; opacity: .75; margin-top: 3px; }
    .psb { background: #f5f7f9; padding: 7px 20px; display: flex; border-bottom: 1px solid #e2e8f0; }
    .psb-f { padding: 0 16px; border-left: 1px solid #d1d8e0; }
    .psb-f:first-child { padding-left: 0; border-left: none; }
    .psb-l { font-size: 5.5px; font-weight: 700; letter-spacing: .1em; color: #8c96a4; text-transform: uppercase; margin-bottom: 2px; }
    .psb-v { font-size: 8px; font-weight: 700; color: #1e293b; }
    .pb { padding: 14px 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { color: ${brand.colorHex}; padding: 5px 8px; text-align: left; font-size: 6.5px; text-transform: uppercase; letter-spacing: .1em; border-bottom: 1.5px solid ${brand.colorHex}; font-weight: 700; }
    td { padding: 6px 8px; border-bottom: 1px solid #eaecf0; font-size: 8px; }
    .pf { background: ${brand.colorHex}; color: #fff; padding: 7px 20px; display: flex; justify-content: space-between; font-size: 6.5px; margin-top: 20px; }
    @media print { body { padding: 0; } .pf { position: fixed; bottom: 0; left: 0; right: 0; } }
  </style>
</head>
<body>
  <div class="ph">
    <div class="ph-left">
      <div class="co">${brand.name}</div>
      ${contactLine ? `<div class="co-sub">${contactLine}</div>` : ''}
    </div>
    <div class="ph-right">
      <div class="dt">Report</div>
      <div class="dt-sub">Generated: ${today}</div>
    </div>
  </div>
  <div class="psb">
    <div class="psb-f"><div class="psb-l">Generated</div><div class="psb-v">${today}</div></div>
  </div>
  <div class="pb">${element.innerHTML}</div>
  <div class="pf">
    <span>${footerText}${contactLine ? '  ·  ' + contactLine : ''}</span>
    <span>Printed: ${today}</span>
  </div>
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

// ─── Quick Export ────────────────────────────────────────────────────
export function quickExport(
  format: 'pdf' | 'print',
  options: ExportOptions,
  printElementId?: string,
): void {
  switch (format) {
    case 'pdf':
      exportToPDF(options);
      break;
    case 'print':
      if (printElementId) printElement(printElementId);
      else window.print();
      break;
  }
}
