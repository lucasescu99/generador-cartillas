import { useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useCartilla } from '../../context/CartillaContext';
import { usePdfGenerator } from '../../hooks/usePdfGenerator';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import styles from './PreviewPage.module.css';

export function PreviewPage() {
  const navigate = useNavigate();
  const { cartillaData, textBlocks, planOperativoBlocks, sectionOrder, provinciaOrder, zonaOrder, rubroOrder, reset } = useCartilla();
  const { start, progress, status, download, metadata, errorMessage, pdfUrl } = usePdfGenerator();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !cartillaData || cartillaData.prestadores.length === 0) return;
    started.current = true;
    start(cartillaData.prestadores, textBlocks, planOperativoBlocks, sectionOrder, provinciaOrder, zonaOrder, rubroOrder);
  }, [cartillaData, textBlocks, planOperativoBlocks, sectionOrder, provinciaOrder, zonaOrder, rubroOrder, start]);

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
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>
            {status === 'complete' ? 'Vista Previa del PDF' : 'Generando Cartilla'}
          </h1>
          <p className={styles.subtitle}>
            {cartillaData.totalPrestadores.toLocaleString()} prestadores · {cartillaData.totalEspecialidades} especialidades
            {status === 'complete' && metadata && (
              <> · {metadata.pageCount.toLocaleString()} pág · {formatSize(metadata.sizeKb)} · {formatDuration(metadata.durationMs)}</>
            )}
          </p>
        </div>
        <div className={styles.actions}>
          <button className={styles.backBtn} onClick={() => navigate('/order')}>
            ← Volver al orden
          </button>
          {status === 'complete' && (
            <>
              <button className={styles.downloadBtn} onClick={() => download()}>
                Descargar PDF
              </button>
              <button className={styles.resetBtn} onClick={handleReset}>
                Nueva cartilla
              </button>
            </>
          )}
          {status === 'error' && (
            <button className={styles.resetBtn} onClick={handleReset}>
              Reintentar
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {(status === 'idle' || status === 'generating') && (
        <div className={styles.progressArea}>
          <ProgressBar progress={progress} />
          <p className={styles.warning}>No cierres esta pestaña mientras se genera el PDF</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className={styles.errorCard}>
          <h2 className={styles.errorTitle}>Error</h2>
          <p>{errorMessage || 'Error desconocido'}</p>
        </div>
      )}

      {/* PDF Viewer */}
      {status === 'complete' && pdfUrl && (
        <iframe
          className={styles.pdfViewer}
          src={pdfUrl}
          title="Vista previa del PDF"
        />
      )}
    </div>
  );
}
