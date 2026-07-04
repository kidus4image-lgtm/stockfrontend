'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { apiFetch } from '../../lib/api';
import { showSuccess, showError } from '../../lib/toast';

interface CashierDashboardData {
  summary: {
    pendingOrdersCount: number;
    pendingOrdersValue: number;
    todayConfirmedCount: number;
    todayConfirmedValue: number;
    todayCash: number;
    todayCheque: number;
    todayTotalPayments: number;
    monthCash: number;
    monthCheque: number;
    monthTotalPayments: number;
    chequesPendingDepositCount: number;
    chequesPendingDepositValue: number;
    overdueCount: number;
    totalOverdueAmount: number;
    criticalOverdueCount: number;
    criticalOverdueAmount: number;
  };
  pendingOrders: Array<{
    id: number;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    salesType: string;
    createdAt: string;
    itemCount: number;
  }>;
  todayConfirmedOrders: Array<{
    id: number;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    confirmedAt: string;
  }>;
  recentPayments: Array<{
    id: number;
    amount: number;
    paymentMethod: string;
    status: string;
    bank: string | null;
    chequeNumber: string | null;
    customerName: string;
    invoiceNumber: string;
    receivedDate: string | null;
  }>;
  chequesPendingDeposit: Array<{
    id: number;
    amount: number;
    chequeNumber: string | null;
    bank: string | null;
    dueDate: string | null;
    customerName: string;
    invoiceNumber: string;
  }>;
  overdueInvoices: Array<{
    id: number;
    invoiceNumber: string;
    customerName: string;
    customerId: number;
    amount: number;
    remainingPayment: number;
    paymentDate: string | null;
    invoiceDate: string | null;
    daysOverdue: number;
    salesType: string | null;
  }>;
  monthlyConfirmTrend: Array<{
    month: string;
    confirmations: number;
    ordersValue: number;
    cashCollected: number;
    chequeCollected: number;
  }>;
}

const PIE_COLORS = ['#10b981', '#f59e0b', '#6366f1', '#ef4444'];

