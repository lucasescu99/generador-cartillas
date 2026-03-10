import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import type { Prestador, WorkerMessage } from '../types/cartilla.types';

// --- Layout constants (mm) ---
const PAGE_H = 297;
const PAGE_W = 210;
const HEADER_H = 12;
const MARGIN_TOP = HEADER_H + 4;
const MARGIN_BOTTOM = 10;
const MARGIN_LEFT = 8;
const MARGIN_RIGHT = 8;
const COL_GAP = 5;
const NUM_COLS = 3;
const USABLE_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;
const COL_W = (USABLE_W - COL_GAP * (NUM_COLS - 1)) / NUM_COLS;
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

const CHUNK_SIZE = 10;

// Font sizes (pt)
const FS_HEADER = 7;
const FS_ESPECIALIDAD = 7;
const FS_PROVINCIA = 6.5;
const FS_LOCALIDAD = 6;
const FS_NOMBRE = 6;
const FS_DETALLE = 5.5;

// Colors from reference PDF
const COLOR_HEADER_BAR: [number, number, number] = [18, 56, 127];    // #12387f
const COLOR_HEADER_TAB: [number, number, number] = [0, 124, 194];    // #007cc2
const COLOR_ESP: [number, number, number] = [0, 125, 195];           // #007dc3
const COLOR_TEXT: [number, number, number] = [18, 57, 128];          // #123980
const COLOR_CENTRO: [number, number, number] = [0, 125, 195];        // #007dc3 bright blue for Centro Medicus
const COLOR_WHITE: [number, number, number] = [255, 255, 255];

// --- Helpers ---

interface Cursor {
  col: number; // 0, 1, or 2
  y: number;
  pageProvince: string;
}

function colX(col: number): number {
  return MARGIN_LEFT + col * (COL_W + COL_GAP);
}

// --- Data grouping ---

interface ProvinciaGroup {
  nombre: string;
  localidades: LocalidadGroup[];
}

interface LocalidadGroup {
  nombre: string;
  prestadores: Prestador[];
}

interface EspGroup {
  nombre: string;
  provincias: ProvinciaGroup[];
}

function groupData(prestadores: Prestador[]): EspGroup[] {
  const espMap = new Map<string, Prestador[]>();
  for (const p of prestadores) {
    const key = p.especialidad.toUpperCase().trim();
    if (!espMap.has(key)) espMap.set(key, []);
    espMap.get(key)!.push(p);
  }

  const groups: EspGroup[] = [];
  const sortedEsps = Array.from(espMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));

  for (const espNombre of sortedEsps) {
    const prestList = espMap.get(espNombre)!;
    const provMap = new Map<string, Prestador[]>();
    for (const p of prestList) {
      const prov = (p.provincia || 'SIN PROVINCIA').trim();
      if (!provMap.has(prov)) provMap.set(prov, []);
      provMap.get(prov)!.push(p);
    }

    const provincias: ProvinciaGroup[] = [];
    for (const provNombre of Array.from(provMap.keys()).sort((a, b) => a.localeCompare(b, 'es'))) {
      const provPrest = provMap.get(provNombre)!;
      const locMap = new Map<string, Prestador[]>();
      for (const p of provPrest) {
        const loc = p.localidad || 'SIN LOCALIDAD';
        if (!locMap.has(loc)) locMap.set(loc, []);
        locMap.get(loc)!.push(p);
      }

      const localidades: LocalidadGroup[] = [];
      for (const locNombre of Array.from(locMap.keys()).sort((a, b) => a.localeCompare(b, 'es'))) {
        const locPrest = locMap.get(locNombre)!;
        locPrest.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        localidades.push({ nombre: locNombre, prestadores: locPrest });
      }
      provincias.push({ nombre: provNombre, localidades });
    }

    groups.push({ nombre: espNombre, provincias });
  }

  return groups;
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

