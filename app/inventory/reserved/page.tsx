'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';

interface ReservedItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  batchId: number;
  batchNumber: string;
  reservedQuantity: number;
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  customerId: number;
  customerName: string;
  salesRepName: string | null;
  createdAt: string;
}

export default function ReservedStockPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReservedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 15;

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/inventory/reserved-report');
      if (res.ok) {
        setItems(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch reserved stock report', err);
    } finally {
      setLoading(false);
    }
  };

  const totalReserved = items.reduce((s, i) => s + i.reservedQuantity, 0);

  const filtered = items.filter(i =>
    !search ||
    i.productName.toLowerCase().includes(search.toLowerCase()) ||
    i.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
    i.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    i.customerName.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const statusStyle = (status: string) => {
    switch (status) {
      case 'Pending': return { color: '#f59e0b' };
      case 'Manager_Approved': return { color: '#60a5fa' };
      case 'Finance_Approved': return { color: '#8b5cf6' };
      case 'Store_Confirmed': return { color: '#10b981' };
      case 'Completed': return { color: '#6b7280' };
      case 'Rejected': return { color: '#ef4444' };
      default: return { color: 'var(--text-muted)' };
    }
  };

  return (
    <div className="dashboard-container">
      <header className="page-header">
        <div>
          <h1 className="text-gradient">Reserved Stock Report</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {items.length} allocations — {totalReserved} units reserved across approved orders
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={() => router.push('/inventory')}>
            ← Back to Inventory
          </button>
        </div>
      </header>

      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by product, batch, order, or customer..."
          className="form-control"
          style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px' }}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading reserved stock...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          {search ? 'No results match your search.' : 'No reserved stock found. Approve orders to reserve inventory.'}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>Batch</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Reserved</th>
                  <th style={{ padding: '0.75rem' }}>Order #</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Customer</th>
                  <th style={{ padding: '0.75rem' }}>Sales Rep</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item) => (
                  <tr key={item.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.85rem' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                      <span style={{ cursor: 'pointer', color: 'var(--accent-hover)', textDecoration: 'underline' }}
                        onClick={() => router.push(`/inventory/${item.productId}`)}>
                        {item.productName}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{item.productSku}</span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{item.batchNumber}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>{item.reservedQuantity}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ cursor: 'pointer', color: 'var(--accent-hover)', textDecoration: 'underline' }}
                        onClick={() => router.push(`/orders/${item.orderId}`)}>
                        {item.orderNumber}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ ...statusStyle(item.orderStatus), fontWeight: 600 }}>{item.orderStatus}</span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-main)' }}>{item.customerName}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{item.salesRepName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', width: 'auto' }} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0 0.5rem' }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', width: 'auto' }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}
      <div className="sticky-footer-bar no-print">
        <button className="btn-secondary" onClick={() => router.push('/inventory')} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
          ← Back to Inventory
        </button>
      </div>
    </div>
  );
}
