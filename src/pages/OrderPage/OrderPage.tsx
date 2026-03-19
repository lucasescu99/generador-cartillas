import { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useCartilla } from '../../context/CartillaContext';
import styles from './OrderPage.module.css';

function moveItem(arr: string[], from: number, to: number): string[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface OrderListProps {
  items: string[];
  onChange: (items: string[]) => void;
}

function OrderList({ items, onChange }: OrderListProps) {
  return (
    <ul className={styles.list}>
      {items.map((name, i) => (
        <li key={name} className={styles.item}>
          <span className={styles.itemIndex}>{i + 1}</span>
          <span className={styles.itemName}>{name}</span>
          <button
            className={styles.moveBtn}
            disabled={i === 0}
            onClick={() => onChange(moveItem(items, i, i - 1))}
            title="Subir"
          >
            ▲
          </button>
          <button
            className={styles.moveBtn}
            disabled={i === items.length - 1}
            onClick={() => onChange(moveItem(items, i, i + 1))}
            title="Bajar"
          >
            ▼
          </button>
        </li>
      ))}
    </ul>
  );
}

interface SelectableOrderListProps {
  items: string[];
  selected: string | null;
  onSelect: (item: string) => void;
  onChange: (items: string[]) => void;
}

function SelectableOrderList({ items, selected, onSelect, onChange }: SelectableOrderListProps) {
  return (
    <ul className={styles.list}>
      {items.map((name, i) => (
        <li
          key={name}
          className={`${styles.item} ${styles.itemClickable} ${selected === name ? styles.itemSelected : ''}`}
          onClick={() => onSelect(name)}
        >
          <span className={styles.itemIndex}>{i + 1}</span>
          <span className={styles.itemName}>{name}</span>
          <button
            className={styles.moveBtn}
            disabled={i === 0}
            onClick={(e) => { e.stopPropagation(); onChange(moveItem(items, i, i - 1)); }}
            title="Subir"
          >
            ▲
          </button>
          <button
            className={styles.moveBtn}
            disabled={i === items.length - 1}
            onClick={(e) => { e.stopPropagation(); onChange(moveItem(items, i, i + 1)); }}
            title="Bajar"
          >
            ▼
          </button>
        </li>
      ))}
    </ul>
  );
}

export function OrderPage() {
  const navigate = useNavigate();
  const { cartillaData, provinciaOrder, zonaOrder, rubroOrder, setProvinciaOrder, setZonaOrder, setRubroOrder } = useCartilla();
  const [selectedProv, setSelectedProv] = useState<string | null>(null);

  // Compute which zonas belong to each province
  const zonasByProv = useMemo(() => {
    if (!cartillaData) return new Map<string, Set<string>>();
    const map = new Map<string, Set<string>>();
    for (const p of cartillaData.prestadores) {
      const prov = (p.provincia || 'SIN PROVINCIA').trim().toUpperCase();
      const zona = (p.zona || 'SIN ZONA').trim().toUpperCase();
      if (!map.has(prov)) map.set(prov, new Set());
      map.get(prov)!.add(zona);
    }
    return map;
  }, [cartillaData]);

  // Filtered zonas for selected province, respecting global order
  const filteredZonas = useMemo(() => {
    if (!selectedProv) return [];
    const provZonas = zonasByProv.get(selectedProv);
    if (!provZonas) return [];
    return zonaOrder.filter((z) => provZonas.has(z));
  }, [selectedProv, zonaOrder, zonasByProv]);

  // Reorder filtered zonas and propagate to global zonaOrder
  const handleZonaReorder = (reordered: string[]) => {
    const provZonas = selectedProv ? zonasByProv.get(selectedProv) : null;
    if (!provZonas) return;

    const newOrder = [...zonaOrder];
    const indices = newOrder
      .map((z, i) => (provZonas.has(z) ? i : -1))
      .filter((i) => i !== -1);

    for (let i = 0; i < indices.length; i++) {
      newOrder[indices[i]] = reordered[i];
    }
    setZonaOrder(newOrder);
  };

  if (!cartillaData || cartillaData.prestadores.length === 0) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Orden de Secciones</h1>
        <button className={styles.backBtn} onClick={() => navigate('/mapping')}>
          ← Volver al mapeo
        </button>
      </div>

      <p className={styles.subtitle}>
        Ordena las provincias, zonas y rubros como quieras que aparezcan en el PDF.
        Selecciona una provincia para ver sus zonas.
      </p>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Provincias ({provinciaOrder.length})</h2>
          <SelectableOrderList
            items={provinciaOrder}
            selected={selectedProv}
            onSelect={setSelectedProv}
            onChange={setProvinciaOrder}
          />
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            Zonas {selectedProv ? `de ${selectedProv}` : ''} ({filteredZonas.length})
          </h2>
          {selectedProv ? (
            <OrderList items={filteredZonas} onChange={handleZonaReorder} />
          ) : (
            <p className={styles.emptyMsg}>Selecciona una provincia para ver sus zonas</p>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Rubros ({rubroOrder.length})</h2>
          <OrderList items={rubroOrder} onChange={setRubroOrder} />
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.continueBtn} onClick={() => navigate('/preview')}>
          Generar PDF
        </button>
      </div>
    </div>
  );
}
