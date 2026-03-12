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

// Normas font sizes
const FS_NORMAS_H1 = 11;
const FS_NORMAS_H2 = 9;
const FS_NORMAS_H3 = 8;
const FS_NORMAS_BODY = 7;
const FS_NORMAS_LIST = 6.5;

function drawNormasHeader(doc: jsPDF, pageNum: number): void {
  const tabH = 5.5;
  const tabY = 6;
  const MIN_TAB_W = 28;
  const tabPadX = 3;
  const pageNumGap = 5.6;
  const isRightSide = pageNum % 2 === 0;

  doc.setFontSize(FS_HEADER_TAB);
  doc.setFont('Poppins', 'normal');

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

  doc.setFillColor(...COLOR_HEADER_DARK);
  doc.rect(tabX, tabY, tabW, tabH, 'F');

  const textY = tabY + tabH / 2 + FS_HEADER_TAB * 0.13;
  doc.setTextColor(...COLOR_WHITE);
  doc.setFontSize(FS_HEADER_TAB);
  const tw = doc.getTextWidth(tabText);
  doc.text(tabText, tabX + (tabW - tw) / 2, textY);

  doc.setTextColor(...COLOR_TEXT);
  doc.text(pageNumText, pageNumX, textY);
}

function blockFontSize(block: NormasBlock): number {
  if (block.type === 'heading') {
    if (block.level === 1) return FS_NORMAS_H1;
    if (block.level === 2) return FS_NORMAS_H2;
    return FS_NORMAS_H3;
  }
  if (block.type === 'list-item') return FS_NORMAS_LIST;
  return FS_NORMAS_BODY;
}

function spanText(spans: NormasSpan[]): string {
  return spans.map((s) => s.text).join('');
}

function measureBlock(doc: jsPDF, block: NormasBlock, maxW: number): number {
  const fs = blockFontSize(block);
  doc.setFontSize(fs);
  const text = spanText(block.spans);
  if (!text.trim()) return fs * 0.3;
  const prefix = block.type === 'list-item' ? '  - ' : '';
  const lines = wrapText(doc, prefix + text, maxW);
  return lines.length * (fs * 0.42) + (block.type === 'heading' ? 2 : 0.5);
}

function drawBlock(doc: jsPDF, y: number, block: NormasBlock, maxW: number): number {
  const fs = blockFontSize(block);
  const text = spanText(block.spans);

  if (!text.trim()) return y + fs * 0.3;

  // Determine dominant style from spans
  const hasBold = block.type === 'heading' || block.spans.some((s) => s.bold);
  const hasItalic = block.spans.some((s) => s.italic);

  let fontStyle: string = 'normal';
  if (hasBold && hasItalic) fontStyle = 'bolditalic';
  else if (hasBold) fontStyle = 'bold';
  else if (hasItalic) fontStyle = 'italic';

  doc.setFontSize(fs);
  doc.setFont('Poppins', fontStyle);

  if (block.type === 'heading') {
    doc.setTextColor(...COLOR_ESP);
  } else {
    doc.setTextColor(...COLOR_TEXT);
  }

  const prefix = block.type === 'list-item' ? '  - ' : '';
  const lines = wrapText(doc, prefix + text, maxW);

  for (const line of lines) {
    doc.text(line, MARGIN_LEFT, y + fs * 0.35);
    y += fs * 0.42;
  }

  if (block.type === 'heading') y += 1.5;

  return y;
}

