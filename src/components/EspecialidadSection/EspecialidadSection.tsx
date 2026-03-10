import type { EspecialidadGroup } from '../../services/dataTransformer.service';
import { PrestadorCard } from '../PrestadorCard/PrestadorCard';
import styles from './EspecialidadSection.module.css';

interface Props {
  group: EspecialidadGroup;
}

export function EspecialidadSection({ group }: Props) {
  return (
    <div className={styles.section}>
      <h3 className={styles.header}>{group.nombre}</h3>
      {group.provincias.map((prov) => (
        <div key={prov.nombre} className={styles.provincia}>
          <h4 className={styles.provTitle}>{prov.nombre}</h4>
          {prov.localidades.map((loc) => (
            <div key={loc.nombre} className={styles.localidad}>
              <h5 className={styles.locTitle}>{loc.nombre}</h5>
              {loc.prestadores.map((p, i) => (
                <PrestadorCard key={i} prestador={p} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
