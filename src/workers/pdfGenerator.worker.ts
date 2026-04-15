import { jsPDF } from 'jspdf';
import { PDFDocument, rgb } from 'pdf-lib';
// @ts-ignore fontkit CJS/ESM interop
import _fontkit from '@pdf-lib/fontkit';
const fontkit: any = (_fontkit as any).default || _fontkit;
import type { Prestador, NormasBlock, NormasSpan, SectionKey, WorkerMessage } from '../types/cartilla.types';

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
const FS_HEADER_TAB = 8;
const FS_ESPECIALIDAD = 8;
const FS_NOMBRE = 7;
const FS_DETALLE = 6.5;

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

interface LocalidadGroup {
  nombre: string;
  especialidades: EspGroup[];
}

interface RubroSection {
  nombre: string;
  localidades: LocalidadGroup[];
}

interface ZonaSection {
  nombre: string;
  rubros: RubroSection[];
}

interface ProvinciaSection {
  nombre: string;
  zonas: ZonaSection[];
}

// --- Data grouping: provincia → zona → rubro → localidad (alphabetical) → especialidad → prestadores ---

function groupByProvincia(
  prestadores: Prestador[],
  provinciaOrder?: string[],
  zonaOrder?: string[],
  rubroOrder?: string[],
): ProvinciaSection[] {
  const provMap = new Map<string, Prestador[]>();

  for (const p of prestadores) {
    const prov = (p.provincia || 'SIN PROVINCIA').trim().toUpperCase();
    if (!provMap.has(prov)) provMap.set(prov, []);
    provMap.get(prov)!.push(p);
  }

  const sortedProvs = provinciaOrder && provinciaOrder.length > 0
    ? provinciaOrder.filter((p) => provMap.has(p))
    : Array.from(provMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));

  const sections: ProvinciaSection[] = [];

  for (const provNombre of sortedProvs) {
    const provPrestadores = provMap.get(provNombre)!;

    // Group by zona
    const zonaMap = new Map<string, Prestador[]>();
    for (const p of provPrestadores) {
      const zona = (p.zona || 'SIN ZONA').trim().toUpperCase();
      if (!zonaMap.has(zona)) zonaMap.set(zona, []);
      zonaMap.get(zona)!.push(p);
    }

    const sortedZonas = zonaOrder && zonaOrder.length > 0
      ? zonaOrder.filter((z) => zonaMap.has(z))
      : Array.from(zonaMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));

    const zonas: ZonaSection[] = [];

    for (const zonaNombre of sortedZonas) {
      const zonaPrestadores = zonaMap.get(zonaNombre)!;

      // Group by rubro within this zona
      const rubroMap = new Map<string, Prestador[]>();
      for (const p of zonaPrestadores) {
        const rubro = p.rubro.toUpperCase().trim();
        if (!rubroMap.has(rubro)) rubroMap.set(rubro, []);
        rubroMap.get(rubro)!.push(p);
      }

      const sortedRubros = rubroOrder && rubroOrder.length > 0
        ? rubroOrder.filter((r) => rubroMap.has(r))
        : Array.from(rubroMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));

      const rubros: RubroSection[] = [];

      for (const rubroNombre of sortedRubros) {
        const rubroPrestadores = rubroMap.get(rubroNombre)!;

        // Group by localidad (always alphabetical)
        const locMap = new Map<string, Prestador[]>();
        for (const p of rubroPrestadores) {
          const loc = (p.localidad || 'SIN LOCALIDAD').trim().toUpperCase();
          if (!locMap.has(loc)) locMap.set(loc, []);
          locMap.get(loc)!.push(p);
        }

        const sortedLocs = Array.from(locMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));
        const localidades: LocalidadGroup[] = [];

        for (const locNombre of sortedLocs) {
          const locPrestadores = locMap.get(locNombre)!;

          // Group by especialidad within this localidad
          const espMap = new Map<string, Prestador[]>();
          for (const p of locPrestadores) {
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

          localidades.push({ nombre: locNombre, especialidades });
        }

        rubros.push({ nombre: rubroNombre, localidades });
      }

      zonas.push({ nombre: zonaNombre, rubros });
    }

    sections.push({ nombre: provNombre, zonas });
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

