// @ts-ignore mammoth has no type declarations
import mammoth from 'mammoth';
import type { NormasBlock, NormasSpan } from '../types/cartilla.types';

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
        const innerSpans = extractSpans(child);

        for (const span of innerSpans) {
          if (tag === 'strong' || tag === 'b') span.bold = true;
          if (tag === 'em' || tag === 'i') span.italic = true;
          if (tag === 'u') span.underline = true;
          spans.push(span);
        }
      }
    }

    return spans;
  }

  for (const node of doc.body.children) {
    const tag = node.tagName.toLowerCase();
    const spans = extractSpans(node);

    if (spans.length === 0 || spans.every((s) => !s.text.trim())) {
      blocks.push({ type: 'paragraph', spans: [{ text: '' }] });
      continue;
    }

    if (tag.match(/^h[1-6]$/)) {
      const level = parseInt(tag[1]);
      // Headings are inherently bold
      for (const s of spans) s.bold = true;
      blocks.push({ type: 'heading', level, spans });
    } else if (tag === 'li') {
      blocks.push({ type: 'list-item', spans });
    } else if (tag === 'ol' || tag === 'ul') {
      // Process list items inside
      for (const li of node.querySelectorAll('li')) {
        const liSpans = extractSpans(li);
        if (liSpans.length > 0) {
          blocks.push({ type: 'list-item', spans: liSpans });
        }
      }
    } else {
      blocks.push({ type: 'paragraph', spans });
    }
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
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    return parseHtmlToBlocks(result.value);
  }

  throw new Error('Formato no soportado. Usa .txt o .docx');
}
