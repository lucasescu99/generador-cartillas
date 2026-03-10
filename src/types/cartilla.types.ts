export interface Prestador {
  codigo: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  especialidad: string;
  nombreInsti?: string;
  subespecialidades: string[];
}

export interface CartillaData {
  planNombre: string;
  especialidades: string[];
  totalEspecialidades: number;
  totalPrestadores: number;
  prestadores: Prestador[];
}

export interface ColumnMapping {
  codigo: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  especialidad: string;
  subespecialidad?: string;
  nombreInsti?: string;
  planWeb?: string;
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
