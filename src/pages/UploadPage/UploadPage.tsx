import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartilla } from '../../context/CartillaContext';
import { useFileParser } from '../../hooks/useFileParser';
import { FileDropzone } from '../../components/FileDropzone/FileDropzone';
import styles from './UploadPage.module.css';

export function UploadPage() {
  const navigate = useNavigate();
  const { setParsedFile, parsedFile, reset } = useCartilla();
  const { parse, result, isLoading, error, clearError } = useFileParser();

  const handleFile = useCallback(async (file: File) => {
    clearError();
    await parse(file);
  }, [parse, clearError]);

  // Sync result to context in an effect, not during render
  useEffect(() => {
    if (result && (!parsedFile || parsedFile.filename !== result.filename)) {
      setParsedFile(result);
    }
  }, [result, parsedFile, setParsedFile]);

  const handleRemove = () => {
    reset();
    clearError();
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Generador de Cartilla Médica</h1>
      <p className={styles.subtitle}>Cargá un archivo Excel o CSV con los datos de prestadores</p>

      <FileDropzone
        onFile={handleFile}
        parsedFile={parsedFile}
        isLoading={isLoading}
        error={error}
        onRemove={handleRemove}
      />

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
