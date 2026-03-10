import { useState, useMemo, useCallback } from 'react';
import type { ColumnMapping, Prestador, ParsedFile } from '../types/cartilla.types';
import { transformRows } from '../services/dataTransformer.service';

export interface MappingField {
  key: keyof ColumnMapping;
  label: string;
  required: boolean;
}

export const MAPPING_FIELDS: MappingField[] = [
  { key: 'especialidad', label: 'Especialidad', required: true },
  { key: 'nombre', label: 'Nombre', required: true },
  { key: 'direccion1', label: 'Dirección 1', required: true },
  { key: 'telefono1', label: 'Teléfono 1', required: true },
  { key: 'indicador', label: 'Indicador', required: false },
  { key: 'esCentro', label: 'Es Centro', required: false },
  { key: 'telefono2', label: 'Teléfono 2', required: false },
  { key: 'direccion2', label: 'Dirección 2', required: false },
  { key: 'telefono3', label: 'Teléfono 3', required: false },
  { key: 'telefono4', label: 'Teléfono 4', required: false },
];

function autoDetect(headers: string[]): Partial<ColumnMapping> {
  const auto: Partial<ColumnMapping> = {};
  const lower = headers.map((h) => h.toLowerCase().trim());

  const tryMatch = (key: keyof ColumnMapping, ...patterns: string[]) => {
    for (const pattern of patterns) {
      const idx = lower.findIndex((h) => h.includes(pattern));
      if (idx !== -1 && !Object.values(auto).includes(headers[idx])) {
        auto[key] = headers[idx];
        return;
      }
    }
  };

  tryMatch('especialidad', 'especialidad', 'specialty', 'esp');
  tryMatch('nombre', 'nombre', 'name', 'prestador');
  tryMatch('indicador', 'indicador', 'indicator', 'plan');
  tryMatch('esCentro', 'es_centro', 'centro', 'center');
  tryMatch('direccion1', 'direccion', 'address', 'dir');
  tryMatch('telefono1', 'telefono', 'phone', 'tel');

  return auto;
}

export function useColumnMapping(parsedFile: ParsedFile | null) {
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>(() =>
    parsedFile ? autoDetect(parsedFile.headers) : {},
  );

  const setField = useCallback((key: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value || undefined }));
  }, []);

  const resetAutoDetect = useCallback((headers: string[]) => {
    setMapping(autoDetect(headers));
  }, []);

  const isValid = useMemo(() => {
    return MAPPING_FIELDS
      .filter((f) => f.required)
      .every((f) => mapping[f.key]);
  }, [mapping]);

  const previewRows: Prestador[] = useMemo(() => {
    if (!isValid || !parsedFile) return [];
    return transformRows(parsedFile.rows.slice(0, 5), mapping as ColumnMapping);
  }, [mapping, isValid, parsedFile]);

  const totalDetected = useMemo(() => {
    if (!isValid || !parsedFile) return 0;
    return transformRows(parsedFile.rows, mapping as ColumnMapping).length;
  }, [mapping, isValid, parsedFile]);

  return { mapping, setField, isValid, previewRows, totalDetected, resetAutoDetect };
}
