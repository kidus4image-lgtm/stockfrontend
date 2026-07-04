'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { apiFetch } from '../../lib/api';
import { showSuccess, showError } from '../../lib/toast';

interface SellerDashboardData {
  kpis: {
    totalCustomers: number;
    totalOrdersThisMonth: number;
    totalSalesThisMonth: number;
    collectedThisMonth: number;
    outstandingTotal: number;
    overdueAmount: number;
    avgDaysToCollect: number;
  };
  pipeline: {
    pendingOrders: number;
    awaitingConfirmation: number;
    completedThisMonth: number;
  };
  monthlyTrend: Array<{
    month: string;
    sales: number;
    collected: number;
    outstanding: number;
    orderCount: number;
  }>;
  recentOrders: Array<{
    id: number;
    orderNumber: string;
    customerName: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  topCustomers: Array<{
    id: number;
    name: string;
    totalSales: number;
    outstanding: number;
    lastInvoiceDate: string | null;
  }>;
  paymentBreakdown: {
    cash: number;
    cheque: number;
    collected: number;
    uncollected: number;
    bounced: number;
  };
  followUps: Array<{
    customerId: number;
    customerName: string;
    amountDue: number;
    daysOverdue: number;
    lastPaymentDate: string | null;
  }>;
  collectionEfficiency: number;
}

const PIE_COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#6366f1', '#3b82f6'];

const STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Manager_Approved: '#3b82f6',
  Finance_Approved: '#6366f1',
  Store_Confirmed: '#8b5cf6',
  Completed: '#10b981',
  Rejected: '#f43f5e',
};

