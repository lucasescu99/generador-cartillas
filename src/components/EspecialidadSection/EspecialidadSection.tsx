import type { Prestador } from '../../types/cartilla.types';
import { PrestadorCard } from '../PrestadorCard/PrestadorCard';
import styles from './EspecialidadSection.module.css';

interface Props {
  especialidad: string;
  prestadores: Prestador[];
}

export function EspecialidadSection({ especialidad, prestadores }: Props) {
  return (
    <div className={styles.section}>
      <h3 className={styles.header}>{especialidad}</h3>
      {prestadores.map((p, i) => (
        <PrestadorCard key={i} prestador={p} />
      ))}
    </div>
  );
}
