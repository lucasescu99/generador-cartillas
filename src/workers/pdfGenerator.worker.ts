import { jsPDF } from 'jspdf';
import { PDFDocument, rgb } from 'pdf-lib';
// @ts-ignore fontkit CJS/ESM interop
import _fontkit from '@pdf-lib/fontkit';
const fontkit: any = (_fontkit as any).default || _fontkit;
import type { Prestador, NormasBlock, NormasSpan, WorkerMessage } from '../types/cartilla.types';

// --- Layout constants (mm) ---
const PAGE_H = 297;
const PAGE_W = 210;
const MARGIN_TOP = 22;
const MARGIN_BOTTOM = 10;
const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 10;
const COL_GAP = 5;
const NUM_COLS = 3;
const USABLE_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;
const COL_W = (USABLE_W - COL_GAP * (NUM_COLS - 1)) / NUM_COLS;
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

// Font sizes (pt)
const FS_HEADER_TAB = 7;
const FS_ESPECIALIDAD = 7;
const FS_NOMBRE = 6;
const FS_DETALLE = 5.5;

// Colors
const COLOR_HEADER_DARK: [number, number, number] = [2, 54, 112];    // #023670
const COLOR_HEADER_LIGHT: [number, number, number] = [0, 124, 194];  // #007cc2
const COLOR_ESP: [number, number, number] = [0, 124, 194];           // #007cc2
const COLOR_TEXT: [number, number, number] = [2, 54, 112];           // #023670
const COLOR_CENTRO: [number, number, number] = [2, 54, 112];         // #023670
const COLOR_WHITE: [number, number, number] = [255, 255, 255];

// --- Types ---

interface Cursor {
  col: number;
  y: number;
}

interface EspGroup {
  nombre: string;
  prestadores: Prestador[];
}

interface ProvinciaSection {
  nombre: string;
  especialidades: EspGroup[];
}

// --- Data grouping: provincia → especialidad → prestadores ---

function groupByProvincia(prestadores: Prestador[]): ProvinciaSection[] {
  const provMap = new Map<string, Prestador[]>();

  for (const p of prestadores) {
    const prov = (p.provincia || 'SIN PROVINCIA').trim().toUpperCase();
    if (!provMap.has(prov)) provMap.set(prov, []);
    provMap.get(prov)!.push(p);
  }

  const sections: ProvinciaSection[] = [];
  const sortedProvs = Array.from(provMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));

  for (const provNombre of sortedProvs) {
    const provPrestadores = provMap.get(provNombre)!;

    // Group by especialidad within this province
    const espMap = new Map<string, Prestador[]>();
    for (const p of provPrestadores) {
      const esp = p.especialidad.toUpperCase().trim();
      if (!espMap.has(esp)) espMap.set(esp, []);
      espMap.get(esp)!.push(p);
    }

    const especialidades: EspGroup[] = [];
    const sortedEsps = Array.from(espMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));

    for (const espNombre of sortedEsps) {
      const list = espMap.get(espNombre)!;
      list.sort((a, b) => {
        const aCentro = isCentroMedicus(a) ? 0 : 1;
        const bCentro = isCentroMedicus(b) ? 0 : 1;
        if (aCentro !== bCentro) return aCentro - bCentro;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
      especialidades.push({ nombre: espNombre, prestadores: list });
    }

    sections.push({ nombre: provNombre, especialidades });
  }

  return sections;
}

