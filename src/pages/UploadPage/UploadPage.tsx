import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartilla } from '../../context/CartillaContext';
import { useFileParser } from '../../hooks/useFileParser';
import { FileDropzone } from '../../components/FileDropzone/FileDropzone';
import { parseNormasFile } from '../../services/normasParser.service';
import styles from './UploadPage.module.css';

export function UploadPage() {
  const navigate = useNavigate();
  const { setParsedFile, parsedFile, normasBlocks, setNormasBlocks, reset } = useCartilla();
  const { parse, result, isLoading, error, clearError } = useFileParser();
  const normasInputRef = useRef<HTMLInputElement>(null);
  const [normasFilename, setNormasFilename] = useState<string | null>(null);
  const [normasError, setNormasError] = useState<string | null>(null);

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

  const handleNormasFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNormasError(null);
    try {
      const blocks = await parseNormasFile(file);
      setNormasBlocks(blocks);
      setNormasFilename(file.name);
    } catch (err) {
      setNormasError(err instanceof Error ? err.message : 'Error al leer el archivo');
    }
  };

  const handleRemoveNormas = () => {
    setNormasBlocks(null);
    setNormasFilename(null);
    setNormasError(null);
    if (normasInputRef.current) normasInputRef.current.value = '';
  };

  const normasCount = normasBlocks?.filter((b) => b.spans.some((s) => s.text.trim())).length ?? 0;

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
        <p className={styles.txtLabel}>Normas Generales (opcional)</p>
        <p className={styles.txtHint}>Archivo .docx o .txt que se incluira como primera seccion del PDF</p>

        {!normasBlocks ? (
          <button className={styles.txtBtn} onClick={() => normasInputRef.current?.click()}>
            Seleccionar archivo
          </button>
        ) : (
          <div className={styles.txtBadge}>
            <div className={styles.txtInfo}>
              <span className={styles.txtName}>{normasFilename}</span>
              <span className={styles.txtMeta}>
                {normasCount} bloques de texto
              </span>
            </div>
            <button className={styles.txtRemoveBtn} onClick={handleRemoveNormas} title="Quitar archivo">
              ✕
            </button>
          </div>
        )}

        {normasError && <p className={styles.normasError}>{normasError}</p>}

        <input
          ref={normasInputRef}
          type="file"
          accept=".txt,.docx"
          hidden
          onChange={handleNormasFile}
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
