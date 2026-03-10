import type { Prestador } from '../../types/cartilla.types';
import styles from './PrestadorCard.module.css';

interface Props {
  prestador: Prestador;
}

export function PrestadorCard({ prestador: p }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.nombre}>
        {p.nombre}
        {p.nombreInsti && <span className={styles.insti}> ({p.nombreInsti})</span>}
      </div>
      <div className={styles.detalle}>
        {p.direccion && <div>{p.direccion}</div>}
      </div>
      {p.subespecialidades.length > 0 && (
        <div className={styles.subs}>
          {p.subespecialidades.join(' · ')}
        </div>
      )}
    </div>
  );
}
