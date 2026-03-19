import type { Prestador, ColumnMapping, CartillaData } from '../types/cartilla.types';

function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

/** Collapse multiple spaces/dashes, trim, and title-case */
function cleanName(s: string): string {
  return s
    .replace(/\s+/g, ' ')        // collapse whitespace
    .replace(/\s*-\s*/g, ' - ')  // normalize dashes
    .trim();
}

/** Title Case: "BUENOS AIRES" → "Buenos Aires", preserving short words */
function titleCase(s: string): string {
  const lower = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en']);
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (i > 0 && lower.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/** Normalize direction: collapse spaces, trim trailing/leading junk */
function cleanDireccion(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s*;\s*/g, ', ').trim();
}

/** Normalize phone: trim, collapse spaces */
function cleanTelefono(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Transforms raw CSV rows into Prestador objects.
 * Merges rows with the same prestador code + especialidad + dirección,
 * aggregating their subespecialidades.
 */
export function transformRows(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
): Prestador[] {
  // Build a map keyed by (codigo+especialidad+direccion+localidad) to merge subespecialidades
  const mergeMap = new Map<string, Prestador>();

  for (const row of rows) {
    const codigo = str(row[mapping.codigo]).trim();
    const nombre = cleanName(str(row[mapping.nombre]));
    const direccion = cleanDireccion(str(row[mapping.direccion]));
    const localidad = titleCase(cleanName(str(row[mapping.localidad])));
    const provincia = cleanName(str(row[mapping.provincia])).toUpperCase();
    const zona = cleanName(str(row[mapping.zona])).toUpperCase();
    const especialidad = cleanName(str(row[mapping.especialidad])).toUpperCase();
    const rubro = cleanName(str(row[mapping.rubro])).toUpperCase();
    const subespecialidad = mapping.subespecialidad ? cleanName(str(row[mapping.subespecialidad])) : '';
    const nombreInsti = mapping.nombreInsti ? cleanName(str(row[mapping.nombreInsti])) : '';
    const telefono = mapping.telefono ? cleanTelefono(str(row[mapping.telefono])) : '';

    if (!especialidad || !nombre || !rubro) continue;

    const key = `${codigo}||${especialidad}||${direccion}||${localidad}`.toUpperCase();

    if (mergeMap.has(key)) {
      const existing = mergeMap.get(key)!;
      if (subespecialidad && !existing.subespecialidades.includes(subespecialidad.toUpperCase())) {
        existing.subespecialidades.push(subespecialidad.toUpperCase());
      }
    } else {
      mergeMap.set(key, {
        codigo,
        nombre,
        direccion,
        localidad,
        provincia,
        zona,
        especialidad,
        rubro,
        nombreInsti: nombreInsti || undefined,
        telefono: telefono || undefined,
        subespecialidades: subespecialidad ? [subespecialidad.toUpperCase()] : [],
      });
    }
  }

  const result = Array.from(mergeMap.values());
  result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return result;
}

export function buildCartillaData(
  prestadores: Prestador[],
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
): CartillaData {
  const especialidadesSet = new Set<string>();
  for (const p of prestadores) {
    especialidadesSet.add(p.especialidad);
  }
  const especialidades = Array.from(especialidadesSet).sort((a, b) => a.localeCompare(b, 'es'));

  // Extract plan name from first row
  let planNombre = '';
  if (mapping.planWeb && rows.length > 0) {
    planNombre = str(rows[0][mapping.planWeb]);
  }

  return {
    planNombre,
    prestadores,
    especialidades,
    totalEspecialidades: especialidades.length,
    totalPrestadores: prestadores.length,
  };
}

export interface ProvinciaGroup {
  nombre: string;
  localidades: LocalidadGroup[];
}

export interface LocalidadGroup {
  nombre: string;
  prestadores: Prestador[];
}

export interface EspecialidadGroup {
  nombre: string;
  provincias: ProvinciaGroup[];
  totalPrestadores: number;
}

/**
 * Groups prestadores by especialidad → provincia → localidad.
 * Returns a sorted array of EspecialidadGroup.
 */
export function groupByEspecialidad(prestadores: Prestador[]): EspecialidadGroup[] {
  const espMap = new Map<string, Prestador[]>();

  for (const p of prestadores) {
    if (!espMap.has(p.especialidad)) espMap.set(p.especialidad, []);
    espMap.get(p.especialidad)!.push(p);
  }

  const groups: EspecialidadGroup[] = [];

  const sortedEsps = Array.from(espMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));

  for (const espNombre of sortedEsps) {
    const prestList = espMap.get(espNombre)!;

    // Group by provincia
    const provMap = new Map<string, Prestador[]>();
    for (const p of prestList) {
      const prov = p.provincia || 'SIN PROVINCIA';
      if (!provMap.has(prov)) provMap.set(prov, []);
      provMap.get(prov)!.push(p);
    }

    const provincias: ProvinciaGroup[] = [];
    const sortedProvs = Array.from(provMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));

    for (const provNombre of sortedProvs) {
      const provPrestadores = provMap.get(provNombre)!;

      // Group by localidad
      const locMap = new Map<string, Prestador[]>();
      for (const p of provPrestadores) {
        const loc = p.localidad || 'SIN LOCALIDAD';
        if (!locMap.has(loc)) locMap.set(loc, []);
        locMap.get(loc)!.push(p);
      }

      const localidades: LocalidadGroup[] = [];
      const sortedLocs = Array.from(locMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));

      for (const locNombre of sortedLocs) {
        const locPrestadores = locMap.get(locNombre)!;
        locPrestadores.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        localidades.push({ nombre: locNombre, prestadores: locPrestadores });
      }

      provincias.push({ nombre: provNombre, localidades });
    }

    groups.push({
      nombre: espNombre,
      provincias,
      totalPrestadores: prestList.length,
    });
  }

  return groups;
}
