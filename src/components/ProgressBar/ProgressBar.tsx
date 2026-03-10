import type { Progress } from '../../hooks/usePdfGenerator';
import styles from './ProgressBar.module.css';

interface Props {
  progress: Progress;
}

export function ProgressBar({ progress }: Props) {
  const { phase, current, total, message } = progress;
  const pct = total > 0 ? (current / total) * 100 : 0;

  const isGenerating = phase === 'generating';
  const isMerging = phase === 'merging';

  const phaseText = isGenerating ? 'Paso 1 de 2 — Generando chunks' : 'Paso 2 de 2 — Uniendo documento';

  const fillClass = [
    styles.fill,
    isGenerating ? styles.fillGenerating : styles.fillMerging,
  ].join(' ');

  const genDotClass = [
    styles.stepDot,
    isGenerating ? styles.stepDotActive : styles.stepDotDone,
  ].join(' ');

  const mergeDotClass = [
    styles.stepDot,
    isMerging ? styles.stepDotMerging : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.container}>
      <p className={styles.phaseLabel}>{phaseText}</p>

      <div className={styles.track}>
        <div className={fillClass} style={{ width: `${pct}%` }} />
      </div>

      <p className={styles.label}>
        {total > 0 ? `${current} de ${total}` : 'Preparando...'}
      </p>

      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.steps}>
        <div className={styles.step}>
          <span className={genDotClass} />
          Generar{isGenerating ? 'ando' : 'ado'}
        </div>
        <div className={styles.step}>
          <span className={mergeDotClass} />
          {isMerging ? 'Uniendo' : 'Unir'}
        </div>
      </div>
    </div>
  );
}
