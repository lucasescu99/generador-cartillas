import styles from './EspecialidadIndex.module.css';

interface Props {
  especialidades: string[];
  counts: Map<string, number>;
  onSelect: (esp: string) => void;
}

export function EspecialidadIndex({ especialidades, counts, onSelect }: Props) {
  return (
    <aside className={styles.sidebar}>
      <h2 className={styles.title}>Especialidades ({especialidades.length})</h2>
      {especialidades.map((esp) => (
        <button
          key={esp}
          className={styles.item}
          onClick={() => onSelect(esp)}
        >
          {esp} ({counts.get(esp) || 0})
        </button>
      ))}
    </aside>
  );
}
