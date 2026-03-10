import type { Prestador, ColumnMapping, CartillaData } from '../types/cartilla.types';

function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
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
    const codigo = str(row[mapping.codigo]);
    const nombre = str(row[mapping.nombre]);
    const direccion = str(row[mapping.direccion]);
    const localidad = str(row[mapping.localidad]);
    const provincia = str(row[mapping.provincia]);
    const especialidad = str(row[mapping.especialidad]).toUpperCase();
    const subespecialidad = mapping.subespecialidad ? str(row[mapping.subespecialidad]) : '';
    const nombreInsti = mapping.nombreInsti ? str(row[mapping.nombreInsti]) : '';

    if (!especialidad || !nombre) continue;

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
        provincia: provincia.trim(),
        especialidad,
        nombreInsti: nombreInsti || undefined,
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
