import PDFDocument from 'pdfkit';
import { formatOrgDateTime, normalizeOrgTimezone } from '../utils/orgTimezone.js';

const CHART_COLORS = [
  '#f59e0b',
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#f472b6',
  '#94a3b8',
  '#2dd4bf',
  '#eab308',
  '#818cf8',
];

function pageSize(formatting = {}) {
  const paper = String(formatting.paperSize || 'a4').toLowerCase();
  if (paper === 'letter') return 'LETTER';
  if (paper === 'legal') return 'LEGAL';
  if (paper === 'a3') return 'A3';
  return 'A4';
}

function normalizeBranding(branding = {}) {
  const plain =
    branding && typeof branding.toObject === 'function' ? branding.toObject() : branding || {};
  return {
    companyName: String(plain.companyName || '').trim(),
    logoData: String(plain.logoData || '').trim(),
  };
}

function logoBufferFromDataUrl(logoData) {
  if (!logoData || typeof logoData !== 'string') return null;
  // PDFKit natively supports PNG and JPEG only
  const match = logoData.match(/^data:image\/(png|jpe?g);base64,([\s\S]+)$/i);
  if (!match) return null;
  try {
    const b64 = match[2].replace(/\s/g, '');
    const buf = Buffer.from(b64, 'base64');
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

function drawWatermark(doc, text) {
  if (!text) return;
  const { width, height } = doc.page;
  doc.save();
  doc.fillColor('#9ca3af', 0.12);
  doc.font('Helvetica-Bold').fontSize(48);
  doc.rotate(-30, { origin: [width / 2, height / 2] });
  doc.text(String(text), 0, height / 2 - 24, {
    width,
    align: 'center',
    lineBreak: false,
  });
  doc.restore();
}

function drawHeaderFooter(doc, { header, footer, reportName, branding, pageNumber }) {
  const { width, height } = doc.page;
  const left = doc.page.margins.left;
  const right = width - doc.page.margins.right;
  const brand = normalizeBranding(branding);
  const logoBuf = logoBufferFromDataUrl(brand.logoData);
  const companyName = brand.companyName;
  const headerText = String(header || '').trim();
  const hasChrome = Boolean(headerText || companyName || logoBuf);

  if (hasChrome) {
    const textRight = logoBuf ? right - 72 : right;
    const title = companyName || headerText;
    const subtitle = companyName && headerText && headerText !== companyName ? headerText : reportName || '';

    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11);
    doc.text(title, left, 20, {
      width: Math.max(40, textRight - left),
      align: 'left',
      lineBreak: false,
    });

    if (subtitle) {
      doc.fillColor('#6b7280').font('Helvetica').fontSize(8);
      doc.text(subtitle, left, 36, {
        width: Math.max(40, textRight - left),
        align: 'left',
        lineBreak: false,
      });
    } else if (companyName && reportName) {
      doc.fillColor('#6b7280').font('Helvetica').fontSize(8);
      doc.text(reportName, left, 36, {
        width: Math.max(40, textRight - left),
        align: 'left',
        lineBreak: false,
      });
    }

    if (logoBuf) {
      try {
        doc.image(logoBuf, right - 64, 14, { fit: [56, 36] });
      } catch (err) {
        console.warn('Report PDF logo render failed:', err?.message || err);
      }
    }

    doc
      .moveTo(left, 52)
      .lineTo(right, 52)
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .stroke();
  }

  const foot = String(footer || '').trim();
  doc.fillColor('#6b7280').font('Helvetica').fontSize(8);
  if (foot) {
    doc.text(foot, left, height - 36, {
      width: (right - left) * 0.7,
      align: 'left',
      lineBreak: false,
    });
  }
  doc.text(`Page ${pageNumber}`, left, height - 36, {
    width: right - left,
    align: 'right',
    lineBreak: false,
  });
}

function drawBarChart(doc, chart, x, y, width, height) {
  const labels = chart.labels || [];
  const values = chart.values || [];
  if (!labels.length) return y;

  const max = Math.max(...values, 1);
  const gap = 6;
  const barW = Math.max(8, (width - gap * (labels.length + 1)) / labels.length);
  const baseY = y + height - 18;

  doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
  doc.text('Chart', x, y, { width, lineBreak: false });

  labels.forEach((label, i) => {
    const v = Number(values[i]) || 0;
    const h = Math.max(2, (v / max) * (height - 36));
    const bx = x + gap + i * (barW + gap);
    const by = baseY - h;
    doc.rect(bx, by, barW, h).fill(CHART_COLORS[i % CHART_COLORS.length]);
    doc.fillColor('#374151').fontSize(6);
    doc.text(String(v), bx, by - 8, { width: barW, align: 'center', lineBreak: false });
    doc.text(String(label).slice(0, 10), bx - 2, baseY + 2, {
      width: barW + 4,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });
  });

  return y + height;
}

function drawHorizontalBars(doc, chart, x, y, width) {
  const labels = chart.labels || [];
  const values = chart.values || [];
  if (!labels.length) return y;
  const max = Math.max(...values, 1);
  let cy = y + 12;
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Chart', x, y, { lineBreak: false });
  labels.slice(0, 12).forEach((label, i) => {
    const v = Number(values[i]) || 0;
    const barW = Math.max(4, ((width - 120) * v) / max);
    doc.fillColor('#374151').fontSize(7).text(String(label).slice(0, 18), x, cy, {
      width: 90,
      lineBreak: false,
      ellipsis: true,
    });
    doc.rect(x + 95, cy, barW, 8).fill(CHART_COLORS[i % CHART_COLORS.length]);
    doc.fillColor('#6b7280').text(String(v), x + 100 + barW, cy, { lineBreak: false });
    cy += 14;
  });
  return cy + 4;
}

function drawPieChart(doc, chart, x, y, size, donut = false) {
  const labels = chart.labels || [];
  const values = chart.values || [];
  if (!labels.length) return y;
  const total = values.reduce((a, b) => a + Number(b || 0), 0) || 1;
  const cx = x + size / 2;
  const cy = y + size / 2 + 8;
  const r = size / 2 - 8;
  const r0 = donut ? r * 0.45 : 0;

  doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(donut ? 'Donut chart' : 'Pie chart', x, y, {
    lineBreak: false,
  });

  let angle = -Math.PI / 2;
  values.forEach((raw, i) => {
    const v = Number(raw) || 0;
    const sweep = (v / total) * Math.PI * 2;
    const steps = Math.max(8, Math.ceil((sweep / (Math.PI * 2)) * 48));
    doc.save();
    doc.moveTo(cx + (donut ? Math.cos(angle) * r0 : 0), cy + (donut ? Math.sin(angle) * r0 : 0));
    if (!donut) doc.moveTo(cx, cy);
    for (let s = 0; s <= steps; s++) {
      const a = angle + (sweep * s) / steps;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (s === 0 && donut) doc.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else doc.lineTo(px, py);
    }
    if (donut) {
      for (let s = steps; s >= 0; s--) {
        const a = angle + (sweep * s) / steps;
        doc.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      }
    } else {
      doc.lineTo(cx, cy);
    }
    doc.fill(CHART_COLORS[i % CHART_COLORS.length]);
    doc.restore();
    angle += sweep;
  });

  let ly = y + 12;
  const legendX = x + size + 12;
  labels.slice(0, 10).forEach((label, i) => {
    doc.rect(legendX, ly, 8, 8).fill(CHART_COLORS[i % CHART_COLORS.length]);
    doc.fillColor('#374151').fontSize(7).text(`${label}: ${values[i]}`, legendX + 12, ly, {
      width: 140,
      lineBreak: false,
      ellipsis: true,
    });
    ly += 12;
  });

  return Math.max(y + size + 16, ly + 4);
}

function drawChartSection(doc, result, formatting, x, startY, usableWidth) {
  const viz = result.visualization || formatting.visualizationType || 'table';
  const chart = result.chart;
  if (!chart?.labels?.length || viz === 'table') return startY;

  let y = startY;
  const bottom = doc.page.height - doc.page.margins.bottom - 28;
  const needed = viz === 'pie' || viz === 'donut' || viz === 'kpi' ? 180 : 160;
  if (y + needed > bottom) {
    doc.addPage();
    y = formatting.header ? 60 : 48;
  }

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');
  doc.text(`Visualization: ${String(viz).replace(/_/g, ' ')}`, x, y, { lineBreak: false });
  y += 14;

  if (viz === 'pie') {
    y = drawPieChart(doc, chart, x, y, 140, false);
  } else if (viz === 'donut') {
    y = drawPieChart(doc, chart, x, y, 140, true);
  } else if (viz === 'line' || viz === 'area' || viz === 'timeline' || viz === 'heatmap' || viz === 'treemap') {
    y = drawHorizontalBars(doc, chart, x, y, usableWidth);
  } else if (viz === 'kpi' || viz === 'pivot') {
    y = drawHorizontalBars(doc, chart, x, y, usableWidth);
  } else {
    // bar and default
    y = drawBarChart(doc, chart, x, y, usableWidth, 130);
  }

  return y + 10;
}

/**
 * Build a real PDF buffer for a report result, including formatting chrome + charts.
 */
export function buildReportPdfBuffer({
  reportName,
  result,
  formatting = {},
  branding = {},
  timezone,
}) {
  return new Promise((resolve, reject) => {
    const brand = normalizeBranding(branding);
    const tz = normalizeOrgTimezone(timezone || branding?.timezone);
    const orientation = formatting.orientation === 'portrait' ? 'portrait' : 'landscape';
    const doc = new PDFDocument({
      size: pageSize(formatting),
      layout: orientation,
      margin: 48,
      bufferPages: true,
      info: {
        Title: reportName || 'Report',
        Author: brand.companyName || 'Report Studio',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const columns = result.columns || [];
    const rows = result.rows || [];
    const aggregates = result.aggregates || [];
    const hasBrandChrome = Boolean(
      formatting.header || brand.companyName || logoBufferFromDataUrl(brand.logoData)
    );
    const contentTop = hasBrandChrome ? 64 : 48;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = columns.length ? usableWidth / columns.length : usableWidth;
    const left = doc.page.margins.left;

    let y = contentTop;

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827');
    doc.text(reportName || 'Report', left, y, { width: usableWidth });
    y = doc.y + 6;
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
    doc.text(
      `Generated ${formatOrgDateTime(new Date(), tz)} · ${result.total ?? rows.length} records`,
      left,
      y,
      { width: usableWidth }
    );
    y = doc.y + 12;

    if (aggregates.length) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');
      for (const agg of aggregates) {
        doc.text(`${agg.label}: ${agg.value ?? '—'}`, left, y, { width: usableWidth });
        y = doc.y + 2;
      }
      y += 8;
    }

    y = drawChartSection(doc, result, formatting, left, y, usableWidth);

    const ensureSpace = (needed) => {
      const bottom = doc.page.height - doc.page.margins.bottom - 24;
      if (y + needed > bottom) {
        doc.addPage();
        y = contentTop;
      }
    };

    const drawTableHeader = () => {
      ensureSpace(22);
      doc.rect(left, y, usableWidth, 18).fill('#f3f4f6');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151');
      columns.forEach((col, i) => {
        doc.text(String(col.label || col.key), left + i * colWidth + 3, y + 5, {
          width: colWidth - 6,
          ellipsis: true,
          lineBreak: false,
        });
      });
      y += 20;
    };

    const viz = result.visualization || 'table';
    const showTable = viz === 'table' || viz === 'pivot' || !result.chart?.labels?.length;

    if (columns.length && showTable) {
      drawTableHeader();
      doc.font('Helvetica').fontSize(8).fillColor('#111827');
      for (const row of rows) {
        ensureSpace(16);
        if (y <= contentTop + 2) {
          drawTableHeader();
          doc.font('Helvetica').fontSize(8).fillColor('#111827');
        }
        columns.forEach((col, i) => {
          const val = row[col.key];
          doc.text(val == null ? '' : String(val), left + i * colWidth + 3, y, {
            width: colWidth - 6,
            ellipsis: true,
            lineBreak: false,
          });
        });
        y += 14;
      }
    } else if (columns.length && !showTable) {
      // Compact data appendix for chart exports
      ensureSpace(30);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('Data appendix', left, y);
      y = doc.y + 6;
      drawTableHeader();
      doc.font('Helvetica').fontSize(8).fillColor('#111827');
      for (const row of rows.slice(0, 40)) {
        ensureSpace(16);
        columns.forEach((col, i) => {
          const val = row[col.key];
          doc.text(val == null ? '' : String(val), left + i * colWidth + 3, y, {
            width: colWidth - 6,
            ellipsis: true,
            lineBreak: false,
          });
        });
        y += 14;
      }
      if (rows.length > 40) {
        doc.fillColor('#6b7280').fontSize(8).text(`… and ${rows.length - 40} more rows`, left, y);
      }
    } else if (!columns.length) {
      doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('No columns selected.', left, y);
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawWatermark(doc, formatting.watermark);
      drawHeaderFooter(doc, {
        header: formatting.header,
        footer: formatting.footer,
        reportName,
        branding: brand,
        pageNumber: i + 1,
      });
    }

    doc.end();
  });
}
