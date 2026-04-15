import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartilla } from '../../context/CartillaContext';
import { useFileParser } from '../../hooks/useFileParser';
import { useDevPreload } from '../../hooks/useDevPreload';
import { FileDropzone } from '../../components/FileDropzone/FileDropzone';
import { parseNormasFile } from '../../services/normasParser.service';
import styles from './UploadPage.module.css';

export function UploadPage() {
  const navigate = useNavigate();
  const { setParsedFile, parsedFile, textBlocks, setTextBlocks, planOperativoBlocks, setPlanOperativoBlocks, reset } = useCartilla();
  const { parse, result, isLoading, error, clearError } = useFileParser();
  useDevPreload();
  const textInputRef = useRef<HTMLInputElement>(null);
  const [textFilename, setTextFilename] = useState<string | null>(textBlocks ? 'documento.docx' : null);
  const [textError, setTextError] = useState<string | null>(null);
  const planInputRef = useRef<HTMLInputElement>(null);
  const [planFilename, setPlanFilename] = useState<string | null>(planOperativoBlocks ? 'documento.docx' : null);
  const [planError, setPlanError] = useState<string | null>(null);

  // Sync filename when preloaded from dev fixtures
  useEffect(() => {
    if (textBlocks && !textFilename) setTextFilename('documento.docx');
  }, [textBlocks, textFilename]);

  useEffect(() => {
    if (planOperativoBlocks && !planFilename) setPlanFilename('documento.docx');
  }, [planOperativoBlocks, planFilename]);

  const handleFile = useCallback(async (file: File) => {
    clearError();
    await parse(file);
  }, [parse, clearError]);

  useEffect(() => {
    if (result && (!parsedFile || parsedFile.filename !== result.filename)) {
      setParsedFile(result);
    }
  }, [result, parsedFile, setParsedFile]);

  const handleRemove = () => {
    reset();
    clearError();
  };

  const handleTextFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTextError(null);
    try {
      const blocks = await parseNormasFile(file);
      setTextBlocks(blocks);
      setTextFilename(file.name);
    } catch (err) {
      setTextError(err instanceof Error ? err.message : 'Error al leer el archivo');
    }
  };

  const handleRemoveText = () => {
    setTextBlocks(null);
    setTextFilename(null);
    setTextError(null);
    if (textInputRef.current) textInputRef.current.value = '';
  };

  const handlePlanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPlanError(null);
    try {
      const blocks = await parseNormasFile(file);
      setPlanOperativoBlocks(blocks);
      setPlanFilename(file.name);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Error al leer el archivo');
    }
  };

  const handleRemovePlan = () => {
    setPlanOperativoBlocks(null);
    setPlanFilename(null);
    setPlanError(null);
    if (planInputRef.current) planInputRef.current.value = '';
  };

  const textCount = textBlocks?.filter((b) => b.spans.some((s) => s.text.trim())).length ?? 0;
  const planCount = planOperativoBlocks?.filter((b) => b.spans.some((s) => s.text.trim())).length ?? 0;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Generador de Cartilla Medica</h1>
      <p className={styles.subtitle}>Carga un archivo Excel o CSV con los datos de prestadores</p>

      <FileDropzone
        onFile={handleFile}
        parsedFile={parsedFile}
        isLoading={isLoading}
        error={error}
        onRemove={handleRemove}
      />

      <div className={styles.txtSection}>
        <p className={styles.txtLabel}>Contactos, Servicios y Cobertura (opcional)</p>
        <p className={styles.txtHint}>Archivo .docx o .txt que se incluirá como primera sección del PDF</p>

        {!textBlocks ? (
          <button className={styles.txtBtn} onClick={() => textInputRef.current?.click()}>
            Seleccionar archivo
          </button>
        ) : (
          <div className={styles.txtBadge}>
            <div className={styles.txtInfo}>
              <span className={styles.txtName}>{textFilename}</span>
              <span className={styles.txtMeta}>
                {textCount} bloques de texto
              </span>
            </div>
            <button className={styles.txtRemoveBtn} onClick={handleRemoveText} title="Quitar archivo">
              ✕
            </button>
          </div>
        )}

        {textError && <p className={styles.normasError}>{textError}</p>}

        <input
          ref={textInputRef}
          type="file"
          accept=".txt,.docx"
          hidden
          onChange={handleTextFile}
        />
      </div>

      <div className={styles.txtSection}>
        <p className={styles.txtLabel}>Plan de Implementación Operativa (opcional)</p>
        <p className={styles.txtHint}>Archivo .docx o .txt que se incluirá justo después del índice</p>

        {!planOperativoBlocks ? (
          <button className={styles.txtBtn} onClick={() => planInputRef.current?.click()}>
            Seleccionar archivo
          </button>
        ) : (
          <div className={styles.txtBadge}>
            <div className={styles.txtInfo}>
              <span className={styles.txtName}>{planFilename}</span>
              <span className={styles.txtMeta}>
                {planCount} bloques de texto
              </span>
            </div>
            <button className={styles.txtRemoveBtn} onClick={handleRemovePlan} title="Quitar archivo">
              ✕
            </button>
          </div>
        )}

        {planError && <p className={styles.normasError}>{planError}</p>}

        <input
          ref={planInputRef}
          type="file"
          accept=".txt,.docx"
          hidden
          onChange={handlePlanFile}
        />
      </div>

      <button
        className={styles.continueBtn}
        disabled={!parsedFile || isLoading}
        onClick={() => navigate('/mapping')}
      >
        Continuar
      </button>
    </div>
  );
}
