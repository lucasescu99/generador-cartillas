import { useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useCartilla } from '../../context/CartillaContext';
import { useColumnMapping, MAPPING_FIELDS } from '../../hooks/useColumnMapping';
import { ColumnMappingRow } from '../../components/ColumnMappingRow/ColumnMappingRow';
import { MappingPreviewTable } from '../../components/MappingPreviewTable/MappingPreviewTable';
import type { ColumnMapping } from '../../types/cartilla.types';
import styles from './MappingPage.module.css';

export function MappingPage() {
  const navigate = useNavigate();
  const { parsedFile, applyMapping } = useCartilla();
  const { mapping, setField, isValid, previewRows, totalDetected, resetAutoDetect } =
    useColumnMapping(parsedFile);

  useEffect(() => {
    if (parsedFile) resetAutoDetect(parsedFile.headers);
  }, [parsedFile, resetAutoDetect]);

  if (!parsedFile) return <Navigate to="/" replace />;

  const handleContinue = () => {
    if (!isValid) return;
    applyMapping(mapping as ColumnMapping, parsedFile.rows);
    navigate('/preview');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mapeo de Columnas</h1>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Volver
        </button>
      </div>

      <p className={styles.stats}>
        <strong>{parsedFile.filename}</strong> — {parsedFile.totalRows.toLocaleString()} filas · {parsedFile.headers.length} columnas
      </p>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Asignar columnas</h2>
          {MAPPING_FIELDS.map((field) => (
            <ColumnMappingRow
              key={field.key}
              label={field.label}
              required={field.required}
              value={mapping[field.key]}
              headers={parsedFile.headers}
              onChange={(val) => setField(field.key, val)}
            />
          ))}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Vista previa transformada</h2>
          <MappingPreviewTable rows={previewRows} />
        </div>
      </div>

      <div className={styles.actions}>
        <span className={styles.detected}>
          {isValid ? `${totalDetected.toLocaleString()} prestadores detectados` : ''}
        </span>
        <button
          className={styles.continueBtn}
          disabled={!isValid}
          onClick={handleContinue}
        >
          Ver preview completo
        </button>
      </div>
    </div>
  );
}
