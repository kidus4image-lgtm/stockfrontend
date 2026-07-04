'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Line, AreaChart, Area
} from 'recharts';
import { apiFetch } from '../../../lib/api';
import { showError, showSuccess } from '../../../lib/toast';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#f43f5e', '#8b5cf6', '#fbbf24'];
const AGING_COLORS: Record<string, string> = {
  current: '#10b981',
  days1to30: '#fbbf24',
  days31to60: '#f59e0b',
  days61to90: '#f97316',
  over90: '#f43f5e'
};
const AGING_LABELS: Record<string, string> = {
  current: 'Not Yet Due',
  days1to30: '1-30 Days',
  days31to60: '31-60 Days',
  days61to90: '61-90 Days',
  over90: 'Over 90 Days'
};

export default function InvoicesDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string>('');

  // Filters
  const [timeFilter, setTimeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [salesRepFilter, setSalesRepFilter] = useState('All');
  const [salesTypeFilter, setSalesTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const fetchAllInvoices = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/invoices');
      if (res.ok) {
        const data = await res.json();
        setAllInvoices(data);
      } else {
        const errText = await res.text().catch(() => '');
        setLoadError(`Invoices endpoint returned ${res.status} ${res.statusText}. ${errText}`);
        console.error('Invoices fetch non-OK:', res.status, errText);
      }
    } catch (err: any) {
      const msg = err?.message || 'Network error';
      setLoadError(msg);
      console.error('Failed to fetch invoices', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setLoadError('');
    await fetchAllInvoices();
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filterByTime = (dateString: string | null | undefined) => {
    if (!dateString) return timeFilter === 'all';
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

  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      const dateStr = inv.invoiceDate || inv.createdAt;
      const timeMatch = filterByTime(dateStr);
      const customerMatch = customerFilter === 'All' || inv.customer?.id === Number(customerFilter);
      const repMatch = salesRepFilter === 'All' || inv.salesRep?.id === Number(salesRepFilter);
      const typeMatch = salesTypeFilter === 'All' || inv.salesType === salesTypeFilter;
      const statusName = inv.computedStatus || inv.status;
      const statusMatch = statusFilter === 'All' || statusName === statusFilter;
      const min = amountMin ? parseFloat(amountMin) : -Infinity;
      const max = amountMax ? parseFloat(amountMax) : Infinity;
      const amountMatch = (inv.amount || 0) >= min && (inv.amount || 0) <= max;
      const search = searchQuery.trim().toLowerCase();
      const searchMatch = !search
        || (inv.invoiceNumber || '').toLowerCase().includes(search)
        || (inv.customer?.customerName || '').toLowerCase().includes(search)
        || (inv.fsNumber || '').toLowerCase().includes(search)
        || (inv.crv || '').toLowerCase().includes(search);
      return timeMatch && customerMatch && repMatch && typeMatch && statusMatch && amountMatch && searchMatch;
    });
  }, [allInvoices, timeFilter, startDate, endDate, customerFilter, salesRepFilter, salesTypeFilter, statusFilter, searchQuery, amountMin, amountMax]);

  const filteredTotal = useMemo(
    () => filteredInvoices.reduce((s, inv) => s + (inv.amount || 0), 0),
    [filteredInvoices]
  );
  const filteredOutstanding = useMemo(
    () => filteredInvoices.reduce((s, inv) => s + (inv.remainingPayment || 0), 0),
    [filteredInvoices]
  );

  const paginatedInvoices = useMemo(
    () => filteredInvoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [filteredInvoices, currentPage]
  );

  const customerOptions = useMemo(() => {
    const map = new Map<number, string>();
    allInvoices.forEach(inv => {
      if (inv.customer) map.set(inv.customer.id, inv.customer.customerName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allInvoices]);

  const salesRepOptions = useMemo(() => {
    const map = new Map<number, string>();
    allInvoices.forEach(inv => {
      if (inv.salesRep) map.set(inv.salesRep.id, `${inv.salesRep.firstName} ${inv.salesRep.lastName}`);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allInvoices]);

  // Dashboard KPIs computed from filtered invoices
  const kpis = useMemo(() => {
    const totalInvoiced = filteredInvoices.reduce((s, i) => s + (i.amount || 0), 0);
    const totalCollected = filteredInvoices.reduce((s, i) => s + (i.totalPayed || 0), 0);
    const totalOutstanding = filteredInvoices.reduce((s, i) => s + (i.remainingPayment || 0), 0);
    const totalUncollected = filteredInvoices.reduce((s, i) => s + (i.uncollectedPayment || 0), 0);
    let overdueAmount = 0, criticalAmount = 0, dueTodayAmount = 0, dueThisWeekAmount = 0;
    let thisMonthInvoiced = 0, thisMonthCollected = 0;
    let todayCount = 0;
    const now = new Date();
    const todayStr = now.toDateString();
    filteredInvoices.forEach(inv => {
      const status = inv.computedStatus || inv.status;
      const remaining = inv.remainingPayment || 0;
      const amount = inv.amount || 0;
      const payed = inv.totalPayed || 0;
      if (status === 'Overdue') overdueAmount += remaining;
      if (status === 'Critical') criticalAmount += remaining;
      if (status === 'Today') dueTodayAmount += remaining;
      if (status === 'This Week') dueThisWeekAmount += remaining;
      if (inv.invoiceDate) {
        const d = new Date(inv.invoiceDate);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          thisMonthInvoiced += amount;
          thisMonthCollected += payed;
        }
        if (d.toDateString() === todayStr) todayCount++;
      }
    });
    return { totalInvoices: filteredInvoices.length, todayCount, totalInvoiced, totalCollected, totalOutstanding, totalUncollected, overdueAmount, criticalAmount, dueTodayAmount, dueThisWeekAmount, thisMonthInvoiced, thisMonthCollected };
  }, [filteredInvoices]);

  const filteredAging = useMemo(() => {
    const now = new Date();
    const buckets: Record<string, { total: number; count: number }> = { current: { total: 0, count: 0 }, days1to30: { total: 0, count: 0 }, days31to60: { total: 0, count: 0 }, days61to90: { total: 0, count: 0 }, over90: { total: 0, count: 0 } };
    filteredInvoices.forEach(inv => {
      const remaining = inv.remainingPayment || 0;
      if (remaining <= 0) return;
      const dueDate = inv.paymentDate ? new Date(inv.paymentDate) : null;
      if (!dueDate) { buckets.current.total += remaining; buckets.current.count += 1; return; }
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) { buckets.current.total += remaining; buckets.current.count += 1; }
      else if (diffDays <= 30) { buckets.days1to30.total += remaining; buckets.days1to30.count += 1; }
      else if (diffDays <= 60) { buckets.days31to60.total += remaining; buckets.days31to60.count += 1; }
      else if (diffDays <= 90) { buckets.days61to90.total += remaining; buckets.days61to90.count += 1; }
      else { buckets.over90.total += remaining; buckets.over90.count += 1; }
    });
    return buckets;
  }, [filteredInvoices]);

  const filteredStatusData = useMemo(() => {
    const map = new Map<string, number>();
    filteredInvoices.forEach(inv => {
      const status = inv.computedStatus || inv.status;
      map.set(status, (map.get(status) || 0) + (inv.amount || 0));
    });
    return Array.from(map.entries()).map(([status, total]) => ({ name: status, value: total }));
  }, [filteredInvoices]);

  const filteredSalesTypeData = useMemo(() => {
    const map = new Map<string, number>();
    filteredInvoices.forEach(inv => {
      const type = inv.salesType || 'Credit';
      map.set(type, (map.get(type) || 0) + (inv.amount || 0));
    });
    return Array.from(map.entries()).map(([type, total]) => ({ name: type, value: total }));
  }, [filteredInvoices]);

  const filteredMonthlyTrend = useMemo(() => {
    const dataMap = new Map<string, { total: number; collected: number; count: number; label: string }>();
    const sortKeys: string[] = [];
    filteredInvoices.forEach(inv => {
      const d = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
      if (!d) return;
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!dataMap.has(sortKey)) sortKeys.push(sortKey);
      const entry = dataMap.get(sortKey) || { total: 0, collected: 0, count: 0, label: d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear() };
      entry.total += inv.amount || 0;
      entry.collected += inv.totalPayed || 0;
      entry.count += 1;
      dataMap.set(sortKey, entry);
    });
    return sortKeys.sort().map(key => ({ month: dataMap.get(key)!.label, total: dataMap.get(key)!.total, collected: dataMap.get(key)!.collected, count: dataMap.get(key)!.count }));
  }, [filteredInvoices]);

  const filteredTopCustomers = useMemo(() => {
    const map = new Map<string, { name: string; outstanding: number }>();
    filteredInvoices.forEach(inv => {
      if (!inv.customer || !(inv.remainingPayment || 0)) return;
      const name = inv.customer.customerName;
      const entry = map.get(name) || { name, outstanding: 0 };
      entry.outstanding += inv.remainingPayment || 0;
      map.set(name, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding).slice(0, 7);
  }, [filteredInvoices]);

  const filteredTopReps = useMemo(() => {
    const map = new Map<string, { name: string; total: number; outstanding: number; collected: number; count: number }>();
    filteredInvoices.forEach(inv => {
      if (!inv.salesRep) return;
      const name = `${inv.salesRep.firstName} ${inv.salesRep.lastName}`;
      const entry = map.get(name) || { name, total: 0, outstanding: 0, collected: 0, count: 0 };
      entry.total += inv.amount || 0;
      entry.outstanding += inv.remainingPayment || 0;
      entry.collected += inv.totalPayed || 0;
      entry.count += 1;
      map.set(name, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 7);
  }, [filteredInvoices]);

  const recentFilteredInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      const da = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
      const db = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
      return db - da;
    }).slice(0, 10);
  }, [filteredInvoices]);

  const handleResetFilters = () => {
    setTimeFilter('all');
    setStartDate('');
    setEndDate('');
    setCustomerFilter('All');
    setSalesRepFilter('All');
    setSalesTypeFilter('All');
    setStatusFilter('All');
    setSearchQuery('');
    setAmountMin('');
    setAmountMax('');
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    if (filteredInvoices.length === 0) {
      showError('No invoices to export.');
      return;
    }
    const headers = ['Invoice #', 'Customer', 'Sales Rep', 'Sales Type', 'Invoice Date', 'Due Date', 'Amount', 'Paid', 'Outstanding', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber || '',
      inv.customer?.customerName || '',
      inv.salesRep ? `${inv.salesRep.firstName} ${inv.salesRep.lastName}` : '',
      inv.salesType || '',
      inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '',
      inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : '',
      inv.amount || 0,
      inv.totalPayed || 0,
      inv.remainingPayment || 0,
      inv.computedStatus || inv.status || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' +
      rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `invoices_dashboard_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('CSV exported successfully.');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading invoices dashboard...
      </div>
    );
  }

  if (loadError && allInvoices.length === 0) {
    return (
      <div className="dashboard-container">
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '640px', margin: '4rem auto' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>⚠️ Failed to load invoices</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {loadError}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={loadAll} style={{ padding: '0.6rem 1.5rem' }}>
              ↻ Retry
            </button>
            <button className="btn-secondary" onClick={() => router.push('/invoices')} style={{ padding: '0.6rem 1.5rem' }}>
              📜 Invoice Ledger
            </button>
          </div>
        </div>
      </div>
    );
  }

  const agingPieData = Object.entries(filteredAging).map(([key, val]: [string, any]) => ({
    name: AGING_LABELS[key] || key,
    value: val.total,
    color: AGING_COLORS[key]
  })).filter((a: any) => a.value > 0);

  return (
    <div className="dashboard-container">
      <header className="gen-page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.4rem', margin: 0, fontWeight: 800 }}>Invoices Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Real-time invoice metrics, receivables aging, and sales performance analytics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={() => router.push('/invoices')} style={{ width: 'auto', padding: '0.6rem 1.2rem' }}>
            📜 Invoice Ledger
          </button>
          <button className="btn-primary" onClick={() => router.push('/invoices/new')} style={{ width: 'auto', padding: '0.6rem 1.2rem', background: '#174f49' }}>
            + Create Invoice
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-title">Total Invoices</div>
          <div className="stat-value" style={{ color: '#6366f1' }}>{kpis.totalInvoices}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Today: {kpis.todayCount} new
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title">Total Invoiced</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            ${(kpis.totalInvoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Collected: ${(kpis.totalCollected || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Outstanding</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            ${(kpis.totalOutstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Uncollected: ${(kpis.totalUncollected || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f43f5e' }}>
          <div className="stat-title">Overdue / Critical</div>
          <div className="stat-value" style={{ color: '#f43f5e' }}>
            ${(kpis.overdueAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Critical (&gt;7d): ${(kpis.criticalAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-title">Due Today</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>
            ${(kpis.dueTodayAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            This week: ${(kpis.dueThisWeekAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-title">This Month</div>
          <div className="stat-value" style={{ color: '#8b5cf6' }}>
            ${(kpis.thisMonthInvoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Collected: ${(kpis.thisMonthCollected || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Aging Summary */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--text-main)' }}>⏰ Receivables Aging Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          {Object.entries(filteredAging).map(([key, val]: [string, any]) => (
            <div key={key} style={{
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${AGING_COLORS[key]}40`,
              borderLeft: `4px solid ${AGING_COLORS[key]}`,
              padding: '0.75rem',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{AGING_LABELS[key]}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: AGING_COLORS[key], marginTop: '0.25rem' }}>
                ${(val.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{val.count} invoice{val.count === 1 ? '' : 's'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>🔍 Filter Invoices</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={handleResetFilters} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
              ↺ Reset
            </button>
            <button className="btn-primary" onClick={handleExportCsv} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', background: '#174f49' }}>
              📊 Export CSV
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Search</label>
            <input type="text" className="form-control" placeholder="Invoice #, customer, FS, CRV" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Time Period</label>
            <select className="form-control" value={timeFilter} onChange={(e) => { setTimeFilter(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="all" style={{ color: 'black' }}>All Time</option>
              <option value="today" style={{ color: 'black' }}>Today</option>
              <option value="thisWeek" style={{ color: 'black' }}>This Week</option>
              <option value="thisMonth" style={{ color: 'black' }}>This Month</option>
              <option value="thisYear" style={{ color: 'black' }}>This Year</option>
              <option value="custom" style={{ color: 'black' }}>Custom Range</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Status</label>
            <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Statuses</option>
              <option value="Paid" style={{ color: 'black' }}>Paid</option>
              <option value="Critical" style={{ color: 'black' }}>Critical (&gt;7d late)</option>
              <option value="Overdue" style={{ color: 'black' }}>Overdue</option>
              <option value="Today" style={{ color: 'black' }}>Due Today</option>
              <option value="This Week" style={{ color: 'black' }}>This Week</option>
              <option value="Upcoming" style={{ color: 'black' }}>Upcoming</option>
              <option value="Active" style={{ color: 'black' }}>Active</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Sales Type</label>
            <select className="form-control" value={salesTypeFilter} onChange={(e) => { setSalesTypeFilter(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Types</option>
              <option value="Cash" style={{ color: 'black' }}>Cash</option>
              <option value="Credit" style={{ color: 'black' }}>Credit</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Customer</label>
            <select className="form-control" value={customerFilter} onChange={(e) => { setCustomerFilter(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Customers</option>
              {customerOptions.map(([id, name]) => (
                <option key={id} value={id} style={{ color: 'black' }}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Sales Rep</label>
            <select className="form-control" value={salesRepFilter} onChange={(e) => { setSalesRepFilter(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Reps</option>
              {salesRepOptions.map(([id, name]) => (
                <option key={id} value={id} style={{ color: 'black' }}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Min Amount</label>
            <input type="number" className="form-control" placeholder="0" value={amountMin} onChange={(e) => { setAmountMin(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Max Amount</label>
            <input type="number" className="form-control" placeholder="∞" value={amountMax} onChange={(e) => { setAmountMax(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
          </div>
        </div>

        {timeFilter === 'custom' && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>From</label>
              <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>To</label>
              <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} />
            </div>
          </div>
        )}

        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing <strong style={{ color: '#fff' }}>{filteredInvoices.length}</strong> of {allInvoices.length} invoices
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Filtered Total: <strong style={{ color: 'var(--success)', marginLeft: '0.5rem' }}>${filteredTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            <span style={{ marginLeft: '1rem' }}>Outstanding: <strong style={{ color: 'var(--warning)' }}>${filteredOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
          </span>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid-2col" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>📈 Monthly Invoice Trend</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredMonthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="invoicedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickMargin={6} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={10} />
                <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="total" stroke="#6366f1" fill="url(#invoicedGradient)" name="Invoiced ($)" />
                <Area yAxisId="left" type="monotone" dataKey="collected" stroke="#10b981" fill="url(#collectedGradient)" name="Collected ($)" />
                <Line yAxisId="right" type="monotone" dataKey="count" stroke="#fbbf24" name="Invoice Count" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>⏰ Receivables Aging</h3>
          {agingPieData.length > 0 ? (
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={agingPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                    {agingPieData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={40} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No outstanding receivables. 🎉</p>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid-2col" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>📊 Status Distribution</h3>
          {filteredStatusData.length > 0 ? (
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={filteredStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                    {filteredStatusData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No status data.</p>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>💵 Sales Type Breakdown</h3>
          {filteredSalesTypeData.length > 0 ? (
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={filteredSalesTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                    {filteredSalesTypeData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.name === 'Cash' ? '#10b981' : entry.name === 'Credit' ? '#3b82f6' : PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No sales type data.</p>
          )}
        </div>
      </div>

      {/* Top Customers & Top Reps */}
      <div className="grid-split" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--danger)' }}>⚠️ Top Customers by Outstanding</h3>
          {filteredTopCustomers.length > 0 ? (
            <div style={{ height: '320px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredTopCustomers} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={10} width={130} />
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No outstanding balances.</p>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>🏆 Top Sales Reps</h3>
          {filteredTopReps.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '320px', overflowY: 'auto' }}>
              {filteredTopReps.map((r: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-hover)' }}>{idx + 1}. {r.name}</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {r.count} invoices • Outstanding: ${r.outstanding.toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>${r.total.toLocaleString()}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--success)' }}>Collected: ${r.collected.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No sales rep data.</p>
          )}
        </div>
      </div>

      {/* Filtered Invoices Table */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>📋 Filtered Invoices</h3>
        <div className="tbl-mobile">
          {paginatedInvoices.length > 0 ? (
            paginatedInvoices.map((inv: any) => {
              const statusName = inv.computedStatus || inv.status;
              const statusColor = (() => {
                switch (statusName) {
                  case 'Critical': return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
                  case 'Overdue': return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
                  case 'Today': return { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' };
                  case 'This Week': return { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' };
                  case 'Upcoming': return { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' };
                  case 'Paid': return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
                  case 'Void': return { background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' };
                  default: return { background: 'rgba(255,255,255,0.15)', color: '#ffffff' };
                }
              })();
              return (
                <div className="gen-mobile-card" key={inv.id}>
                  <div className="gen-mobile-card-header">
                    <Link href={`/invoices/${inv.id}`} className="gen-mobile-card-title" style={{ textDecoration: 'none', color: 'var(--accent-hover)' }}>
                      {inv.invoiceNumber}
                    </Link>
                    <span style={{ ...statusColor, padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                      {statusName}
                    </span>
                  </div>
                  <div className="gen-mobile-card-body">
                    <div>
                      <div className="gen-mobile-card-label">Customer</div>
                      <div className="gen-mobile-card-value">{inv.customer?.customerName || '-'}</div>
                    </div>
                    <div>
                      <div className="gen-mobile-card-label">Sales Rep</div>
                      <div className="gen-mobile-card-value">{inv.salesRep ? `${inv.salesRep.firstName} ${inv.salesRep.lastName}` : '—'}</div>
                    </div>
                    <div>
                      <div className="gen-mobile-card-label">Type</div>
                      <div className="gen-mobile-card-value" style={{ color: inv.salesType === 'Cash' ? '#10b981' : inv.salesType === 'Credit' ? '#60a5fa' : 'var(--text-muted)', fontWeight: 600 }}>
                        {inv.salesType || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="gen-mobile-card-label">Due Date</div>
                      <div className="gen-mobile-card-value">{inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : '-'}</div>
                    </div>
                    <div>
                      <div className="gen-mobile-card-label">Amount</div>
                      <div className="gen-mobile-card-value" style={{ fontWeight: 600 }}>${(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div className="gen-mobile-card-label">Outstanding</div>
                      <div className="gen-mobile-card-value" style={{ color: inv.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                        ${(inv.remainingPayment || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No invoices match the selected filters.</p>
          )}
        </div>
        <div className="tbl-desktop" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '0.75rem' }}>Invoice #</th>
                <th style={{ padding: '0.75rem' }}>Customer</th>
                <th style={{ padding: '0.75rem' }}>Sales Rep</th>
                <th style={{ padding: '0.75rem' }}>Type</th>
                <th style={{ padding: '0.75rem' }}>Due Date</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Outstanding</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.length > 0 ? (
                paginatedInvoices.map((inv: any) => {
                  const statusName = inv.computedStatus || inv.status;
                  const statusColor = (() => {
                    switch (statusName) {
                      case 'Critical': return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
                      case 'Overdue': return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
                      case 'Today': return { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' };
                      case 'This Week': return { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' };
                      case 'Upcoming': return { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' };
                      case 'Paid': return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
                      case 'Void': return { background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' };
                      default: return { background: 'rgba(255,255,255,0.15)', color: '#ffffff' };
                    }
                  })();
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <Link href={`/invoices/${inv.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600 }}>
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{inv.customer?.customerName || '-'}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{inv.salesRep ? `${inv.salesRep.firstName} ${inv.salesRep.lastName}` : '—'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ color: inv.salesType === 'Cash' ? '#10b981' : inv.salesType === 'Credit' ? '#60a5fa' : 'var(--text-muted)', fontWeight: 600 }}>
                          {inv.salesType || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : '-'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>${(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: inv.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                        ${(inv.remainingPayment || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span style={{ ...statusColor, padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                          {statusName}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No invoices match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {(() => {
          const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / rowsPerPage));
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

      {/* Recent Invoices & Quick Actions */}
      <div className="grid-split" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem', color: 'var(--accent-hover)' }}>🆕 Recent Invoices</h3>
          {recentFilteredInvoices.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {recentFilteredInvoices.map((inv: any) => (
                <Link key={inv.id} href={`/invoices/${inv.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-hover)' }}>{inv.invoiceNumber}</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{inv.customer?.customerName || ''}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>${(inv.amount || 0).toLocaleString()}</div>
                    <span style={{ fontSize: '0.7rem', color: inv.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                      {inv.computedStatus || inv.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No invoices yet.</p>
          )}
        </div>

        <div className="glass-panel quick-actions">
          <span className="quick-actions-label">⚡ Quick Actions:</span>
          <button className="btn-primary" onClick={() => router.push('/invoices/new')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto', background: '#174f49' }}>
            + Create Invoice
          </button>
          <button className="btn-secondary" onClick={() => router.push('/invoices')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
            📜 Invoice Ledger
          </button>
          <button className="btn-secondary" onClick={() => router.push('/payments')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
            💵 Post Receipt
          </button>
          <button className="btn-secondary" onClick={() => router.push('/reports')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
            📊 Reports
          </button>
          <button className="btn-secondary" onClick={() => router.push('/customers')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
            👥 Customers
          </button>
        </div>
      </div>
    </div>
  );
}
