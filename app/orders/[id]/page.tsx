'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { showError, showSuccess } from '../../../lib/toast';
import ReportExportToolbar from '../../../components/ReportExportToolbar';
import { type ExportOptions } from '../../../lib/exportUtils';
import { useSettings } from '../../../lib/SettingsContext';

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { settings } = useSettings();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);
  const [declineModal, setDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    salesType: 'Credit',
    includeWithhold: false,
    fsNumber: '',
    crv: ''
  });

  useEffect(() => {
    if (!orderId) return;
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserRole((parsed.role || '').toLowerCase());
        setCurrentUsername(parsed.username || '');
      } catch (e) {
        console.error('Failed to parse stored user', e);
      }
    }
    const fetchOrder = async () => {
      try {
        const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}`);
        if (res.ok) {
          setOrder(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch order', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const doManagerApprove = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      const username = storedUser ? JSON.parse(storedUser).username : '';
      const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}/manager-approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (res.ok) {
        const updated = await res.json();
        setOrder({ ...order, ...updated });
        setConfirmModal(null);
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to approve');
        setConfirmModal(null);
      }
    } catch (err) {
      console.error(err);
      setConfirmModal(null);
    }
  };

  const handleManagerApprove = () => {
    setConfirmModal({
      title: 'Manager Approval',
      message: 'Approve this order as Manager? This will forward it to Store for batch assignment.',
      action: doManagerApprove
    });
  };

  const doCustomerConfirm = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      const username = storedUser ? JSON.parse(storedUser).username : '';
      const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}/customer-confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (res.ok) {
        const updated = await res.json();
        setOrder({ ...order, ...updated });
        showSuccess('Order confirmed — awaiting Finance approval');
        setConfirmModal(null);
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to confirm order');
        setConfirmModal(null);
      }
    } catch (err) {
      console.error(err);
      setConfirmModal(null);
    }
  };

  const handleCustomerConfirm = () => {
    setConfirmModal({
      title: 'Confirm Order',
      message: 'Confirm this order? It will be sent to Finance for approval. Only you (the order creator) can do this.',
      action: doCustomerConfirm
    });
  };

  const doFinanceApprove = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      const username = storedUser ? JSON.parse(storedUser).username : '';
      const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (res.ok) {
        const updated = await res.json();
        setOrder({ ...order, ...updated });
        setConfirmModal(null);
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to approve');
        setConfirmModal(null);
      }
    } catch (err) {
      console.error(err);
      setConfirmModal(null);
    }
  };

  const handleFinanceApprove = () => {
    setConfirmModal({
      title: 'Finance Approval',
      message: 'Approve this order as Finance? This will forward it to Manager for review.',
      action: doFinanceApprove
    });
  };

  const doDecline = async () => {
    if (!declineReason.trim()) {
      showError('Please provide a reason for declining this order.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason })
      });
      if (res.ok) {
        const updated = await res.json();
        setOrder({ ...order, ...updated, status: 'Rejected', rejectReason: declineReason });
        setDeclineModal(false);
        setDeclineReason('');
        showSuccess('Order declined. Reserved stock has been released.');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to decline order');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to decline order');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeclineModal = () => {
    setDeclineReason('');
    setDeclineModal(true);
  };

  const handleConfirm = () => {
    setInvoiceForm(f => ({
      ...f,
      invoiceNumber: `INV-${order?.orderNumber || Date.now()}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      salesType: order?.salesType || 'Credit'
    }));
    setShowInvoiceModal(true);
  };

  const handleConfirmWithInvoice = async () => {
    if (!invoiceForm.invoiceNumber) {
      showError('Invoice number is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}/confirm-with-invoice`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceForm)
      });
      if (res.ok) {
        const { order: updated, invoice } = await res.json();
        setOrder({ ...order, ...updated });
        setShowInvoiceModal(false);
        showSuccess(`Order confirmed and invoice ${invoice.invoiceNumber} created!`);
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to confirm');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading order details...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="dashboard-container">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem' }}>Order not found.</p>
        <div style={{ textAlign: 'center' }}>
          <button className="btn-secondary" onClick={() => router.push('/orders')}>Back to Orders</button>
        </div>
      </div>
    );
  }

  const totalAllocated = order.items?.every(
    (item: any) => item.allocations?.reduce((s: number, a: any) => s + a.quantity, 0) >= item.quantity
  );

  const isAdmin = userRole === 'admin' || userRole === 'administrator';
  const isCreator = !!order.createdBy && order.createdBy === currentUsername;
  const canEdit = isAdmin || isCreator;

  const salesRepName = order.salesRep
    ? [order.salesRep.firstName, order.salesRep.middleName, order.salesRep.lastName].filter(Boolean).join(' ')
    : (order.createdBy || 'System');

  const customerName = order.customer?.customerName || 'Unknown Customer';
  const customerPhone = order.customer?.phone || order.customer?.phoneNumber || '';
  const customerAddress = order.customer?.address || '';

  const fmt = (n: number) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const overdueAmt = order.customerSummary?.overdueAmount || 0;
  const balance = order.customer?.balance || 0;
  const totalPurchase = order.customer?.totalPurchase || 0;
  const totalPaid = order.customer?.totalPayed || 0;
  const uncollectedCheque = order.customer?.uncollectedCheque || 0;
  const withholdRate = (settings.withholdPercent || 2) / 100;
  const lineTotal = (order.items || []).reduce((s: number, i: any) => s + (i.price || 0) * i.quantity, 0);
  const withholdTotal = lineTotal * withholdRate;

  const statusWatermarkColor = (s: string): 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gray' => {
    if (s === 'Completed')        return 'green';
    if (s === 'Rejected')         return 'red';
    if (s === 'Pending')          return 'orange';
    if (s === 'Finance_Approved') return 'blue';
    if (s === 'Manager_Approved') return 'purple';
    return 'gray';
  };

  const orderExportConfig: ExportOptions = {
    title: `Sales Order — ${order.orderNumber || `#${order.id}`}`,
    filename: `order_${order.orderNumber || order.id}_${new Date().toISOString().slice(0, 10)}`,
    orientation: 'portrait',
    watermark: {
      text: order.status.replace(/_/g, ' '),
      color: statusWatermarkColor(order.status),
    },

    infoBlock: {
      leftTitle: 'Customer Details',
      rightTitle: 'Order Details',
      left: [
        { label: 'Name',              value: customerName },
        { label: 'Address',           value: customerAddress || '—' },
        { label: 'Phone',             value: customerPhone || '—' },
        { label: 'Balance',           value: fmt(balance), valueColor: balance > 0 ? 'blue' : undefined },
        { label: 'Overdue',           value: fmt(overdueAmt), valueColor: overdueAmt > 0 ? 'red' : 'green' },
        { label: 'Total Purchase',    value: fmt(totalPurchase) },
        { label: 'Total Paid',        value: fmt(totalPaid), valueColor: 'green' },
        { label: 'Uncollected Chq',   value: fmt(uncollectedCheque), valueColor: uncollectedCheque > 0 ? 'orange' : undefined },
      ],
      right: [
        { label: 'Order #',           value: order.orderNumber || `#${order.id}` },
        { label: 'Date',              value: new Date(order.createdAt).toLocaleDateString('en-GB') },
        { label: 'Sales Rep',         value: salesRepName },
        { label: 'Sales Type',        value: order.salesType || 'N/A' },
        { label: 'Status',            value: order.status.replace(/_/g, ' ') },
        { label: 'Items',             value: String(order.items?.length || 0) },
        { label: 'Created By',        value: order.createdBy || '—' },
        { label: 'Finance Approved',  value: order.financeApprovedBy || '—' },
      ],
    },

    columns: [
      { key: 'no',          label: '#',           align: 'center', width: 7  },
      { key: 'productName', label: 'Product',                       width: 52 },
      { key: 'sku',         label: 'SKU',                           width: 24 },
      { key: 'unit',        label: 'Unit',        align: 'center',  width: 14 },
      { key: 'quantity',    label: 'Qty',         align: 'center',  width: 12 },
      { key: 'price',       label: 'Unit Price',  align: 'right',   width: 22, format: (v: number) => fmt(v) },
      { key: 'subtotal',    label: 'Subtotal',    align: 'right',   width: 24, format: (v: number) => fmt(v) },
      { key: 'extraPaid',   label: `WHT (${settings.withholdPercent || 2}%)`, align: 'right', width: 22, format: (v: number) => fmt(v) },
    ],

    data: (order.items || []).map((item: any, idx: number) => {
      const sub = (item.price || 0) * item.quantity;
      return {
        no: idx + 1,
        productName: item.product?.name || `Product #${item.productId}`,
        sku: item.product?.sku || '—',
        unit: item.product?.sellingUnit || item.product?.purchaseUnit || 'pcs',
        quantity: item.quantity,
        price: item.price,
        subtotal: sub,
        extraPaid: sub * withholdRate,
      };
    }),

    totalsRows: [
      { label: 'Line Total',                                      value: fmt(lineTotal) },
      { label: `Withhold (${settings.withholdPercent || 2}%)`,   value: fmt(withholdTotal), bold: true },
      { label: 'ORDER TOTAL',                                     value: fmt(order.totalAmount || 0), accent: true },
    ],
  };

  return (
    <div className="dashboard-container" style={{ paddingBottom: '6rem', animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* Premium Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '2rem',
        padding: '1.5rem',
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.4) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
      }}>
        <div>
          <button onClick={() => router.push('/orders')} style={{ 
            background: 'transparent', border: 'none', color: 'var(--text-muted)', 
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', 
            fontSize: '0.85rem', marginBottom: '1rem', transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            ← Back to Orders
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(to right, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {order.orderNumber || `Order #${order.id}`}
            </h1>
            <span style={{ 
              fontSize: '0.75rem', padding: '0.4rem 0.8rem', borderRadius: '50px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              background: order.status === 'Completed' ? 'rgba(16,185,129,0.15)' : order.status === 'Pending' ? 'rgba(245,158,11,0.15)' : order.status === 'Manager_Approved' ? 'rgba(249,115,22,0.15)' : order.status === 'Rejected' ? 'rgba(244,63,94,0.15)' : 'rgba(99,102,241,0.15)',
              color: order.status === 'Completed' ? '#10b981' : order.status === 'Pending' ? '#f59e0b' : order.status === 'Manager_Approved' ? '#f97316' : order.status === 'Rejected' ? '#fb7185' : '#818cf8',
              border: `1px solid ${order.status === 'Completed' ? 'rgba(16,185,129,0.3)' : order.status === 'Pending' ? 'rgba(245,158,11,0.3)' : order.status === 'Manager_Approved' ? 'rgba(249,115,22,0.3)' : order.status === 'Rejected' ? 'rgba(244,63,94,0.3)' : 'rgba(99,102,241,0.3)'}`
            }}>
              {order.status.replace('_', ' ')}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            Customer: <Link href={`/customers/${order.customer?.id}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>{order.customer?.customerName || 'Unknown'}</Link> • Created on {new Date(order.createdAt).toLocaleDateString()}
            {order.status === 'Completed' && order.invoice && (
              <> • <Link href={`/invoices/${order.invoice.id}`} style={{ color: '#34d399', textDecoration: 'none', fontWeight: 600 }}>View Invoice {order.invoice.invoiceNumber} →</Link></>
            )}
          </p>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
            Sales Person: {order.salesRep
              ? `${order.salesRep.firstName} ${order.salesRep.middleName ? order.salesRep.middleName + ' ' : ''}${order.salesRep.lastName}`
              : order.createdBy || 'System'}
          </p>
        </div>
      </header>

      {/* EXPORT TOOLBAR */}
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <ReportExportToolbar
          exportOptions={orderExportConfig}
          variant="compact"
          disabled={!order}
        />
      </div>

      {/* Visual Status Stepper */}
      {order.status !== 'Rejected' && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: '4rem', right: '4rem', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0, transform: 'translateY(-50%)' }}></div>
          
          {[
            { id: 'Pending', label: 'Order Placed', icon: '🛒' },
            { id: 'Customer_Confirmed', label: 'Customer Confirmed', icon: '✔️' },
            { id: 'Finance_Approved', label: 'Finance Verified', icon: '💰' },
            { id: 'Manager_Approved', label: 'Manager Review', icon: '👤' },
            { id: 'Store_Confirmed', label: 'Store Confirmed', icon: '📦' },
            { id: 'Completed', label: 'Completed', icon: '✅' }
          ].map((step, idx, arr) => {
            const statuses = ['Pending', 'Customer_Confirmed', 'Finance_Approved', 'Manager_Approved', 'Store_Confirmed', 'Completed'];
            const currentIndex = statuses.indexOf(order.status);
            const stepIndex = statuses.indexOf(step.id);
            const isCompleted = stepIndex <= currentIndex;
            const isCurrent = stepIndex === currentIndex;
            
            return (
              <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1, width: '120px' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isCompleted ? '#10b981' : '#1e293b',
                  border: `2px solid ${isCurrent ? '#38bdf8' : isCompleted ? '#059669' : '#475569'}`,
                  color: isCompleted ? '#fff' : '#94a3b8',
                  fontSize: '1.2rem',
                  boxShadow: isCurrent ? '0 0 0 4px rgba(56, 189, 248, 0.2)' : isCompleted ? '0 0 15px rgba(16,185,129,0.4)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {step.icon}
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#f8fafc' : isCompleted ? '#cbd5e1' : '#64748b', textAlign: 'center' }}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#818cf8' }}>
            💵
          </div>
          <div>
            <div className="stat-title" style={{ margin: 0 }}>Total Amount</div>
            <div className="stat-value" style={{ color: '#818cf8', fontSize: '1.6rem' }}>
              ${(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{order.salesType || 'Credit'} Sale</div>
          </div>
        </div>

            <div className="stat-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#34d399' }}>
                🛍️
              </div>
              <div>
                <div className="stat-title" style={{ margin: 0 }}>Items</div>
                <div className="stat-value" style={{ color: '#34d399', fontSize: '1.6rem' }}>{order.items?.length || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Sales Person: {order.salesRep
                    ? `${order.salesRep.firstName} ${order.salesRep.middleName ? order.salesRep.middleName + ' ' : ''}${order.salesRep.lastName}`
                    : order.createdBy || 'System'}
                </div>
              </div>
            </div>

        <div className="stat-card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: totalAllocated ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: totalAllocated ? '#34d399' : '#fbbf24' }}>
            {totalAllocated ? '📦' : '⏳'}
          </div>
          <div>
            <div className="stat-title" style={{ margin: 0 }}>Allocation Status</div>
            <div className="stat-value" style={{ color: totalAllocated ? '#34d399' : '#fbbf24', fontSize: '1.2rem' }}>
              {totalAllocated ? 'Fully Allocated' : 'Pending Allocation'}
            </div>
            <div style={{ marginTop: '0.2rem' }}>
              <Link href={`/orders/${order.id}/assign-batches`} style={{ fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>
                Manage Allocations →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Financial Status */}
      {order.customer && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #f59e0b, #ea580c)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📊</span> Customer Financial Overview
            </h3>
            <Link href={`/customers/${order.customer.id}`} style={{ fontSize: '0.85rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 500, background: 'rgba(96,165,250,0.1)', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
              View Profile
            </Link>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Balance', value: order.customer.balance, color: '#6366f1' },
              { label: 'Overdue', value: order.customerSummary?.overdueAmount, color: (order.customerSummary?.overdueAmount || 0) > 0 ? '#ef4444' : '#10b981' },
              { label: 'Total Purchase', value: order.customer.totalPurchase, color: '#8b5cf6' },
              { label: 'Total Paid', value: order.customer.totalPayed, color: '#10b981' },
              { label: 'Uncollected Cheque', value: order.customer.uncollectedCheque, color: (order.customer.uncollectedCheque || 0) > 0 ? '#ef4444' : '#10b981' },
              { label: 'Bounced Cheques', value: order.customer.bouncedCheques, color: (order.customer.bouncedCheques || 0) > 0 ? '#ef4444' : '#10b981' }
            ].map((stat, i) => (
              <div key={i} style={{ padding: '1rem', background: 'rgba(15,23,42,0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', fontWeight: 600 }}>{stat.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stat.color }}>
                  ${(stat.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📋</span> Order Line Items
        </h3>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', minWidth: '700px' }}>
            <thead>
              <tr>
                <th style={{ padding: '1rem', background: 'rgba(15,23,42,0.8)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }}>Product</th>
                <th style={{ padding: '1rem', background: 'rgba(15,23,42,0.8)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '1rem', background: 'rgba(15,23,42,0.8)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Price</th>
                <th style={{ padding: '1rem', background: 'rgba(15,23,42,0.8)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Subtotal</th>
                <th style={{ padding: '1rem', background: 'rgba(15,23,42,0.8)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Allocated</th>
                <th style={{ padding: '1rem', background: 'rgba(15,23,42,0.8)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}>Batch Details</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item: any) => {
                const allocatedQty = item.allocations?.reduce((s: number, a: any) => s + a.quantity, 0) || 0;
                return (
                  <tr key={item.id} style={{ transition: 'background 0.2s', borderBottom: '1px solid rgba(255,255,255,0.02)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                          📦
                        </div>
                        <Link href={`/inventory/${item.productId}`} style={{ color: '#f8fafc', textDecoration: 'none', fontWeight: 600 }}>
                          {item.product?.name || `Product #${item.productId}`}
                        </Link>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 600 }}>{item.quantity}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>${(item.price || 0).toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: '#38bdf8' }}>${((item.price || 0) * item.quantity).toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ padding: '0.3rem 0.6rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700, background: allocatedQty >= item.quantity ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: allocatedQty >= item.quantity ? '#34d399' : '#fbbf24' }}>
                        {allocatedQty} / {item.quantity}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {item.allocations?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {item.allocations.map((a: any, i: number) => (
                            <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                              {a.batch?.batchNumber || 'N/A'}: <strong style={{ color: '#f8fafc' }}>{a.quantity}</strong>
                            </span>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="sticky-footer-bar" style={{ justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '1200px', justifyContent: 'flex-end', alignItems: 'center' }}>
          
          <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {order.status === 'Rejected' && order.rejectReason && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: '8px', color: '#fb7185', fontSize: '0.85rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span> 
                <div>
                  <strong>Declined:</strong> {order.rejectReason}
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({order.rejectedBy})</span>
                </div>
              </div>
            )}
            <button className="btn-secondary" onClick={() => router.push('/orders/new')} style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}>
              + New Order
            </button>
          </div>

          {order.status === 'Pending' && (
            <>
              {(userRole === 'finance' || isAdmin) && (
                <button className="btn-secondary" onClick={openDeclineModal} style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185' }}>
                  ❌ Decline
                </button>
              )}
              {canEdit && (
                <button className="btn-secondary" onClick={() => router.push(`/orders/${order.id}/edit`)} style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}>
                  ✏️ Edit
                </button>
              )}
              {isCreator && (
                <button onClick={handleCustomerConfirm} style={{ padding: '0.7rem 2rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
                  ✔️ Confirm Order →
                </button>
              )}
            </>
          )}

          {order.status === 'Customer_Confirmed' && (
            <>
              {(userRole === 'finance' || isAdmin) && (
                <button className="btn-secondary" onClick={openDeclineModal} style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185' }}>
                  ❌ Decline
                </button>
              )}
              {(userRole === 'finance' || isAdmin) && (
                <button onClick={handleFinanceApprove} style={{ padding: '0.7rem 2rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(139,92,246,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
                  Finance Approve →
                </button>
              )}
            </>
          )}

          {order.status === 'Manager_Approved' && (
            <>
              {(userRole === 'manager' || isAdmin) && (
                <button className="btn-secondary" onClick={openDeclineModal} style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185' }}>
                  ❌ Decline
                </button>
              )}
              <button onClick={() => router.push(`/orders/${order.id}/assign-batches`)} style={{ padding: '0.7rem 2rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', background: 'linear-gradient(135deg, #eab308, #ca8a04)', border: 'none', color: '#000', cursor: 'pointer', boxShadow: '0 4px 15px rgba(234,179,8,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
                Assign Batches 📦
              </button>
            </>
          )}

          {order.status === 'Finance_Approved' && (
            <>
              {(userRole === 'manager' || isAdmin) && (
                <button className="btn-secondary" onClick={openDeclineModal} style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185' }}>
                  ❌ Decline
                </button>
              )}
              {(userRole === 'manager' || isAdmin) && (
                <button onClick={handleManagerApprove} style={{ padding: '0.7rem 2rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(249,115,22,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
                  Manager Approve →
                </button>
              )}
            </>
            )}

          {order.status === 'Store_Confirmed' && (
            <>
              {(userRole === 'manager' || isAdmin) && (
                <button className="btn-secondary" onClick={openDeclineModal} style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185' }}>
                  ❌ Decline
                </button>
              )}
              {(userRole === 'cashier' || isAdmin) && (
                <button onClick={handleConfirm} style={{ padding: '0.7rem 2rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
                  Cashier Confirm & Invoice 🧾
                </button>
              )}
            </>
          )}

          {order.status === 'Rejected' && canEdit && (
            <button onClick={() => router.push(`/orders/${order.id}/edit`)} style={{ padding: '0.7rem 2rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
              ✏️ Edit & Resubmit
            </button>
          )}

          {order.status === 'Completed' && order.invoice && (
            <button onClick={() => router.push(`/invoices/${order.invoice.id}`)} style={{ padding: '0.7rem 2rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
              🧾 View Purchased Products
            </button>
          )}
        </div>
      </div>

      {/* Confirm Action Modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 100000, padding: '1.5rem',
          animation: 'fadeIn 0.2s ease'
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmModal(null); }}
        >
          <div className="glass-panel" style={{
            maxWidth: '420px', width: '100%', padding: '2.5rem 2rem 2rem',
            borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(249,115,22,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(249,115,22,0.08)',
            textAlign: 'center',
            animation: 'slideUp 0.25s ease'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(234,88,12,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', border: '2px solid rgba(249,115,22,0.25)'
            }}>
              <span style={{ fontSize: '2rem' }}>⚡</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#fb923c' }}>
              {confirmModal.title}
            </h3>
            <p style={{
              color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6',
              fontSize: '0.9rem', padding: '0 0.5rem'
            }}>
              {confirmModal.message}
            </p>
            <div style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem'
            }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.action}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(249,115,22,0.35)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(249,115,22,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,115,22,0.35)'; }}
              >
                ✅ Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* Invoice Creation Modal */}
      {showInvoiceModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '1.5rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '520px', padding: '2rem',
            borderRadius: '16px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            animation: 'slideUp 0.25s ease'
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#f8fafc' }}>Create Invoice from Order</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Invoice Number *</label>
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
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>FS Number</label>
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
              <button className="btn-secondary" onClick={() => setShowInvoiceModal(false)} disabled={submitting}
                style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}>Cancel</button>
              <button onClick={handleConfirmWithInvoice} disabled={submitting}
                style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Processing...' : 'Confirm & Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Reason Modal */}
      {declineModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '1.5rem'
        }}
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) setDeclineModal(false); }}
        >
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '480px', padding: '2rem',
            borderRadius: '16px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.25s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.75rem' }}>⚠️</span>
              <h2 style={{ margin: 0, color: '#fb7185' }}>Decline Order</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              {order.status === 'Manager_Approved' || order.status === 'Finance_Approved'
                ? 'This order is already approved. Declining it will release all reserved stock back to inventory and reject the order.'
                : 'Declining this order will reject it and prevent further processing.'}
            </p>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Reason for declining <span style={{ color: '#fb7185' }}>*</span>
            </label>
            <textarea
              className="form-control"
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="E.g. Customer credit limit exceeded, stock unavailable, etc."
              rows={4}
              style={{ width: '100%', padding: '0.75rem', resize: 'vertical', minHeight: '100px', borderRadius: '8px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setDeclineModal(false)} disabled={submitting}
                style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}>
                Cancel
              </button>
              <button
                onClick={doDecline}
                disabled={submitting || !declineReason.trim()}
                style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.9rem', fontWeight: 700,
                  background: submitting || !declineReason.trim() ? 'rgba(244, 63, 94, 0.3)' : 'linear-gradient(135deg, #f43f5e, #be123c)',
                  border: 'none', borderRadius: '8px',
                  color: '#fff', cursor: submitting || !declineReason.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {submitting ? 'Declining...' : '❌ Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