function drawHeaderBar(doc: jsPDF, province: string, pageNum: number): void {
  // Full-width dark blue bar
  doc.setFillColor(...COLOR_HEADER_BAR);
  doc.rect(0, 0, PAGE_W, HEADER_H, 'F');

  // Province tab in lighter blue on the left
  doc.setFillColor(...COLOR_HEADER_TAB);
  const provText = province.toUpperCase();
  doc.setFontSize(FS_HEADER);
  doc.setFont('helvetica', 'bold');
  const provW = doc.getTextWidth(provText) + 8;
  doc.rect(MARGIN_LEFT, 0, provW, HEADER_H, 'F');

  // Province text
  doc.setTextColor(...COLOR_WHITE);
  doc.text(provText, MARGIN_LEFT + 4, HEADER_H / 2 + FS_HEADER * 0.15);

  // Page number on the right
  doc.setFont('helvetica', 'normal');
  const pageText = String(pageNum);
  const pageTextW = doc.getTextWidth(pageText);
  doc.setTextColor(...COLOR_WHITE);
  doc.text(pageText, PAGE_W - MARGIN_RIGHT - pageTextW, HEADER_H / 2 + FS_HEADER * 0.15);
}

function nextColumn(doc: jsPDF, cursor: Cursor): void {
  if (cursor.col < NUM_COLS - 1) {
    cursor.col++;
    cursor.y = MARGIN_TOP;
  } else {
    doc.addPage();
    cursor.col = 0;
    cursor.y = MARGIN_TOP;
    drawHeaderBar(doc, cursor.pageProvince, doc.getNumberOfPages());
  }
}

function drawEspHeader(doc: jsPDF, cursor: Cursor, esp: string, cont: boolean): void {
  const x = colX(cursor.col);
  const label = cont ? `${esp} (cont.)` : esp;

  // Blue line separator
  doc.setDrawColor(...COLOR_ESP);
  doc.setLineWidth(0.3);
  doc.line(x, cursor.y, x + COL_W, cursor.y);
  cursor.y += 1.2;

  doc.setFontSize(FS_ESPECIALIDAD);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_ESP);

  for (const line of wrapText(doc, label, COL_W)) {
    doc.text(line, x, cursor.y + FS_ESPECIALIDAD * 0.35);
    cursor.y += FS_ESPECIALIDAD * 0.38;
  }
  cursor.y += 1;
}

function drawProvHeader(doc: jsPDF, cursor: Cursor, prov: string): void {
  const x = colX(cursor.col);
  doc.setFontSize(FS_PROVINCIA);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_TEXT);
  const lines = wrapText(doc, prov, COL_W);
  for (const line of lines) {
    doc.text(line, x + 0.5, cursor.y + FS_PROVINCIA * 0.35);
    cursor.y += FS_PROVINCIA * 0.38;
  }
  cursor.y += 0.5;
}

function drawLocHeader(doc: jsPDF, cursor: Cursor, loc: string): void {
  const x = colX(cursor.col);
  doc.setFontSize(FS_LOCALIDAD);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLOR_TEXT);
  const lines = wrapText(doc, loc, COL_W - 1);
  for (const line of lines) {
    doc.text(line, x + 1, cursor.y + FS_LOCALIDAD * 0.35);
    cursor.y += FS_LOCALIDAD * 0.38;
  }
  cursor.y += 0.3;
}

function measurePrestador(doc: jsPDF, p: Prestador): number {
  let h = 0;
  doc.setFontSize(FS_NOMBRE);
  const nombreText = p.nombreInsti ? `${p.nombre} (${p.nombreInsti})` : p.nombre;
  h += wrapText(doc, nombreText, COL_W - 2).length * (FS_NOMBRE * 0.38) + 0.3;

  doc.setFontSize(FS_DETALLE);
  if (p.direccion) h += wrapText(doc, p.direccion, COL_W - 2).length * (FS_DETALLE * 0.38);
  if (p.subespecialidades.length > 0) {
    const subsText = p.subespecialidades.join(' - ');
    h += wrapText(doc, subsText, COL_W - 2).length * (FS_DETALLE * 0.38);
  }
  return h + 1.8;
}

