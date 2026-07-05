'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { showSuccess, showError } from '../../../lib/toast';
import { confirmAsync } from '../../../lib/confirm';
import ReportExportToolbar from '../../../components/ReportExportToolbar';
import { type ExportOptions } from '../../../lib/exportUtils';

interface Supplier { id: number; name: string; }
interface Product { id: number; name: string; sku: string; price: number; }
interface POItem {
  id: number; productId: number; quantity: number;
  purchasePrice: number; receivedQuantity: number; product: Product;
}
interface PurchaseOrder {
  id: number; poNumber: string; supplierId: number; status: string;
  orderDate: string; expectedDate: string | null; totalAmount: number;
  notes: string | null; createdBy: string | null;
  submittedBy: string | null; submittedAt: string | null;
  approvedBy: string | null; approvedAt: string | null;
  rejectedBy: string | null; rejectedAt: string | null; rejectionReason: string | null;
  sentBy: string | null; sentAt: string | null;
  createdAt: string; updatedAt: string;
  supplier: Supplier; items: POItem[]; receipts?: any[];
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  Draft:            { label: 'Draft',            bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' },
  Submitted:        { label: 'Submitted',         bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
  Manager_Approved: { label: 'Mgr Approved',      bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
  Sent:             { label: 'Sent',              bg: 'rgba(34,211,238,0.15)', color: '#22d3ee' },
  Partial_Received: { label: 'Partial Received',  bg: 'rgba(245,158,11,0.15)', color: '#fde047' },
  Received:         { label: 'Received',          bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7' },
  Cancelled:        { label: 'Cancelled',         bg: 'rgba(239,68,68,0.12)', color: '#fca5a5' },
  Rejected:         { label: 'Rejected',          bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
};

const BLANK_FORM = {
  supplierId: '', expectedDate: '', notes: '',
  items: [{ productId: '', quantity: '', purchasePrice: '' }] as { productId: string; quantity: string; purchasePrice: string }[]
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [createForm, setCreateForm] = useState(BLANK_FORM);

  const [userRole, setUserRole] = useState('sales_user');
  const [currentUser, setCurrentUser] = useState('System User');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setCurrentUser(u.username || 'System User');
        setUserRole(u.role || 'sales_user');
      } catch {}
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [poRes, supRes, prodRes] = await Promise.all([
        apiFetch('http://localhost:5000/api/purchase-orders'),
        apiFetch('http://localhost:5000/api/suppliers'),
        apiFetch('http://localhost:5000/api/inventory/products')
      ]);
      if (poRes.ok) { const d = await poRes.json(); setOrders(d.data || d); }
      if (supRes.ok) setSuppliers(await supRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch {}
    finally { setLoading(false); }
  };

  const role = userRole.toLowerCase();
  const isAdmin   = role === 'admin' || role === 'administrator';
  const isManager = role === 'manager' || isAdmin;
  const isFinance = role === 'finance' || isManager;
  const canManage = isManager || role === 'sales_user' || role === 'store_user';
  const canApprove = isManager || isFinance;

  // ─── form helpers ────────────────────────────────────────────────
  const openCreate = () => { setEditingOrder(null); setCreateForm(BLANK_FORM); setShowCreateModal(true); };

  const openEdit = (o: PurchaseOrder) => {
    setEditingOrder(o);
    setCreateForm({
      supplierId: String(o.supplierId),
      expectedDate: o.expectedDate ? o.expectedDate.slice(0, 10) : '',
      notes: o.notes || '',
      items: o.items.map(it => ({
        productId: String(it.productId),
        quantity: String(it.quantity),
        purchasePrice: String(it.purchasePrice)
      }))
    });
    setShowCreateModal(true);
  };

  const addItem = () => setCreateForm(f => ({ ...f, items: [...f.items, { productId: '', quantity: '', purchasePrice: '' }] }));
  const removeItem = (idx: number) => setCreateForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: string) => {
    const items = [...createForm.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'productId' && value) {
      const p = products.find(p => p.id === parseInt(value));
      if (p) items[idx].purchasePrice = (p.price * 0.6).toFixed(2);
    }
    setCreateForm(f => ({ ...f, items }));
  };

  const calculateTotal = () => createForm.items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.purchasePrice) || 0), 0);

