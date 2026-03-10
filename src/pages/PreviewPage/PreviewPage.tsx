import { useMemo, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useCartilla } from '../../context/CartillaContext';
import { groupByEspecialidad } from '../../services/dataTransformer.service';
import { EspecialidadIndex } from '../../components/EspecialidadIndex/EspecialidadIndex';
import { EspecialidadSection } from '../../components/EspecialidadSection/EspecialidadSection';
import styles from './PreviewPage.module.css';

export function PreviewPage() {
  const navigate = useNavigate();
  const { cartillaData } = useCartilla();
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const grouped = useMemo(() => {
    if (!cartillaData) return new Map();
    return groupByEspecialidad(cartillaData.prestadores);
  }, [cartillaData]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const [esp, list] of grouped) {
      m.set(esp, list.length);
    }
    return m;
  }, [grouped]);

  if (!cartillaData || cartillaData.prestadores.length === 0) {
    return <Navigate to="/" replace />;
  }

  const especialidades = Array.from(grouped.keys());

  const scrollTo = (esp: string) => {
    sectionRefs.current.get(esp)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={styles.container}>
      <EspecialidadIndex
        especialidades={especialidades}
        counts={counts}
        onSelect={scrollTo}
      />

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1>Vista Previa</h1>
            <p>
              {cartillaData.totalEspecialidades} especialidades — {cartillaData.totalPrestadores.toLocaleString()} prestadores
            </p>
          </div>
          <button className={styles.backBtn} onClick={() => navigate('/mapping')}>
            ← Volver al mapeo
          </button>
        </div>

        {especialidades.map((esp) => (
          <div
            key={esp}
            ref={(el) => { if (el) sectionRefs.current.set(esp, el); }}
          >
            <EspecialidadSection
              especialidad={esp}
              prestadores={grouped.get(esp)!}
            />
          </div>
        ))}
      </main>

      <div className={styles.floatingBar}>
        <button className={styles.generateBtn} onClick={() => navigate('/generate')}>
          Generar PDF
        </button>
      </div>
    </div>
  );
}
