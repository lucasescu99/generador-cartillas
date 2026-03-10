import * as XLSX from 'xlsx';
import type { ParsedFile } from '../types/cartilla.types';

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

export function validateFileExtension(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export function parseFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        if (rows.length === 0) {
          reject(new Error('El archivo está vacío o no tiene datos válidos'));
          return;
        }

        const headers = Object.keys(rows[0]);

        resolve({
          headers,
          rows,
          filename: file.name,
          totalRows: rows.length,
        });
      } catch {
        reject(new Error('Error al leer el archivo. Verificá que no esté corrupto.'));
      }
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}
