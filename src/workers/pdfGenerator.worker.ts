import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import type { Prestador, WorkerMessage } from '../types/cartilla.types';

// --- Layout constants (mm) ---
const PAGE_H = 297;
const PAGE_W = 210;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 12;
const MARGIN_LEFT = 12;
const MARGIN_RIGHT = 12;
const COL_GAP = 8;
const COL_W = (PAGE_W - MARGIN_LEFT - MARGIN_RIGHT - COL_GAP) / 2;
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

// How many especialidades per chunk — keeps each jsPDF instance small
const CHUNK_SIZE = 10;

// Font sizes
const FS_ESPECIALIDAD = 9;
const FS_NOMBRE = 7.5;
const FS_DETALLE = 7;

// Colors
const COLOR_ESP: [number, number, number] = [0, 123, 191];
const COLOR_TEXT: [number, number, number] = [33, 33, 33];
const COLOR_DETAIL: [number, number, number] = [80, 80, 80];

// --- Helpers ---

interface Cursor {
  col: 0 | 1;
  y: number;
}

function colX(col: 0 | 1): number {
  return col === 0 ? MARGIN_LEFT : MARGIN_LEFT + COL_W + COL_GAP;
}

function groupByEspecialidad(prestadores: Prestador[]): Map<string, Prestador[]> {
  const map = new Map<string, Prestador[]>();
  for (const p of prestadores) {
    const key = p.especialidad.toUpperCase().trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  return new Map(Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'es')));
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function measurePrestador(doc: jsPDF, p: Prestador): number {
  let h = 0;
  doc.setFontSize(FS_NOMBRE);
  const nombreText = p.indicador ? `${p.nombre} (${p.indicador})` : p.nombre;
  h += wrapText(doc, nombreText, COL_W).length * (FS_NOMBRE * 0.4) + 1;

  doc.setFontSize(FS_DETALLE);
  for (const dir of p.direcciones) {
    if (dir.calle) h += wrapText(doc, dir.calle, COL_W).length * (FS_DETALLE * 0.4);
    if (dir.telefonos.length > 0) h += wrapText(doc, dir.telefonos.join('  '), COL_W).length * (FS_DETALLE * 0.4);
  }
  return h + 3;
}

function measureEspHeader(doc: jsPDF, esp: string): number {
  doc.setFontSize(FS_ESPECIALIDAD);
  return wrapText(doc, esp, COL_W).length * (FS_ESPECIALIDAD * 0.4) + 3;
}

function remaining(cursor: Cursor): number {
  return CONTENT_H - (cursor.y - MARGIN_TOP);
}

function nextColumn(doc: jsPDF, cursor: Cursor): void {
  if (cursor.col === 0) {
    cursor.col = 1;
    cursor.y = MARGIN_TOP;
  } else {
    doc.addPage();
    cursor.col = 0;
    cursor.y = MARGIN_TOP;
  }
}

function drawEspHeader(doc: jsPDF, cursor: Cursor, esp: string, cont: boolean): void {
  const x = colX(cursor.col);
  const label = cont ? `${esp} (cont.)` : esp;

  doc.setDrawColor(...COLOR_ESP);
  doc.setLineWidth(0.3);
  doc.line(x, cursor.y, x + COL_W, cursor.y);
  cursor.y += 1.5;

  doc.setFontSize(FS_ESPECIALIDAD);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_ESP);

  for (const line of wrapText(doc, label, COL_W)) {
    doc.text(line, x, cursor.y + FS_ESPECIALIDAD * 0.35);
    cursor.y += FS_ESPECIALIDAD * 0.4;
  }
  cursor.y += 1.5;
}

function drawPrestador(doc: jsPDF, cursor: Cursor, p: Prestador): void {
  const x = colX(cursor.col);

  doc.setFontSize(FS_NOMBRE);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_TEXT);

  const nombreText = p.indicador ? `${p.nombre} (${p.indicador})` : p.nombre;
  for (const line of wrapText(doc, nombreText, COL_W)) {
    doc.text(line, x, cursor.y + FS_NOMBRE * 0.35);
    cursor.y += FS_NOMBRE * 0.4;
  }
  cursor.y += 0.5;

  doc.setFontSize(FS_DETALLE);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_DETAIL);

  for (const dir of p.direcciones) {
    if (dir.calle) {
      for (const line of wrapText(doc, dir.calle, COL_W)) {
        doc.text(line, x, cursor.y + FS_DETALLE * 0.35);
        cursor.y += FS_DETALLE * 0.4;
      }
    }
    if (dir.telefonos.length > 0) {
      for (const line of wrapText(doc, dir.telefonos.join('  '), COL_W)) {
        doc.text(line, x, cursor.y + FS_DETALLE * 0.35);
        cursor.y += FS_DETALLE * 0.4;
      }
    }
  }
  cursor.y += 2.5;
}

// --- Generate a single chunk of especialidades into a PDF ArrayBuffer ---

function generateChunk(
  especialidades: string[],
  grouped: Map<string, Prestador[]>,
): ArrayBuffer {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const cursor: Cursor = { col: 0, y: MARGIN_TOP };

  for (const esp of especialidades) {
    const grupo = grouped.get(esp)!;
    const headerH = measureEspHeader(doc, esp);
    const firstPrestH = grupo.length > 0 ? measurePrestador(doc, grupo[0]) : 0;

    if (remaining(cursor) < headerH + firstPrestH) {
      nextColumn(doc, cursor);
    }

    drawEspHeader(doc, cursor, esp, false);

    for (const prest of grupo) {
      const pH = measurePrestador(doc, prest);
      if (remaining(cursor) < pH) {
        nextColumn(doc, cursor);
        drawEspHeader(doc, cursor, esp, true);
      }
      drawPrestador(doc, cursor, prest);
    }

    cursor.y += 2;
  }

  return doc.output('arraybuffer');
}

// --- Main worker entry ---

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type !== 'START') return;

  try {
    const { prestadores } = e.data.payload;
    const grouped = groupByEspecialidad(prestadores);
    const allEspecialidades = Array.from(grouped.keys());

    // Split especialidades into chunks
    const chunks: string[][] = [];
    for (let i = 0; i < allEspecialidades.length; i += CHUNK_SIZE) {
      chunks.push(allEspecialidades.slice(i, i + CHUNK_SIZE));
    }

    const totalChunks = chunks.length;
    const chunkBuffers: ArrayBuffer[] = [];

    // Phase 1: Generate each chunk
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i];
      const firstEsp = chunk[0];
      const lastEsp = chunk[chunk.length - 1];

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

      chunkBuffers.push(generateChunk(chunk, grouped));
    }

    // Phase 2: Merge all chunks with pdf-lib
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
