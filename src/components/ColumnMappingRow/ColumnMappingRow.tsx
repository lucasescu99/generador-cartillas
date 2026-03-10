import styles from './ColumnMappingRow.module.css';

interface Props {
  label: string;
  required: boolean;
  value: string | undefined;
  headers: string[];
  onChange: (value: string) => void;
}

export function ColumnMappingRow({ label, required, value, headers, onChange }: Props) {
  return (
    <div className={styles.row}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}> *</span>}
      </label>
      <select
        className={styles.select}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Sin asignar —</option>
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}