function drawHeader(doc: jsPDF, zona: string, rubro: string, pageNum: number): void {
  const tabH = 5.5;
  const tabY = 6;
  const MIN_TAB_W = 28;
  const tabPadX = 3;
  const pageNumGap = 5.6;
  const isRightSide = pageNum % 2 !== 0; // odd = right, even = left

  doc.setFontSize(FS_HEADER_TAB);
  doc.setFont('Poppins', 'normal');

  const zonaText = zona.toUpperCase();
  const zonaTabW = Math.max(MIN_TAB_W, doc.getTextWidth(zonaText) + tabPadX * 2);

  const rubroText = rubro.toUpperCase();
  const rubroTabW = Math.max(MIN_TAB_W, doc.getTextWidth(rubroText) + tabPadX * 2);

  const pageNumText = String(pageNum);
  const pageNumW = doc.getTextWidth(pageNumText);

  let zonaTabX: number;
  let rubroTabX: number;
  let pageNumX: number;

  if (isRightSide) {
    // Right-aligned: [ZONA] [RUBRO]  pageNum
    const rightEdge = PAGE_W - MARGIN_RIGHT;
    pageNumX = rightEdge - pageNumW;
    const tabsRight = pageNumX - pageNumGap;
    rubroTabX = tabsRight - rubroTabW;
    zonaTabX = rubroTabX - zonaTabW;
  } else {
    // Left-aligned: pageNum  [RUBRO] [ZONA]
    pageNumX = MARGIN_LEFT;
    const tabsLeft = pageNumX + pageNumW + pageNumGap;
    rubroTabX = tabsLeft;
    zonaTabX = rubroTabX + rubroTabW;
  }

  // Zona tab (lighter blue)
  doc.setFillColor(...COLOR_HEADER_LIGHT);
  doc.rect(zonaTabX, tabY, zonaTabW, tabH, 'F');

  // Rubro tab (darker blue)
  doc.setFillColor(...COLOR_HEADER_DARK);
  doc.rect(rubroTabX, tabY, rubroTabW, tabH, 'F');

  // Tab texts - centered vertically
  const textY = tabY + tabH / 2 + FS_HEADER_TAB * 0.13;
  doc.setTextColor(...COLOR_WHITE);
  doc.setFontSize(FS_HEADER_TAB);

  const zonaTW = doc.getTextWidth(zonaText);
  doc.text(zonaText, zonaTabX + (zonaTabW - zonaTW) / 2, textY);
  const rubroTW = doc.getTextWidth(rubroText);
  doc.text(rubroText, rubroTabX + (rubroTabW - rubroTW) / 2, textY);

  // Page number
  doc.setTextColor(...COLOR_TEXT);
  doc.text(pageNumText, pageNumX, textY);
}


// --- Localidad header: full-width dark blue text with centered line ---
const FS_LOCALIDAD = 7;
const LOCALIDAD_LINE_W = 0.3;
const LOCALIDAD_GAP_AFTER = 2.5;

function measureLocalidadHeader(): number {
  return FS_LOCALIDAD * 0.38 + LOCALIDAD_GAP_AFTER + 2;
}