function isCentroMedicus(p: Prestador): boolean {
  const text = (p.nombre + ' ' + (p.nombreInsti || '')).toUpperCase();
  return text.includes('CENTRO MEDICUS') || text.includes('MEDICUS');
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function remaining(cursor: Cursor): number {
  return CONTENT_H - (cursor.y - MARGIN_TOP);
}

// --- Drawing functions ---

function drawHeader(doc: jsPDF, provincia: string, pageNum: number): void {
  const tabH = 5.5;
  const tabY = 6;
  const MIN_TAB_W = 28;
  const tabPadX = 3;
  const pageNumGap = 5.6;
  const isRightSide = pageNum % 2 === 0; // even = right, odd = left

  doc.setFontSize(FS_HEADER_TAB);
  doc.setFont('Poppins', 'normal');

  const provText = provincia.toUpperCase();
  const provTabW = Math.max(MIN_TAB_W, doc.getTextWidth(provText) + tabPadX * 2);

  const secText = 'CUERPO MEDICO';
  const secTabW = Math.max(MIN_TAB_W, doc.getTextWidth(secText) + tabPadX * 2);

  const pageNumText = String(pageNum);
  const pageNumW = doc.getTextWidth(pageNumText);

  let provTabX: number;
  let secTabX: number;
  let pageNumX: number;

  if (isRightSide) {
    // Right-aligned: [PROVINCIA] [CUERPO MEDICO]  pageNum
    const rightEdge = PAGE_W - MARGIN_RIGHT;
    pageNumX = rightEdge - pageNumW;
    const tabsRight = pageNumX - pageNumGap;
    secTabX = tabsRight - secTabW;
    provTabX = secTabX - provTabW;
  } else {
    // Left-aligned: pageNum  [CUERPO MEDICO] [PROVINCIA]
    pageNumX = MARGIN_LEFT;
    const tabsLeft = pageNumX + pageNumW + pageNumGap;
    secTabX = tabsLeft;
    provTabX = secTabX + secTabW;
  }

  // Province tab (lighter blue)
  doc.setFillColor(...COLOR_HEADER_LIGHT);
  doc.rect(provTabX, tabY, provTabW, tabH, 'F');

  // Section tab (darker blue)
  doc.setFillColor(...COLOR_HEADER_DARK);
  doc.rect(secTabX, tabY, secTabW, tabH, 'F');

  // Tab texts - centered vertically
  const textY = tabY + tabH / 2 + FS_HEADER_TAB * 0.13;
  doc.setTextColor(...COLOR_WHITE);
  doc.setFontSize(FS_HEADER_TAB);

  const provTW = doc.getTextWidth(provText);
  doc.text(provText, provTabX + (provTabW - provTW) / 2, textY);
  const secTW = doc.getTextWidth(secText);
  doc.text(secText, secTabX + (secTabW - secTW) / 2, textY);

  // Page number
  doc.setTextColor(...COLOR_TEXT);
  doc.text(pageNumText, pageNumX, textY);
}


function drawEspHeader(doc: jsPDF, cursor: Cursor, esp: string, cont: boolean): void {
  const x = colX(cursor.col);
  const label = cont ? `${esp} (cont.)` : esp;

  doc.setFontSize(FS_ESPECIALIDAD);
  doc.setFont('Poppins', 'bold');
  doc.setTextColor(...COLOR_ESP);

  for (const line of wrapText(doc, label, COL_W)) {
    doc.text(line, x, cursor.y + FS_ESPECIALIDAD * 0.35);
    cursor.y += FS_ESPECIALIDAD * 0.38;
  }
  cursor.y += 2.5;
}

function colX(col: number): number {
  return MARGIN_LEFT + col * (COL_W + COL_GAP);
}

function measurePrestador(doc: jsPDF, p: Prestador): number {
  let h = 0;
  const textW = COL_W - 1;

  doc.setFontSize(FS_NOMBRE);
  const nombreText = p.nombreInsti ? `${p.nombre} (${p.nombreInsti})` : p.nombre;
  h += wrapText(doc, nombreText, textW).length * (FS_NOMBRE * 0.38) + 0.2;

  doc.setFontSize(FS_DETALLE);
  if (p.direccion) {
    h += wrapText(doc, p.direccion, textW).length * (FS_DETALLE * 0.38);
  }
  if (p.subespecialidades.length > 0) {
    const subsText = p.subespecialidades.join(' - ');
    h += wrapText(doc, subsText, textW).length * (FS_DETALLE * 0.38);
  }
  return h + 2;
}

function drawPrestador(doc: jsPDF, cursor: Cursor, p: Prestador): void {
  const x = colX(cursor.col);
  const textW = COL_W - 1;
  const centro = isCentroMedicus(p);

  // Name
  doc.setFontSize(FS_NOMBRE);
  doc.setFont('Poppins', centro ? 'bold' : 'normal');
  doc.setTextColor(...(centro ? COLOR_CENTRO : COLOR_TEXT));

  const nombreText = p.nombreInsti ? `${p.nombre} (${p.nombreInsti})` : p.nombre;
  for (const line of wrapText(doc, nombreText, textW)) {
    doc.text(line, x, cursor.y + FS_NOMBRE * 0.35);
    cursor.y += FS_NOMBRE * 0.38;
  }

  // Address
  doc.setFontSize(FS_DETALLE);
  doc.setFont('Poppins', 'normal');
  doc.setTextColor(...COLOR_TEXT);

  if (p.direccion) {
    for (const line of wrapText(doc, p.direccion, textW)) {
      doc.text(line, x, cursor.y + FS_DETALLE * 0.35);
      cursor.y += FS_DETALLE * 0.38;
    }
  }

  // Subespecialidades
  if (p.subespecialidades.length > 0) {
    doc.setFont('Poppins', 'italic');
    const subsText = p.subespecialidades.join(' - ');
    for (const line of wrapText(doc, subsText, textW)) {
      doc.text(line, x, cursor.y + FS_DETALLE * 0.35);
      cursor.y += FS_DETALLE * 0.38;
    }
  }

  cursor.y += 1.5;
}

// --- Generate "Normas Generales" pages ---
// Font: Calibri. Titles: 12pt Bold. Body: 10pt Regular.
// Line height within paragraph: ~12pt (automatic). Between paragraphs: 20pt. Title→paragraph: 20pt.

const FS_NORMAS_HEADING = 12;
const FS_NORMAS_BODY = 10;
const FS_NORMAS_LIST = 10;
// Convert pt to mm for jsPDF (1pt = 0.3528mm)
const PT_TO_MM = 0.3528;
const NORMAS_LINE_H = 12 * PT_TO_MM;    // ~4.23mm interlineado automático
const NORMAS_PARA_GAP = 20 * PT_TO_MM;  // ~7.06mm entre párrafos
const NORMAS_TITLE_GAP = 20 * PT_TO_MM; // ~7.06mm después de título
const NORMAS_FONT = 'Calibri';

function drawSectionHeader(doc: jsPDF, tabText: string, pageNum: number): void {
  const tabH = 5.5;
  const tabY = 6;
  const MIN_TAB_W = 28;
  const tabPadX = 3;
  const pageNumGap = 5.6;
  const FS_TAB = 10;  // Calibri Bold 10pt per reference
  const isRightSide = pageNum % 2 === 0;

  // Measure tab text
  doc.setFontSize(FS_TAB);
  doc.setFont(NORMAS_FONT, 'bold');
  const tabW = Math.max(MIN_TAB_W, doc.getTextWidth(tabText) + tabPadX * 2);

  // Measure page number at its actual draw size
  doc.setFontSize(FS_HEADER_TAB);
  doc.setFont(NORMAS_FONT, 'normal');
  const pageNumText = String(pageNum);
  const pageNumW = doc.getTextWidth(pageNumText);

  let tabX: number;
  let pageNumX: number;

  if (isRightSide) {
    const rightEdge = PAGE_W - MARGIN_RIGHT;
    pageNumX = rightEdge - pageNumW;
    tabX = pageNumX - pageNumGap - tabW;
  } else {
    pageNumX = MARGIN_LEFT;
    tabX = pageNumX + pageNumW + pageNumGap;
  }

  doc.setFillColor(...COLOR_HEADER_DARK);
  doc.rect(tabX, tabY, tabW, tabH, 'F');

  const textY = tabY + tabH / 2 + FS_TAB * 0.13;
  doc.setTextColor(...COLOR_WHITE);
  doc.setFontSize(FS_TAB);
  doc.setFont(NORMAS_FONT, 'bold');
  const tw = doc.getTextWidth(tabText);
  doc.text(tabText, tabX + (tabW - tw) / 2, textY);

  doc.setTextColor(...COLOR_TEXT);
  doc.setFont(NORMAS_FONT, 'normal');
  doc.setFontSize(FS_HEADER_TAB);
  doc.text(pageNumText, pageNumX, textY);
}

function blockFontSize(block: NormasBlock): number {
  if (block.type === 'heading') return FS_NORMAS_HEADING;
  if (block.type === 'list-item') return FS_NORMAS_LIST;
  return FS_NORMAS_BODY;
}

function spanText(spans: NormasSpan[]): string {
  return spans.map((s) => s.text).join('');
}

function blockFontStyle(block: NormasBlock): string {
  const hasBold = block.type === 'heading' || block.spans.some((s) => s.bold);
  const hasItalic = block.spans.some((s) => s.italic);
  if (hasBold && hasItalic) return 'bolditalic';
  if (hasBold) return 'bold';
  if (hasItalic) return 'italic';
  return 'normal';
}

// --- Table rendering ---
const TABLE_COL_RATIO = 0.38; // left column takes 38% of width
const TABLE_LINE_W = 0.25;    // line thickness in mm
const TABLE_PAD_Y = 1.4;      // vertical padding inside row
const TABLE_PAD_X = 2;        // horizontal padding inside cells
const TABLE_LINE_COLOR: [number, number, number] = [180, 195, 215]; // light blue-gray borders

function measureTableRow(doc: jsPDF, block: NormasBlock, maxW: number): number {
  const fs = FS_NORMAS_BODY;
  const cells = block.cells || [];
  const leftW = maxW * TABLE_COL_RATIO - TABLE_PAD_X * 2;
  const rightW = maxW * (1 - TABLE_COL_RATIO) - TABLE_PAD_X * 2;

  let maxH = 0;
  for (let i = 0; i < cells.length; i++) {
    const cellW = i === 0 ? leftW : rightW;
    const style = cells[i].bold ? 'bold' : 'normal';
    doc.setFontSize(fs);
    doc.setFont(NORMAS_FONT, style);
    const lines = wrapText(doc, cells[i].text, cellW);
    const cellH = lines.length * NORMAS_LINE_H;
    if (cellH > maxH) maxH = cellH;
  }

  let h = maxH + TABLE_PAD_Y * 2;
  if (block.tableFlags?.isLast) h += NORMAS_PARA_GAP;
  return h;
}

function drawTableRow(doc: jsPDF, y: number, block: NormasBlock, maxW: number): number {
  const fs = FS_NORMAS_BODY;
  const cells = block.cells || [];
  const flags = block.tableFlags;
  const tableX = MARGIN_LEFT;
  const tableRight = MARGIN_LEFT + maxW;
  const dividerX = tableX + maxW * TABLE_COL_RATIO;
  const leftTextX = tableX + TABLE_PAD_X;
  const rightTextX = dividerX + TABLE_PAD_X;
  const leftW = maxW * TABLE_COL_RATIO - TABLE_PAD_X * 2;
  const rightW = maxW * (1 - TABLE_COL_RATIO) - TABLE_PAD_X * 2;

  // Measure row height
  let maxCellH = 0;
  const cellData: { lines: string[]; h: number }[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cellW = i === 0 ? leftW : rightW;
    const style = cells[i].bold ? 'bold' : 'normal';
    doc.setFontSize(fs);
    doc.setFont(NORMAS_FONT, style);
    const lines = wrapText(doc, cells[i].text, cellW);
    const h = lines.length * NORMAS_LINE_H;
    cellData.push({ lines, h });
    if (h > maxCellH) maxCellH = h;
  }

  const rowH = maxCellH + TABLE_PAD_Y * 2;
  const isHeader = flags?.isHeader;

  // Fill header row background
  if (isHeader) {
    doc.setFillColor(230, 238, 248); // very light blue
    doc.rect(tableX, y, maxW, rowH, 'F');
  }

  // Draw cell borders (full grid)
  doc.setDrawColor(...TABLE_LINE_COLOR);
  doc.setLineWidth(TABLE_LINE_W);

  // Top border
  doc.line(tableX, y, tableRight, y);
  // Bottom border
  doc.line(tableX, y + rowH, tableRight, y + rowH);
  // Left border
  doc.line(tableX, y, tableX, y + rowH);
  // Right border
  doc.line(tableRight, y, tableRight, y + rowH);
  // Column divider
  doc.line(dividerX, y, dividerX, y + rowH);

  // Thicker bottom line for header
  if (isHeader) {
    doc.setDrawColor(...COLOR_TEXT);
    doc.setLineWidth(TABLE_LINE_W * 2);
    doc.line(tableX, y + rowH, tableRight, y + rowH);
  }

  const textY = y + TABLE_PAD_Y;

  // Draw left cell (left-aligned)
  if (cellData[0]) {
    const style = cells[0]?.bold ? 'bold' : 'normal';
    doc.setFontSize(fs);
    doc.setFont(NORMAS_FONT, style);
    doc.setTextColor(...COLOR_TEXT);
    let cy = textY;
    for (const line of cellData[0].lines) {
      doc.text(line, leftTextX, cy + fs * 0.35);
      cy += NORMAS_LINE_H;
    }
  }

  // Draw right cell (right-aligned)
  if (cellData[1]) {
    const style = cells[1]?.bold ? 'bold' : 'normal';
    doc.setFontSize(fs);
    doc.setFont(NORMAS_FONT, style);
    doc.setTextColor(...COLOR_TEXT);
    let cy = textY;
    for (const line of cellData[1].lines) {
      const tw = doc.getTextWidth(line);
      doc.text(line, tableRight - TABLE_PAD_X - tw, cy + fs * 0.35);
      cy += NORMAS_LINE_H;
    }
  }

  y += rowH;

  if (flags?.isLast) y += NORMAS_PARA_GAP;

  return y;
}

// --- Block measurement & drawing ---

function measureBlock(doc: jsPDF, block: NormasBlock, maxW: number): number {
  if (block.type === 'table-row') return measureTableRow(doc, block, maxW);

  const fs = blockFontSize(block);
  doc.setFontSize(fs);
  doc.setFont(NORMAS_FONT, blockFontStyle(block));
  const text = spanText(block.spans);
  if (!text.trim()) return NORMAS_PARA_GAP;
  const prefix = block.type === 'list-item' ? '  \u2022 ' : '';
  const lines = wrapText(doc, prefix + text, maxW);
  const textH = lines.length * NORMAS_LINE_H;
  const afterGap = block.type === 'heading' ? NORMAS_TITLE_GAP : NORMAS_PARA_GAP;
  return textH + afterGap;
}

const COLOR_LINK: [number, number, number] = [0, 124, 194]; // #007cc2

function drawBlock(doc: jsPDF, y: number, block: NormasBlock, maxW: number): number {
  if (block.type === 'table-row') return drawTableRow(doc, y, block, maxW);

  const fs = blockFontSize(block);
  const text = spanText(block.spans);

  if (!text.trim()) return y + NORMAS_PARA_GAP;

  const hasLinks = block.spans.some((s) => s.link);
  const prefix = block.type === 'list-item' ? '  \u2022 ' : '';

  if (!hasLinks) {
    // Fast path: no links, draw all text at once
    doc.setFontSize(fs);
    doc.setFont(NORMAS_FONT, blockFontStyle(block));
    doc.setTextColor(...COLOR_TEXT);

    const lines = wrapText(doc, prefix + text, maxW);
    for (const line of lines) {
      doc.text(line, MARGIN_LEFT, y + fs * 0.35);
      y += NORMAS_LINE_H;
    }
  } else {
    // Span-by-span rendering for blocks with links
    doc.setFontSize(fs);
    const baseStyle = blockFontStyle(block);

    // Build flat segments from spans
    const segments: { text: string; link?: string; bold?: boolean; italic?: boolean }[] = [];
    if (prefix) segments.push({ text: prefix });
    for (const span of block.spans) {
      segments.push({
        text: span.text,
        link: span.link,
        bold: span.bold || block.type === 'heading',
        italic: span.italic,
      });
    }

    // Wrap all text together to get line breaks
    const fullText = segments.map((s) => s.text).join('');
    const lines = wrapText(doc, fullText, maxW);

    // For each wrapped line, render segments with correct styling
    let charIdx = 0;
    for (const line of lines) {
      let x = MARGIN_LEFT;
      let lineCharsLeft = line.length;

      for (const seg of segments) {
        if (lineCharsLeft <= 0) break;
        if (charIdx >= seg.text.length + charIdx) continue; // skip consumed

        // How many chars of this segment fall on this line
        const segRemaining = seg.text.length - Math.max(0, charIdx - segments.slice(0, segments.indexOf(seg)).reduce((a, s) => a + s.text.length, 0));
        if (segRemaining <= 0) continue;

        const charsOnLine = Math.min(segRemaining, lineCharsLeft);
        // Actually, this approach gets complex. Use simpler method:
        // Just find the segment that contains the link text and render it differently
        break;
      }

      // Simplified: render line, then overlay links
      doc.setFont(NORMAS_FONT, baseStyle);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(line, MARGIN_LEFT, y + fs * 0.35);

      // Find link spans that appear in this line
      for (const seg of segments) {
        if (!seg.link || !seg.text.trim()) continue;
        const linkText = seg.text.trim();
        const idx = line.indexOf(linkText);
        if (idx >= 0) {
          // Calculate x position of link text
          const beforeText = line.substring(0, idx);
          doc.setFont(NORMAS_FONT, baseStyle);
          const linkX = MARGIN_LEFT + doc.getTextWidth(beforeText);
          const linkW = doc.getTextWidth(linkText);
          const linkY = y + fs * 0.35;

          // Overdraw link text in link color
          doc.setTextColor(...COLOR_LINK);
          doc.text(linkText, linkX, linkY);

          // Draw underline
          const underlineY = linkY + 0.5;
          doc.setDrawColor(...COLOR_LINK);
          doc.setLineWidth(0.15);
          doc.line(linkX, underlineY, linkX + linkW, underlineY);

          // Add clickable link annotation (coordinates in mm, same as doc unit)
          doc.link(linkX, y - 0.5, linkW, NORMAS_LINE_H + 1, { url: seg.link });
        }
      }

      charIdx += line.length;
      y += NORMAS_LINE_H;
    }
  }

  y += block.type === 'heading' ? NORMAS_TITLE_GAP : NORMAS_PARA_GAP;

  return y;
}

function generateTextSection(blocks: NormasBlock[], headerText: string): ArrayBuffer {
  const doc = createContentDoc();
  let y = MARGIN_TOP;
  const textW = USABLE_W;

  drawSectionHeader(doc, headerText, 1);

  for (const block of blocks) {
    const blockH = measureBlock(doc, block, textW);

    if (y + blockH > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      drawSectionHeader(doc, headerText, doc.getNumberOfPages());
    }

    y = drawBlock(doc, y, block, textW);
  }

  return doc.output('arraybuffer');
}

// --- Generate pages for a single province ---

function generateProvince(section: ProvinciaSection, startPage: number): ArrayBuffer {
  const doc = createContentDoc();
  const cursor: Cursor = { col: 0, y: MARGIN_TOP };

  drawHeader(doc, section.nombre, startPage);

  const getPageNum = () => startPage + doc.getNumberOfPages() - 1;

  const nextCol = (cur: Cursor) => {
    if (cur.col < NUM_COLS - 1) {
      cur.col++;
      cur.y = MARGIN_TOP;
    } else {
      doc.addPage();
      cur.col = 0;
      cur.y = MARGIN_TOP;
      drawHeader(doc, section.nombre, getPageNum());
    }
  };

  for (const esp of section.especialidades) {
    // Ensure room for header + at least the first prestador
    const firstPH = esp.prestadores.length > 0 ? measurePrestador(doc, esp.prestadores[0]) : 0;
    if (remaining(cursor) < 8 + firstPH) {
      nextCol(cursor);
    }

    drawEspHeader(doc, cursor, esp.nombre, false);

    for (const prest of esp.prestadores) {
      const pH = measurePrestador(doc, prest);
      if (remaining(cursor) < pH) {
        nextCol(cursor);
        drawEspHeader(doc, cursor, esp.nombre, true);
      }
      drawPrestador(doc, cursor, prest);
    }

    cursor.y += 1;
  }

  return doc.output('arraybuffer');
}

// --- Font helpers ---

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return res.arrayBuffer();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Cached font data (base64 for jsPDF, raw for pdf-lib)
let fontsReady = false;
// Poppins (prestadores)
let poppinsRegularB64 = '';
let poppinsBoldB64 = '';
let poppinsItalicB64 = '';
let poppinsBoldItalicB64 = '';
let poppinsSemiBoldRaw: ArrayBuffer;
// Calibri (normas generales)
let calibriRegularB64 = '';
let calibriBoldB64 = '';
let calibriItalicB64 = '';
let calibriBoldItalicB64 = '';

async function loadFonts(): Promise<void> {
  if (fontsReady) return;
  const [
    poppinsRegular, poppinsBold, poppinsItalic, poppinsBoldItalic,
    calibriRegular, calibriBold, calibriItalic, calibriBoldItalic,
  ] = await Promise.all([
    fetchBuffer('/Poppins-Regular.ttf'),
    fetchBuffer('/Poppins-SemiBold.ttf'),
    fetchBuffer('/Poppins-Italic.ttf'),
    fetchBuffer('/Poppins-SemiBoldItalic.ttf'),
    fetchBuffer('/Calibri-Regular.ttf'),
    fetchBuffer('/Calibri-Bold.ttf'),
    fetchBuffer('/Calibri-Italic.ttf'),
    fetchBuffer('/Calibri-BoldItalic.ttf'),
  ]);
  poppinsRegularB64 = arrayBufferToBase64(poppinsRegular);
  poppinsBoldB64 = arrayBufferToBase64(poppinsBold);
  poppinsItalicB64 = arrayBufferToBase64(poppinsItalic);
  poppinsBoldItalicB64 = arrayBufferToBase64(poppinsBoldItalic);
  poppinsSemiBoldRaw = poppinsBold;
  calibriRegularB64 = arrayBufferToBase64(calibriRegular);
  calibriBoldB64 = arrayBufferToBase64(calibriBold);
  calibriItalicB64 = arrayBufferToBase64(calibriItalic);
  calibriBoldItalicB64 = arrayBufferToBase64(calibriBoldItalic);
  fontsReady = true;
}

function createContentDoc(): jsPDF {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });

  // Poppins (prestadores)
  doc.addFileToVFS('Poppins-Regular.ttf', poppinsRegularB64);
  doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');

  doc.addFileToVFS('Poppins-SemiBold.ttf', poppinsBoldB64);
  doc.addFont('Poppins-SemiBold.ttf', 'Poppins', 'bold');

  doc.addFileToVFS('Poppins-Italic.ttf', poppinsItalicB64);
  doc.addFont('Poppins-Italic.ttf', 'Poppins', 'italic');

  doc.addFileToVFS('Poppins-SemiBoldItalic.ttf', poppinsBoldItalicB64);
  doc.addFont('Poppins-SemiBoldItalic.ttf', 'Poppins', 'bolditalic');

  // Calibri (normas generales)
  doc.addFileToVFS('Calibri-Regular.ttf', calibriRegularB64);
  doc.addFont('Calibri-Regular.ttf', 'Calibri', 'normal');

  doc.addFileToVFS('Calibri-Bold.ttf', calibriBoldB64);
  doc.addFont('Calibri-Bold.ttf', 'Calibri', 'bold');

  doc.addFileToVFS('Calibri-Italic.ttf', calibriItalicB64);
  doc.addFont('Calibri-Italic.ttf', 'Calibri', 'italic');

  doc.addFileToVFS('Calibri-BoldItalic.ttf', calibriBoldItalicB64);
  doc.addFont('Calibri-BoldItalic.ttf', 'Calibri', 'bolditalic');

  doc.setFont('Poppins');
  return doc;
}

