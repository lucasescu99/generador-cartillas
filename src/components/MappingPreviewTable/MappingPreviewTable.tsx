import type { Prestador } from '../../types/cartilla.types';
import styles from './MappingPreviewTable.module.css';

interface Props {
  rows: Prestador[];
}

export function MappingPreviewTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className={styles.empty}>Asigná los campos obligatorios para ver la vista previa</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Código</th>
            <th>Especialidad</th>
            <th>Rubro</th>
            <th>Nombre</th>
            <th>Dirección</th>
            <th>Localidad</th>
            <th>Provincia</th>
            <th>Zona</th>
            <th>Teléfono</th>
            <th>Subespecialidades</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i}>
              <td>{p.codigo || '—'}</td>
              <td>{p.especialidad}</td>
              <td>{p.rubro}</td>
              <td>{p.nombre}{p.nombreInsti ? ` (${p.nombreInsti})` : ''}</td>
              <td>{p.direccion || '—'}</td>
              <td>{p.localidad || '—'}</td>
              <td>{p.provincia || '—'}</td>
              <td>{p.zona || '—'}</td>
              <td>{p.telefono || '—'}</td>
              <td>{p.subespecialidades.length > 0 ? p.subespecialidades.join(', ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
