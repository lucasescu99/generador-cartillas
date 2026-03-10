import type { Prestador, Direccion, ColumnMapping, CartillaData } from '../types/cartilla.types';

/** SheetJS can return numbers, booleans, etc. — always coerce to string. */
function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function transformRows(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
): Prestador[] {
  return rows
    .map((row) => {
      const direcciones: Direccion[] = [];

      const dir1: Direccion = {
        calle: str(row[mapping.direccion1]),
        telefonos: [str(row[mapping.telefono1])].filter(Boolean),
      };
      if (mapping.telefono2 && str(row[mapping.telefono2])) {
        dir1.telefonos.push(str(row[mapping.telefono2]));
      }
      if (dir1.calle) direcciones.push(dir1);

      if (mapping.direccion2 && str(row[mapping.direccion2])) {
        const dir2: Direccion = {
          calle: str(row[mapping.direccion2]),
          telefonos: [],
        };
        if (mapping.telefono3 && str(row[mapping.telefono3])) {
          dir2.telefonos.push(str(row[mapping.telefono3]));
        }
        if (mapping.telefono4 && str(row[mapping.telefono4])) {
          dir2.telefonos.push(str(row[mapping.telefono4]));
        }
        direcciones.push(dir2);
      }

      const esCentroVal = mapping.esCentro ? str(row[mapping.esCentro]).toLowerCase() : '';
      const esCentro = ['true', 'si', 'sí', '1', 'yes'].includes(esCentroVal);

      return {
        especialidad: str(row[mapping.especialidad]).toUpperCase(),
        nombre: str(row[mapping.nombre]),
        indicador: mapping.indicador ? str(row[mapping.indicador]) || undefined : undefined,
        esCentro: esCentro || undefined,
        direcciones,
      };
    })
    .filter((p) => p.especialidad && p.nombre);
}

export function buildCartillaData(prestadores: Prestador[]): CartillaData {
  const especialidadesSet = new Set<string>();
  for (const p of prestadores) {
    especialidadesSet.add(p.especialidad);
  }

  const especialidades = Array.from(especialidadesSet).sort((a, b) => a.localeCompare(b, 'es'));

  return {
    prestadores,
    especialidades,
    totalEspecialidades: especialidades.length,
    totalPrestadores: prestadores.length,
  };
}

export function groupByEspecialidad(prestadores: Prestador[]): Map<string, Prestador[]> {
  const map = new Map<string, Prestador[]>();

  for (const p of prestadores) {
    if (!map.has(p.especialidad)) {
      map.set(p.especialidad, []);
    }
    map.get(p.especialidad)!.push(p);
  }

  // Ordenar prestadores dentro de cada especialidad
  for (const [, list] of map) {
    list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  return new Map(
    Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'es')),
  );
}
