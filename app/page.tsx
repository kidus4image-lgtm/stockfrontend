'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { apiFetch } from '../lib/api';
import { showSuccess, showError } from '../lib/toast';
import { confirmAsync } from '../lib/confirm';

export default function Dashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [storeOrders, setStoreOrders] = useState<any[]>([]);
  const [storeBatches, setStoreBatches] = useState<any[]>([]);
  const [storeMovements, setStoreMovements] = useState<any[]>([]);

  // Dashboard filters
  const [chequeSearch, setChequeSearch] = useState('');
  const [managerSearch, setManagerSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      router.push('/login');
      return;
    }
    setIsAuthenticated(true);
    try {
      const parsed = JSON.parse(storedUser);
      setCurrentUser(parsed);
      if (parsed.role?.toLowerCase() === 'sales_user') {
        router.push('/seller-dashboard');
        return;
      }
      if (parsed.role?.toLowerCase() === 'cashier') {
        router.push('/cashier-dashboard');
        return;
      }
    } catch (err) {
      console.error('Failed to parse current user session', err);
    }
    fetchDashboardData();
  }, [router]);

  const fetchDashboardData = async () => {
    try {
      // Fetch comprehensive report data
      const res = await apiFetch('http://localhost:5000/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }

      // Fetch active reminders
      const remRes = await apiFetch('http://localhost:5000/api/reminders');
      if (remRes.ok) {
        setReminders(await remRes.json());
      }

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const role = parsed.role?.toLowerCase();
        if (role === 'store_user') {
          const dateTo = new Date().toISOString();
          const dateFrom = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
          const [productsRes, ordersRes, batchesRes, movementsRes] = await Promise.all([
            apiFetch('http://localhost:5000/api/inventory/products'),
            apiFetch('http://localhost:5000/api/orders'),
            apiFetch('http://localhost:5000/api/inventory/batches'),
            apiFetch(`http://localhost:5000/api/reports/inventory-movement?dateFrom=${dateFrom}&dateTo=${dateTo}`)
          ]);
          if (productsRes.ok) setStoreProducts(await productsRes.json());
          if (ordersRes.ok) setStoreOrders(await ordersRes.json());
          if (batchesRes.ok) setStoreBatches(await batchesRes.json());
          if (movementsRes.ok) {
            const movementData = await movementsRes.json();
            setStoreMovements(movementData.movements || []);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard statistics', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCheque = async (paymentId: number) => {
    const date = prompt('Enter cleared date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!date) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${paymentId}/clear`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearedDate: date })
      });
      if (res.ok) {
        showSuccess('Cheque successfully cleared and settled.');
        fetchDashboardData();
      } else {
        const errData = await res.json();
        showError(`Error: ${errData.error || 'Failed to clear cheque'}`);
      }
    } catch (err) {
      console.error(err);
      showError('Network error clearing cheque');
    }
  };

  const handleBounceCheque = async (paymentId: number) => {
    if (!(await confirmAsync({ title: 'Bounce Cheque', message: 'WARNING: Are you sure you want to BOUNCE this cheque? This will reverse the pending balance and log a critical reminder.', variant: 'danger' }))) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${paymentId}/bounce`, { method: 'POST' });
      if (res.ok) {
        showSuccess('Cheque marked as Bounced. Critical customer reminder has been registered.');
        fetchDashboardData();
      } else {
        const errData = await res.json();
        showError(`Error: ${errData.error || 'Failed to bounce cheque'}`);
      }
    } catch (err) {
      console.error(err);
      showError('Network error bouncing cheque');
    }
  };

  const handleResolveReminder = async (reminderId: number) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/reminders/${reminderId}/resolve`, { method: 'POST' });
      if (res.ok) {
        setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, isResolved: true } : r));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Aggregating enterprise metrics...
      </div>
    );
  }

  if (!isAuthenticated || !reportData || !currentUser) {
    return null;
  }

  const { summary, customers, employees, banks, invoices } = reportData;
  const userRole = currentUser.role?.toLowerCase() || 'sales_user';

  // --- 1. SALES USER DASHBOARD VIEW ---
  if (userRole === 'sales_user') {
    return (
      <div className="dashboard-container">
        <header className="page-header">
          <div>
            <h1 className="text-gradient">Sales Dashboard</h1>
            <p style={{ color: 'var(--text-muted)' }}>Welcome back, {currentUser.username}! View your enhanced seller dashboard.</p>
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6ee7b7', background: 'rgba(16,185,129,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', flexShrink: 0 }}>
            Role: <strong>Sales User</strong>
          </div>
        </header>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>Redirecting to Seller Dashboard...</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Your personalized seller dashboard with operations and reports is now available.
          </p>
          <button className="btn-primary" onClick={() => router.push('/seller-dashboard')} style={{ width: 'auto', margin: '0 auto', padding: '0.8rem 2rem', fontSize: '1rem' }}>
            Open Seller Dashboard
          </button>
        </div>
      </div>
    );
  }

  // --- 2. FINANCE DASHBOARD VIEW ---
  if (userRole === 'finance') {
    const flatPayments = invoices.flatMap((inv: any) => 
      (inv.payments || []).map((p: any) => ({
        ...p,
        invoiceNumber: inv.invoiceNumber,
        invoiceId: inv.id,
        customerName: inv.customer?.customerName,
        customerId: inv.customer?.id
      }))
    );

    const pendingCheques = flatPayments.filter((p: any) => p.status === 'Uncollected' && p.paymentMethod === 'Cheque');
    const filteredPendingCheques = chequeSearch ? pendingCheques.filter((p: any) =>
      p.customerName?.toLowerCase().includes(chequeSearch.toLowerCase()) ||
      p.invoiceNumber?.toLowerCase().includes(chequeSearch.toLowerCase()) ||
      p.chequeNumber?.toLowerCase().includes(chequeSearch.toLowerCase()) ||
      p.bank?.toLowerCase().includes(chequeSearch.toLowerCase())
    ) : pendingCheques;
    const bouncedTotal = flatPayments.filter((p: any) => p.status === 'Bounced').reduce((sum: number, p: any) => sum + p.amount, 0);

    const COLORS = ['#10b981', '#f43f5e', '#f59e0b'];
    const collectionStatusData = [
      { name: 'Cleared Deposits', value: summary.totalPaid },
      { name: 'Accounts Outstanding', value: summary.totalRemaining },
      { name: 'Uncleared Cheques', value: summary.totalUncollected },
    ];

    return (
      <div className="dashboard-container">
        <header className="page-header">
          <div>
            <h1 className="text-gradient">Finance Cashier Desk</h1>
            <p style={{ color: 'var(--text-muted)' }}>Manage bank cheque pipelines, register customer accounts, and audit liquidity status.</p>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)', flexShrink: 0 }}>
            Role: <strong>Finance Control</strong>
          </div>
        </header>

        {/* Quick Operations Panel */}
        <div className="glass-panel quick-actions">
          <span className="quick-actions-label">⚡ Cashier Actions:</span>
          <button className="btn-primary" onClick={() => router.push('/import')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📥 Import POS Sales</button>
          <button className="btn-secondary" onClick={() => router.push('/payments')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>💵 Register / Post Payment</button>
          <button className="btn-secondary" onClick={() => router.push('/reports')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📊 Accounting Reports</button>
        </div>

        {/* KPI Summary Columns */}
        <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-title">Cleared Funds</div>
            <div className="stat-value" style={{ color: '#10b981' }}>
              ${summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Cash & cleared bank accounts
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-title">Uncleared Cheque Pipeline</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              ${summary.totalUncollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Pending clearing validation
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #ef4444' }}>
            <div className="stat-title">Bounced Cheques Total</div>
            <div className="stat-value" style={{ color: '#ef4444' }}>
              ${bouncedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Returned/rejected cheque entries
            </div>
          </div>
        </div>

        {/* Uncleared Cheque Verification Queue */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, color: 'var(--accent-hover)' }}>🏦 Cheque Maturity Clearance Queue ({pendingCheques.length})</h3>
            <input type="text" placeholder="🔍 Search customer, invoice, cheque, bank..." value={chequeSearch}
              onChange={e => setChequeSearch(e.target.value)}
              style={{ padding: '0.4rem 0.7rem', borderRadius: '8px', fontSize: '0.8rem', width: '280px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Pending bank cheque clearances. Clear cheque on mature bank settlement or flag as Bounced.</p>
          
          {filteredPendingCheques.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', padding: '3rem' }}>
              No cheques currently pending clearance in the pipeline.
            </p>
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem' }}>Maturity Date</th>
                    <th style={{ padding: '0.75rem' }}>Customer Name</th>
                    <th style={{ padding: '0.75rem' }}>Invoice No</th>
                    <th style={{ padding: '0.75rem' }}>Cheque Number</th>
                    <th style={{ padding: '0.75rem' }}>Deposit Bank</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Clearance Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingCheques.slice(0, 10).map((pmt: any) => (
                    <tr key={pmt.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>{pmt.dueDate ? new Date(pmt.dueDate).toLocaleDateString() : 'N/A'}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{pmt.customerName}</td>
                      <td style={{ padding: '0.75rem' }}>{pmt.invoiceNumber}</td>
                      <td style={{ padding: '0.75rem' }}>{pmt.chequeNumber}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{pmt.bank}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>${pmt.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                          <button className="btn-primary" onClick={() => handleClearCheque(pmt.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'var(--success)' }}>Clear</button>
                          <button className="btn-primary" onClick={() => handleBounceCheque(pmt.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'var(--danger)' }}>Bounce</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid-2col" style={{ marginBottom: '3rem' }}>
          {/* Pie Chart: Cash flow breakdown */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Enterprise Cash Flow Status</h3>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={collectionStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {collectionStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: any) => `$${Number(val).toLocaleString()}`} contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Banks Pipeline Summary */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Uncollected Cheques by Bank</h3>
            <div style={{ height: '300px', overflowY: 'auto', paddingRight: '1rem' }}>
              {banks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {banks.map((b: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#374151', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>🏦</div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600 }}>{b.bankName}</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.paymentCount} Cheque Deposits</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#f59e0b' }}>${b.totalUncollected.toLocaleString()}</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending Clearance</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                  No pending bank collections.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 3. STORE USER DASHBOARD VIEW ---
  if (userRole === 'store_user') {
    const totalProducts = storeProducts.length;
    const totalStockValue = storeProducts.reduce((sum: number, p: any) => sum + ((p.stockQuantity || 0) * (p.unitCost || 0)), 0);
    const totalStockQty = storeProducts.reduce((sum: number, p: any) => sum + (p.stockQuantity || 0), 0);
    const pendingStoreOrders = storeOrders.filter((o: any) => o.status === 'Pending Store Confirmation' || o.status === 'Pending');
    const lowStockItems = storeProducts.filter((p: any) => p.stockQuantity <= (p.reorderLevel || 0) && p.stockQuantity > 0);
    const outOfStockItems = storeProducts.filter((p: any) => (p.stockQuantity || 0) === 0);

    return (
      <div className="dashboard-container">
        <header className="page-header">
          <div>
            <h1 className="text-gradient">Store Dashboard</h1>
            <p style={{ color: 'var(--text-muted)' }}>Inventory status, stock movements, and pending order confirmations.</p>
          </div>
          <div style={{ fontSize: '0.9rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', flexShrink: 0 }}>
            Role: <strong>Store User</strong>
          </div>
        </header>

        {/* Quick Operations Panel */}
        <div className="glass-panel quick-actions">
          <span className="quick-actions-label">⚡ Store Actions:</span>
          <button className="btn-primary" onClick={() => router.push('/inventory')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📦 Manage Inventory</button>
          <button className="btn-secondary" onClick={() => router.push('/orders')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📋 View Orders</button>
          <button className="btn-secondary" onClick={() => router.push('/inventory/receive')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📥 Receive Stock</button>
          <button className="btn-secondary" onClick={() => router.push('/reports?tab=inventory')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📊 Stock Reports</button>
        </div>

        {/* KPI Summary */}
        <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
            <div className="stat-title">Total Products</div>
            <div className="stat-value" style={{ color: '#6366f1' }}>{totalProducts}</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Registered inventory items
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-title">Total Stock Value</div>
            <div className="stat-value" style={{ color: '#10b981', fontSize: '1.5rem' }}>
              ${totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {totalStockQty.toLocaleString()} total units on hand
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-title">Pending Confirmations</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{pendingStoreOrders.length}</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Orders awaiting store confirmation
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #ef4444' }}>
            <div className="stat-title">Out of Stock</div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{outOfStockItems.length}</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {lowStockItems.length} items near reorder level
            </div>
          </div>
        </div>

        <div className="grid-split" style={{ marginBottom: '3rem' }}>
          {/* Low Stock Alerts */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: '#f59e0b' }}>⚠️ Low Stock Alerts</h3>
            {lowStockItems.length === 0 && outOfStockItems.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
                All products are adequately stocked.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {[...outOfStockItems, ...lowStockItems].slice(0, 10).map((p: any) => (
                  <Link key={p.id} href={`/inventory/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', background: (p.stockQuantity || 0) === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: '1px solid ' + ((p.stockQuantity || 0) === 0 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'), cursor: 'pointer', transition: 'opacity 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{p.productName}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {p.sku || 'N/A'} | Reorder at: {p.reorderLevel || 0}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: (p.stockQuantity || 0) === 0 ? '#ef4444' : '#f59e0b' }}>
                        {(p.stockQuantity || 0) === 0 ? 'OUT OF STOCK' : `${p.stockQuantity} left`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Pending Orders */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>📋 Orders Awaiting Confirmation</h3>
            {pendingStoreOrders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
                No orders pending confirmation.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {pendingStoreOrders.slice(0, 8).map((o: any) => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div>
                      <Link href={`/orders/${o.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
                        {o.orderNumber || `Order #${o.id}`}
                      </Link>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(o.createdAt).toISOString().split('T')[0]} — {o.customer?.customerName || 'N/A'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                        {o.status}
                      </span>
                      <button className="btn-primary" onClick={() => router.push(`/orders/${o.id}`)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                        Confirm
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid-2col" style={{ marginBottom: '3rem' }}>
          {/* Donut Chart: Stock Status */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Stock Status</h3>
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'In Stock', value: totalProducts - lowStockItems.length - outOfStockItems.length },
                      { name: 'Low Stock', value: lowStockItems.length },
                      { name: 'Out of Stock', value: outOfStockItems.length }
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {[
                      { name: 'In Stock', value: totalProducts - lowStockItems.length - outOfStockItems.length },
                      { name: 'Low Stock', value: lowStockItems.length },
                      { name: 'Out of Stock', value: outOfStockItems.length }
                    ].filter(d => d.value > 0).map((_, idx) => (
                      <Cell key={idx} fill={['#10b981', '#f59e0b', '#ef4444'][idx]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: any) => `${val} products`} contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={30} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart: Top Products by Stock */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Top Products by Stock Qty</h3>
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...storeProducts].sort((a: any, b: any) => (b.stockQuantity || 0) - (a.stockQuantity || 0)).slice(0, 8).map((p: any) => ({
                  name: (p.productName || p.name || '').substring(0, 12),
                  qty: p.stockQuantity || 0
                }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickMargin={8} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="qty" fill="#6366f1" radius={[4, 4, 0, 0]} name="Stock Qty" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Line Chart: 14-Day Movement */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>📈 Inventory Movement (Last 14 Days)</h3>
          {storeMovements.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No movement data for this period.</p>
          ) : (
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(() => {
                  const byDate: Record<string, { in: number; out: number }> = {};
                  for (const m of storeMovements) {
                    const day = new Date(m.date).toISOString().split('T')[0];
                    if (!byDate[day]) byDate[day] = { in: 0, out: 0 };
                    if (m.type === 'Stock In') byDate[day].in += Math.abs(m.quantity);
                    else byDate[day].out += Math.abs(m.quantity);
                  }
                  return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), in: v.in, out: v.out }));
                })()} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickMargin={8} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="in" fill="#10b981" radius={[4, 4, 0, 0]} name="Stock In" />
                  <Bar dataKey="out" fill="#ef4444" radius={[4, 4, 0, 0]} name="Stock Out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Monthly Activity Cards */}
        <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-title">Received This Month</div>
            <div className="stat-value" style={{ color: '#10b981' }}>
              {storeBatches.filter((b: any) => new Date(b.receivedDate).getMonth() === new Date().getMonth()).length}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Batches received
            </div>
          </div>
          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-title">Orders Fulfilled</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              {storeOrders.filter((o: any) => o.status === 'Completed' || o.status === 'Store_Confirmed').length}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Total completed orders
            </div>
          </div>
          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
            <div className="stat-title">Total Batches</div>
            <div className="stat-value" style={{ color: '#6366f1' }}>
              {storeBatches.length}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Across all products
            </div>
          </div>
          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="stat-title">Expiring Soon</div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>
              {storeBatches.filter((b: any) => {
                if (!b.expiryDate) return false;
                const daysUntilExpiry = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
              }).length}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Within 30 days
            </div>
          </div>
        </div>

        <div className="grid-split" style={{ marginBottom: '3rem' }}>
          {/* Recent Goods Received */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>📥 Recent Goods Received</h3>
            {storeBatches.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No batches received yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto' }}>
                {[...storeBatches].sort((a: any, b: any) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime()).slice(0, 5).map((b: any) => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{b.batchNumber}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.product?.name || b.productName || `Product #${b.productId}`} — {b.quantity} units</p>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(b.receivedDate).toISOString().split('T')[0]}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expiring Batches */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: '#ef4444' }}>⏳ Expiring Within 30 Days</h3>
            {(() => {
              const expiring = storeBatches.filter((b: any) => {
                if (!b.expiryDate) return false;
                const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return days >= 0 && days <= 30;
              }).sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
              return expiring.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No batches expiring soon.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto' }}>
                  {expiring.slice(0, 5).map((b: any) => {
                    const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', background: days <= 7 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: '1px solid ' + (days <= 7 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)') }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{b.batchNumber}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.product?.name || b.productName || `Product #${b.productId}`} — {b.quantity} units</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: days <= 7 ? '#ef4444' : '#f59e0b' }}>
                            {days}d remaining
                          </p>
                          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Exp: {new Date(b.expiryDate).toISOString().split('T')[0]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Compact Inventory Table */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>📦 Inventory Snapshot</h3>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>SKU</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Stock Qty</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Value</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {storeProducts.slice(0, 8).map((p: any) => (
                  <tr key={p.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.85rem' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{p.productName}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{p.sku || 'N/A'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{p.stockQuantity || 0}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${(p.unitCost || 0).toFixed(2)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>${((p.stockQuantity || 0) * (p.unitCost || 0)).toFixed(2)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {(p.stockQuantity || 0) === 0 ? (
                        <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>OUT</span>
                      ) : p.stockQuantity <= (p.reorderLevel || 0) ? (
                        <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>LOW</span>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- 4. MANAGER / DEFAULT EXECUTIVE VIEW ---
  const topCustomers = customers.slice(0, 5).map((c: any) => ({
    name: c.customerName.substring(0, 15) + (c.customerName.length > 15 ? '...' : ''),
    Outstanding: c.totalRemaining,
    TotalAmount: c.totalAmount
  }));

  const topEmployees = employees.slice(0, 5).map((e: any) => ({
    name: e.employeeName.substring(0, 15),
    Outstanding: e.totalRemaining
  }));

  const collectionStatusData = [
    { name: 'Paid Collections', value: summary.totalPaid },
    { name: 'Remaining Outstanding', value: summary.totalRemaining },
    { name: 'Uncollected Bank Chqs', value: summary.totalUncollected },
  ];
  const COLORS = ['#10b981', '#f43f5e', '#f59e0b'];

  return (
    <div className="dashboard-container">
      <header className="page-header no-print">
        <div>
          <h1 className="text-gradient">Enterprise Overview</h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time statistics sourced directly from your operational ledger.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={() => router.push('/reports')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📑 Reports Library</button>
          <button className="btn-primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}>
            🖨️ Export Dashboard
          </button>
        </div>
      </header>

      <div className="report-print-area">
        {/* KPI HIGHLIGHTS */}
        <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f43f5e' }}>
            <div className="stat-title">Total Outstanding</div>
            <div className="stat-value" style={{ color: '#f43f5e' }}>
              ${summary.totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Across {customers.length} ledger accounts
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-title">Total Collected</div>
            <div className="stat-value" style={{ color: '#10b981' }}>
              ${summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Cleared cash and bank deposits
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-title">Uncollected Payments</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              ${summary.totalUncollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Pending banks verification
            </div>
          </div>
          
          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
            <div className="stat-title">Total Invoices</div>
            <div className="stat-value" style={{ color: '#6366f1' }}>
              {summary.invoiceCount}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Overdue: {summary.overdueCount} critical invoices
            </div>
          </div>
        </div>

        {/* CHARTS SECTION */}
        <div className="grid-2col" style={{ marginBottom: '3rem' }}>
          {/* Top Customers Chart */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Top 5 Customers by Outstanding</h3>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCustomers} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `$${val/1000}k`} />
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="Outstanding" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Collection Status Pie Chart */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Enterprise Cash Flow Status</h3>
            <div style={{ height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={collectionStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {collectionStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: any) => `$${Number(val).toLocaleString()}`} contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Reps Chart */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Sales Reps Collection Performance</h3>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topEmployees} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `$${val/1000}k`} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={12} width={100} />
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="Outstanding" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Banks Pipeline Summary */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Uncollected Cheques by Bank</h3>
              <input type="text" placeholder="🔍 Filter by bank name..." value={managerSearch}
                onChange={e => setManagerSearch(e.target.value)}
                style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', width: '220px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
            </div>
            <div style={{ height: '300px', overflowY: 'auto', paddingRight: '1rem' }}>
              {(banks.length > 0 ? (managerSearch ? banks.filter((b: any) => b.bankName?.toLowerCase().includes(managerSearch.toLowerCase())) : banks) : []).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(managerSearch ? banks.filter((b: any) => b.bankName?.toLowerCase().includes(managerSearch.toLowerCase())) : banks).map((b: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#374151', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>🏦</div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600 }}>{b.bankName}</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.paymentCount} Cheque Deposits</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#f59e0b' }}>${b.totalUncollected.toLocaleString()}</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending Clearance</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                  {managerSearch ? 'No banks match your search.' : 'No pending bank collections.'}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .sidebar { display: none !important; }
          .dashboard-container { margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
          .report-print-area { padding: 0 !important; border: none !important; box-shadow: none !important; }
          .stat-card { border: 1px solid #e5e7eb !important; background: #f9fafb !important; }
          .text-gradient { background: none !important; -webkit-text-fill-color: #111827 !important; color: #111827 !important; }
          .glass-panel { background: white !important; border: 1px solid #e5e7eb !important; box-shadow: none !important; }
          h3, p, div { color: #111827 !important; }
        }
      `}} />
    </div>
  );
}
