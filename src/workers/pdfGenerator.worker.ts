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

const CHUNK_SIZE = 10;

// Font sizes
const FS_ESPECIALIDAD = 9;
const FS_PROVINCIA = 8;
const FS_LOCALIDAD = 7.5;
const FS_NOMBRE = 7.5;
const FS_DETALLE = 7;

// Colors
const COLOR_ESP: [number, number, number] = [0, 123, 191];
const COLOR_PROV: [number, number, number] = [60, 60, 60];
const COLOR_LOC: [number, number, number] = [100, 100, 100];
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

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
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

function drawProvHeader(doc: jsPDF, cursor: Cursor, prov: string): void {
  const x = colX(cursor.col);
  doc.setFontSize(FS_PROVINCIA);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_PROV);
  doc.text(prov, x + 1, cursor.y + FS_PROVINCIA * 0.35);
  cursor.y += FS_PROVINCIA * 0.4 + 1;
}

function drawLocHeader(doc: jsPDF, cursor: Cursor, loc: string): void {
  const x = colX(cursor.col);
  doc.setFontSize(FS_LOCALIDAD);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLOR_LOC);
  doc.text(loc, x + 2, cursor.y + FS_LOCALIDAD * 0.35);
  cursor.y += FS_LOCALIDAD * 0.4 + 0.5;
}

function measurePrestador(doc: jsPDF, p: Prestador): number {
  let h = 0;
  doc.setFontSize(FS_NOMBRE);
  const nombreText = p.nombreInsti ? `${p.nombre} (${p.nombreInsti})` : p.nombre;
  h += wrapText(doc, nombreText, COL_W - 4).length * (FS_NOMBRE * 0.4) + 0.5;

  doc.setFontSize(FS_DETALLE);
  if (p.direccion) h += wrapText(doc, p.direccion, COL_W - 4).length * (FS_DETALLE * 0.4);
  if (p.subespecialidades.length > 0) {
    const subsText = p.subespecialidades.join(' · ');
    h += wrapText(doc, subsText, COL_W - 4).length * (FS_DETALLE * 0.4);
  }
  return h + 2.5;
}

function drawPrestador(doc: jsPDF, cursor: Cursor, p: Prestador): void {
  const x = colX(cursor.col) + 3;
  const textW = COL_W - 4;

  doc.setFontSize(FS_NOMBRE);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_TEXT);

  const nombreText = p.nombreInsti ? `${p.nombre} (${p.nombreInsti})` : p.nombre;
  for (const line of wrapText(doc, nombreText, textW)) {
    doc.text(line, x, cursor.y + FS_NOMBRE * 0.35);
    cursor.y += FS_NOMBRE * 0.4;
  }
  cursor.y += 0.3;

  doc.setFontSize(FS_DETALLE);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_DETAIL);

  if (p.direccion) {
    for (const line of wrapText(doc, p.direccion, textW)) {
      doc.text(line, x, cursor.y + FS_DETALLE * 0.35);
      cursor.y += FS_DETALLE * 0.4;
    }
  }

  if (p.subespecialidades.length > 0) {
    doc.setFont('helvetica', 'italic');
    const subsText = p.subespecialidades.join(' · ');
    for (const line of wrapText(doc, subsText, textW)) {
      doc.text(line, x, cursor.y + FS_DETALLE * 0.35);
      cursor.y += FS_DETALLE * 0.4;
    }
  }

  cursor.y += 2;
}

function measureEspHeader(_doc: jsPDF, esp: string): number {
  // Approximate: header line + text + spacing
  const lineCount = Math.ceil(esp.length / 40);
  return lineCount * (FS_ESPECIALIDAD * 0.4) + 3;
}

// --- Generate a single chunk ---

function generateChunk(espGroups: EspGroup[]): ArrayBuffer {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const cursor: Cursor = { col: 0, y: MARGIN_TOP };

  for (const espGroup of espGroups) {
    const headerH = measureEspHeader(doc, espGroup.nombre);

    if (remaining(cursor) < headerH + 10) {
      nextColumn(doc, cursor);
    }

    drawEspHeader(doc, cursor, espGroup.nombre, false);

    for (const prov of espGroup.provincias) {
      // Province header
      if (remaining(cursor) < 8) {
        nextColumn(doc, cursor);
        drawEspHeader(doc, cursor, espGroup.nombre, true);
      }
      drawProvHeader(doc, cursor, prov.nombre);

      for (const loc of prov.localidades) {
        // Locality header
        if (remaining(cursor) < 6) {
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

    cursor.y += 2;
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