export default function SellerDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminderModal, setReminderModal] = useState<{ customerId: number; customerName: string } | null>(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/dashboard/seller');
      if (res.ok) {
        setData(await res.json());
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to load dashboard');
      }
    } catch (err) {
      console.error('Seller dashboard fetch error:', err);
      showError('Network error loading dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/customers');
      if (res.ok) setCustomers(await res.json());
    } catch { /* ignore */ }
  }, []);



  const fetchActivity = useCallback(async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/dashboard/seller/activity');
      if (res.ok) {
        const data = await res.json();
        setActivityFeed(data.activities || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      router.push('/login');
      return;
    }
    try {
      setCurrentUser(JSON.parse(storedUser));
    } catch {
      router.push('/login');
      return;
    }
    fetchData();
    fetchActivity();
    fetchCustomers();
  }, [router, fetchData, fetchActivity, fetchCustomers]);

  const handleSendReminder = async () => {
    if (!reminderModal || !reminderMessage.trim()) return;
    try {
      const res = await apiFetch('http://localhost:5000/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: reminderModal.customerId,
          message: reminderMessage.trim()
        })
      });
      if (res.ok) {
        showSuccess('Reminder sent successfully');
        setReminderModal(null);
        setReminderMessage('');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to send reminder');
      }
    } catch {
      showError('Network error sending reminder');
    }
  };



  const formatCurrency = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: 2 });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div style={{ marginRight: '1rem' }}>⌛</div>
        Loading Seller Dashboard...
      </div>
    );
  }

  if (!data || !currentUser) return null;

  const d = data;

  return (
    <div className="dashboard-container">
      <header className="page-header">
        <div>
          <h1 className="text-gradient">Seller Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Welcome back, {currentUser.username}! Track your sales, orders, and collections.
          </p>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#6ee7b7', background: 'rgba(16,185,129,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', flexShrink: 0 }}>
          Role: <strong>Sales User</strong>
        </div>
      </header>

      {/* Quick Operations */}
      <div className="glass-panel quick-actions">
        <span className="quick-actions-label">Quick Operations:</span>
        <button className="btn-primary" onClick={() => router.push('/orders/new')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>Create Order</button>
        <button className="btn-secondary" onClick={() => router.push('/customers')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>Customers</button>
        <button className="btn-secondary" onClick={() => router.push('/orders')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>My Orders</button>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title">Total Customers</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{d.kpis.totalCustomers}</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-title">Orders This Month</div>
          <div className="stat-value" style={{ color: '#6366f1' }}>{d.kpis.totalOrdersThisMonth}</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-title">Sales This Month</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>${formatCurrency(d.kpis.totalSalesThisMonth)}</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Outstanding</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>${formatCurrency(d.kpis.outstandingTotal)}</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title">Collected This Month</div>
          <div className="stat-value" style={{ color: '#10b981' }}>${formatCurrency(d.kpis.collectedThisMonth)}</div>
        </div>
      </div>

      {/* Pipeline Status */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Pending Orders</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{d.pipeline.pendingOrders}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Awaiting Confirmation</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#6366f1' }}>{d.pipeline.awaitingConfirmation}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Completed This Month</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>{d.pipeline.completedThisMonth}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-split" style={{ marginBottom: '2rem' }}>
        {/* Monthly Trend */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--accent-hover)' }}>Monthly Sales vs Collected</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <RechartsTooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f8fafc' }}
              />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Breakdown */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--accent-hover)' }}>Payment Method Split</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Cash', value: d.paymentBreakdown.cash || 1 },
                  { name: 'Cheque', value: d.paymentBreakdown.cheque || 1 },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              >
                {[0, 1].map((i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers + Recent Orders */}
      <div className="grid-split" style={{ marginBottom: '2rem' }}>
        {/* Top Customers */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--accent-hover)' }}>Top Customers by Sales</h3>
          {d.topCustomers.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={d.topCustomers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} />
                  <RechartsTooltip />
                  <Bar dataKey="totalSales" name="Total Sales" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="table-responsive" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Sales</th>
                      <th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.topCustomers.map((c) => (
                      <tr key={c.id} className="hover-row" onClick={() => router.push(`/customers/${c.id}`)}>
                        <td style={{ color: 'var(--accent-hover)' }}>{c.name}</td>
                        <td>${formatCurrency(c.totalSales)}</td>
                        <td style={{ color: c.outstanding > 0 ? '#f59e0b' : '#10b981' }}>
                          ${formatCurrency(c.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No customer data yet</p>
          )}
        </div>

        {/* Recent Orders */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--accent-hover)' }}>Recent Orders</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
            {d.recentOrders.length > 0 ? d.recentOrders.map((o) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div>
                  <Link href={`/orders/${o.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
                    {o.orderNumber}
                  </Link>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{o.customerName}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>${formatCurrency(o.amount)}</div>
                  <div style={{ fontSize: '0.7rem', color: STATUS_COLORS[o.status] || 'var(--text-muted)', fontWeight: 600 }}>
                    {o.status.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
            )) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No orders yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--accent-hover)' }}>Recent Activity</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
          {activityFeed.length > 0 ? activityFeed.slice(0, 20).map((a: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px',
              borderLeft: `3px solid ${
                a.type === 'order' ? '#3b82f6' : a.type === 'payment' ? '#10b981' : '#f59e0b'
              }`
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  {a.type === 'order' ? '📦' : a.type === 'payment' ? '💵' : '🧾'} {a.description}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {a.customerName} · {new Date(a.timestamp).toLocaleDateString()} {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {a.amount !== undefined && (
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                  ${a.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          )) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>No recent activity</p>
          )}
        </div>
      </div>

      {/* Follow-ups / Overdue */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: '#f43f5e' }}>Follow-ups Needed</h3>
        {d.followUps.length > 0 ? (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount Due</th>
                  <th>Days Overdue</th>
                  <th>Last Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {d.followUps.map((f) => (
                  <tr key={f.customerId} className="hover-row">
                    <td style={{ color: 'var(--accent-hover)' }}>{f.customerName}</td>
                    <td style={{ color: '#f43f5e', fontWeight: 600 }}>${formatCurrency(f.amountDue)}</td>
                    <td>
                      <span style={{
                        background: f.daysOverdue > 30 ? 'rgba(244,63,94,0.15)' : f.daysOverdue > 7 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                        color: f.daysOverdue > 30 ? '#f43f5e' : f.daysOverdue > 7 ? '#f59e0b' : '#10b981',
                        padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600
                      }}>
                        {f.daysOverdue}d
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {f.lastPaymentDate ? new Date(f.lastPaymentDate).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', width: 'auto' }}
                        onClick={() => setReminderModal({ customerId: f.customerId, customerName: f.customerName })}
                      >
                        Send Reminder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No overdue accounts — great job!</p>
        )}
      </div>

      {/* Reminder Modal */}
      {reminderModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 100000, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{ maxWidth: '480px', width: '90%', padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Send Reminder to {reminderModal.customerName}</h3>
            <div className="form-field" style={{ marginBottom: '1.5rem' }}>
              <label>Message</label>
              <textarea
                className="form-control"
                style={{ minHeight: '120px', resize: 'vertical' }}
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder="Enter reminder message..."
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-primary" onClick={handleSendReminder} disabled={!reminderMessage.trim()}>
                Send
              </button>
              <button className="btn-secondary" onClick={() => { setReminderModal(null); setReminderMessage(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