function drawPrestador(doc: jsPDF, cursor: Cursor, p: Prestador): void {
  const x = colX(cursor.col) + 1.5;
  const textW = COL_W - 2;
  const centro = isCentroMedicus(p);

  // Prestador name
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

// --- Generate a single chunk ---

function generateChunk(espGroups: EspGroup[]): ArrayBuffer {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });

  // Determine initial province from first group
  const firstProv = espGroups[0]?.provincias[0]?.nombre || '';
  const cursor: Cursor = { col: 0, y: MARGIN_TOP, pageProvince: firstProv };

  // Draw header on first page
  drawHeaderBar(doc, cursor.pageProvince, 1);

  for (const espGroup of espGroups) {
    // Ensure header + at least one row fits
    if (remaining(cursor) < 8) {
      nextColumn(doc, cursor);
    }

    drawEspHeader(doc, cursor, espGroup.nombre, false);

    for (const prov of espGroup.provincias) {
      // Update page province for header
      cursor.pageProvince = prov.nombre;

      if (remaining(cursor) < 6) {
        nextColumn(doc, cursor);
        drawEspHeader(doc, cursor, espGroup.nombre, true);
      }
      drawProvHeader(doc, cursor, prov.nombre);

      for (const loc of prov.localidades) {
        if (remaining(cursor) < 5) {
          nextColumn(doc, cursor);
          drawEspHeader(doc, cursor, espGroup.nombre, true);
        }
        drawLocHeader(doc, cursor, loc.nombre);

        for (const prest of loc.prestadores) {
          const pH = measurePrestador(doc, prest);
          if (remaining(cursor) < pH) {
            nextColumn(doc, cursor);
            drawEspHeader(doc, cursor, espGroup.nombre, true);
          }
          drawPrestador(doc, cursor, prest);
        }
      }
    }

    cursor.y += 1.5;
  }

  // Update page numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Redraw page number (overwrite previous)
    doc.setFillColor(...COLOR_HEADER_BAR);
    doc.rect(PAGE_W - MARGIN_RIGHT - 12, 0, 20, HEADER_H, 'F');
    doc.setFontSize(FS_HEADER);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_WHITE);
    const pageText = String(i);
    const pw = doc.getTextWidth(pageText);
    doc.text(pageText, PAGE_W - MARGIN_RIGHT - pw, HEADER_H / 2 + FS_HEADER * 0.15);
  }

  return doc.output('arraybuffer');
}

// --- Main worker entry ---

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type !== 'START') return;

  try {
    const { prestadores } = e.data.payload;
    const allGroups = groupData(prestadores);

    // Split into chunks
    const chunks: EspGroup[][] = [];
    for (let i = 0; i < allGroups.length; i += CHUNK_SIZE) {
      chunks.push(allGroups.slice(i, i + CHUNK_SIZE));
    }

    const totalChunks = chunks.length;
    const chunkBuffers: ArrayBuffer[] = [];

    // Phase 1: Generate each chunk
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i];
      const firstEsp = chunk[0].nombre;
      const lastEsp = chunk[chunk.length - 1].nombre;

      self.postMessage({
        type: 'PROGRESS',
        payload: {
          phase: 'generating',
          current: i + 1,
          total: totalChunks,
          message: totalChunks === 1
            ? `Generando: ${firstEsp}`
            : `Chunk ${i + 1}/${totalChunks}: ${firstEsp} → ${lastEsp}`,
        },
      } satisfies WorkerMessage);

      chunkBuffers.push(generateChunk(chunk));
    }

    // Phase 2: Merge all chunks
    self.postMessage({
      type: 'PROGRESS',
      payload: {
        phase: 'merging',
        current: 0,
        total: totalChunks,
        message: 'Preparando documento final...',
      },
    } satisfies WorkerMessage);

    const merged = await PDFDocument.create();

    for (let i = 0; i < chunkBuffers.length; i++) {
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          phase: 'merging',
          current: i + 1,
          total: totalChunks,
          message: `Uniendo parte ${i + 1} de ${totalChunks}...`,
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
