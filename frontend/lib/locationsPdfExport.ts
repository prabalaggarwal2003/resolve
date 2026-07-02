import jsPDF from 'jspdf';
import type { LocationTreeNode, LocationTypeDef } from '@/lib/locations';
import { typeDef } from '@/lib/locations';

const INDENT_MM = 6;
const LINE_HEIGHT = 5.5;
const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

function ensureSpace(doc: jsPDF, y: number, needed = LINE_HEIGHT): number {
  if (y + needed > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    return MARGIN + 6;
  }
  return y;
}

function treePrefix(depth: number, isLast: boolean, ancestorLast: boolean[]): string {
  if (depth === 0) return '';
  let prefix = '';
  for (let i = 0; i < depth - 1; i++) {
    prefix += ancestorLast[i] ? '    ' : '|   ';
  }
  prefix += isLast ? '`-- ' : '|-- ';
  return prefix;
}

function drawTreeNode(
  doc: jsPDF,
  node: LocationTreeNode,
  types: LocationTypeDef[],
  depth: number,
  y: number,
  ancestorLast: boolean[],
  isLast: boolean
): number {
  const td = typeDef(types, node.type);
  const prefix = treePrefix(depth, isLast, ancestorLast);
  const stats = node.stats;
  const statsParts: string[] = [];
  if (stats?.assetCount) statsParts.push(`${stats.assetCount} assets`);
  if (stats?.childCount) statsParts.push(`${stats.childCount} children`);
  if (stats?.issueCount) statsParts.push(`${stats.issueCount} issues`);
  const statsText = statsParts.length ? `  (${statsParts.join(', ')})` : '';

  y = ensureSpace(doc, y, LINE_HEIGHT + 1);
  const x = MARGIN;

  doc.setFont('courier', depth === 0 ? 'bold' : 'normal');
  doc.setFontSize(depth === 0 ? 10 : 9);
  doc.setTextColor(30, 30, 30);

  const nameLine = `${prefix}${node.name}  [${td.name}]${statsText}`;
  doc.text(nameLine, x, y, { maxWidth: PAGE_WIDTH - MARGIN * 2 });

  if (node.path && node.path !== node.name) {
    y += LINE_HEIGHT - 1;
    y = ensureSpace(doc, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    const pathIndent = MARGIN + (prefix.length * 1.6);
    doc.text(`Path: ${node.path}`, pathIndent, y, { maxWidth: PAGE_WIDTH - pathIndent - MARGIN });
  }

  y += LINE_HEIGHT + 0.5;

  const children = node.children || [];
  children.forEach((child, i) => {
    const childIsLast = i === children.length - 1;
    y = drawTreeNode(doc, child, types, depth + 1, y, [...ancestorLast, isLast], childIsLast);
  });

  return y;
}

export function exportLocationsHierarchyPdf(
  tree: LocationTreeNode[],
  types: LocationTypeDef[],
  orgLabel = 'Organization'
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text('Location Hierarchy', MARGIN, MARGIN);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`${orgLabel}  ·  Exported ${dateStr}`, MARGIN, MARGIN + 7);

  doc.setDrawColor(180, 180, 180);
  doc.line(MARGIN, MARGIN + 10, PAGE_WIDTH - MARGIN, MARGIN + 10);

  let y = MARGIN + 18;

  if (tree.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No locations defined.', MARGIN, y);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    y = ensureSpace(doc, y);
    doc.text(orgLabel, MARGIN, y);
    y += LINE_HEIGHT + 3;

    tree.forEach((root, i) => {
      const rootIsLast = i === tree.length - 1;
      y = drawTreeNode(doc, root, types, 0, y, [], rootIsLast);
      y += 3;
    });
  }

  const fileName = `locations-hierarchy-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
