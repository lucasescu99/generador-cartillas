import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import type { Prestador, WorkerMessage } from '../types/cartilla.types';

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

// Colors from reference PDF
const COLOR_HEADER_DARK: [number, number, number] = [18, 56, 127];   // #12387f
const COLOR_HEADER_LIGHT: [number, number, number] = [0, 124, 194];  // #007cc2
const COLOR_ESP: [number, number, number] = [0, 125, 195];           // #007dc3
const COLOR_TEXT: [number, number, number] = [18, 57, 128];          // #123980
const COLOR_CENTRO: [number, number, number] = [0, 125, 195];        // #007dc3
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
      list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
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
  doc.setFont('helvetica', 'normal');

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
  doc.setFont('helvetica', 'bold');
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
  doc.setFont('helvetica', centro ? 'bold' : 'normal');
  doc.setTextColor(...(centro ? COLOR_CENTRO : COLOR_TEXT));

  const nombreText = p.nombreInsti ? `${p.nombre} (${p.nombreInsti})` : p.nombre;
  for (const line of wrapText(doc, nombreText, textW)) {
    doc.text(line, x, cursor.y + FS_NOMBRE * 0.35);
    cursor.y += FS_NOMBRE * 0.38;
  }

  // Address
  doc.setFontSize(FS_DETALLE);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_TEXT);

  if (p.direccion) {
    for (const line of wrapText(doc, p.direccion, textW)) {
      doc.text(line, x, cursor.y + FS_DETALLE * 0.35);
      cursor.y += FS_DETALLE * 0.38;
    }
  }

  // Subespecialidades
  if (p.subespecialidades.length > 0) {
    doc.setFont('helvetica', 'italic');
    const subsText = p.subespecialidades.join(' - ');
    for (const line of wrapText(doc, subsText, textW)) {
      doc.text(line, x, cursor.y + FS_DETALLE * 0.35);
      cursor.y += FS_DETALLE * 0.38;
    }
  }

  cursor.y += 1.5;
}

// --- Generate "Normas Generales" pages ---

const FS_NORMAS_BODY = 7;

function drawNormasHeader(doc: jsPDF, pageNum: number): void {
  const tabH = 5.5;
  const tabY = 6;
  const MIN_TAB_W = 28;
  const tabPadX = 3;
  const pageNumGap = 5.6;
  const isRightSide = pageNum % 2 === 0;

  doc.setFontSize(FS_HEADER_TAB);
  doc.setFont('helvetica', 'normal');

  const tabText = 'NORMAS GENERALES';
  const tabW = Math.max(MIN_TAB_W, doc.getTextWidth(tabText) + tabPadX * 2);

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

  // Single tab (dark blue)
  doc.setFillColor(...COLOR_HEADER_DARK);
  doc.rect(tabX, tabY, tabW, tabH, 'F');

  const textY = tabY + tabH / 2 + FS_HEADER_TAB * 0.13;
  doc.setTextColor(...COLOR_WHITE);
  doc.setFontSize(FS_HEADER_TAB);
  const tw = doc.getTextWidth(tabText);
  doc.text(tabText, tabX + (tabW - tw) / 2, textY);

  // Page number
  doc.setTextColor(...COLOR_TEXT);
  doc.text(pageNumText, pageNumX, textY);
}

function generateNormas(text: string): ArrayBuffer {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const cursor: Cursor = { col: 0, y: MARGIN_TOP };
  const textW = USABLE_W; // full width, no columns

  drawNormasHeader(doc, 1);

  doc.setFontSize(FS_NORMAS_BODY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_TEXT);

  const paragraphs = text.split(/\n/);

  for (const para of paragraphs) {
    if (para.trim() === '') {
      cursor.y += FS_NORMAS_BODY * 0.3;
      continue;
    }

    const lines = wrapText(doc, para.trim(), textW);
    const blockH = lines.length * (FS_NORMAS_BODY * 0.42);

    if (cursor.y + blockH > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      cursor.y = MARGIN_TOP;
      drawNormasHeader(doc, doc.getNumberOfPages());
      doc.setFontSize(FS_NORMAS_BODY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_TEXT);
    }

    for (const line of lines) {
      doc.text(line, MARGIN_LEFT, cursor.y + FS_NORMAS_BODY * 0.35);
      cursor.y += FS_NORMAS_BODY * 0.42;
    }
  }

  return doc.output('arraybuffer');
}

// --- Generate pages for a single province ---

function generateProvince(section: ProvinciaSection, startPage: number): ArrayBuffer {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
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
    if (remaining(cursor) < 8) {
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

// --- Main worker entry ---

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type !== 'START') return;

  try {
    const { prestadores, normasText } = e.data.payload;
    const sections = groupByProvincia(prestadores);
    const hasNormas = !!normasText;
    const totalSteps = sections.length + (hasNormas ? 1 : 0);
    const chunkBuffers: ArrayBuffer[] = [];
    let currentPage = 1;
    let stepIndex = 0;

    // Generate "Normas Generales" pages first
    if (hasNormas) {
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          phase: 'generating',
          current: ++stepIndex,
          total: totalSteps,
          message: 'Generando: Normas Generales',
        },
      } satisfies WorkerMessage);

      const normasBuffer = generateNormas(normasText!);
      chunkBuffers.push(normasBuffer);
      // Count pages in normas to offset province page numbers
      const tempDoc = new jsPDF();
      const loaded = await PDFDocument.load(normasBuffer);
      currentPage += loaded.getPageCount();
      void tempDoc;
    }

    // Generate PDF for each province with correct page offset
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      self.postMessage({
        type: 'PROGRESS',
        payload: {
          phase: 'generating',
          current: ++stepIndex,
          total: totalSteps,
          message: `Generando: ${section.nombre} (${section.especialidades.length} especialidades)`,
        },
      } satisfies WorkerMessage);

      const provBuffer = generateProvince(section, currentPage);
      chunkBuffers.push(provBuffer);
      const loaded = await PDFDocument.load(provBuffer);
      currentPage += loaded.getPageCount();
    }

    // Phase 2: Merge all PDFs
    self.postMessage({
      type: 'PROGRESS',
      payload: {
        phase: 'merging',
        current: 0,
        total: chunkBuffers.length,
        message: 'Preparando documento final...',
      },
    } satisfies WorkerMessage);

    const merged = await PDFDocument.create();

    for (let i = 0; i < chunkBuffers.length; i++) {
      const label = i === 0 && hasNormas ? 'Normas Generales' : sections[hasNormas ? i - 1 : i].nombre;
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          phase: 'merging',
          current: i + 1,
          total: chunkBuffers.length,
          message: `Uniendo ${label}...`,
        },
      } satisfies WorkerMessage);

      const chunkDoc = await PDFDocument.load(chunkBuffers[i]);
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
