import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartilla } from '../../context/CartillaContext';
import { useFileParser } from '../../hooks/useFileParser';
import { FileDropzone } from '../../components/FileDropzone/FileDropzone';
import styles from './UploadPage.module.css';

export function UploadPage() {
  const navigate = useNavigate();
  const { setParsedFile, parsedFile, normasText, setNormasText, reset } = useCartilla();
  const { parse, result, isLoading, error, clearError } = useFileParser();
  const txtInputRef = useRef<HTMLInputElement>(null);
  const [txtFilename, setTxtFilename] = useState<string | null>(null);

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

  const handleTxtFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTxtFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setNormasText(ev.target?.result as string);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleRemoveTxt = () => {
    setNormasText(null);
    setTxtFilename(null);
    if (txtInputRef.current) txtInputRef.current.value = '';
  };

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
        <p className={styles.txtHint}>Archivo .txt que se incluira como primera seccion del PDF</p>

        {!normasText ? (
          <button className={styles.txtBtn} onClick={() => txtInputRef.current?.click()}>
            Seleccionar archivo .txt
          </button>
        ) : (
          <div className={styles.txtBadge}>
            <div className={styles.txtInfo}>
              <span className={styles.txtName}>{txtFilename}</span>
              <span className={styles.txtMeta}>
                {normasText.length.toLocaleString()} caracteres
              </span>
            </div>
            <button className={styles.txtRemoveBtn} onClick={handleRemoveTxt} title="Quitar archivo">
              ✕
            </button>
          </div>
        )}

        <input
          ref={txtInputRef}
          type="file"
          accept=".txt"
          hidden
          onChange={handleTxtFile}
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
