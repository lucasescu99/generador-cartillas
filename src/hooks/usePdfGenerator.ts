import { useState, useRef, useCallback, useEffect } from 'react';
import type { Prestador, NormasBlock, WorkerMessage } from '../types/cartilla.types';
import PdfWorker from '../workers/pdfGenerator.worker?worker';

export interface Progress {
  phase: 'generating' | 'merging';
  current: number;
  total: number;
  message: string;
}

interface Metadata {
  pageCount: number;
  sizeKb: number;
  durationMs: number;
}

type Status = 'idle' | 'generating' | 'complete' | 'error';

export function usePdfGenerator() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<Progress>({ phase: 'generating', current: 0, total: 0, message: '' });
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const startTimeRef = useRef<number>(0);

  // Revoke old blob URL on cleanup or when a new one is created
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const start = useCallback((prestadores: Prestador[], textBlocks?: NormasBlock[] | null, provinciaOrder?: string[], zonaOrder?: string[], rubroOrder?: string[]) => {
    setStatus('generating');
    setProgress({ phase: 'generating', current: 0, total: 0, message: 'Iniciando...' });
    setMetadata(null);
    setErrorMessage(null);
    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    blobRef.current = null;
    startTimeRef.current = Date.now();

    const worker = new PdfWorker();
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;

      if (msg.type === 'PROGRESS') {
        setProgress(msg.payload);
      } else if (msg.type === 'COMPLETE') {
        blobRef.current = msg.payload.blob;
        setPdfUrl(URL.createObjectURL(msg.payload.blob));
        setMetadata({
          pageCount: msg.payload.pageCount,
          sizeKb: msg.payload.sizeKb,
          durationMs: Date.now() - startTimeRef.current,
        });
        setStatus('complete');
        worker.terminate();
      } else if (msg.type === 'ERROR') {
        setErrorMessage(msg.payload.message);
        setStatus('error');
        worker.terminate();
      }
    };

    worker.onerror = () => {
      setErrorMessage('Error inesperado en el proceso de generacion');
      setStatus('error');
      worker.terminate();
    };

    worker.postMessage({
      type: 'START',
      payload: {
        prestadores,
        textBlocks: textBlocks || undefined,
        provinciaOrder: provinciaOrder || undefined,
        zonaOrder: zonaOrder || undefined,
        rubroOrder: rubroOrder || undefined,
      },
    } satisfies WorkerMessage);
  }, []);

  const download = useCallback((filename = 'cartilla-medica.pdf') => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    setStatus('idle');
  }, []);

  return { start, progress, status, download, metadata, errorMessage, cancel, pdfUrl };
}