  // ─── submit create / edit ─────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.supplierId) { showError('Please select a supplier'); return; }
    const validItems = createForm.items.filter(it => it.productId && it.quantity && it.purchasePrice);
    if (validItems.length === 0) { showError('Please add at least one item'); return; }

    setSubmitting(true);
    try {
      const body = {
        supplierId: parseInt(createForm.supplierId),
        expectedDate: createForm.expectedDate || null,
        notes: createForm.notes,
        items: validItems.map(it => ({ productId: parseInt(it.productId), quantity: parseInt(it.quantity), purchasePrice: parseFloat(it.purchasePrice) })),
        username: currentUser
      };
      const url = editingOrder
        ? `http://localhost:5000/api/purchase-orders/${editingOrder.id}`
        : 'http://localhost:5000/api/purchase-orders';
      const method = editingOrder ? 'PUT' : 'POST';
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showSuccess(editingOrder ? 'Purchase order updated!' : 'Purchase order created!');
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) { showError(err.message); }
    finally { setSubmitting(false); }
  };

  // ─── workflow actions ─────────────────────────────────────────────
  const poAction = async (id: number, path: string, bodyExtra?: object, confirm?: { title: string; message: string; variant?: 'danger' | 'info' | 'warning' }) => {
    if (confirm && !(await confirmAsync({ title: confirm.title, message: confirm.message, variant: confirm.variant || 'info' }))) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/purchase-orders/${id}/${path}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, ...bodyExtra })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      fetchData();
      return true;
    } catch (err: any) { showError(err.message); return false; }
  };

  const handleSubmit = (id: number) => poAction(id, 'submit', {}, { title: 'Submit for Approval', message: 'Submit this PO for manager approval?' });
  const handleApprove = (id: number) => poAction(id, 'approve', {}, { title: 'Approve PO', message: 'Approve this purchase order?' });
  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection?');
    if (reason === null) return;
    await poAction(id, 'reject', { reason }, { title: 'Reject PO', message: 'Reject this purchase order?', variant: 'danger' });
    showSuccess('PO rejected');
  };
  const handleSend = (id: number) => poAction(id, 'send', {}, { title: 'Send to Supplier', message: 'Mark this PO as sent to supplier? This will allow goods receipt.' });
  const handleCancel = async (id: number) => {
    const reason = prompt('Reason for cancellation?');
    if (reason === null) return;
    const ok = await poAction(id, 'cancel', { reason }, { title: 'Cancel PO', message: 'Cancel this purchase order?', variant: 'danger' });
    if (ok) showSuccess('PO cancelled');
  };

  const viewDetails = async (id: number) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/purchase-orders/${id}`);
      if (res.ok) { setSelectedOrder(await res.json()); setShowDetailModal(true); }
    } catch { showError('Failed to load PO details'); }
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    return (o.poNumber.toLowerCase().includes(q) || o.supplier.name.toLowerCase().includes(q))
      && (!statusFilter || o.status === statusFilter);
  });

  // ─── export config ────────────────────────────────────────────────
  const fmtPO   = (n: number) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';

  const totalPOValue     = filtered.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const totalPOQty       = filtered.reduce((s, o) => s + (o.items || []).reduce((s2, it) => s2 + it.quantity, 0), 0);
  const totalReceivedQty = filtered.reduce((s, o) => s + (o.items || []).reduce((s2, it) => s2 + (it.receivedQuantity || 0), 0), 0);
  const supplierSet      = new Set(filtered.map(o => o.supplier?.name).filter(Boolean));

  const poItemRows = filtered.flatMap((o, oi) =>
    (o.items || []).map((it, idx) => ({
      no: oi * 1000 + idx + 1, poNumber: o.poNumber, supplier: o.supplier?.name || '—',
      status: o.status, orderDate: fmtDate(o.orderDate), expectedDate: fmtDate(o.expectedDate),
      product: it.product?.name || `#${it.productId}`, sku: it.product?.sku || '—',
      orderedQty: it.quantity, receivedQty: it.receivedQuantity || 0,
      remaining: it.quantity - (it.receivedQuantity || 0),
      price: it.purchasePrice, lineTotal: it.quantity * it.purchasePrice,
      createdBy: o.createdBy || '—'
    }))
  );

  const poExportConfig: ExportOptions = {
    title: 'Purchase Orders Report',
    subtitle: `Exported: ${new Date().toLocaleDateString('en-GB')} · ${filtered.length} POs · ${supplierSet.size} supplier(s)${statusFilter ? ` · Filter: ${statusFilter}` : ''}`,
    filename: `purchase_orders_${new Date().toISOString().slice(0, 10)}`,
    orientation: 'landscape',
    summary: [
      { label: 'Total POs',    value: filtered.length },
      { label: 'Qty Ordered',  value: totalPOQty.toLocaleString() },
      { label: 'Qty Received', value: totalReceivedQty.toLocaleString() },
      { label: 'Total Value',  value: fmtPO(totalPOValue) },
    ],
    columns: [
      { key: 'no',          label: '#',           align: 'center', width: 8  },
      { key: 'poNumber',    label: 'PO #',                         width: 26 },
      { key: 'supplier',    label: 'Supplier',                     width: 36 },
      { key: 'status',      label: 'Status',      align: 'center', width: 20 },
      { key: 'orderDate',   label: 'Order Date',                   width: 22 },
      { key: 'expectedDate',label: 'Expected',                     width: 22 },
      { key: 'product',     label: 'Product',                      width: 44 },
      { key: 'sku',         label: 'SKU',                          width: 22 },
      { key: 'orderedQty',  label: 'Ordered',     align: 'center', width: 16 },
      { key: 'receivedQty', label: 'Received',    align: 'center', width: 16 },
      { key: 'remaining',   label: 'Pending',     align: 'center', width: 16 },
      { key: 'price',       label: 'Unit Price',  align: 'right',  width: 22, format: (v: number) => fmtPO(v) },
      { key: 'lineTotal',   label: 'Line Total',  align: 'right',  width: 24, format: (v: number) => fmtPO(v) },
      { key: 'createdBy',   label: 'Created By',                   width: 24 },
    ],
    data: poItemRows,
    totalsRows: [
      { label: 'Total Qty Ordered',  value: totalPOQty.toLocaleString() },
      { label: 'Total Qty Received', value: totalReceivedQty.toLocaleString(), bold: true },
      { label: 'TOTAL PO VALUE',     value: fmtPO(totalPOValue), accent: true },
    ],
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
      <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>Loading Purchase Orders...
    </div>
  );

  // ─── status badge ─────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: string }) => {
    const m = STATUS_META[status] || { label: status, bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    return (
      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 600, background: m.bg, color: m.color }}>
        {m.label}
      </span>
    );
  };

  // ─── create/edit form modal ───────────────────────────────────────
  const FormModal = () => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', padding: '1.25rem 2rem', borderRadius: '20px', background: 'rgba(17,24,39,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', position: 'relative', maxHeight: '90vh', overflow: 'auto' }}>
        <button onClick={() => setShowCreateModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        <h2 className="text-gradient" style={{ fontSize: '1.5rem', margin: '0 0 1rem 0', fontWeight: 800 }}>
          {editingOrder ? `Edit PO: ${editingOrder.poNumber}` : 'Create Purchase Order'}
        </h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Supplier *</label>
              <select className="form-control" value={createForm.supplierId} onChange={e => setCreateForm(f => ({ ...f, supplierId: e.target.value }))} required>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Expected Date</label>
              <input type="date" className="form-control" value={createForm.expectedDate} onChange={e => setCreateForm(f => ({ ...f, expectedDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes</label>
            <textarea className="form-control" style={{ minHeight: '50px', resize: 'none' }} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#93bbfc' }}>Order Items</span>
              <button type="button" className="btn-secondary" onClick={addItem} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>+ Add Item</button>
            </div>
            {createForm.items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Product</label>
                  <select className="form-control" value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)} required style={{ padding: '0.3rem', fontSize: '0.75rem' }}>
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Quantity</label>
                  <input type="number" min="1" className="form-control" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} required style={{ padding: '0.3rem', fontSize: '0.75rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Unit Price</label>
                  <input type="number" step="0.01" min="0" className="form-control" value={item.purchasePrice} onChange={e => updateItem(idx, 'purchasePrice', e.target.value)} required style={{ padding: '0.3rem', fontSize: '0.75rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Subtotal</label>
                  <div style={{ padding: '0.3rem', fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>
                    ${((parseFloat(item.quantity) || 0) * (parseFloat(item.purchasePrice) || 0)).toFixed(2)}
                  </div>
                </div>
                <button type="button" onClick={() => removeItem(idx)} disabled={createForm.items.length === 1} className="btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: '#ef4444' }}>×</button>
              </div>
            ))}
            <div style={{ textAlign: 'right', marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(16,185,129,0.1)', borderRadius: '6px' }}>
              <span style={{ color: '#6ee7b7', fontWeight: 700, fontSize: '0.9rem' }}>Total: ${calculateTotal().toFixed(2)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? (editingOrder ? 'Saving...' : 'Creating...') : (editingOrder ? 'Save Changes' : 'Create PO')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // ─── detail modal ─────────────────────────────────────────────────
  const DetailModal = () => {
    const o = selectedOrder!;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', padding: '1.25rem 2rem', borderRadius: '20px', background: 'rgba(17,24,39,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', position: 'relative', maxHeight: '90vh', overflow: 'auto' }}>
          <button onClick={() => setShowDetailModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.5rem', margin: 0, fontWeight: 800 }}>{o.poNumber}</h2>
            <StatusBadge status={o.status} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>Supplier: {o.supplier.name}</p>

          {/* Workflow trail */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
            {[
              { label: 'Created by', val: o.createdBy, date: o.orderDate },
              o.submittedBy ? { label: 'Submitted by', val: o.submittedBy, date: o.submittedAt } : null,
              o.approvedBy  ? { label: 'Approved by',  val: o.approvedBy,  date: o.approvedAt  } : null,
              o.rejectedBy  ? { label: 'Rejected by',  val: o.rejectedBy,  date: o.rejectedAt  } : null,
              o.sentBy      ? { label: 'Sent by',      val: o.sentBy,      date: o.sentAt      } : null,
              { label: 'Expected', val: fmtDate(o.expectedDate) },
            ].filter(Boolean).map((item: any, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600, marginBottom: '0.2rem' }}>{item.label.toUpperCase()}</div>
                <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{item.val || '—'}</div>
                {item.date && item.label !== 'Expected' && <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{fmtDate(item.date)}</div>}
              </div>
            ))}
          </div>

          {o.rejectionReason && (
            <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}>
              <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 600 }}>Rejection reason: </span>
              <span style={{ fontSize: '0.8rem' }}>{o.rejectionReason}</span>
            </div>
          )}

          <h3 style={{ color: '#fff', fontSize: '0.95rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>Items</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                <th style={{ padding: '0.4rem', textAlign: 'left' }}>Product</th>
                <th style={{ padding: '0.4rem', textAlign: 'right' }}>Ordered</th>
                <th style={{ padding: '0.4rem', textAlign: 'right' }}>Received</th>
                <th style={{ padding: '0.4rem', textAlign: 'right' }}>Unit Price</th>
                <th style={{ padding: '0.4rem', textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map(it => (
                <tr key={it.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.5rem 0.4rem' }}>{it.product.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({it.product.sku})</span></td>
                  <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>{it.quantity}</td>
                  <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>
                    <span style={{ color: it.receivedQuantity === it.quantity ? '#6ee7b7' : it.receivedQuantity > 0 ? '#fde047' : 'var(--text-muted)' }}>
                      {it.receivedQuantity} / {it.quantity}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>${it.purchasePrice.toFixed(2)}</td>
                  <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>${(it.quantity * it.purchasePrice).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', fontWeight: 700 }}>
                <td colSpan={4} style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>Total:</td>
                <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', color: '#6ee7b7' }}>${o.totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          {o.notes && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>NOTES</span>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem' }}>{o.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── render ───────────────────────────────────────────────────────
  return (
    <div className="dashboard-container employee-page-shell">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0 }}>Purchase Orders</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.15rem 0 0 0' }}>
            Draft → Submit → Manager Approval → Send to Supplier → Receive
          </p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={openCreate} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>+ New PO</button>
        )}
      </header>

      {/* workflow legend */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {Object.entries(STATUS_META).map(([k, v]) => (
          <span key={k} style={{ padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.62rem', fontWeight: 600, background: v.bg, color: v.color, cursor: 'pointer', border: statusFilter === k ? `1px solid ${v.color}` : '1px solid transparent' }} onClick={() => setStatusFilter(f => f === k ? '' : k)}>
            {v.label} ({orders.filter(o => o.status === k).length})
          </span>
        ))}
        {statusFilter && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', cursor: 'pointer', alignSelf: 'center', marginLeft: '0.25rem' }} onClick={() => setStatusFilter('')}>✕ clear</span>}
      </div>

      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <ReportExportToolbar exportOptions={poExportConfig} variant="compact" disabled={filtered.length === 0} />
      </div>

      <div className="employee-grid" style={{ flex: 1, minHeight: 0 }}>
      <div className="glass-panel employee-list-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input type="text" placeholder="Search PO number, supplier..." className="form-control"
            style={{ maxWidth: '280px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: '180px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div className="customer-mobile-search-results">
          {filtered.length > 0 ? filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage).map(o => (
            <div key={o.id} className="customer-mobile-search-item" onClick={() => viewDetails(o.id)}>
              <div>
                <strong style={{ color: 'var(--accent-hover)', fontSize: '0.85rem' }}>{o.poNumber}</strong>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {o.supplier.name} · {fmtDate(o.orderDate)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>${o.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 600, background: (STATUS_META[o.status] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }).bg, color: (STATUS_META[o.status] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }).color }}>
                  {(STATUS_META[o.status] || { label: o.status }).label}
                </span>
              </div>
            </div>
          )) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>No purchase orders found.</p>
          )}
        </div>

        <div className="table-wrap employee-list-scroll customer-table-desktop-only">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <th style={{ padding: '0.5rem 0.4rem' }}>PO NUMBER</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>SUPPLIER</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>DATE</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>EXPECTED</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>TOTAL</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>STATUS</th>
                <th style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage).map(o => (
                <tr key={o.id} onClick={() => viewDetails(o.id)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem', cursor: 'pointer', transition: 'background 0.12s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '0.6rem 0.4rem' }}><strong style={{ color: 'var(--accent-hover)' }}>{o.poNumber}</strong></td>
                  <td style={{ padding: '0.6rem 0.4rem' }}>{o.supplier.name}</td>
                  <td style={{ padding: '0.6rem 0.4rem' }}>{fmtDate(o.orderDate)}</td>
                  <td style={{ padding: '0.6rem 0.4rem' }}>{fmtDate(o.expectedDate)}</td>
                  <td style={{ padding: '0.6rem 0.4rem' }}>${o.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '0.6rem 0.4rem' }}><StatusBadge status={o.status} /></td>
                  <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'inline-flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* Draft actions */}
                      {o.status === 'Draft' && canManage && (
                        <button className="btn-secondary" onClick={() => openEdit(o)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>Edit</button>
                      )}
                      {o.status === 'Draft' && canManage && (
                        <button className="btn-secondary" onClick={() => handleSubmit(o.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(96,165,250,0.3)', color: '#93bbfc' }}>Submit</button>
                      )}

                      {/* Submitted actions — manager approves/rejects */}
                      {o.status === 'Submitted' && isManager && (
                        <button className="btn-secondary" onClick={() => handleApprove(o.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>Approve</button>
                      )}
                      {o.status === 'Submitted' && isManager && (
                        <button className="btn-secondary" onClick={() => handleReject(o.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>Reject</button>
                      )}

                      {/* Manager_Approved — finance/manager sends to supplier */}
                      {o.status === 'Manager_Approved' && canApprove && (
                        <button className="btn-secondary" onClick={() => handleSend(o.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee' }}>Send to Supplier</button>
                      )}

                      {/* Sent / Partial_Received — shortcut to record purchase */}
                      {(o.status === 'Sent' || o.status === 'Partial_Received') && (
                        <button className="btn-secondary" onClick={() => router.push(`/purchasing/purchases?fromPO=${o.id}`)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>Record Purchase</button>
                      )}
                      {o.status === 'Manager_Approved' && isManager && (
                        <button className="btn-secondary" onClick={() => handleReject(o.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>Reject</button>
                      )}

                      {/* Cancel — available on anything not terminal */}
                      {!['Received', 'Cancelled', 'Rejected'].includes(o.status) && canApprove && (
                        <button className="btn-secondary" onClick={() => handleCancel(o.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(239,68,68,0.12)', color: '#ef4444' }}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No purchase orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > rowsPerPage && (
          <div className="customer-table-desktop-only" style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
            <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 0.4rem' }}>{page} / {Math.ceil(filtered.length / rowsPerPage)}</span>
            <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={page >= Math.ceil(filtered.length / rowsPerPage)} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
      </div>

      {showCreateModal && <FormModal />}
      {showDetailModal && selectedOrder && <DetailModal />}
    </div>
  );
}
