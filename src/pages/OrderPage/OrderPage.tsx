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

export function OrderPage() {
  const navigate = useNavigate();
  const { cartillaData, provinciaOrder, rubroOrder, setProvinciaOrder, setRubroOrder } = useCartilla();

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
        Ordena las provincias y rubros como quieras que aparezcan en el PDF.
      </p>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Provincias ({provinciaOrder.length})</h2>
          <OrderList items={provinciaOrder} onChange={setProvinciaOrder} />
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
