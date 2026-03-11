import { useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useCartilla } from '../../context/CartillaContext';
import { usePdfGenerator } from '../../hooks/usePdfGenerator';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import styles from './GeneratePage.module.css';

export function GeneratePage() {
  const navigate = useNavigate();
  const { cartillaData, normasBlocks, reset } = useCartilla();
  const { start, progress, status, download, metadata, errorMessage } = usePdfGenerator();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !cartillaData || cartillaData.prestadores.length === 0) return;
    started.current = true;
    start(cartillaData.prestadores, normasBlocks);
  }, [cartillaData, normasBlocks, start]);

  if (!cartillaData || cartillaData.prestadores.length === 0) {
    return <Navigate to="/" replace />;
  }

  const handleReset = () => {
    reset();
    navigate('/');
  };

  const formatSize = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Generando Cartilla</h1>
      <p className={styles.subtitle}>
        {cartillaData.totalPrestadores.toLocaleString()} prestadores · {cartillaData.totalEspecialidades} especialidades
      </p>

      {(status === 'idle' || status === 'generating') && (
        <>
          <ProgressBar progress={progress} />
          <p className={styles.warning}>No cierres esta pestaña mientras se genera el PDF</p>
        </>
      )}

      {status === 'complete' && metadata && (
        <div className={styles.completeCard}>
          <span className={styles.checkIcon}>✓</span>
          <h2 className={styles.completeTitle}>PDF generado exitosamente</h2>
          <p className={styles.meta}>
            {metadata.pageCount.toLocaleString()} páginas · {formatSize(metadata.sizeKb)} · {formatDuration(metadata.durationMs)}
          </p>
          <button className={styles.downloadBtn} onClick={() => download()}>
            Descargar PDF
          </button>
          <br />
          <button className={styles.resetBtn} onClick={handleReset}>
            Nueva cartilla
          </button>
        </div>
      )}

      {status === 'error' && (
        <>
          <div className={styles.errorCard}>
            <h2 className={styles.errorTitle}>Error</h2>
            <p>{errorMessage || 'Error desconocido'}</p>
          </div>
          <button className={styles.resetBtn} onClick={handleReset}>
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
