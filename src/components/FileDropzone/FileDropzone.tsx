import { useRef, useState, useCallback } from 'react';
import type { ParsedFile } from '../../types/cartilla.types';
import styles from './FileDropzone.module.css';

interface Props {
  onFile: (file: File) => void;
  parsedFile: ParsedFile | null;
  isLoading: boolean;
  error: string | null;
  onRemove: () => void;
}

export function FileDropzone({ onFile, parsedFile, isLoading, error, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  const handleRemove = () => {
    if (inputRef.current) inputRef.current.value = '';
    onRemove();
  };

  const zoneClass = [
    styles.dropzone,
    dragging ? styles.active : '',
    error ? styles.error : '',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <div
        className={zoneClass}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <span className={styles.icon}>📄</span>
        <p className={styles.text}>Arrastrá tu archivo acá o hacé click para seleccionarlo</p>
        <p className={styles.hint}>Formatos aceptados: .csv, .xlsx, .xls</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          hidden
          onChange={handleChange}
        />
      </div>

      {error && <p className={styles.errorText}>{error}</p>}
      {isLoading && <p className={styles.loadingText}>Leyendo archivo...</p>}

      {parsedFile && !isLoading && (
        <div className={styles.badge}>
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{parsedFile.filename}</span>
            <span className={styles.fileMeta}>
              {parsedFile.totalRows.toLocaleString()} filas · {parsedFile.headers.length} columnas
            </span>
          </div>
          <button className={styles.removeBtn} onClick={handleRemove} title="Quitar archivo">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
