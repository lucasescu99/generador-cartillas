import { useState, useRef, useCallback } from 'react';
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
  const blobRef = useRef<Blob | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const startTimeRef = useRef<number>(0);

  const start = useCallback((prestadores: Prestador[], normasBlocks?: NormasBlock[] | null) => {
    setStatus('generating');
    setProgress({ phase: 'generating', current: 0, total: 0, message: 'Iniciando...' });
    setMetadata(null);
    setErrorMessage(null);
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
      payload: { prestadores, normasBlocks: normasBlocks || undefined },
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

  return { start, progress, status, download, metadata, errorMessage, cancel };
}