export default function CashierDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [data, setData] = useState<CashierDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingOrder, setConfirmingOrder] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/dashboard/cashier');
      if (res.ok) {
        setData(await res.json());
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to load dashboard');
      }
    } catch (err) {
      console.error('Cashier dashboard fetch error:', err);
      showError('Network error loading dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      router.push('/login');
      return;
    }
    try {
      const parsed = JSON.parse(storedUser);
      setCurrentUser(parsed);
    } catch (err) {
      console.error('Failed to parse current user session', err);
    }
    fetchData();
  }, [router, fetchData]);

  const handleConfirmOrder = async (orderId: number) => {
    setConfirmingOrder(orderId);
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}/confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        showSuccess('Order confirmed successfully. Invoice created and stock deducted.');
        fetchData();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to confirm order');
      }
    } catch (err) {
      console.error('Confirm order error:', err);
      showError('Network error confirming order');
    } finally {
      setConfirmingOrder(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading cashier dashboard...
      </div>
    );
  }

  if (!currentUser || !data) return null;

  const { summary } = data;
  summary.overdueCount = summary.overdueCount ?? 0;
  summary.totalOverdueAmount = summary.totalOverdueAmount ?? 0;
  summary.criticalOverdueCount = summary.criticalOverdueCount ?? 0;
  summary.criticalOverdueAmount = summary.criticalOverdueAmount ?? 0;
  data.overdueInvoices = data.overdueInvoices ?? [];

  const cashChequePieData = [
    { name: 'Cash', value: summary.todayCash },
    { name: 'Cheque', value: summary.todayCheque },
  ].filter(d => d.value > 0);

  const monthPieData = [
    { name: 'Cash', value: summary.monthCash },
    { name: 'Cheque', value: summary.monthCheque },
  ].filter(d => d.value > 0);

  return (
    <div className="dashboard-container">
      <header className="page-header">
        <div>
          <h1 className="text-gradient">Cashier Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Order confirmations, payment posting, and daily collections overview.</p>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#22d3ee', background: 'rgba(34,211,238,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(34,211,238,0.2)', flexShrink: 0 }}>
          Role: <strong>Cashier</strong> &mdash; {currentUser.username}
        </div>
      </header>

      {/* Quick Actions */}
      <div className="glass-panel quick-actions">
        <span className="quick-actions-label">⚡ Quick Actions:</span>
        <button className="btn-primary" onClick={() => router.push('/orders')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>🛒 View Pending Orders</button>
        <button className="btn-secondary" onClick={() => router.push('/payments')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>💵 Post Payment</button>
        <button className="btn-secondary" onClick={() => router.push('/invoices')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📄 Invoice Ledger</button>
        <button className="btn-secondary" onClick={() => router.push('/customers')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>👥 Customers</button>
        <button className="btn-secondary" onClick={() => router.push('/reports?type=outstanding_invoice')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📑 Outstanding Invoices</button>
        <button className="btn-secondary" onClick={() => router.push('/reports?type=payment_register')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>📊 Payment Register</button>
        <button className="btn-secondary" onClick={() => router.push('/reports?type=bank_collection')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>🏦 Bank Collection</button>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Pending Confirmations</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{summary.pendingOrdersCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ${summary.pendingOrdersValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} total value
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title">Today&apos;s Confirmations</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{summary.todayConfirmedCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ${summary.todayConfirmedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} confirmed
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-title">Today&apos;s Collections</div>
          <div className="stat-value" style={{ color: '#6366f1' }}>
            ${summary.todayTotalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Cash: ${summary.todayCash.toLocaleString(undefined, { minimumFractionDigits: 2 })} | Cheque: ${summary.todayCheque.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-title">Cheques Pending Deposit</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>{summary.chequesPendingDepositCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ${summary.chequesPendingDepositValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} uncollected
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f43f5e' }}>
          <div className="stat-title">Overdue Invoices</div>
          <div className="stat-value" style={{ color: '#f43f5e' }}>{summary.overdueCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ${summary.totalOverdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} outstanding
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="stat-title">Critical Overdue (&gt;30d)</div>
          <div className="stat-value" style={{ color: '#dc2626' }}>{summary.criticalOverdueCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ${summary.criticalOverdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} at risk
          </div>
        </div>
      </div>

      {/* Pending Orders Queue */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--accent-hover)' }}>🛒 Orders Awaiting Cashier Confirmation ({data.pendingOrders.length})</h3>
          <Link href="/orders" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9rem' }}>View All →</Link>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          These orders have been confirmed by the store and are ready for cashier processing. Confirming deducts stock and creates an invoice.
        </p>
        {data.pendingOrders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
            No orders pending confirmation. All caught up!
          </p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem' }}>Order Number</th>
                  <th style={{ padding: '0.75rem' }}>Customer</th>
                  <th style={{ padding: '0.75rem' }}>Type</th>
                  <th style={{ padding: '0.75rem' }}>Items</th>
                  <th style={{ padding: '0.75rem' }}>Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingOrders.map((order) => (
                  <tr key={order.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <Link href={`/orders/${order.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600 }}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{order.customerName}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: order.salesType === 'Cash' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color: order.salesType === 'Cash' ? '#10b981' : '#6366f1'
                      }}>
                        {order.salesType}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{order.itemCount} items</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>
                      ${order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                        <button
                          className="btn-primary"
                          onClick={() => handleConfirmOrder(order.id)}
                          disabled={confirmingOrder === order.id}
                          style={{
                            padding: '0.35rem 0.8rem',
                            fontSize: '0.8rem',
                            background: confirmingOrder === order.id ? '#666' : 'var(--success)',
                            opacity: confirmingOrder === order.id ? 0.7 : 1
                          }}
                        >
                          {confirmingOrder === order.id ? 'Confirming...' : '✓ Confirm'}
                        </button>
                        <Link href={`/orders/${order.id}`} className="btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid-2col" style={{ marginBottom: '3rem' }}>
        {/* Today's Collections Pie */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Today&apos;s Collection Breakdown</h3>
          {cashChequePieData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No collections today yet.</p>
          ) : (
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={cashChequePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {cashChequePieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: any) => `$${Number(val).toLocaleString()}`} contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Monthly Collections Pie */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>This Month&apos;s Collections</h3>
          {monthPieData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No collections this month yet.</p>
          ) : (
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={monthPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {monthPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: any) => `$${Number(val).toLocaleString()}`} contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Trend Bar Chart */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>📈 7-Month Confirmation & Collection Trend</h3>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlyConfirmTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} />
              <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(val: any) => `$${Number(val).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="cashCollected" fill="#10b981" radius={[4, 4, 0, 0]} name="Cash Collected" />
              <Bar dataKey="chequeCollected" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Cheque Collected" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-column: Today's Confirmed + Recent Payments */}
      <div className="grid-2col" style={{ marginBottom: '3rem' }}>
        {/* Today's Confirmed Orders */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: '#10b981' }}>✓ Today&apos;s Confirmed Orders ({data.todayConfirmedOrders.length})</h3>
          {data.todayConfirmedOrders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No orders confirmed today yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
              {data.todayConfirmedOrders.map((order) => (
                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(16,185,129,0.05)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.1)' }}>
                  <div>
                    <Link href={`/orders/${order.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
                      {order.orderNumber}
                    </Link>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.customerName}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontWeight: 700, color: '#10b981' }}>${order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(order.confirmedAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: '#6366f1' }}>💵 Recent Payments</h3>
          {data.recentPayments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No recent payments.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
              {data.recentPayments.map((pmt) => (
                <div key={pmt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{pmt.customerName}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {pmt.paymentMethod} {pmt.chequeNumber ? `(${pmt.chequeNumber})` : ''} — {pmt.invoiceNumber}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontWeight: 700, color: pmt.paymentMethod === 'Cash' ? '#10b981' : '#f59e0b' }}>
                      ${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {pmt.receivedDate ? new Date(pmt.receivedDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cheques Pending Deposit */}
      {data.chequesPendingDeposit.length > 0 && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: '#f59e0b' }}>
            🏦 Cheques Pending Deposit ({data.chequesPendingDeposit.length})
          </h3>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem' }}>Customer</th>
                  <th style={{ padding: '0.75rem' }}>Invoice</th>
                  <th style={{ padding: '0.75rem' }}>Cheque #</th>
                  <th style={{ padding: '0.75rem' }}>Bank</th>
                  <th style={{ padding: '0.75rem' }}>Due Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.chequesPendingDeposit.map((chq) => (
                  <tr key={chq.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{chq.customerName}</td>
                    <td style={{ padding: '0.75rem' }}>{chq.invoiceNumber}</td>
                    <td style={{ padding: '0.75rem' }}>{chq.chequeNumber || 'N/A'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{chq.bank || 'N/A'}</td>
                    <td style={{ padding: '0.75rem', color: '#f59e0b' }}>{chq.dueDate ? new Date(chq.dueDate).toLocaleDateString() : 'N/A'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      ${chq.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overdue Invoices */}
      {data.overdueInvoices.length > 0 && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#f43f5e' }}>
              ⚠️ Overdue Invoices ({data.overdueInvoices.length}) — ${summary.totalOverdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
            <Link href="/reports?type=outstanding_invoice" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9rem' }}>View Full Report →</Link>
          </div>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem' }}>Customer</th>
                  <th style={{ padding: '0.75rem' }}>Invoice</th>
                  <th style={{ padding: '0.75rem' }}>Type</th>
                  <th style={{ padding: '0.75rem' }}>Due Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Days Overdue</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.overdueInvoices.map((inv) => (
                  <tr key={inv.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{inv.customerName}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <Link href={`/invoices/${inv.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600 }}>
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: inv.salesType === 'Cash' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color: inv.salesType === 'Cash' ? '#10b981' : '#6366f1'
                      }}>
                        {inv.salesType || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      {inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: inv.daysOverdue > 30 ? 'rgba(220,38,38,0.15)' : 'rgba(244,63,94,0.1)',
                        color: inv.daysOverdue > 30 ? '#dc2626' : '#f43f5e'
                      }}>
                        {inv.daysOverdue}d
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                      ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#f43f5e' }}>
                      ${inv.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Summary Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title">Month Cash Collected</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            ${summary.monthCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Month Cheque Collected</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            ${summary.monthCheque.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-title">Month Total Payments</div>
          <div className="stat-value" style={{ color: '#6366f1' }}>
            ${summary.monthTotalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}
