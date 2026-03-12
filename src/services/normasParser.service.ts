// @ts-ignore mammoth has no type declarations
import mammoth from 'mammoth';
import type { NormasBlock, NormasSpan, TableCell } from '../types/cartilla.types';

// Mammoth style mappings: map DOCX styles to HTML heading tags
const MAMMOTH_OPTIONS = {
  styleMap: [
    "p[style-name='Title'] => h1:fresh",
    "p[style-name='Subtitle'] => h2:fresh",
    "p[style-name='Título'] => h1:fresh",
    "p[style-name='Subtítulo'] => h2:fresh",
    "p[style-name='heading 1'] => h1:fresh",
    "p[style-name='heading 2'] => h2:fresh",
    "p[style-name='heading 3'] => h3:fresh",
  ],
};

function parseHtmlToBlocks(html: string): NormasBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: NormasBlock[] = [];

  function extractSpans(el: Element): NormasSpan[] {
    const spans: NormasSpan[] = [];

    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text) spans.push({ text });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const child = node as Element;
        const tag = child.tagName.toLowerCase();

        if (tag === 'br') {
          spans.push({ text: '\n' });
          continue;
        }

        const innerSpans = extractSpans(child);
        const href = tag === 'a' ? child.getAttribute('href') : null;

        for (const span of innerSpans) {
          if (tag === 'strong' || tag === 'b') span.bold = true;
          if (tag === 'em' || tag === 'i') span.italic = true;
          if (tag === 'u') span.underline = true;
          if (href) span.link = href;
          spans.push(span);
        }
      }
    }

    return spans;
  }

  function processElement(node: Element): void {
    const tag = node.tagName.toLowerCase();

    // Tables: extract rows with cell structure
    if (tag === 'table') {
      const rows = node.querySelectorAll('tr');
      const totalRows = rows.length;
      rows.forEach((row, rowIdx) => {
        const cells: TableCell[] = [];
        for (const cell of row.querySelectorAll('td, th')) {
          const text = (cell.textContent || '').trim().replace(/\s+/g, ' ');
          const isBold = cell.tagName.toLowerCase() === 'th' ||
            cell.querySelector('strong, b') !== null;
          cells.push({ text, bold: isBold || undefined });
        }
        if (cells.length > 0) {
          const isHeader = cells.every((c) => c.bold);
          blocks.push({
            type: 'table-row',
            spans: [{ text: cells.map((c) => c.text).join(' | ') }],
            cells,
            tableFlags: {
              isHeader,
              isFirst: rowIdx === 0,
              isLast: rowIdx === totalRows - 1,
            },
          });
        }
      });
      return;
    }

    // Lists
    if (tag === 'ol' || tag === 'ul') {
      for (const li of node.querySelectorAll(':scope > li')) {
        const liSpans = extractSpans(li);
        if (liSpans.length > 0 && liSpans.some((s) => s.text.trim())) {
          blocks.push({ type: 'list-item', spans: liSpans });
        }
      }
      return;
    }

    const spans = extractSpans(node);

    // Skip empty paragraphs (but preserve a single empty block for spacing)
    if (spans.length === 0 || spans.every((s) => !s.text.trim())) {
      blocks.push({ type: 'paragraph', spans: [{ text: '' }] });
      return;
    }

    if (tag.match(/^h[1-6]$/)) {
      const level = parseInt(tag[1]);
      for (const s of spans) s.bold = true;
      blocks.push({ type: 'heading', level, spans });
    } else if (tag === 'li') {
      blocks.push({ type: 'list-item', spans });
    } else {
      blocks.push({ type: 'paragraph', spans });
    }
  }

  for (const node of doc.body.children) {
    processElement(node);
  }

  return blocks;
}

function textToBlocks(text: string): NormasBlock[] {
  return text.split('\n').map((line) => ({
    type: 'paragraph' as const,
    spans: [{ text: line }],
  }));
}

export async function parseNormasFile(file: File): Promise<NormasBlock[]> {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  if (ext === '.txt') {
    const text = await file.text();
    return textToBlocks(text);
  }

  if (ext === '.docx') {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, MAMMOTH_OPTIONS);
    return parseHtmlToBlocks(result.value);
  }

  throw new Error('Formato no soportado. Usa .txt o .docx');
}
