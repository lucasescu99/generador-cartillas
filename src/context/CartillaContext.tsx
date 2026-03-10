import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ColumnMapping, ParsedFile, CartillaData } from '../types/cartilla.types';
import { transformRows, buildCartillaData } from '../services/dataTransformer.service';

interface CartillaState {
  parsedFile: ParsedFile | null;
  mapping: ColumnMapping | null;
  cartillaData: CartillaData | null;
}

interface CartillaContextType extends CartillaState {
  setParsedFile: (file: ParsedFile) => void;
  applyMapping: (mapping: ColumnMapping, allRows: Record<string, unknown>[]) => void;
  reset: () => void;
}

const initial: CartillaState = {
  parsedFile: null,
  mapping: null,
  cartillaData: null,
};

const CartillaContext = createContext<CartillaContextType | null>(null);

export function CartillaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartillaState>(initial);

  const setParsedFile = useCallback((parsedFile: ParsedFile) => {
    setState((prev) => ({ ...prev, parsedFile, mapping: null, cartillaData: null }));
  }, []);

  const applyMapping = useCallback((mapping: ColumnMapping, allRows: Record<string, unknown>[]) => {
    const prestadores = transformRows(allRows, mapping);
    const cartillaData = buildCartillaData(prestadores, allRows, mapping);
    setState((prev) => ({ ...prev, mapping, cartillaData }));
  }, []);

  const reset = useCallback(() => setState(initial), []);

  return (
    <CartillaContext.Provider value={{ ...state, setParsedFile, applyMapping, reset }}>
      {children}
    </CartillaContext.Provider>
  );
}

export function useCartilla(): CartillaContextType {
  const ctx = useContext(CartillaContext);
  if (!ctx) throw new Error('useCartilla must be used within CartillaProvider');
  return ctx;
}
