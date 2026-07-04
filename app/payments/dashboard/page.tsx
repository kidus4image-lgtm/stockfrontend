'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { showError } from '../../../lib/toast';

interface Payment {
  id: number;
  amount: number;
  paymentMethod: string;
  bank: string | null;
  chequeNumber: string | null;
  slipNumber: string | null;
  status: string;
  dueDate: string | null;
  receivedDate: string | null;
  clearedDate: string | null;
  depositBank: string | null;
  depositDate: string | null;
  bounceReason: string | null;
  bouncedDate: string | null;
  savedBy: string | null;
  createdAt: string;
  invoice: {
    id: number;
    invoiceNumber: string;
    customer: {
      id: number;
      customerName: string;
      tinNumber: string | null;
    };
  };
}

type StatusFilter = 'All' | 'Collected' | 'Uncollected' | 'Deposited' | 'Bounced' | 'Void';
type MethodFilter = 'All' | 'Cash' | 'Cheque';
type SortKey = 'receivedDate' | 'amount' | 'status' | 'customer' | 'method' | 'bank';
type DateRange = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year';

export default function PaymentsDashboardPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [sortKey, setSortKey] = useState<SortKey>('receivedDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/payments');
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (err) {
      console.error('Failed to fetch payments', err);
      showError('Failed to load payments data');
    } finally {
      setLoading(false);
    }
  };

  const dateRangeFilter = (payment: Payment): boolean => {
    if (dateRange === 'all') return true;
    const ref = new Date(payment.receivedDate || payment.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - ref.getTime();
    const days = diffMs / (1000 * 60 * 60 * 24);
    switch (dateRange) {
      case 'today': return days <= 1;
      case 'week': return days <= 7;
      case 'month': return days <= 30;
      case 'quarter': return days <= 90;
      case 'year': return days <= 365;
      default: return true;
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (methodFilter !== 'All' && p.paymentMethod !== methodFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          (p.invoice?.invoiceNumber && p.invoice.invoiceNumber.toLowerCase().includes(q)) ||
          (p.invoice?.customer?.customerName && p.invoice.customer.customerName.toLowerCase().includes(q)) ||
          (p.bank && p.bank.toLowerCase().includes(q)) ||
          (p.chequeNumber && p.chequeNumber.toLowerCase().includes(q)) ||
          (p.slipNumber && p.slipNumber.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (!dateRangeFilter(p)) return false;
      return true;
    });
  }, [payments, statusFilter, methodFilter, searchQuery, dateRange]);

  const sortedPayments = useMemo(() => {
    return [...filteredPayments].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      switch (sortKey) {
        case 'amount':
          aVal = a.amount || 0;
          bVal = b.amount || 0;
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        case 'customer':
          aVal = a.invoice?.customer?.customerName || '';
          bVal = b.invoice?.customer?.customerName || '';
          break;
        case 'method':
          aVal = a.paymentMethod || '';
          bVal = b.paymentMethod || '';
          break;
        case 'bank':
          aVal = a.bank || '';
          bVal = b.bank || '';
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'receivedDate':
        default:
          aVal = a.receivedDate ? new Date(a.receivedDate).getTime() : 0;
          bVal = b.receivedDate ? new Date(b.receivedDate).getTime() : 0;
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredPayments, sortKey, sortDir]);

  const aggregates = useMemo(() => {
    const inRange = filteredPayments;
    const totalAmount = inRange.reduce((s, p) => s + (p.amount || 0), 0);
    const collected = inRange.filter(p => p.status === 'Collected').reduce((s, p) => s + p.amount, 0);
    const uncollected = inRange.filter(p => p.status === 'Uncollected').reduce((s, p) => s + p.amount, 0);
    const deposited = inRange.filter(p => p.status === 'Deposited').reduce((s, p) => s + p.amount, 0);
    const bounced = inRange.filter(p => p.status === 'Bounced').reduce((s, p) => s + p.amount, 0);
    const voided = inRange.filter(p => p.status === 'Void').reduce((s, p) => s + p.amount, 0);
    const cashTotal = inRange.filter(p => p.paymentMethod === 'Cash').reduce((s, p) => s + p.amount, 0);
    const chequeTotal = inRange.filter(p => p.paymentMethod === 'Cheque').reduce((s, p) => s + p.amount, 0);
    const chequeCount = inRange.filter(p => p.paymentMethod === 'Cheque').length;
    const cashCount = inRange.filter(p => p.paymentMethod === 'Cash').length;

    // Bank breakdown
    const bankMap: Record<string, { count: number, total: number, collected: number, pending: number, bounced: number }> = {};
    inRange.forEach(p => {
      const key = p.bank || 'Unspecified';
      if (!bankMap[key]) bankMap[key] = { count: 0, total: 0, collected: 0, pending: 0, bounced: 0 };
      bankMap[key].count += 1;
      bankMap[key].total += p.amount;
      if (p.status === 'Collected' || p.status === 'Deposited') bankMap[key].collected += p.amount;
      else if (p.status === 'Uncollected') bankMap[key].pending += p.amount;
      else if (p.status === 'Bounced') bankMap[key].bounced += p.amount;
    });
    const bankBreakdown = Object.entries(bankMap)
      .map(([bank, data]) => ({ bank, ...data }))
      .sort((a, b) => b.total - a.total);

    // Top paying customers
    const custMap: Record<number, { name: string, count: number, total: number }> = {};
    inRange.forEach(p => {
      const cId = p.invoice?.customer?.id;
      if (!cId) return;
      if (!custMap[cId]) {
        custMap[cId] = { name: p.invoice.customer.customerName, count: 0, total: 0 };
      }
      custMap[cId].count += 1;
      custMap[cId].total += p.amount;
    });
    const topCustomers = Object.values(custMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Pending cheques by maturity
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const pendingChequesMatured = inRange.filter(p =>
      p.paymentMethod === 'Cheque' && p.status === 'Uncollected' &&
      p.dueDate && new Date(p.dueDate) <= now
    );
    const pendingChequesThisWeek = inRange.filter(p =>
      p.paymentMethod === 'Cheque' && p.status === 'Uncollected' &&
      p.dueDate && new Date(p.dueDate) > now && new Date(p.dueDate) <= in7days
    );
    const pendingChequesFuture = inRange.filter(p =>
      p.paymentMethod === 'Cheque' && p.status === 'Uncollected' &&
      p.dueDate && new Date(p.dueDate) > in7days
    );

    return {
      totalAmount,
      collected,
      uncollected,
      deposited,
      bounced,
      voided,
      cashTotal,
      chequeTotal,
      cashCount,
      chequeCount,
      count: inRange.length,
      bankBreakdown,
      topCustomers,
      pendingChequesMatured,
      pendingChequesThisWeek,
      pendingChequesFuture,
      collectionRate: totalAmount > 0 ? (collected / totalAmount) * 100 : 0
    };
  }, [filteredPayments]);

  const totalPages = Math.max(1, Math.ceil(sortedPayments.length / rowsPerPage));
  const paginatedPayments = sortedPayments.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'amount' || key === 'receivedDate' ? 'desc' : 'asc');
    }
  };

  const formatCurrency = (n: number) =>
    `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (d: string | Date | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString();
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span style={{ opacity: 0.3, marginLeft: '0.25rem' }}>⇅</span>;
    return <span style={{ marginLeft: '0.25rem' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Collected': return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
      case 'Deposited': return { background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' };
      case 'Uncollected': return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' };
      case 'Bounced': return { background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' };
      case 'Void': return { background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' };
      default: return { background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' };
    }
  };

  return (
    <div className="dashboard-container">
      <header className="page-header gen-page-header">
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800 }}>
            Payments Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Comprehensive view of collections, pending cheques, bank deposits, and customer payment activity.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn-secondary"
            onClick={() => router.push('/payments')}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
          >
            💵 Post Receipt
          </button>
        </div>
      </header>

      {/* Date Range Filter */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, marginRight: '0.5rem' }}>PERIOD:</span>
          {(['all', 'today', 'week', 'month', 'quarter', 'year'] as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => { setDateRange(r); setCurrentPage(1); }}
              className={dateRange === r ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', width: 'auto', ...(dateRange === r ? { background: '#174f49' } : {}) }}
            >
              {r === 'all' ? 'All Time' : r === 'today' ? 'Today' : r === 'week' ? '7 Days' : r === 'month' ? '30 Days' : r === 'quarter' ? '90 Days' : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading payments...
        </div>
      ) : payments.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No payments recorded yet.
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-title">Total Payments</div>
              <div className="stat-value" style={{ color: '#3b82f6' }}>{aggregates.count}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {formatCurrency(aggregates.totalAmount)} total value
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-title">Collected</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {formatCurrency(aggregates.collected)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {aggregates.collectionRate.toFixed(1)}% collection rate
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="stat-title">Pending (Cheques)</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                {formatCurrency(aggregates.uncollected)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {aggregates.pendingChequesMatured.length} matured • {aggregates.pendingChequesThisWeek.length} due this week
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="stat-title">Bounced</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>
                {formatCurrency(aggregates.bounced)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Requires follow-up action
              </div>
            </div>
          </div>

          {/* Secondary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Cash Receipts
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                {formatCurrency(aggregates.cashTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {aggregates.cashCount} transactions
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Cheque Receipts
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                {formatCurrency(aggregates.chequeTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {aggregates.chequeCount} cheques
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Awaiting Deposit
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#60a5fa' }}>
                {formatCurrency(aggregates.deposited)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Deposited, pending clearance
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Voided Payments
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#9ca3af' }}>
                {formatCurrency(aggregates.voided)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Cancelled / reversed
              </div>
            </div>
          </div>

          {/* Bank Breakdown + Top Customers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--accent-hover)' }}>Bank Collection Breakdown</h3>
              {aggregates.bankBreakdown.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem' }}>No bank data available.</p>
              ) : (
                <>
                  <div className="tbl-mobile">
                    {aggregates.bankBreakdown.map(b => (
                      <div className="gen-mobile-card" key={b.bank}>
                        <div className="gen-mobile-card-header">
                          <span className="gen-mobile-card-title">{b.bank}</span>
                        </div>
                        <div className="gen-mobile-card-body">
                          <div>
                            <div className="gen-mobile-card-label">Count</div>
                            <div className="gen-mobile-card-value">{b.count}</div>
                          </div>
                          <div>
                            <div className="gen-mobile-card-label">Total</div>
                            <div className="gen-mobile-card-value">{formatCurrency(b.total)}</div>
                          </div>
                          <div>
                            <div className="gen-mobile-card-label">Collected</div>
                            <div className="gen-mobile-card-value" style={{ color: 'var(--success)' }}>{formatCurrency(b.collected)}</div>
                          </div>
                          <div>
                            <div className="gen-mobile-card-label">Pending</div>
                            <div className="gen-mobile-card-value" style={{ color: 'var(--warning)' }}>{formatCurrency(b.pending)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="tbl-desktop">
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ padding: '0.6rem 0.5rem' }}>Bank</th>
                            <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Count</th>
                            <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Total</th>
                            <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Collected</th>
                            <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Pending</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregates.bankBreakdown.map(b => (
                            <tr key={b.bank} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{b.bank}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{b.count}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{formatCurrency(b.total)}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(b.collected)}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: 'var(--warning)' }}>{formatCurrency(b.pending)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--accent-hover)' }}>Top Paying Customers</h3>
              {aggregates.topCustomers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem' }}>No customer payments yet.</p>
              ) : (
                <>
                  <div className="tbl-mobile">
                    {aggregates.topCustomers.map((c, idx) => (
                      <div className="gen-mobile-card" key={idx}>
                        <div className="gen-mobile-card-header">
                          <span className="gen-mobile-card-title" style={{ color: 'var(--accent-hover)' }}>{c.name}</span>
                        </div>
                        <div className="gen-mobile-card-body">
                          <div>
                            <div className="gen-mobile-card-label">Payments</div>
                            <div className="gen-mobile-card-value">{c.count}</div>
                          </div>
                          <div>
                            <div className="gen-mobile-card-label">Total Paid</div>
                            <div className="gen-mobile-card-value" style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(c.total)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="tbl-desktop">
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ padding: '0.6rem 0.5rem' }}>Customer</th>
                            <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Payments</th>
                            <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Total Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregates.topCustomers.map((c, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: 'var(--accent-hover)' }}>{c.name}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{c.count}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(c.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Cheque Maturity Tracker */}
          {aggregates.pendingChequesMatured.length + aggregates.pendingChequesThisWeek.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--warning)' }}>⚠️ Pending Cheques Requiring Action</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'rgba(244, 63, 94, 0.08)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Past Due (Matured)</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)', marginTop: '0.25rem' }}>
                    {formatCurrency(aggregates.pendingChequesMatured.reduce((s, p) => s + p.amount, 0))}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {aggregates.pendingChequesMatured.length} cheques overdue
                  </div>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Due This Week</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.25rem' }}>
                    {formatCurrency(aggregates.pendingChequesThisWeek.reduce((s, p) => s + p.amount, 0))}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {aggregates.pendingChequesThisWeek.length} cheques approaching maturity
                  </div>
                </div>
                <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Future Maturity</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa', marginTop: '0.25rem' }}>
                    {formatCurrency(aggregates.pendingChequesFuture.reduce((s, p) => s + p.amount, 0))}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {aggregates.pendingChequesFuture.length} cheques upcoming
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter + Table */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-hover)' }}>
                Payments Ledger ({sortedPayments.length})
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search invoice, customer, bank, cheque..."
                  className="form-control"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ maxWidth: '300px', padding: '0.5rem 0.9rem' }}
                />
                <select
                  className="form-control"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setCurrentPage(1); }}
                  style={{ maxWidth: '150px', padding: '0.5rem 0.9rem' }}
                >
                  <option value="All">All Status</option>
                  <option value="Collected">Collected</option>
                  <option value="Deposited">Deposited</option>
                  <option value="Uncollected">Uncollected</option>
                  <option value="Bounced">Bounced</option>
                  <option value="Void">Void</option>
                </select>
                <select
                  className="form-control"
                  value={methodFilter}
                  onChange={(e) => { setMethodFilter(e.target.value as MethodFilter); setCurrentPage(1); }}
                  style={{ maxWidth: '130px', padding: '0.5rem 0.9rem' }}
                >
                  <option value="All">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div className="tbl-mobile">
              {paginatedPayments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem' }}>No payments match your filters.</p>
              ) : (
                paginatedPayments.map((p) => {
                  const statusStyle = getStatusStyle(p.status);
                  return (
                    <div className="gen-mobile-card" key={p.id}>
                      <div className="gen-mobile-card-header">
                        <span className="gen-mobile-card-title">{p.invoice?.customer?.customerName || '—'}</span>
                        <span style={{
                          ...statusStyle,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 600
                        }}>
                          {p.status}
                        </span>
                      </div>
                      <div className="gen-mobile-card-body">
                        <div>
                          <div className="gen-mobile-card-label">Amount</div>
                          <div className="gen-mobile-card-value" style={{ fontWeight: 700 }}>{formatCurrency(p.amount)}</div>
                        </div>
                        <div>
                          <div className="gen-mobile-card-label">Method</div>
                          <div className="gen-mobile-card-value">{p.paymentMethod}</div>
                        </div>
                        <div>
                          <div className="gen-mobile-card-label">Received</div>
                          <div className="gen-mobile-card-value">{formatDate(p.receivedDate)}</div>
                        </div>
                        <div>
                          <div className="gen-mobile-card-label">Invoice</div>
                          <div className="gen-mobile-card-value">
                            <Link
                              href={`/invoices/${p.invoice?.id}`}
                              style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600 }}
                            >
                              {p.invoice?.invoiceNumber || '—'}
                            </Link>
                          </div>
                        </div>
                        {p.paymentMethod === 'Cheque' && (p.bank || p.chequeNumber || p.slipNumber) && (
                          <>
                            <div>
                              <div className="gen-mobile-card-label">Bank</div>
                              <div className="gen-mobile-card-value">{p.bank || '—'}</div>
                            </div>
                            {(p.chequeNumber || p.slipNumber) && (
                              <div>
                                <div className="gen-mobile-card-label">Ref</div>
                                <div className="gen-mobile-card-value">{p.chequeNumber || p.slipNumber}</div>
                              </div>
                            )}
                          </>
                        )}
                        {p.paymentMethod === 'Cheque' && p.dueDate && (
                          <div>
                            <div className="gen-mobile-card-label">Due Date</div>
                            <div className="gen-mobile-card-value" style={{ color: new Date(p.dueDate) < new Date() && p.status === 'Uncollected' ? 'var(--danger)' : undefined }}>
                              {formatDate(p.dueDate)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="tbl-desktop">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.85rem 0.75rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('receivedDate')}>
                        Received <SortIcon column="receivedDate" />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem' }}>Invoice</th>
                      <th style={{ padding: '0.85rem 0.75rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('customer')}>
                        Customer <SortIcon column="customer" />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('method')}>
                        Method <SortIcon column="method" />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('bank')}>
                        Bank / Reference <SortIcon column="bank" />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('amount')}>
                        Amount <SortIcon column="amount" />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>
                        Status <SortIcon column="status" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No payments match your filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedPayments.map((p) => {
                        const statusStyle = getStatusStyle(p.status);
                        return (
                          <tr key={p.id} className="hover-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                            <td style={{ padding: '0.75rem' }}>{formatDate(p.receivedDate)}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <Link
                                href={`/invoices/${p.invoice?.id}`}
                                style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600 }}
                              >
                                {p.invoice?.invoiceNumber || '—'}
                              </Link>
                            </td>
                            <td style={{ padding: '0.75rem' }}>{p.invoice?.customer?.customerName || '—'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.75rem' }}>
                                {p.paymentMethod}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {p.paymentMethod === 'Cheque' ? (
                                <>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.bank || '—'}</div>
                                  {(p.chequeNumber || p.slipNumber) && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                      Ref: {p.chequeNumber || p.slipNumber}
                                    </div>
                                  )}
                                  {p.dueDate && (
                                    <div style={{ color: new Date(p.dueDate) < new Date() && p.status === 'Uncollected' ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.7rem' }}>
                                      Due: {formatDate(p.dueDate)}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>
                              {formatCurrency(p.amount)}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <span style={{
                                ...statusStyle,
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {sortedPayments.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Showing {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, sortedPayments.length)} of {sortedPayments.length}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn-secondary"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    ← Prev
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 0.5rem' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="btn-secondary"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
