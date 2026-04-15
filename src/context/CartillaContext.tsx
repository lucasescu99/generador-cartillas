import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ColumnMapping, ParsedFile, CartillaData, NormasBlock, SectionKey } from '../types/cartilla.types';

const DEFAULT_SECTION_ORDER: SectionKey[] = ['plan', 'contactos', 'provincias'];
import { transformRows, buildCartillaData } from '../services/dataTransformer.service';

interface CartillaState {
  parsedFile: ParsedFile | null;
  mapping: ColumnMapping | null;
  cartillaData: CartillaData | null;
  textBlocks: NormasBlock[] | null;
  planOperativoBlocks: NormasBlock[] | null;
  sectionOrder: SectionKey[];
  provinciaOrder: string[];
  zonaOrder: string[];
  rubroOrder: string[];
}

interface CartillaContextType extends CartillaState {
  setParsedFile: (file: ParsedFile) => void;
  applyMapping: (mapping: ColumnMapping, allRows: Record<string, unknown>[]) => void;
  setTextBlocks: (blocks: NormasBlock[] | null) => void;
  setPlanOperativoBlocks: (blocks: NormasBlock[] | null) => void;
  setSectionOrder: (order: SectionKey[]) => void;
  setProvinciaOrder: (order: string[]) => void;
  setZonaOrder: (order: string[]) => void;
  setRubroOrder: (order: string[]) => void;
  reset: () => void;
}

const initial: CartillaState = {
  parsedFile: null,
  mapping: null,
  cartillaData: null,
  textBlocks: null,
  planOperativoBlocks: null,
  sectionOrder: DEFAULT_SECTION_ORDER,
  provinciaOrder: [],
  zonaOrder: [],
  rubroOrder: [],
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
    // Extract unique provinces and rubros, sorted alphabetically as default order
    const provSet = new Set<string>();
    const zonaSet = new Set<string>();
    const rubroSet = new Set<string>();
    for (const p of prestadores) {
      provSet.add((p.provincia || 'SIN PROVINCIA').trim().toUpperCase());
      zonaSet.add((p.zona || 'SIN ZONA').trim().toUpperCase());
      rubroSet.add(p.rubro);
    }
    const provinciaOrder = Array.from(provSet).sort((a, b) => a.localeCompare(b, 'es'));
    const zonaOrder = Array.from(zonaSet).sort((a, b) => a.localeCompare(b, 'es'));
    const rubroOrder = Array.from(rubroSet).sort((a, b) => a.localeCompare(b, 'es'));
    setState((prev) => ({ ...prev, mapping, cartillaData, provinciaOrder, zonaOrder, rubroOrder }));
  }, []);

  const setTextBlocks = useCallback((textBlocks: NormasBlock[] | null) => {
    setState((prev) => ({ ...prev, textBlocks }));
  }, []);

  const setPlanOperativoBlocks = useCallback((planOperativoBlocks: NormasBlock[] | null) => {
    setState((prev) => ({ ...prev, planOperativoBlocks }));
  }, []);

  const setSectionOrder = useCallback((sectionOrder: SectionKey[]) => {
    setState((prev) => ({ ...prev, sectionOrder }));
  }, []);

  const setProvinciaOrder = useCallback((provinciaOrder: string[]) => {
    setState((prev) => ({ ...prev, provinciaOrder }));
  }, []);

  const setZonaOrder = useCallback((zonaOrder: string[]) => {
    setState((prev) => ({ ...prev, zonaOrder }));
  }, []);

  const setRubroOrder = useCallback((rubroOrder: string[]) => {
    setState((prev) => ({ ...prev, rubroOrder }));
  }, []);

  const reset = useCallback(() => setState(initial), []);

  return (
    <CartillaContext.Provider value={{ ...state, setParsedFile, applyMapping, setTextBlocks, setPlanOperativoBlocks, setSectionOrder, setProvinciaOrder, setZonaOrder, setRubroOrder, reset }}>
      {children}
    </CartillaContext.Provider>
  );
}

export function useCartilla(): CartillaContextType {
  const ctx = useContext(CartillaContext);
  if (!ctx) throw new Error('useCartilla must be used within CartillaProvider');
  return ctx;
}