function drawLocalidadHeader(doc: jsPDF, cursor: Cursor, localidad: string, cont: boolean): void {
  const colLeft = colX(cursor.col);
  const label = cont ? `${localidad} (cont.)` : localidad;

  // The line spans the full width of the current column
  const lineY = cursor.y + 0.5;
  doc.setDrawColor(...COLOR_HEADER_DARK);
  doc.setLineWidth(LOCALIDAD_LINE_W);
  doc.line(colLeft, lineY, colLeft + COL_W, lineY);

  cursor.y += 1.5;

  // Text below the line, left-aligned
  doc.setFontSize(FS_LOCALIDAD);
  doc.setFont('Poppins', 'bold');
  doc.setTextColor(...COLOR_HEADER_DARK);

  for (const line of wrapText(doc, label, COL_W)) {
    doc.text(line, colLeft, cursor.y + FS_LOCALIDAD * 0.35);
    cursor.y += FS_LOCALIDAD * 0.38;
  }

  cursor.y += LOCALIDAD_GAP_AFTER;
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
  if (p.telefono) {
    h += wrapText(doc, p.telefono, textW).length * (FS_DETALLE * 0.38);
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

  // Teléfono
  if (p.telefono) {
    doc.setFont('Poppins', 'normal');
    for (const line of wrapText(doc, p.telefono, textW)) {
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
const NORMAS_PARA_GAP = 6 * PT_TO_MM;   // ~2.12mm entre párrafos
const NORMAS_TITLE_GAP = 19 * PT_TO_MM; // ~6.70mm después de título
const NORMAS_FONT = 'Calibri';
// Two-column bullet list layout
const LIST_COL_GAP = 15 * PT_TO_MM;     // 15pt (~5.3mm) minimum gap between columns
const LIST_BULLET = '\u2022 ';

function drawSectionHeader(doc: jsPDF, tabText: string, pageNum: number): void {
  const tabH = 5.5;
  const tabY = 6;
  const MIN_TAB_W = 28;
  const tabPadX = 3;
  const pageNumGap = 5.6;
  const FS_TAB = 10;  // Calibri Bold 10pt per reference
  const isRightSide = pageNum % 2 !== 0; // odd = right, even = left

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

const FS_NORMAS_SUBTITLE = 10; // h2 subtitles: 10pt Bold (per reference)

function blockFontSize(block: NormasBlock): number {
  if (block.type === 'heading') {
    // h1 = 12pt, h2+ = 10pt Bold
    return (block.level ?? 1) <= 1 ? FS_NORMAS_HEADING : FS_NORMAS_SUBTITLE;
  }
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

function headingAfterGap(block: NormasBlock): number {
  // h1 titles: full title gap after. h2 subtitles: smaller gap (closer to content)
  return (block.level ?? 1) <= 1 ? NORMAS_TITLE_GAP : NORMAS_LINE_H;
}

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
  const afterGap = block.type === 'heading' ? headingAfterGap(block) : NORMAS_PARA_GAP;
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

  const justify = block.type === 'paragraph';

  if (!hasLinks) {
    // Fast path: no links, draw all text at once
    doc.setFontSize(fs);
    doc.setFont(NORMAS_FONT, blockFontStyle(block));
    doc.setTextColor(...COLOR_TEXT);

    const lines = wrapText(doc, prefix + text, maxW);
    for (let li = 0; li < lines.length; li++) {
      const isLastLine = li === lines.length - 1;
      if (justify && !isLastLine) {
        doc.text(lines[li], MARGIN_LEFT, y + fs * 0.35, { align: 'justify', maxWidth: maxW });
      } else {
        doc.text(lines[li], MARGIN_LEFT, y + fs * 0.35);
      }
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
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const isLastLine = li === lines.length - 1;
      // Render line, then overlay links
      doc.setFont(NORMAS_FONT, baseStyle);
      doc.setTextColor(...COLOR_TEXT);
      if (justify && !isLastLine) {
        doc.text(line, MARGIN_LEFT, y + fs * 0.35, { align: 'justify', maxWidth: maxW });
      } else {
        doc.text(line, MARGIN_LEFT, y + fs * 0.35);
      }

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

  y += block.type === 'heading' ? headingAfterGap(block) : NORMAS_PARA_GAP;

  return y;
}

// --- Two-column list helpers ---

function measureListItem2Col(doc: jsPDF, block: NormasBlock, colW: number): number {
  const fs = FS_NORMAS_LIST;
  doc.setFontSize(fs);
  doc.setFont(NORMAS_FONT, blockFontStyle(block));
  const text = LIST_BULLET + spanText(block.spans);
  const lines = wrapText(doc, text, colW);
  return lines.length * NORMAS_LINE_H;
}

function drawListItem2Col(doc: jsPDF, x: number, y: number, block: NormasBlock, colW: number): number {
  const fs = FS_NORMAS_LIST;
  const text = LIST_BULLET + spanText(block.spans);
  doc.setFontSize(fs);
  doc.setFont(NORMAS_FONT, blockFontStyle(block));
  doc.setTextColor(...COLOR_TEXT);
  const lines = wrapText(doc, text, colW);
  for (const line of lines) {
    doc.text(line, x, y + fs * 0.35);
    y += NORMAS_LINE_H;
  }
  return y;
}

/**
 * Measure the total height of a batch of list items rendered in two columns.
 * Items are split: first half in left column, second half in right column.
 */
function measureListBatch2Col(doc: jsPDF, items: NormasBlock[], textW: number): number {
  const colW = (textW - LIST_COL_GAP) / 2;
  const half = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, half);
  const rightItems = items.slice(half);

  let leftH = 0;
  for (const item of leftItems) leftH += measureListItem2Col(doc, item, colW);
  let rightH = 0;
  for (const item of rightItems) rightH += measureListItem2Col(doc, item, colW);

  return Math.max(leftH, rightH) + NORMAS_PARA_GAP;
}

/**
 * Draw a batch of list items in two columns.
 */
function drawListBatch2Col(doc: jsPDF, y: number, items: NormasBlock[], textW: number): number {
  const colW = (textW - LIST_COL_GAP) / 2;
  const half = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, half);
  const rightItems = items.slice(half);

  const leftX = MARGIN_LEFT;
  const rightX = MARGIN_LEFT + colW + LIST_COL_GAP;

  let leftY = y;
  for (const item of leftItems) {
    leftY = drawListItem2Col(doc, leftX, leftY, item, colW);
  }

  let rightY = y;
  for (const item of rightItems) {
    rightY = drawListItem2Col(doc, rightX, rightY, item, colW);
  }

  return Math.max(leftY, rightY) + NORMAS_PARA_GAP;
}

function generateTextSection(blocks: NormasBlock[], headerText: string, startPage: number): ArrayBuffer {
  const doc = createContentDoc();
  let y = MARGIN_TOP;
  const textW = USABLE_W;

  const getPageNum = () => startPage + doc.getNumberOfPages() - 1;

  drawSectionHeader(doc, headerText, getPageNum());

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    // Batch consecutive list-item blocks for two-column layout
    if (block.type === 'list-item') {
      const batchStart = i;
      while (i < blocks.length && blocks[i].type === 'list-item') i++;
      let batch = blocks.slice(batchStart, i);

      // Render batch, splitting across pages if needed
      while (batch.length > 0) {
        const batchH = measureListBatch2Col(doc, batch, textW);
        const availH = PAGE_H - MARGIN_BOTTOM - y;

        if (batchH <= availH) {
          y = drawListBatch2Col(doc, y, batch, textW);
          break;
        }

        // If even a fresh page can't fit entire batch, just draw what we can
        if (y > MARGIN_TOP) {
          doc.addPage();
          y = MARGIN_TOP;
          drawSectionHeader(doc, headerText, getPageNum());
        }

        // If batch still doesn't fit on a fresh page, draw it anyway (best effort)
        y = drawListBatch2Col(doc, y, batch, textW);
        break;
      }
      continue;
    }

    // Regular block (heading, paragraph, table-row)
    const blockH = measureBlock(doc, block, textW);

    // Keep headings with the next block — avoid orphaned titles at page bottom
    let requiredH = blockH;
    if (block.type === 'heading' && i + 1 < blocks.length) {
      const next = blocks[i + 1];
      if (next.type === 'list-item') {
        // Next is a list batch — estimate at least a few lines
        requiredH += NORMAS_LINE_H * 3;
      } else {
        requiredH += measureBlock(doc, next, textW);
      }
    }

    if (y + requiredH > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      drawSectionHeader(doc, headerText, getPageNum());
    }

    y = drawBlock(doc, y, block, textW);
    i++;
  }

  return doc.output('arraybuffer');
}

// --- Generate pages for a single zona+rubro ---

function generateZonaRubro(
  zonaNombre: string,
  rubro: RubroSection,
  startPage: number,
): ArrayBuffer {
  const doc = createContentDoc();
  const cursor: Cursor = { col: 0, y: MARGIN_TOP };

  drawHeader(doc, zonaNombre, rubro.nombre, startPage);

  const getPageNum = () => startPage + doc.getNumberOfPages() - 1;

  const nextCol = (cur: Cursor) => {
    if (cur.col < NUM_COLS - 1) {
      cur.col++;
      cur.y = MARGIN_TOP;
    } else {
      doc.addPage();
      cur.col = 0;
      cur.y = MARGIN_TOP;
      drawHeader(doc, zonaNombre, rubro.nombre, getPageNum());
    }
  };

  let currentLoc = '';
  const drawnLocs = new Set<string>();

  for (const loc of rubro.localidades) {
    for (const esp of loc.especialidades) {
      // Check if we need a localidad header
      const needLocHeader = loc.nombre !== currentLoc;
      const locHeaderH = needLocHeader ? measureLocalidadHeader() : 0;
      const firstPH = esp.prestadores.length > 0 ? measurePrestador(doc, esp.prestadores[0]) : 0;

      if (remaining(cursor) < locHeaderH + 8 + firstPH) {
        nextCol(cursor);
        currentLoc = '';
      }

      // Draw localidad header if entering a new localidad
      if (loc.nombre !== currentLoc) {
        const isCont = drawnLocs.has(loc.nombre);
        drawLocalidadHeader(doc, cursor, loc.nombre, isCont);
        currentLoc = loc.nombre;
        drawnLocs.add(loc.nombre);
      }

      // Especialidad header
      if (remaining(cursor) < 8 + firstPH) {
        nextCol(cursor);
        drawLocalidadHeader(doc, cursor, loc.nombre, true);
        currentLoc = loc.nombre;
      }

      drawEspHeader(doc, cursor, esp.nombre, false);

      for (const prest of esp.prestadores) {
        const pH = measurePrestador(doc, prest);
        if (remaining(cursor) < pH) {
          nextCol(cursor);
          drawLocalidadHeader(doc, cursor, loc.nombre, true);
          currentLoc = loc.nombre;
          drawEspHeader(doc, cursor, esp.nombre, true);
        }
        drawPrestador(doc, cursor, prest);
      }

      cursor.y += 1;
    }
  }

  return doc.output('arraybuffer');
}

// --- Font helpers ---

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return res.arrayBuffer();
}

async function tryFetchBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// Province name → pre-rendered cover filename (without extension).
// Keys are the province name with accents stripped, spaces removed, uppercased.
const PROVINCE_COVER_MAP: Record<string, string> = {
  BUENOSAIRES: 'Caratula-MS_BuenosAires',
  CABA: 'Caratula-MS_CABAyAMBA',
  CAPITALFEDERAL: 'Caratula-MS_CABAyAMBA',
  CIUDADDEBUENOSAIRES: 'Caratula-MS_CABAyAMBA',
  CIUDADAUTONOMADEBUENOSAIRES: 'Caratula-MS_CABAyAMBA',
  AMBA: 'Caratula-MS_CABAyAMBA',
  CATAMARCA: 'Caratula-MS_Catamarca',
  CHACO: 'Caratula-MS_Chaco',
  CHUBUT: 'Caratula-MS_Chubut',
  CORDOBA: 'Caratula-MS_Cordoba',
  CORRIENTES: 'Caratula-MS_Corrientes',
  ENTRERIOS: 'Caratula-MS_EntreRios',
  FORMOSA: 'Caratula-MS_Formosa',
  JUJUY: 'Caratula-MS_Jujuy',
  LAPAMPA: 'Caratula-MS_LaPampa',
  LARIOJA: 'Caratula-MS_LaRioja',
  MENDOZA: 'Caratula-MS_Mendoza',
  MISIONES: 'Caratula-MS_Misiones',
  NEUQUEN: 'Caratula-MS_Neuquen',
  RIONEGRO: 'Caratula-MS_RioNegro',
  SALTA: 'Caratula-MS_Salta',
  SANJUAN: 'Caratula-MS_SanJuan',
  SANLUIS: 'Caratula-MS_SanLuis',
  SANTACRUZ: 'Caratula-MS_SantaCruz',
  SANTAFE: 'Caratula-MS_SantaFe',
  SANTIAGODELESTERO: 'Caratula-MS_SantiagoDelEstero',
  TIERRADELFUEGO: 'Caratula-MS_TierraDelFuego',
  TUCUMAN: 'Caratula-MS_Tucuman',
};

function provinceCoverFilename(provinceName: string): string | null {
  const key = provinceName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
  return PROVINCE_COVER_MAP[key] ?? null;
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
let poppinsRegularRaw: ArrayBuffer;
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
  poppinsRegularRaw = poppinsRegular;
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

  const fontRegular = await doc.embedFont(poppinsRegularRaw);
  const fontBold = await doc.embedFont(poppinsSemiBoldRaw);
  const brandColor = rgb(2 / 255, 54 / 255, 112 / 255); // #023670

  // Cover "Plan Integra 4" with white rect (pdf-lib bottom-left origin)
  page.drawRectangle({
    x: 55,
    y: 475,
    width: 400,
    height: 50,
    color: rgb(1, 1, 1),
  });

  // Draw "Plan " in regular + "MS" in bold
  const planSize = 30;
  const planText = 'Plan ';
  const msText = 'MS';
  const planTextY = 490;
  const planX = 63.39;

  page.drawText(planText, {
    x: planX,
    y: planTextY,
    size: planSize,
    font: fontRegular,
    color: brandColor,
  });

  const planWidth = fontRegular.widthOfTextAtSize(planText, planSize);
  page.drawText(msText, {
    x: planX + planWidth,
    y: planTextY,
    size: planSize,
    font: fontBold,
    color: brandColor,
  });

  // Cover "TUCUMÁN" with white rect
  page.drawRectangle({
    x: 55,
    y: 435,
    width: 350,
    height: 50,
    color: rgb(1, 1, 1),
  });

  // Draw province name
  page.drawText(provinceName.toUpperCase(), {
    x: 63.39,
    y: 452.34,
    size: 20,
    font: fontBold,
    color: brandColor,
  });

  return doc.save();
}

// --- Index page ---

interface IndexEntry {
  label: string;
  pageNum: number;
  indent?: boolean;
  color?: [number, number, number];
}

function generateIndexPage(entries: IndexEntry[]): ArrayBuffer {
  const doc = createContentDoc();
  let y = MARGIN_TOP + 5;

  // Title
  doc.setFontSize(16);
  doc.setFont('Poppins', 'bold');
  doc.setTextColor(...COLOR_HEADER_DARK);
  doc.text('ÍNDICE', PAGE_W / 2, y, { align: 'center' });
  y += 12;

  // Separator line
  doc.setDrawColor(...COLOR_HEADER_DARK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_W - MARGIN_RIGHT, y);
  y += 8;

  const maxW = USABLE_W;
  const dotGap = 1.2;

  for (const entry of entries) {
    const fs = entry.indent ? 9 : 11;
    const fontStyle = entry.indent ? 'normal' : 'bold';
    const xOffset = entry.indent ? 10 : 0;

    const textColor: [number, number, number] = entry.color || COLOR_HEADER_DARK;

    doc.setFontSize(fs);
    doc.setFont('Poppins', fontStyle);
    doc.setTextColor(...textColor);

    const labelW = doc.getTextWidth(entry.label);
    const pageText = String(entry.pageNum);
    const pageW = doc.getTextWidth(pageText);

    // Draw label
    doc.text(entry.label, MARGIN_LEFT + xOffset, y + fs * 0.35);

    // Draw page number (right-aligned)
    doc.text(pageText, MARGIN_LEFT + maxW - pageW, y + fs * 0.35);

    // Draw dotted leader between label and page number
    doc.setFontSize(fs);
    const dotText = '.';
    const dotW = doc.getTextWidth(dotText);
    let dotX = MARGIN_LEFT + xOffset + labelW + 2;
    const dotEnd = MARGIN_LEFT + maxW - pageW - 2;

    doc.setTextColor(180, 180, 180);
    while (dotX + dotW < dotEnd) {
      doc.text(dotText, dotX, y + fs * 0.35);
      dotX += dotW + dotGap;
    }

    y += fs * 0.38 + (entry.indent ? 4 : 6);

    // Page break if needed
    if (y > PAGE_H - MARGIN_BOTTOM - 10) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  }

  return doc.output('arraybuffer');
}

// --- Main worker entry ---

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type !== 'START') return;

  try {
    const { prestadores, textBlocks, planOperativoBlocks, sectionOrder, provinciaOrder, zonaOrder, rubroOrder } = e.data.payload;
    const sections = groupByProvincia(prestadores, provinciaOrder, zonaOrder, rubroOrder);
    const hasText = textBlocks && textBlocks.length > 0;
    const hasPlan = planOperativoBlocks && planOperativoBlocks.length > 0;
    const order: SectionKey[] = sectionOrder && sectionOrder.length > 0
      ? sectionOrder
      : ['plan', 'contactos', 'provincias'];

    // Load fonts (cached after first call)
    await loadFonts();

    // Fetch cover PDFs
    const [generalCoverBuf, textCoverBuf, planCoverBuf, provinciaCoverBuf] = await Promise.all([
      fetchBuffer('/Caratula-General.pdf'),
      fetchBuffer('/Caratula-ContactosServiciosCobertura.pdf'),
      fetchBuffer('/Caratula-PlanImplementacionOperativa.pdf'),
      fetchBuffer('/Caratula-MS_provincias.pdf'),
    ]);

    // ================================================================
    // PAGE NUMBERING STRATEGY
    // ================================================================
    // All pages (covers, index, content) count in the absolute numbering.
    // Covers and index don't DISPLAY a page number, but they occupy positions.
    // Content headers show the absolute page number.
    //
    // We use a two-pass approach:
    //   Pass 1: Generate all content with estimated absolute page numbers
    //           (assuming index = 1 page). Record page counts for each part.
    //   Pass 2: Build index entries with correct absolute page numbers,
    //           generate the index, verify its page count, regenerate if needed.
    // ================================================================

    // Parts list and their page counts (parallel arrays)
    const parts: { label: string; buffer: ArrayBuffer | Uint8Array }[] = [];
    const partPages: number[] = [];

    // Fixed pages before any generated content:
    // [0] General cover = 1 page
    // [1] Index = ? pages (assume 1, verify later)
    const COVER_PAGES = 1;
    let indexPageCount = 1; // initial assumption

    // Absolute page counter: tracks the next available page number
    // Starts after cover + index
    let absPage = COVER_PAGES + indexPageCount + 1; // first page after cover+index

    // 0. General cover
    parts.push({ label: 'Portada General', buffer: generalCoverBuf });
    partPages.push(1);

    // Slot where the index will be inserted
    const INDEX_SLOT = parts.length;

    // Progress tracking
    const totalZonaRubroSections = sections.reduce((sum, s) =>
      sum + s.zonas.reduce((zSum, z) => zSum + z.rubros.length, 0), 0);
    const extraSections = (hasText ? 1 : 0) + (hasPlan ? 1 : 0);
    const totalSteps = totalZonaRubroSections + extraSections;
    let stepNum = 0;

    // Index tracking structures
    interface ProvIndex {
      name: string;
      partIndex: number;
      zonas: { name: string; partIndex: number }[];
    }
    const provinceIndices: ProvIndex[] = [];
    let planPartIndex = -1;
    let contactosPartIndex = -1;

    // Iterate top-level sections in the order requested by the user.
    for (const sectionKey of order) {
      if (sectionKey === 'plan' && hasPlan) {
        stepNum++;
        self.postMessage({
          type: 'PROGRESS',
          payload: { phase: 'generating', current: stepNum, total: totalSteps, message: 'Generando: Plan de Implementación Operativa' },
        } satisfies WorkerMessage);

        planPartIndex = parts.length;
        parts.push({ label: 'Carátula Plan de Implementación Operativa', buffer: planCoverBuf });
        partPages.push(1);
        absPage += 1;

        const planBuffer = generateTextSection(planOperativoBlocks!, 'PLAN DE IMPLEMENTACIÓN OPERATIVA', absPage);
        const loaded = await PDFDocument.load(planBuffer);
        const planPageCount = loaded.getPageCount();
        parts.push({ label: 'Plan de Implementación Operativa', buffer: planBuffer });
        partPages.push(planPageCount);
        absPage += planPageCount;
      } else if (sectionKey === 'contactos' && hasText) {
        stepNum++;
        self.postMessage({
          type: 'PROGRESS',
          payload: { phase: 'generating', current: stepNum, total: totalSteps, message: 'Generando: Contactos, Servicios y Cobertura' },
        } satisfies WorkerMessage);

        contactosPartIndex = parts.length;
        parts.push({ label: 'Carátula Contactos, Servicios y Cobertura', buffer: textCoverBuf });
        partPages.push(1);
        absPage += 1;

        const textBuffer = generateTextSection(textBlocks!, 'CONTACTOS, SERVICIOS Y COBERTURA', absPage);
        const loaded = await PDFDocument.load(textBuffer);
        const textPageCount = loaded.getPageCount();
        parts.push({ label: 'Contactos, Servicios y Cobertura', buffer: textBuffer });
        partPages.push(textPageCount);
        absPage += textPageCount;
      } else if (sectionKey === 'provincias') {
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];

          const provEntry: ProvIndex = { name: section.nombre, partIndex: parts.length, zonas: [] };

          // Province cover: prefer pre-rendered per-province PDF, fall back to
          // overlay template.
          const coverFilename = provinceCoverFilename(section.nombre);
          let provCoverBuffer: ArrayBuffer | Uint8Array | null = null;
          if (coverFilename) {
            provCoverBuffer = await tryFetchBuffer(`/${coverFilename}.pdf`);
          }
          if (!provCoverBuffer) {
            provCoverBuffer = await createProvinceCover(provinciaCoverBuf, section.nombre);
          }
          parts.push({ label: `Carátula ${section.nombre}`, buffer: provCoverBuffer });
          partPages.push(1);
          absPage += 1;

          for (const zona of section.zonas) {
            const zonaPartIndex = parts.length;

            for (const rubro of zona.rubros) {
              stepNum++;

              self.postMessage({
                type: 'PROGRESS',
                payload: {
                  phase: 'generating',
                  current: stepNum,
                  total: totalSteps,
                  message: `Generando: ${zona.nombre} — ${rubro.nombre} (${rubro.localidades.length} localidades)`,
                },
              } satisfies WorkerMessage);

              const rubroBuffer = generateZonaRubro(zona.nombre, rubro, absPage);
              const loaded = await PDFDocument.load(rubroBuffer);
              const rubroPageCount = loaded.getPageCount();
              parts.push({ label: `${zona.nombre} — ${rubro.nombre}`, buffer: rubroBuffer });
              partPages.push(rubroPageCount);
              absPage += rubroPageCount;
            }

            provEntry.zonas.push({ name: zona.nombre, partIndex: zonaPartIndex });
          }

          provinceIndices.push(provEntry);
        }
      }
    }

    // ================================================================
    // 3. Generate index
    // ================================================================
    // Calculate absolute page for each entry in the final merged PDF.
    // Final order: parts[0]=cover, INDEX, parts[INDEX_SLOT..end]
    //
    // absPageOf(partIndex) = COVER_PAGES + indexPageCount
    //                        + sum(partPages[INDEX_SLOT .. partIndex-1])
    //                        + 1   (this part starts on the NEXT page)

    const calcAbsPageOf = (partIndex: number, idxPages: number): number => {
      let total = COVER_PAGES + idxPages;
      for (let p = INDEX_SLOT; p < partIndex; p++) {
        total += partPages[p];
      }
      return total + 1;
    };

    const buildIndexEntries = (idxPages: number): IndexEntry[] => {
      const entries: IndexEntry[] = [];
      const COLOR_BLACK: [number, number, number] = [0, 0, 0];

      for (const sectionKey of order) {
        if (sectionKey === 'plan' && hasPlan && planPartIndex >= 0) {
          entries.push({
            label: 'PLAN DE IMPLEMENTACIÓN OPERATIVA',
            pageNum: calcAbsPageOf(planPartIndex, idxPages),
          });
        } else if (sectionKey === 'contactos' && hasText && contactosPartIndex >= 0) {
          entries.push({
            label: 'CONTACTOS, SERVICIOS Y COBERTURA',
            pageNum: calcAbsPageOf(contactosPartIndex, idxPages),
          });
        } else if (sectionKey === 'provincias') {
          for (const prov of provinceIndices) {
            entries.push({
              label: prov.name,
              pageNum: calcAbsPageOf(prov.partIndex, idxPages),
            });
            for (const zona of prov.zonas) {
              entries.push({
                label: zona.name,
                pageNum: calcAbsPageOf(zona.partIndex, idxPages),
                indent: true,
                color: COLOR_BLACK,
              });
            }
          }
        }
      }

      return entries;
    };

    // First attempt: generate index with assumed page count
    let indexEntries = buildIndexEntries(indexPageCount);
    let indexBuffer = generateIndexPage(indexEntries);
    let actualIndexPages = (await PDFDocument.load(indexBuffer)).getPageCount();

    // If assumption was wrong, recalculate with correct page count
    if (actualIndexPages !== indexPageCount) {
      indexPageCount = actualIndexPages;
      indexEntries = buildIndexEntries(indexPageCount);
      indexBuffer = generateIndexPage(indexEntries);
    }

    parts.splice(INDEX_SLOT, 0, { label: 'Índice', buffer: indexBuffer });
    partPages.splice(INDEX_SLOT, 0, indexPageCount);

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
