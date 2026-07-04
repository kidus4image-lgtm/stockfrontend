'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { apiFetch } from '../../../lib/api';


export default function OrdersDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  const [user, setUser] = useState<any>(null);
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [salesTypeFilter, setSalesTypeFilter] = useState('All');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const userRole = user?.role?.toLowerCase() || '';
  const isManager = userRole === 'manager' || userRole === 'admin';
  const isFinance = userRole === 'finance' || userRole === 'admin';

  const fetchAllOrders = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/orders');
      if (res.ok) {
        const data = await res.json();
        setAllOrders(data);
      } else {
        const errText = await res.text().catch(() => '');
        setLoadError(`Orders endpoint returned ${res.status} ${res.statusText}. ${errText}`);
        console.error('Orders fetch non-OK:', res.status, errText);
      }
    } catch (err: any) {
      const msg = err?.message || 'Network error';
      setLoadError(msg);
      console.error('Failed to fetch orders', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setLoadError('');
    await fetchAllOrders();
    setLoading(false);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch { }
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter logic
  const filterByTime = (dateString: string | null | undefined) => {
    if (!dateString) return timeFilter === 'all';
    const d = new Date(dateString);
    if (timeFilter === 'custom') {
      const s = startDate ? new Date(startDate) : null;
      const e = endDate ? new Date(endDate) : null;
      if (s && d < s) return false;
      if (e) { const end = new Date(e); end.setHours(23, 59, 59, 999); if (d > end) return false; }
      return true;
    }
    if (timeFilter === 'all') return true;
    const now = new Date();
    if (timeFilter === 'thisMonth') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (timeFilter === 'thisYear') return d.getFullYear() === now.getFullYear();
    if (timeFilter === 'today') return d.toDateString() === now.toDateString();
    if (timeFilter === 'thisWeek') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return d >= new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    }
    return true;
  };

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const dateStr = o.createdAt;
      const timeMatch = filterByTime(dateStr);
      const statusMatch = statusFilter === 'All' || o.status === statusFilter;
      const typeMatch = salesTypeFilter === 'All' || o.salesType === salesTypeFilter;
      const customerMatch = customerFilter === 'All' || o.customer?.id === Number(customerFilter);
      const min = amountMin ? parseFloat(amountMin) : -Infinity;
      const max = amountMax ? parseFloat(amountMax) : Infinity;
      const amountMatch = (o.totalAmount || 0) >= min && (o.totalAmount || 0) <= max;
      const search = searchQuery.trim().toLowerCase();
      const salesRepName = o.salesRep
        ? `${o.salesRep.firstName} ${o.salesRep.middleName ? o.salesRep.middleName + ' ' : ''}${o.salesRep.lastName}`.toLowerCase()
        : '';
      const searchMatch = !search
        || (o.orderNumber || '').toLowerCase().includes(search)
        || (o.customer?.customerName || '').toLowerCase().includes(search)
        || (o.createdBy || '').toLowerCase().includes(search)
        || salesRepName.includes(search)
        || (o.salesType || '').toLowerCase().includes(search);
      return timeMatch && statusMatch && typeMatch && customerMatch && amountMatch && searchMatch;
    });
  }, [allOrders, timeFilter, startDate, endDate, statusFilter, salesTypeFilter, customerFilter, searchQuery, amountMin, amountMax]);

  const customerOptions = useMemo(() => {
    const map = new Map<number, string>();
    allOrders.forEach(o => { if (o.customer) map.set(o.customer.id, o.customer.customerName); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allOrders]);

  const kpis = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalOrderValue = filteredOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const pendingCount = filteredOrders.filter(o => o.status === 'Pending').length;
    const financeApprovedCount = filteredOrders.filter(o => o.status === 'Finance_Approved').length;
    const completedCount = filteredOrders.filter(o => o.status === 'Completed').length;
    const now = new Date();
    const todayStr = now.toDateString();
    const todayOrders = filteredOrders.filter(o => o.createdAt ? new Date(o.createdAt).toDateString() === todayStr : false);
    const todayCount = todayOrders.length;
    const todayTotal = todayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    return { totalOrders, totalOrderValue, pendingCount, financeApprovedCount, completedCount, todayCount, todayTotal };
  }, [filteredOrders]);

  const filteredByStatus = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach(o => map.set(o.status, (map.get(o.status) || 0) + 1));
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }, [filteredOrders]);

  const filteredBySalesType = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filteredOrders.forEach(o => {
      const type = o.salesType || 'Credit';
      const entry = map.get(type) || { count: 0, total: 0 };
      entry.count++;
      entry.total += o.totalAmount || 0;
      map.set(type, entry);
    });
    return Array.from(map.entries()).map(([type, data]) => ({ type, ...data }));
  }, [filteredOrders]);

  const filteredMonthlyTrend = useMemo(() => {
    const dataMap = new Map<string, { count: number; total: number }>();
    const sortKeys: string[] = [];
    filteredOrders.forEach(o => {
      const d = o.createdAt ? new Date(o.createdAt) : null;
      if (!d) return;
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!dataMap.has(sortKey)) sortKeys.push(sortKey);
      const entry = dataMap.get(sortKey) || { count: 0, total: 0 };
      entry.count++;
      entry.total += o.totalAmount || 0;
      dataMap.set(sortKey, entry);
    });
    return sortKeys.sort().map(key => {
      const d = dataMap.get(key)!;
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
      return { month: label, count: d.count, total: d.total };
    });
  }, [filteredOrders]);

  const filteredTopCustomers = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    filteredOrders.forEach(o => {
      if (!o.customer) return;
      const name = o.customer.customerName;
      const entry = map.get(name) || { name, count: 0, total: 0 };
      entry.count++;
      entry.total += o.totalAmount || 0;
      map.set(name, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filteredOrders]);

  const recentFilteredOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    }).slice(0, 10).map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer?.customerName || 'Unknown',
      totalAmount: o.totalAmount,
      status: o.status,
      salesType: o.salesType,
      createdBy: o.createdBy,
      createdAt: o.createdAt,
    }));
  }, [filteredOrders]);

  // Pending approvals computed from unfiltered data
  const pendingApproval = allOrders.filter(o => o.status === 'Pending').length;
  const pendingFinance = allOrders.filter(o => o.status === 'Finance_Approved').length;

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setSalesTypeFilter('All');
    setCustomerFilter('All');
    setTimeFilter('all');
    setStartDate('');
    setEndDate('');
    setAmountMin('');
    setAmountMax('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading order dashboard...
      </div>
    );
  }

  if (loadError && allOrders.length === 0) {
    return (
      <div className="dashboard-container">
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '640px', margin: '4rem auto' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>⚠️ Failed to load orders</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>{loadError}</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={loadAll} style={{ padding: '0.6rem 1.5rem' }}>↻ Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    Pending: '#f59e0b',
    Manager_Approved: '#f97316',
    Finance_Approved: '#3b82f6',
    Store_Confirmed: '#8b5cf6',
    Completed: '#10b981'
  };

  const PIE_COLORS = ['#f59e0b', '#f97316', '#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <div className="dashboard-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>Orders Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time order metrics, trends, and approval workflows.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={() => router.push('/orders')} style={{ width: 'auto', padding: '0.6rem 1.2rem' }}>
            📋 All Orders
          </button>
          <button className="btn-primary" onClick={() => router.push('/orders/new')} style={{ width: 'auto', padding: '0.6rem 1.2rem', background: '#174f49' }}>
            + Create Order
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>🔍 Filter Orders</h3>
          <button className="btn-secondary" onClick={handleResetFilters} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
            ↺ Reset
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Search</label>
            <input type="text" className="form-control" placeholder="Order #, customer, sales rep..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Time Period</label>
            <select className="form-control" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
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
            <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Statuses</option>
              <option value="Pending" style={{ color: 'black' }}>Pending</option>
              <option value="Manager_Approved" style={{ color: 'black' }}>Manager Approved</option>
              <option value="Finance_Approved" style={{ color: 'black' }}>Finance Approved</option>
              <option value="Store_Confirmed" style={{ color: 'black' }}>Store Confirmed</option>
              <option value="Completed" style={{ color: 'black' }}>Completed</option>
              <option value="Rejected" style={{ color: 'black' }}>Rejected</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Sales Type</label>
            <select className="form-control" value={salesTypeFilter} onChange={(e) => setSalesTypeFilter(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Types</option>
              <option value="Cash" style={{ color: 'black' }}>Cash</option>
              <option value="Credit" style={{ color: 'black' }}>Credit</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Customer</label>
            <select className="form-control" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
              <option value="All" style={{ color: 'black' }}>All Customers</option>
              {customerOptions.map(([id, name]) => (
                <option key={id} value={id} style={{ color: 'black' }}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Min Amount</label>
            <input type="number" className="form-control" placeholder="0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>Max Amount</label>
            <input type="number" className="form-control" placeholder="∞" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
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
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing <strong style={{ color: '#fff' }}>{filteredOrders.length}</strong> of {allOrders.length} orders
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total Value: <strong style={{ color: 'var(--success)' }}>${kpis.totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-title">Total Orders</div>
          <div className="stat-value" style={{ color: '#6366f1' }}>{kpis.totalOrders}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Value: ${kpis.totalOrderValue.toLocaleString()}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Pending</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{kpis.pendingCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Awaiting manager approval
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-title">Finance Approved</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{kpis.financeApprovedCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Awaiting manager approval
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title">Completed</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{kpis.completedCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Fulfilled and delivered
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f43f5e' }}>
          <div className="stat-title">Today's Orders</div>
          <div className="stat-value" style={{ color: '#f43f5e' }}>{kpis.todayCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ${kpis.todayTotal.toLocaleString()} total
          </div>
        </div>
      </div>

      <div className="grid-2col" style={{ marginBottom: '2.5rem' }}>
        {/* Pie Chart: Order Status Distribution */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Order Status Distribution</h3>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={filteredByStatus.map(s => ({ name: s.status.replace(/_/g, ' '), value: s.count }))} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                  {filteredByStatus.map((_: any, idx: number) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Legend verticalAlign="bottom" height={30} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Type Breakdown */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Orders by Sales Type</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredBySalesType.length > 0 ? filteredBySalesType.map((st: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: st.type === 'Cash' ? '#10b981' : '#60a5fa' }}>
                    {st.type === 'Cash' ? '💵 Cash' : '📋 Credit'}
                  </span>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {st.count} orders
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>
                    ${st.total.toLocaleString()}
                  </p>
                </div>
              </div>
            )) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No sales type data.</p>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>📈 Monthly Order Trend</h3>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredMonthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickMargin={8} />
              <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => `$${val/1000}k`} />
              <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Orders" />
              <Bar yAxisId="right" dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Total Value ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Role-specific Pending Approvals Widget */}
      {(isManager || isFinance) && allOrders.length > 0 && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.25rem', color: '#f59e0b' }}>⚠️ Pending Approvals</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {isFinance && `Finance approvals needed: ${pendingApproval}`}
            {isFinance && isManager && ' | '}
            {isManager && `Manager approvals needed: ${pendingFinance}`}
          </p>
          {pendingApproval > 0 && isFinance && (
            <button className="btn-primary" onClick={() => router.push('/orders?filter=Pending')} style={{ marginRight: '0.75rem', width: 'auto', padding: '0.6rem 1.2rem', background: '#8b5cf6' }}>
              Review Pending Orders
            </button>
          )}
          {pendingFinance > 0 && isManager && (
            <button className="btn-primary" onClick={() => router.push('/orders?filter=Finance_Approved')} style={{ width: 'auto', padding: '0.6rem 1.2rem', background: '#174f49' }}>
              Review Finance Approved
            </button>
          )}
          {pendingApproval === 0 && pendingFinance === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No pending approvals.</p>
          )}
        </div>
      )}

      <div className="grid-split" style={{ marginBottom: '2.5rem' }}>
        {/* Top Customers */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>🏆 Top Customers by Orders</h3>
          {filteredTopCustomers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredTopCustomers.map((c: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{idx + 1}. {c.name}</span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.count} orders</p>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-hover)' }}>
                    ${c.total.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No customer data.</p>
          )}
        </div>

        {/* Recent Orders */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>📋 Recent Orders</h3>
          {recentFilteredOrders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {recentFilteredOrders.map((o: any) => (
                <Link key={o.id} href={`/orders/${o.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-hover)' }}>{o.orderNumber}</span>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.customerName}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>${o.totalAmount.toLocaleString()}</div>
                    <span style={{ fontSize: '0.7rem', color: STATUS_COLORS[o.status] || 'var(--text-muted)', fontWeight: 600 }}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No orders yet.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-panel quick-actions" style={{ marginBottom: '2.5rem' }}>
        <span className="quick-actions-label">⚡ Quick Actions:</span>
        <button className="btn-primary" onClick={() => router.push('/orders/new')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto', background: '#174f49' }}>
          🛒 Create Order
        </button>
        <button className="btn-secondary" onClick={() => router.push('/orders')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
          📋 View All Orders
        </button>
        <button className="btn-secondary" onClick={() => router.push('/invoices')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
          🧾 View Invoices
        </button>
        {(isManager || isFinance) && (
          <button className="btn-secondary" onClick={() => router.push('/reports')} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', width: 'auto' }}>
            📊 Reports
          </button>
        )}
      </div>

      {/* Status Legend Table */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--accent-hover)' }}>📊 Order Status Summary</h3>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '0.75rem' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Count</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {filteredByStatus.map((s: any) => (
                <tr key={s.status} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ color: STATUS_COLORS[s.status] || 'var(--text-muted)', fontWeight: 600 }}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>{s.count}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {kpis.totalOrders > 0 ? ((s.count / kpis.totalOrders) * 100).toFixed(1) + '%' : '0%'}
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
