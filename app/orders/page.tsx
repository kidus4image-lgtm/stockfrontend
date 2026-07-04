'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { showSuccess, showError } from '../../lib/toast';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [salesTypeFilter, setSalesTypeFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sortField, setSortField] = useState<'createdAt' | 'totalAmount' | 'orderNumber'>('createdAt');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [declineModalOrder, setDeclineModalOrder] = useState<any | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [confirmOrderId, setConfirmOrderId] = useState<number | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    salesType: 'Credit',
    includeWithhold: false,
    fsNumber: '',
    crv: ''
  });
  const rowsPerPage = 10;

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerConfirm = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${id}/customer-confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username || 'System' })
      });
      if (res.ok) {
        await fetchOrders();
        showSuccess('Order confirmed — awaiting Finance approval');
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to confirm order');
      }
    } catch (err) {
      showError('Failed to confirm order');
    } finally {
      setProcessingId(null);
    }
  };

  const handleManagerApprove = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${id}/manager-approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username || 'System' })
      });
      if (res.ok) {
        await fetchOrders();
        showSuccess('Order approved by Manager! Stock reserved.');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to approve');
      }
    } catch (err) {
      console.error(err);
      showError('Error approving order');
    } finally {
      setProcessingId(null);
    }
  };

  const handleFinanceApprove = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username || 'System' })
      });
      if (res.ok) {
        await fetchOrders();
        showSuccess('Order approved by Finance! Forwarded to Manager.');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to approve');
      }
    } catch (err) {
      console.error(err);
      showError('Error approving order');
    } finally {
      setProcessingId(null);
    }
  };

  const openConfirmModal = (order: any) => {
    setInvoiceForm({
      invoiceNumber: `INV-${order.orderNumber || Date.now()}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      salesType: order.salesType || 'Credit',
      includeWithhold: false,
      fsNumber: '',
      crv: ''
    });
    setConfirmOrderId(order.id);
  };

  const closeConfirmModal = () => {
    if (confirmSubmitting) return;
    setConfirmOrderId(null);
  };

  const handleConfirmWithInvoice = async () => {
    if (!confirmOrderId) return;
    if (!invoiceForm.fsNumber.trim()) {
      showError('FS Number is required to confirm the order.');
      return;
    }
    setConfirmSubmitting(true);
    setProcessingId(confirmOrderId);
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${confirmOrderId}/confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...invoiceForm, username: user?.username || 'System' })
      });
      if (res.ok) {
        await fetchOrders();
        showSuccess('Order Confirmed! Inventory deducted and Invoice generated.');
        setConfirmOrderId(null);
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to confirm');
      }
    } catch (err) {
      console.error(err);
      showError('Error confirming order');
    } finally {
      setConfirmSubmitting(false);
      setProcessingId(null);
    }
  };

  const openDeclineModal = (order: any) => {
    setDeclineModalOrder(order);
    setDeclineReason('');
  };

  const closeDeclineModal = () => {
    if (declineSubmitting) return;
    setDeclineModalOrder(null);
    setDeclineReason('');
  };

  const submitDecline = async () => {
    if (!declineModalOrder) return;
    if (!declineReason.trim()) {
      showError('A reason is required to decline an order.');
      return;
    }
    setDeclineSubmitting(true);
    setProcessingId(declineModalOrder.id);
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${declineModalOrder.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason.trim() })
      });
      if (res.ok) {
        await fetchOrders();
        showSuccess('Order declined. Reserved stock has been released.');
        setDeclineModalOrder(null);
        setDeclineReason('');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to decline');
      }
    } catch (err) {
      console.error(err);
      showError('Error declining order');
    } finally {
      setDeclineSubmitting(false);
      setProcessingId(null);
    }
  };

  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'administrator';
  const currentUsername = user?.username || '';
  const canEditOrder = (o: { createdBy?: string | null }) => isAdmin || (!!o.createdBy && o.createdBy === currentUsername);

  const statusCounts = orders.reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const filteredOrders = orders.filter((o) => {
    if (filter !== 'All' && o.status !== filter) return false;
    if (salesTypeFilter !== 'All' && o.salesType !== salesTypeFilter) return false;
    if (dateFrom && o.createdAt && new Date(o.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && o.createdAt && new Date(o.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
    if (amountMin && o.totalAmount < parseFloat(amountMin)) return false;
    if (amountMax && o.totalAmount > parseFloat(amountMax)) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const salesRepName = o.salesRep
      ? `${o.salesRep.firstName} ${o.salesRep.middleName ? o.salesRep.middleName + ' ' : ''}${o.salesRep.lastName}`.toLowerCase()
      : '';
    return (
      (o.orderNumber && o.orderNumber.toLowerCase().includes(s)) ||
      (o.customer?.customerName && o.customer.customerName.toLowerCase().includes(s)) ||
      (o.createdBy && o.createdBy.toLowerCase().includes(s)) ||
      (salesRepName && salesRepName.includes(s)) ||
      (o.salesType && o.salesType.toLowerCase().includes(s)) ||
      (o.status && o.status.replace('_', ' ').toLowerCase().includes(s))
    );
  }).sort((a, b) => {
    let aVal: any, bVal: any;
    if (sortField === 'createdAt') { aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); }
    else if (sortField === 'totalAmount') { aVal = a.totalAmount; bVal = b.totalAmount; }
    else { aVal = a.orderNumber; bVal = b.orderNumber; }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const hasActiveFilters = filter !== 'All' || salesTypeFilter !== 'All' || dateFrom || dateTo || amountMin || amountMax || searchTerm;

  const clearAllFilters = () => {
    setFilter('All');
    setSalesTypeFilter('All');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setSearchTerm('');
    setPage(1);
  };

  return (
    <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease-out', paddingBottom: '4rem' }}>
      
      {/* Premium Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '2rem',
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.4) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(to right, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Orders Workflow
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>
            Manage incoming orders, finance approval, store batches, and cashier confirmation.
          </p>
        </div>
        <button 
          onClick={() => router.push('/orders/new')} 
          style={{ 
            padding: '0.8rem 1.5rem', fontSize: '1rem', fontWeight: 700, borderRadius: '8px', 
            background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', 
            cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.3)', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
          onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform='none'}
        >
          <span>+</span> Create New Order
        </button>
      </header>

      {/* Search and Filters */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Row 1: search + sort + advanced toggle */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>🔍</span>
            <input
              type="text"
              placeholder="Search order #, customer, creator…"
              style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.6rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(56,189,248,0.5)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {/* Sales type */}
          <select
            value={salesTypeFilter}
            onChange={(e) => { setSalesTypeFilter(e.target.value); setPage(1); }}
            style={{ padding: '0.65rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: salesTypeFilter !== 'All' ? '#38bdf8' : 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
          >
            <option value="All">All Types</option>
            <option value="Credit">Credit</option>
            <option value="Cash">Cash</option>
          </select>

          {/* Sort */}
          <select
            value={sortField}
            onChange={(e) => { setSortField(e.target.value as any); setPage(1); }}
            style={{ padding: '0.65rem 1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
          >
            <option value="createdAt">Sort: Date</option>
            <option value="totalAmount">Sort: Amount</option>
            <option value="orderNumber">Sort: Order #</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            style={{ padding: '0.65rem 0.85rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            style={{ padding: '0.65rem 1rem', background: showAdvanced ? 'rgba(56,189,248,0.1)' : 'rgba(0,0,0,0.2)', border: `1px solid ${showAdvanced ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', color: showAdvanced ? '#38bdf8' : 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {showAdvanced ? '▲ Less' : '▼ More Filters'}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              style={{ padding: '0.65rem 1rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '8px', color: '#fb7185', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Advanced filters: date range + amount range */}
        {showAdvanced && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Date range:</span>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              style={{ padding: '0.55rem 0.75rem', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.82rem', outline: 'none', colorScheme: 'dark' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              style={{ padding: '0.55rem 0.75rem', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.82rem', outline: 'none', colorScheme: 'dark' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>Amount:</span>
            <input type="number" placeholder="Min" value={amountMin} onChange={(e) => { setAmountMin(e.target.value); setPage(1); }}
              style={{ width: '90px', padding: '0.55rem 0.75rem', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.82rem', outline: 'none' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
            <input type="number" placeholder="Max" value={amountMax} onChange={(e) => { setAmountMax(e.target.value); setPage(1); }}
              style={{ width: '90px', padding: '0.55rem 0.75rem', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.82rem', outline: 'none' }} />
          </div>
        )}

        {/* Status pills with live counts */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'All', label: 'All', color: '#94a3b8' },
            { id: 'Pending', label: 'Pending', color: '#fbbf24' },
            { id: 'Customer_Confirmed', label: 'Confirmed', color: '#34d399' },
            { id: 'Finance_Approved', label: 'Finance', color: '#60a5fa' },
            { id: 'Manager_Approved', label: 'Manager', color: '#f97316' },
            { id: 'Store_Confirmed', label: 'Store', color: '#c084fc' },
            { id: 'Completed', label: 'Completed', color: '#10b981' },
            { id: 'Rejected', label: 'Rejected', color: '#fb7185' },
          ].map(f => {
            const count = f.id === 'All' ? orders.length : (statusCounts[f.id] || 0);
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { setFilter(f.id); setPage(1); }}
                style={{
                  padding: '0.4rem 0.9rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '999px', whiteSpace: 'nowrap',
                  background: active ? `color-mix(in srgb, ${f.color} 18%, transparent)` : 'rgba(255,255,255,0.04)',
                  color: active ? f.color : 'var(--text-muted)',
                  border: `1px solid ${active ? `color-mix(in srgb, ${f.color} 40%, transparent)` : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.4rem'
                }}
              >
                {f.label}
                <span style={{ fontSize: '0.72rem', background: active ? `color-mix(in srgb, ${f.color} 25%, transparent)` : 'rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.05rem 0.45rem', fontWeight: 700 }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active filter summary */}
        {hasActiveFilters && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Showing</span>
            <strong style={{ color: '#f8fafc' }}>{filteredOrders.length}</strong>
            <span>of {orders.length} orders</span>
            {searchTerm && <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>"{searchTerm}"</span>}
            {filter !== 'All' && <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>{filter.replace('_', ' ')}</span>}
            {salesTypeFilter !== 'All' && <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>{salesTypeFilter}</span>}
            {(dateFrom || dateTo) && <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>{dateFrom || '…'} → {dateTo || '…'}</span>}
            {(amountMin || amountMax) && <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>${amountMin || '0'} – ${amountMax || '∞'}</span>}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
           <div style={{ fontSize: '2rem', marginBottom: '1rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</div>
           <div>Loading orders...</div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-panel" style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
          <div style={{ fontSize: '1.1rem' }}>No orders found matching your criteria.</div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.8)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '1.25rem 1.5rem', borderTopLeftRadius: '16px' }}>Order #</th>
                <th style={{ padding: '1.25rem 1rem' }}>Date</th>
                <th style={{ padding: '1.25rem 1rem' }}>Customer</th>
                <th style={{ padding: '1.25rem 1rem' }}>Ordered By</th>
                <th style={{ padding: '1.25rem 1rem' }}>Sales Type</th>
                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Total Amount</th>
                <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'right', borderTopRightRadius: '16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((order) => {
                const statusColor =
                  order.status === 'Pending' ? '#fbbf24' :
                  order.status === 'Customer_Confirmed' ? '#34d399' :
                  order.status === 'Finance_Approved' ? '#60a5fa' :
                  order.status === 'Manager_Approved' ? '#f97316' :
                  order.status === 'Store_Confirmed' ? '#c084fc' :
                  order.status === 'Rejected' ? '#fb7185' :
                  '#10b981'; // Completed
                
                return (
                  <tr key={order.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', background: 'transparent' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>
                      <div 
                        style={{ color: '#38bdf8', cursor: 'pointer', display: 'inline-block', transition: 'color 0.2s' }} 
                        onClick={() => router.push(`/orders/${order.id}`)}
                        onMouseEnter={e => e.currentTarget.style.color = '#7dd3fc'}
                        onMouseLeave={e => e.currentTarget.style.color = '#38bdf8'}
                      >
                        {order.orderNumber}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '1.25rem 1rem', fontWeight: 500, color: '#f8fafc' }}>
                      {order.customer?.customerName || 'Unknown'}
                    </td>
                    <td style={{ padding: '1.25rem 1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {order.salesRep
                        ? `${order.salesRep.firstName} ${order.salesRep.middleName ? order.salesRep.middleName + ' ' : ''}${order.salesRep.lastName}`
                        : order.createdBy || '-'}
                    </td>
                    <td style={{ padding: '1.25rem 1rem' }}>
                      <span style={{ 
                        background: order.salesType === 'Cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(96, 165, 250, 0.15)',
                        color: order.salesType === 'Cash' ? '#34d399' : '#60a5fa',
                        padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
                        border: `1px solid ${order.salesType === 'Cash' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(96, 165, 250, 0.3)'}`
                      }}>
                        {order.salesType}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1rem', fontWeight: 700, color: '#f8fafc', textAlign: 'right' }}>
                      ${order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                      <span style={{
                        background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
                        color: statusColor,
                        padding: '0.3rem 0.8rem',
                        borderRadius: '50px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        border: `1px solid color-mix(in srgb, ${statusColor} 40%, transparent)`,
                        display: 'inline-block',
                        whiteSpace: 'nowrap'
                      }}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                        {order.status === 'Pending' && (
                          <>
                            {canEditOrder(order) && (
                              <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(16,185,129,0.2)' }}
                                onClick={() => handleCustomerConfirm(order.id)}
                                disabled={processingId === order.id}
                              >
                                {processingId === order.id ? '...' : 'Confirm'}
                              </button>
                            )}
                            {canEditOrder(order) && (
                              <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                                onClick={() => router.push(`/orders/${order.id}/edit`)}
                                disabled={processingId === order.id}
                              >
                                Edit
                              </button>
                            )}
                            {(userRole === 'finance' || userRole === 'admin' || userRole === 'administrator') && (
                              <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', borderRadius: '6px', cursor: 'pointer' }}
                                onClick={() => openDeclineModal(order)}
                                disabled={processingId === order.id}
                              >
                                Decline
                              </button>
                            )}
                          </>
                        )}
                        {order.status === 'Customer_Confirmed' && (
                          <>
                            {(userRole === 'finance' || userRole === 'admin' || userRole === 'administrator') && (
                              <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(139,92,246,0.2)' }}
                                onClick={() => handleFinanceApprove(order.id)}
                                disabled={processingId === order.id}
                              >
                                {processingId === order.id ? '...' : 'Finance Approve'}
                              </button>
                            )}
                            {(userRole === 'finance' || userRole === 'admin' || userRole === 'administrator') && (
                              <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', borderRadius: '6px', cursor: 'pointer' }}
                                onClick={() => openDeclineModal(order)}
                                disabled={processingId === order.id}
                              >
                                Decline
                              </button>
                            )}
                          </>
                        )}
                        {order.status === 'Manager_Approved' && (
                          <>
                            <button
                              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'linear-gradient(135deg, #eab308, #ca8a04)', border: 'none', color: '#000', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(234,179,8,0.2)' }}
                              onClick={() => router.push(`/orders/${order.id}/assign-batches`)}
                            >
                              Batches
                            </button>
                            {(userRole === 'manager' || userRole === 'admin' || userRole === 'administrator') && (
                              <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', borderRadius: '6px', cursor: 'pointer' }}
                                onClick={() => openDeclineModal(order)}
                                disabled={processingId === order.id}
                              >
                                Decline
                              </button>
                            )}
                          </>
                        )}
                        {order.status === 'Finance_Approved' && (
                          <>
                            {(userRole === 'manager' || userRole === 'admin' || userRole === 'administrator') && (
                              <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(249,115,22,0.2)' }}
                                onClick={() => handleManagerApprove(order.id)}
                                disabled={processingId === order.id}
                              >
                                {processingId === order.id ? '...' : 'Approve'}
                              </button>
                            )}
                            {(userRole === 'manager' || userRole === 'admin' || userRole === 'administrator') && (
                              <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', borderRadius: '6px', cursor: 'pointer' }}
                                onClick={() => openDeclineModal(order)}
                                disabled={processingId === order.id}
                              >
                                Decline
                              </button>
                            )}
                          </>
                        )}
                        {order.status === 'Store_Confirmed' && userRole === 'cashier' && (
                          <button
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(16,185,129,0.2)' }}
                            onClick={() => openConfirmModal(order)}
                            disabled={processingId === order.id}
                          >
                            {processingId === order.id ? '...' : 'Confirm'}
                          </button>
                        )}
                        {order.status === 'Completed' && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingRight: '0.5rem' }}>Completed</span>
                        )}
                        {order.status === 'Rejected' && (
                          <>
                            <span
                              style={{ color: '#fb7185', fontSize: '0.85rem', cursor: 'help', marginRight: '0.5rem', background: 'rgba(244,63,94,0.1)', padding: '0.3rem 0.6rem', borderRadius: '6px' }}
                              title={order.rejectReason ? `Reason: ${order.rejectReason}${order.rejectedBy ? ` (by ${order.rejectedBy})` : ''}` : 'Declined'}
                            >
                              {order.rejectReason ? `❌ ${order.rejectReason.slice(0, 15)}${order.rejectReason.length > 15 ? '…' : ''}` : '❌ Declined'}
                            </span>
                            {canEditOrder(order) && (
                              <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                                onClick={() => router.push(`/orders/${order.id}/edit`)}
                                disabled={processingId === order.id}
                              >
                                Resubmit
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Pagination */}
          {filteredOrders.length > rowsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center', padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button 
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: page === 1 ? 'var(--text-muted)' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer' }} 
                disabled={page === 1} 
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <div style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>
                Page <strong style={{ color: '#fff', margin: '0 0.3rem' }}>{page}</strong> of <strong style={{ color: '#fff', marginLeft: '0.3rem' }}>{Math.ceil(filteredOrders.length / rowsPerPage)}</strong>
              </div>
              <button 
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: page >= Math.ceil(filteredOrders.length / rowsPerPage) ? 'var(--text-muted)' : '#fff', cursor: page >= Math.ceil(filteredOrders.length / rowsPerPage) ? 'not-allowed' : 'pointer' }} 
                disabled={page >= Math.ceil(filteredOrders.length / rowsPerPage)} 
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Decline Reason Modal */}
      {declineModalOrder && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 9999, padding: '1.5rem',
            animation: 'fadeIn 0.2s ease'
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !declineSubmitting) closeDeclineModal(); }}
        >
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '480px', padding: '2.5rem',
            borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.25s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.75rem' }}>⚠️</span>
              <h2 style={{ margin: 0, color: '#fb7185', fontSize: '1.5rem' }}>Decline Order</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              <strong style={{ color: '#fff' }}>{declineModalOrder.orderNumber}</strong>
              {' — '}
              <span style={{ color: '#e2e8f0' }}>{declineModalOrder.customer?.customerName || 'Unknown Customer'}</span>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {declineModalOrder.status === 'Manager_Approved' || declineModalOrder.status === 'Finance_Approved'
                ? 'This order is already approved. Declining it will release all reserved stock back to inventory and reject the order.'
                : 'Declining this order will reject it and prevent further processing.'}
            </p>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Reason for declining <span style={{ color: '#fb7185' }}>*</span>
            </label>
            <textarea
              className="form-control"
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="E.g. Customer credit limit exceeded, stock unavailable, etc."
              rows={4}
              style={{ width: '100%', padding: '1rem', resize: 'vertical', minHeight: '100px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
              onFocus={e => e.currentTarget.style.border = '1px solid rgba(244,63,94,0.5)'}
              onBlur={e => e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
              <button
                className="btn-secondary"
                onClick={closeDeclineModal}
                disabled={declineSubmitting}
                style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                onClick={submitDecline}
                disabled={declineSubmitting || !declineReason.trim()}
                style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.9rem', fontWeight: 700,
                  background: declineSubmitting || !declineReason.trim() ? 'rgba(244, 63, 94, 0.3)' : 'linear-gradient(135deg, #f43f5e, #be123c)',
                  border: 'none', borderRadius: '8px',
                  color: '#fff', cursor: declineSubmitting || !declineReason.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', boxShadow: declineSubmitting || !declineReason.trim() ? 'none' : '0 4px 15px rgba(244,63,94,0.3)'
                }}
              >
                {declineSubmitting ? 'Declining...' : '❌ Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Creation Modal */}
      {confirmOrderId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '1.5rem'
        }}
          onClick={(e) => { if (e.target === e.currentTarget && !confirmSubmitting) closeConfirmModal(); }}
        >
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '520px', padding: '2rem',
            borderRadius: '16px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            animation: 'slideUp 0.25s ease'
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#f8fafc' }}>Confirm Order & Create Invoice</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Invoice Number</label>
                <input className="form-control" style={{ width: '100%', padding: '0.6rem' }}
                  value={invoiceForm.invoiceNumber}
                  onChange={e => setInvoiceForm(f => ({ ...f, invoiceNumber: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Invoice Date</label>
                <input type="date" className="form-control" style={{ width: '100%', padding: '0.6rem' }}
                  value={invoiceForm.invoiceDate}
                  onChange={e => setInvoiceForm(f => ({ ...f, invoiceDate: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sales Type</label>
                <select className="form-control" style={{ width: '100%', padding: '0.6rem' }}
                  value={invoiceForm.salesType}
                  onChange={e => setInvoiceForm(f => ({ ...f, salesType: e.target.value }))}>
                  <option value="Credit">Credit</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
                <input type="checkbox" id="incWithhold" style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  checked={invoiceForm.includeWithhold}
                  onChange={e => setInvoiceForm(f => ({ ...f, includeWithhold: e.target.checked }))} />
                <label htmlFor="incWithhold" style={{ fontSize: '0.85rem', cursor: 'pointer', color: '#e2e8f0' }}>Include Withholding Tax</label>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>FS Number *</label>
                  <input className="form-control" style={{ width: '100%', padding: '0.6rem' }} placeholder="Fiscal Voucher"
                    value={invoiceForm.fsNumber}
                    onChange={e => setInvoiceForm(f => ({ ...f, fsNumber: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>CRV</label>
                  <input className="form-control" style={{ width: '100%', padding: '0.6rem' }} placeholder="Receipt Voucher"
                    value={invoiceForm.crv}
                    onChange={e => setInvoiceForm(f => ({ ...f, crv: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={closeConfirmModal} disabled={confirmSubmitting}
                style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}>Cancel</button>
              <button onClick={handleConfirmWithInvoice} disabled={confirmSubmitting}
                style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, background: confirmSubmitting ? 'rgba(16,185,129,0.5)' : 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', borderRadius: '8px', cursor: confirmSubmitting ? 'not-allowed' : 'pointer' }}>
                {confirmSubmitting ? 'Processing...' : 'Confirm & Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
      <div className="sticky-footer-bar no-print">
        <button className="btn-primary" onClick={() => router.push('/orders/new')} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
          ➕ Create New Order
        </button>
      </div>
    </div>
  );
}
