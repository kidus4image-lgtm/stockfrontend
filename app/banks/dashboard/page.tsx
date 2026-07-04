'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { apiFetch } from '../../../lib/api';
import { showSuccess, showError } from '../../../lib/toast';

const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e', '#8b5cf6', '#fbbf24'];
const STATUS_COLORS: Record<string, string> = {
  Collected: '#10b981',
  Uncollected: '#f59e0b',
  Deposited: '#3b82f6',
  Bounced: '#f43f5e',
  Void: '#9ca3af'
};

export default function BanksDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string>('');

  // Filters
  const [timeFilter, setTimeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bankFilter, setBankFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const loadAll = async () => {
    setLoading(true);
    setLoadError('');
    await fetchStats();
    await fetchAllTransactions();
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/banks/dashboard-stats');
      if (res.ok) {
        setStats(await res.json());
      } else {
        const errText = await res.text().catch(() => '');
        setLoadError(`Dashboard stats endpoint returned ${res.status} ${res.statusText}. ${errText}`);
        console.error('Bank dashboard stats non-OK:', res.status, errText);
      }
    } catch (err: any) {
      const msg = err?.message || 'Network error';
      setLoadError(msg);
      console.error('Failed to fetch bank dashboard stats', err);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      const banksRes = await apiFetch('http://localhost:5000/api/banks');
      if (!banksRes.ok) return;

      const banks = await banksRes.json();
      const allTx: any[] = [];

      for (const bank of banks) {
        const res = await apiFetch(`http://localhost:5000/api/banks/${bank.id}`);
        if (res.ok) {
          const data = await res.json();
          (data.transactions || []).forEach((tx: any) => {
            allTx.push({
              ...tx,
              bank: tx.bank || bank.bankName,
              customerName: tx.invoice?.customer?.customerName,
              invoiceNumber: tx.invoiceNumber
            });
          });
        }
      }

      setAllTransactions(allTx);
    } catch (err) {
      console.error('Failed to fetch bank transactions', err);
    }
  };

  const filterByTime = (dateString: string | null | undefined) => {
    if (!dateString) return timeFilter === 'all' || timeFilter === 'custom';
    const d = new Date(dateString);

    if (timeFilter === 'custom') {
      const s = startDate ? new Date(startDate) : null;
      const e = endDate ? new Date(endDate) : null;
      if (s && d < s) return false;
      if (e) {
        const end = new Date(e);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    }

    if (timeFilter === 'all') return true;
    const now = new Date();
    if (timeFilter === 'thisMonth') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (timeFilter === 'thisYear') {
      return d.getFullYear() === now.getFullYear();
    }
    if (timeFilter === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (timeFilter === 'thisWeek') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      return d >= start;
    }
    return true;
  };

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      const dateStr = tx.receivedDate || tx.createdAt;
      const timeMatch = filterByTime(dateStr);
      const bankMatch = bankFilter === 'All' || tx.bank === bankFilter;
      const statusMatch = statusFilter === 'All' || tx.status === statusFilter;
      const methodMatch = methodFilter === 'All' || tx.paymentMethod === methodFilter;
      const search = searchQuery.trim().toLowerCase();
      const searchMatch = !search
        || (tx.invoiceNumber || '').toLowerCase().includes(search)
        || (tx.customerName || '').toLowerCase().includes(search)
        || (tx.chequeNumber || '').toLowerCase().includes(search)
        || (tx.slipNumber || '').toLowerCase().includes(search)
        || (tx.bank || '').toLowerCase().includes(search);
      return timeMatch && bankMatch && statusMatch && methodMatch && searchMatch;
    });
  }, [allTransactions, timeFilter, startDate, endDate, bankFilter, statusFilter, methodFilter, searchQuery]);

  const filteredTotal = useMemo(
    () => filteredTransactions.reduce((s: number, tx: any) => s + (tx.amount || 0), 0),
    [filteredTransactions]
  );

  const paginatedTransactions = useMemo(
    () => filteredTransactions.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [filteredTransactions, currentPage]
  );

  const bankOptions = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach((tx) => tx.bank && set.add(tx.bank));
    return Array.from(set).sort();
  }, [allTransactions]);

  const handleResetFilters = () => {
    setTimeFilter('all');
    setStartDate('');
    setEndDate('');
    setBankFilter('All');
    setStatusFilter('All');
    setMethodFilter('All');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) {
      showError('No transactions to export.');
      return;
    }
    const headers = ['Receipt Date', 'Bank', 'Customer', 'Invoice #', 'Method', 'Reference', 'Amount', 'Status'];
    const rows = filteredTransactions.map((tx) => [
      tx.receivedDate ? new Date(tx.receivedDate).toLocaleDateString() : '',
      tx.bank || '',
      tx.customerName || '',
      tx.invoiceNumber || '',
      tx.paymentMethod || '',
      tx.chequeNumber || tx.slipNumber || '',
      tx.amount || 0,
      tx.status || ''
    ]);
    let csvContent = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' +
      rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `banks_dashboard_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('CSV exported successfully.');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading bank dashboard...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard-container">
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '640px', margin: '4rem auto' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>⚠️ Failed to load bank dashboard</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {loadError || 'The dashboard stats endpoint did not return any data.'}
          </p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
            Make sure the backend server is running and that the <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>GET /api/banks/dashboard-stats</code> endpoint is registered. If you just added this route, restart the backend server.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={loadAll} style={{ padding: '0.6rem 1.5rem' }}>
              ↻ Retry
            </button>
            <button className="btn-secondary" onClick={() => router.push('/banks')} style={{ padding: '0.6rem 1.5rem' }}>
              🏦 Go to Bank Registry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusPieData = (stats.byStatus || []).map((s: any) => ({ name: s.status, value: s.total }));
  const methodPieData = (stats.byPaymentMethod || []).map((m: any) => ({ name: m.method, value: m.total }));
  const topBanksData = (stats.bankStats || []).slice(0, 7).map((b: any) => ({ name: b.bank, value: b.total }));

  return (
    <div className="dashboard-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.4rem', margin: 0, fontWeight: 800 }}>Banks Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Real-time bank deposits, cheque status, and corporate collection performance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={() => router.push('/banks')} style={{ width: 'auto', padding: '0.6rem 1.2rem' }}>
            🏦 Bank Registry
          </button>
          <button className="btn-primary" onClick={() => router.push('/banks/new')} style={{ width: 'auto', padding: '0.6rem 1.2rem', background: '#174f49' }}>
            + Register Bank
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-title">Total Banks</div>
          <div className="stat-value" style={{ color: '#6366f1' }}>{stats.totalBanks}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Corporate accounts registered
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title">Total Deposits</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            ${(stats.totalDeposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {stats.totalTransactions} transactions
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Uncollected Cheques</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            ${(stats.uncollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Awaiting deposit / clearance
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f43f5e' }}>
          <div className="stat-title">Bounced Cheques</div>
          <div className="stat-value" style={{ color: '#f43f5e' }}>
            ${(stats.bounced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Requires follow-up
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-title">Today's Collection</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>
            ${(stats.todayDeposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            This week: ${(stats.thisWeekDeposits || 0).toLocaleString()}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-title">This Month</div>
          <div className="stat-value" style={{ color: '#8b5cf6' }}>
            ${(stats.thisMonthDeposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Collected: ${(stats.collected || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>🔍 Filter Transactions</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={handleResetFilters} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
              ↺ Reset
            </button>
            <button className="btn-primary" onClick={handleExportCsv} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', background: '#174f49' }}>
              📊 Export CSV
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
              Search
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Customer / invoice / cheque / slip"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
              Time Period
            </label>
            <select className="form-control" value={timeFilter} onChange={(e) => { setTimeFilter(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="all" style={{ color: 'black' }}>All Time</option>
              <option value="today" style={{ color: 'black' }}>Today</option>
              <option value="thisWeek" style={{ color: 'black' }}>This Week</option>
              <option value="thisMonth" style={{ color: 'black' }}>This Month</option>
              <option value="thisYear" style={{ color: 'black' }}>This Year</option>
              <option value="custom" style={{ color: 'black' }}>Custom Date Range</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
              Bank
            </label>
            <select className="form-control" value={bankFilter} onChange={(e) => { setBankFilter(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Banks</option>
              {bankOptions.map((b) => (
                <option key={b} value={b} style={{ color: 'black' }}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
              Status
            </label>
            <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Statuses</option>
              <option value="Collected" style={{ color: 'black' }}>Collected</option>
              <option value="Uncollected" style={{ color: 'black' }}>Uncollected</option>
              <option value="Deposited" style={{ color: 'black' }}>Deposited</option>
              <option value="Bounced" style={{ color: 'black' }}>Bounced</option>
              <option value="Void" style={{ color: 'black' }}>Void</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
              Payment Method
            </label>
            <select className="form-control" value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Methods</option>
              <option value="Cash" style={{ color: 'black' }}>Cash</option>
              <option value="Cheque" style={{ color: 'black' }}>Cheque</option>
              <option value="Transfer" style={{ color: 'black' }}>Transfer</option>
            </select>
          </div>
        </div>

        {timeFilter === 'custom' && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>From</label>
              <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>To</label>
              <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} />
            </div>
          </div>
        )}

        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing <strong style={{ color: '#fff' }}>{filteredTransactions.length}</strong> of {allTransactions.length} transactions
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Filtered Total:
            <strong style={{ color: 'var(--success)', marginLeft: '0.5rem' }}>
              ${filteredTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </strong>
          </span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2col" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>📈 Monthly Deposit Trend</h3>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyTrend || []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickMargin={6} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={10} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Transactions" />
                <Bar yAxisId="right" dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Total Deposits ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>🏦 Top Banks by Volume</h3>
          {topBanksData.length > 0 ? (
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBanksData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={10} width={120} />
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No bank activity yet.</p>
          )}
        </div>
      </div>

      <div className="grid-2col" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>💳 Payment Method Distribution</h3>
          {methodPieData.length > 0 ? (
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={methodPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                    {methodPieData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={30} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No payment method data.</p>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>📊 Payment Status Distribution</h3>
          {statusPieData.length > 0 ? (
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                    {statusPieData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={STATUS_COLORS[entry.name] || PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={30} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No status data.</p>
          )}
        </div>
      </div>

      {/* Filtered Transactions Table */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>📋 Filtered Transactions</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '0.75rem' }}>Receipt Date</th>
                <th style={{ padding: '0.75rem' }}>Bank</th>
                <th style={{ padding: '0.75rem' }}>Customer</th>
                <th style={{ padding: '0.75rem' }}>Invoice</th>
                <th style={{ padding: '0.75rem' }}>Method & Ref</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((tx: any) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                    <td style={{ padding: '0.75rem' }}>
                      {tx.receivedDate ? new Date(tx.receivedDate).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--accent-hover)', fontWeight: 600 }}>{tx.bank || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{tx.customerName || '-'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{tx.invoiceNumber || '-'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{tx.paymentMethod}</strong>
                      {tx.chequeNumber ? ` | Chq: ${tx.chequeNumber}` : ''}
                      {tx.slipNumber ? ` | Slip: ${tx.slipNumber}` : ''}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: tx.status === 'Bounced' ? 'var(--danger)' : 'var(--success)' }}>
                      ${(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        background: STATUS_COLORS[tx.status] ? `${STATUS_COLORS[tx.status]}26` : 'rgba(255,255,255,0.1)',
                        color: STATUS_COLORS[tx.status] || '#fff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600
                      }}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No transactions match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {(() => {
          const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / rowsPerPage));
          return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                Prev
              </button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button className="btn-secondary" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                Next
              </button>
            </div>
          );
        })()}
      </div>

      {/* Bank Performance Table + Pending Cheques */}
      <div className="grid-split" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>🏆 Bank Performance</h3>
          {stats.bankStats && stats.bankStats.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {stats.bankStats.map((b: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-hover)' }}>{b.bank}</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {b.count} txns • Bounced: ${b.bounced.toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>${b.total.toLocaleString()}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                      Collected: ${b.collected.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No bank data available.</p>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: '#f59e0b' }}>⏳ Pending Cheques (Upcoming Maturity)</h3>
          {stats.pendingCheques && stats.pendingCheques.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {stats.pendingCheques.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>📝 Chq: {c.chequeNumber || '-'}</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {c.customerName || '-'} • Bank: {c.bank || '-'}
                    </p>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Due: {c.dueDate ? new Date(c.dueDate).toLocaleDateString() : 'N/A'} • Status: {c.status}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--warning)' }}>
                      ${(c.amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No pending cheques. 🎉</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <span className="quick-actions-label">⚡ Quick Actions:</span>
        <button className="btn-primary" onClick={() => router.push('/banks/new')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto', background: '#174f49' }}>
          🏦 Register Bank
        </button>
        <button className="btn-secondary" onClick={() => router.push('/banks')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
          📁 Bank Registry
        </button>
        <button className="btn-secondary" onClick={() => router.push('/payments')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
          💵 Post Receipt
        </button>
        <button className="btn-secondary" onClick={() => router.push('/reports')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
          📊 Bank Reports
        </button>
      </div>
    </div>
  );
}
