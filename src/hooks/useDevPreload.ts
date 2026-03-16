import { useEffect, useRef } from 'react';
import { useCartilla } from '../context/CartillaContext';
import { parseFile } from '../services/excelParser.service';
import { parseNormasFile } from '../services/normasParser.service';

const DEV_FILES = {
  prestadores: '/dev/prestadores.csv',
  texto: '/dev/normas.docx',
};

async function fetchAsFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const blob = await res.blob();
  return new File([blob], filename);
}

/**
 * In development, attempts to preload fixture files from /dev/.
 * If the files don't exist (404), silently does nothing.
 */
export function useDevPreload() {
  const { parsedFile, setParsedFile, textBlocks, setTextBlocks } = useCartilla();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (parsedFile || textBlocks) return;
    attempted.current = true;

    (async () => {
      try {
        // Try to fetch the prestadores CSV
        const csvFile = await fetchAsFile(DEV_FILES.prestadores, 'prestadores.csv');
        const parsed = await parseFile(csvFile);
        setParsedFile(parsed);
      } catch {
        // Files not available — not in dev or not configured
        return;
      }

      // Load text document (non-blocking)
      try {
        const textoFile = await fetchAsFile(DEV_FILES.texto, 'documento.docx');
        const blocks = await parseNormasFile(textoFile);
        setTextBlocks(blocks);
      } catch {
        // Optional file — ignore errors
      }
    })();
  }, [parsedFile, textBlocks, setParsedFile, setTextBlocks]);
}