function generateNormas(blocks: NormasBlock[]): ArrayBuffer {
  const doc = createContentDoc();
  let y = MARGIN_TOP;
  const textW = USABLE_W;

  drawNormasHeader(doc, 1);

  for (const block of blocks) {
    const blockH = measureBlock(doc, block, textW);

    if (y + blockH > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      drawNormasHeader(doc, doc.getNumberOfPages());
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
let fontRegularB64 = '';
let fontBoldB64 = '';
let fontItalicB64 = '';
let fontBoldItalicB64 = '';
let poppinsSemiBoldRaw: ArrayBuffer;

async function loadFonts(): Promise<void> {
  if (fontsReady) return;
  const [regular, bold, italic, boldItalic] = await Promise.all([
    fetchBuffer('/Poppins-Regular.ttf'),
    fetchBuffer('/Poppins-SemiBold.ttf'),
    fetchBuffer('/Poppins-Italic.ttf'),
    fetchBuffer('/Poppins-SemiBoldItalic.ttf'),
  ]);
  fontRegularB64 = arrayBufferToBase64(regular);
  fontBoldB64 = arrayBufferToBase64(bold);
  fontItalicB64 = arrayBufferToBase64(italic);
  fontBoldItalicB64 = arrayBufferToBase64(boldItalic);
  poppinsSemiBoldRaw = bold;
  fontsReady = true;
}

function createContentDoc(): jsPDF {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });

  doc.addFileToVFS('Poppins-Regular.ttf', fontRegularB64);
  doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');

  doc.addFileToVFS('Poppins-SemiBold.ttf', fontBoldB64);
  doc.addFont('Poppins-SemiBold.ttf', 'Poppins', 'bold');

  doc.addFileToVFS('Poppins-Italic.ttf', fontItalicB64);
  doc.addFont('Poppins-Italic.ttf', 'Poppins', 'italic');

  doc.addFileToVFS('Poppins-SemiBoldItalic.ttf', fontBoldItalicB64);
  doc.addFont('Poppins-SemiBoldItalic.ttf', 'Poppins', 'bolditalic');

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

  // Cover "TUCUMÁN" with white rect
  // Original bbox: x=63-165, y=367-401 (top-left coords)
  // pdf-lib uses bottom-left origin, page height = 841.89pt
  const pageH = 841.89;
  page.drawRectangle({
    x: 55,
    y: pageH - 405,
    width: 350,
    height: 42,
    color: rgb(1, 1, 1),
  });

  // Draw province name at original position
  // Original: origin (63.4, 389.5) top-left → bottom-left y = 841.89 - 389.5
  page.drawText(provinceName.toUpperCase(), {
    x: 63.4,
    y: pageH - 393,
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
    const { prestadores, normasBlocks } = e.data.payload;
    const sections = groupByProvincia(prestadores);
    const hasNormas = normasBlocks && normasBlocks.length > 0;

    // Load fonts (cached after first call)
    await loadFonts();

    // Fetch cover PDFs
    const [normasCoverBuf, prestadoresCoverBuf, provinciaCoverBuf] = await Promise.all([
      fetchBuffer('/Caratula-NormasGenerales.pdf'),
      fetchBuffer('/Caratula-ProgramaMedicoAsistencial.pdf'),
      fetchBuffer('/Caratula-Integra4_provincias.pdf'),
    ]);

    // We'll build an ordered list of PDF buffers to merge
    const parts: { label: string; buffer: ArrayBuffer | Uint8Array }[] = [];
    // Cover pages don't count in page numbering for content headers
    // We track contentPage separately (covers are unnumbered)
    let currentPage = 1;

    // 1. Normas section
    if (hasNormas) {
      self.postMessage({
        type: 'PROGRESS',
        payload: { phase: 'generating', current: 1, total: sections.length + 1, message: 'Generando: Normas Generales' },
      } satisfies WorkerMessage);

      // Normas cover
      parts.push({ label: 'Carátula Normas', buffer: normasCoverBuf });

      // Normas content
      const normasBuffer = generateNormas(normasBlocks!);
      parts.push({ label: 'Normas Generales', buffer: normasBuffer });
      const loaded = await PDFDocument.load(normasBuffer);
      currentPage += loaded.getPageCount();
    }

    // 2. Each province: province cover + prestadores cover + content
    const totalSteps = sections.length + (hasNormas ? 1 : 0);
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const stepNum = (hasNormas ? 2 : 1) + i;

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

      // Prestadores cover
      parts.push({ label: 'Carátula Prestadores', buffer: prestadoresCoverBuf });

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