// --- Cover page helpers ---

async function createProvinceCover(
  templateBuffer: ArrayBuffer,
  provinceName: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBuffer);
  doc.registerFontkit(fontkit);
  const page = doc.getPages()[0];

  // Embed Poppins-SemiBold (same font as original template)
  const font = await doc.embedFont(poppinsSemiBoldRaw);

  // Cover "TUCUMÁN" with white rect (pdf-lib bottom-left origin)
  page.drawRectangle({
    x: 55,
    y: 435,
    width: 350,
    height: 50,
    color: rgb(1, 1, 1),
  });

  // Draw province name at baseline y=452.34, matching template exactly
  page.drawText(provinceName.toUpperCase(), {
    x: 63.39,
    y: 452.34,
    size: 20,
    font,
    color: rgb(2 / 255, 54 / 255, 112 / 255), // #023670
  });

  return doc.save();
}

// --- Main worker entry ---

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type !== 'START') return;

  try {
    const { prestadores, normasBlocks, programaBlocks } = e.data.payload;
    const sections = groupByProvincia(prestadores);
    const hasNormas = normasBlocks && normasBlocks.length > 0;
    const hasPrograma = programaBlocks && programaBlocks.length > 0;

    // Load fonts (cached after first call)
    await loadFonts();

    // Fetch cover PDFs
    const [generalCoverBuf, normasCoverBuf, prestadoresCoverBuf, provinciaCoverBuf] = await Promise.all([
      fetchBuffer('/Caratula-General.pdf'),
      fetchBuffer('/Caratula-NormasGenerales.pdf'),
      fetchBuffer('/Caratula-ProgramaMedicoAsistencial.pdf'),
      fetchBuffer('/Caratula-Integra4_provincias.pdf'),
    ]);

    // We'll build an ordered list of PDF buffers to merge
    const parts: { label: string; buffer: ArrayBuffer | Uint8Array }[] = [];
    // Cover pages don't count in page numbering for content headers
    // We track contentPage separately (covers are unnumbered)
    let currentPage = 1;

    // 0. General cover (portada principal)
    parts.push({ label: 'Portada General', buffer: generalCoverBuf });

    // Track extra sections for progress
    const extraSections = (hasNormas ? 1 : 0) + (hasPrograma ? 1 : 0);
    const totalSteps = sections.length + extraSections;
    let stepNum = 0;

    // 1. Normas section
    if (hasNormas) {
      stepNum++;
      self.postMessage({
        type: 'PROGRESS',
        payload: { phase: 'generating', current: stepNum, total: totalSteps, message: 'Generando: Normas Generales' },
      } satisfies WorkerMessage);

      parts.push({ label: 'Carátula Normas', buffer: normasCoverBuf });

      const normasBuffer = generateTextSection(normasBlocks!, 'NORMAS GENERALES');
      parts.push({ label: 'Normas Generales', buffer: normasBuffer });
      const loaded = await PDFDocument.load(normasBuffer);
      currentPage += loaded.getPageCount();
    }

    // 2. Programa Médico Asistencial section
    if (hasPrograma) {
      stepNum++;
      self.postMessage({
        type: 'PROGRESS',
        payload: { phase: 'generating', current: stepNum, total: totalSteps, message: 'Generando: Programa Médico Asistencial' },
      } satisfies WorkerMessage);

      parts.push({ label: 'Carátula Programa Médico', buffer: prestadoresCoverBuf });

      const programaBuffer = generateTextSection(programaBlocks!, 'PROGRAMA MÉDICO ASISTENCIAL');
      parts.push({ label: 'Programa Médico Asistencial', buffer: programaBuffer });
      const loaded = await PDFDocument.load(programaBuffer);
      currentPage += loaded.getPageCount();
    }

    // 3. Each province: province cover + content
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      stepNum++;

      self.postMessage({
        type: 'PROGRESS',
        payload: {
          phase: 'generating',
          current: stepNum,
          total: totalSteps,
          message: `Generando: ${section.nombre} (${section.especialidades.length} especialidades)`,
        },
      } satisfies WorkerMessage);

      // Province cover with dynamic name
      const provCoverBytes = await createProvinceCover(provinciaCoverBuf, section.nombre);
      parts.push({ label: `Carátula ${section.nombre}`, buffer: provCoverBytes });

      // Province content
      const provBuffer = generateProvince(section, currentPage);
      parts.push({ label: section.nombre, buffer: provBuffer });
      const loaded = await PDFDocument.load(provBuffer);
      currentPage += loaded.getPageCount();
    }

    // Phase 2: Merge all parts
    self.postMessage({
      type: 'PROGRESS',
      payload: { phase: 'merging', current: 0, total: parts.length, message: 'Preparando documento final...' },
    } satisfies WorkerMessage);

    const merged = await PDFDocument.create();

    for (let i = 0; i < parts.length; i++) {
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          phase: 'merging',
          current: i + 1,
          total: parts.length,
          message: `Uniendo ${parts[i].label}...`,
        },
      } satisfies WorkerMessage);

      const chunkDoc = await PDFDocument.load(parts[i].buffer);
      const pages = await merged.copyPages(chunkDoc, chunkDoc.getPageIndices());
      for (const page of pages) {
        merged.addPage(page);
      }
    }

    const pdfBytes = await merged.save();
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const pageCount = merged.getPageCount();
    const sizeKb = Math.round(blob.size / 1024);

    self.postMessage({
      type: 'COMPLETE',
      payload: { blob, pageCount, sizeKb },
    } satisfies WorkerMessage);
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: err instanceof Error ? err.message : 'Error desconocido' },
    } satisfies WorkerMessage);
  }
};
