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
  { key: 'nombre', label: 'Nombre Prestador', required: true },
  { key: 'direccion', label: 'Dirección', required: true },
  { key: 'localidad', label: 'Localidad', required: true },
  { key: 'provincia', label: 'Provincia', required: true },
  { key: 'codigo', label: 'Código Prestador', required: false },
  { key: 'subespecialidad', label: 'Subespecialidad', required: false },
  { key: 'nombreInsti', label: 'Nombre Institución', required: false },
  { key: 'planWeb', label: 'Nombre Plan', required: false },
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

  // Order matters: more specific patterns first to avoid collisions
  tryMatch('especialidad', 'especialidad_nombre', 'especialidad', 'specialty');
  tryMatch('subespecialidad', 'subespecialidad', 'sub_especialidad');
  tryMatch('nombre', 'nombre_prestador', 'nombre_prest', 'nombre', 'name');
  tryMatch('direccion', 'direccion', 'address', 'dir');
  tryMatch('localidad', 'localidad', 'ciudad', 'city');
  tryMatch('provincia', 'provincia', 'state', 'prov');
  tryMatch('codigo', 'prestador', 'codigo', 'code', 'id');
  tryMatch('nombreInsti', 'nombre_insti', 'institucion', 'institution');
  tryMatch('planWeb', 'nombre_plan', 'plan_web', 'plan');

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
    return transformRows(parsedFile.rows.slice(0, 10), mapping as ColumnMapping);
  }, [mapping, isValid, parsedFile]);

  const totalDetected = useMemo(() => {
    if (!isValid || !parsedFile) return 0;
    return transformRows(parsedFile.rows, mapping as ColumnMapping).length;
  }, [mapping, isValid, parsedFile]);

  return { mapping, setField, isValid, previewRows, totalDetected, resetAutoDetect };
}
