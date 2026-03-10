import type { Prestador } from '../../types/cartilla.types';
import styles from './PrestadorCard.module.css';

interface Props {
  prestador: Prestador;
}

export function PrestadorCard({ prestador: p }: Props) {
  const nombreClass = [styles.nombre, p.esCentro ? styles.centro : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.card}>
      <div className={nombreClass}>
        {p.nombre}
        {p.indicador && ` (${p.indicador})`}
      </div>
      {p.direcciones.map((d, i) => (
        <div key={i} className={styles.detalle}>
          {d.calle && <div>{d.calle}</div>}
          {d.telefonos.length > 0 && <div>{d.telefonos.join('  ')}</div>}
        </div>
      ))}
    </div>
  );
}
