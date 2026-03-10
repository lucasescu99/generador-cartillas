import { useState, useCallback } from 'react';
import type { ParsedFile } from '../types/cartilla.types';
import { parseFile, validateFileExtension } from '../services/excelParser.service';

interface UseFileParserReturn {
  parse: (file: File) => Promise<void>;
  result: ParsedFile | null;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useFileParser(): UseFileParserReturn {
  const [result, setResult] = useState<ParsedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (file: File) => {
    if (!validateFileExtension(file.name)) {
      setError('Formato no soportado. Usá archivos .csv, .xlsx o .xls');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const parsed = await parseFile(file);
      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al parsear el archivo');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { parse, result, isLoading, error, clearError };
}
