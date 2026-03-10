export interface Prestador {
  especialidad: string;
  nombre: string;
  indicador?: string;
  esCentro?: boolean;
  direcciones: Direccion[];
}

export interface Direccion {
  calle: string;
  telefonos: string[];
}

export interface CartillaData {
  prestadores: Prestador[];
  especialidades: string[];
  totalEspecialidades: number;
  totalPrestadores: number;
}

export interface ColumnMapping {
  especialidad: string;
  nombre: string;
  direccion1: string;
  telefono1: string;
  indicador?: string;
  esCentro?: string;
  telefono2?: string;
  direccion2?: string;
  telefono3?: string;
  telefono4?: string;
}

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  filename: string;
  totalRows: number;
}

export type WorkerMessage =
  | { type: 'START'; payload: { prestadores: Prestador[] } }
  | { type: 'PROGRESS'; payload: { phase: 'generating' | 'merging'; current: number; total: number; message: string } }
  | { type: 'COMPLETE'; payload: { blob: Blob; pageCount: number; sizeKb: number } }
  | { type: 'ERROR'; payload: { message: string } };
