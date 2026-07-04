'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { showSuccess, showError } from '../../../lib/toast';
import ReportExportToolbar from '../../../components/ReportExportToolbar';
import { type ExportOptions } from '../../../lib/exportUtils';

interface Supplier { id: number; name: string; }
interface Product  { id: number; name: string; sku: string; price: number; }

interface POItem {
  id: number; productId: number; quantity: number;
  purchasePrice: number; receivedQuantity: number;
  product: { id: number; name: string; sku: string };
}
interface PurchaseOrder {
  id: number; poNumber: string; supplierId: number; status: string;
  totalAmount: number; supplier: Supplier; items: POItem[];
}

interface ReceiptItem {
  purchaseOrderItemId: number | null;
  productId: number; productName: string; productSku: string;
  orderedQty: number; remainingQty: number;
  quantity: string; purchasePrice: string; batchNumber: string; expiryDate: string;
}

interface DirectItem {
  productId: string; quantity: string; purchasePrice: string;
  batchNumber: string; expiryDate: string;
}

interface Purchase {
  id: number; receiptNumber: string; purchaseType: string;
  purchaseOrderId: number | null; supplierId: number;
  supplierInvoiceNo: string | null; receivedDate: string;
  receivedBy: string | null; notes: string | null; createdAt: string;
  isVoided: boolean; voidedBy: string | null; voidedAt: string | null; voidReason: string | null;
  supplier: Supplier;
  purchaseOrder: { id: number; poNumber: string } | null;
  items: Array<{
    id: number; productId: number; batchNumber: string;
    quantity: number; purchasePrice: number; expiryDate: string | null;
    product: { name: string; sku: string };
    batch: { id: number; quantity: number; initialQuantity: number } | null;
  }>;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const fmtDate  = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const genBatch = () => `BAT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const TypeBadge = ({ type }: { type: string }) => (
  <span style={{
    padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.62rem', fontWeight: 600,
    background: type === 'Direct' ? 'rgba(251,191,36,0.15)' : 'rgba(96,165,250,0.12)',
    color:      type === 'Direct' ? '#fbbf24'              : '#93bbfc'
  }}>
    {type === 'Direct' ? 'Direct' : 'From PO'}
  </span>
);

export default function PurchasesPage() {
  return (
    <Suspense fallback={null}>
      <PurchasesPageInner />
    </Suspense>
  );
}

function PurchasesPageInner() {
  const router = useRouter();
  const [purchases, setPurchases]   = useState<Purchase[]>([]);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [products,  setProducts]    = useState<Product[]>([]);
  const [openPOs,   setOpenPOs]     = useState<PurchaseOrder[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [page,        setPage]        = useState(1);
  const rowsPerPage = 10;

  const [showFilterModal, setShowFilterModal] = useState(false);
  // pending filter state (applied only on "Apply")
  const [pendingSearch,   setPendingSearch]   = useState('');
  const [pendingType,     setPendingType]     = useState('');
  const [pendingSupplier, setPendingSupplier] = useState('');
  const [pendingDateFrom, setPendingDateFrom] = useState('');
  const [pendingDateTo,   setPendingDateTo]   = useState('');

  // create modal state
  const [showModal,   setShowModal]   = useState(false);
  const [createTab,   setCreateTab]   = useState<'po'|'direct'>('po');
  const [preloadPOId, setPreloadPOId] = useState<number | null>(null); // for shortcut

  // From-PO flow
  const [selectedPO,    setSelectedPO]    = useState<PurchaseOrder | null>(null);
  const [receiptItems,  setReceiptItems]  = useState<ReceiptItem[]>([]);
  const [poNotes,       setPoNotes]       = useState('');

  // Direct flow
  const [directSupplierId,  setDirectSupplierId]  = useState('');
  const [directInvoiceNo,   setDirectInvoiceNo]   = useState('');
  const [directDate,        setDirectDate]         = useState('');
  const [directNotes,       setDirectNotes]        = useState('');
  const [directItems,       setDirectItems]        = useState<DirectItem[]>([
    { productId: '', quantity: '', purchasePrice: '', batchNumber: genBatch(), expiryDate: '' }
  ]);

  // detail modal
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);

  // edit modal
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [editDate,        setEditDate]        = useState('');
  const [editNotes,       setEditNotes]       = useState('');
  const [editInvoiceNo,   setEditInvoiceNo]   = useState('');
  const [editItemQtys,    setEditItemQtys]    = useState<Record<number, string>>({});
  const [editSubmitting,  setEditSubmitting]  = useState(false);

  const [userRole,    setUserRole]    = useState('store_user');
  const [currentUser, setCurrentUser] = useState('System User');

  const searchParams = useSearchParams();

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) try { const p = JSON.parse(u); setCurrentUser(p.username || 'System User'); setUserRole(p.role || 'store_user'); } catch {}
    const fromPO = searchParams.get('fromPO');
    fetchData().then(() => {
      if (fromPO) openCreate('po', parseInt(fromPO));
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purRes, supRes, prodRes, poRes] = await Promise.all([
        apiFetch('http://localhost:5000/api/purchase-receipts'),
        apiFetch('http://localhost:5000/api/suppliers'),
        apiFetch('http://localhost:5000/api/inventory/products'),
        apiFetch('http://localhost:5000/api/purchase-orders?status=Sent'),
      ]);
      if (purRes.ok)  { const d = await purRes.json();  setPurchases(d.data || d); }
      if (supRes.ok)  setSuppliers(await supRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (poRes.ok)   { const d = await poRes.json(); setOpenPOs((d.data || d).filter((o: PurchaseOrder) => ['Sent','Partial_Received'].includes(o.status))); }
    } catch {}
    finally { setLoading(false); }
  };

  const role = userRole.toLowerCase();
  const isAdmin   = role === 'admin' || role === 'administrator';
  const isManager = role === 'manager' || isAdmin;
  const isFinance = role === 'finance' || isManager;
  const canCreate = isManager || isFinance || role === 'store_user';
  const canDirect = isManager || isFinance;

  // ─── open modal ────────────────────────────────────────────────────────────
  const openCreate = (tab: 'po'|'direct' = 'po', poId?: number) => {
    setCreateTab(tab);
    setSelectedPO(null); setReceiptItems([]); setPoNotes('');
    setDirectSupplierId(''); setDirectInvoiceNo(''); setDirectDate(''); setDirectNotes('');
    setDirectItems([{ productId: '', quantity: '', purchasePrice: '', batchNumber: genBatch(), expiryDate: '' }]);
    setShowModal(true);
    if (poId) { setPreloadPOId(poId); loadPO(poId); }
    else setPreloadPOId(null);
  };

  const loadPO = async (poId: number) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/purchase-orders/${poId}`);
      if (!res.ok) return;
      const po: PurchaseOrder = await res.json();
      setSelectedPO(po);
      setReceiptItems(po.items.map(it => ({
        purchaseOrderItemId: it.id,
        productId: it.productId,
        productName: it.product.name,
        productSku: it.product.sku,
        orderedQty: it.quantity,
        remainingQty: it.quantity - it.receivedQuantity,
        quantity: '',
        purchasePrice: it.purchasePrice.toString(),
        batchNumber: genBatch(),
        expiryDate: ''
      })));
    } catch { showError('Failed to load PO'); }
  };

  // ─── Direct item helpers ────────────────────────────────────────────────────
  const addDirectItem = () => setDirectItems(i => [...i, { productId: '', quantity: '', purchasePrice: '', batchNumber: genBatch(), expiryDate: '' }]);
  const removeDirectItem = (idx: number) => setDirectItems(i => i.filter((_, j) => j !== idx));
  const updateDirectItem = (idx: number, field: keyof DirectItem, val: string) => {
    setDirectItems(items => {
      const next = [...items];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'productId' && val) {
        const p = products.find(p => p.id === parseInt(val));
        if (p) next[idx].purchasePrice = (p.price * 0.6).toFixed(2);
      }
      return next;
    });
  };

  const directTotal = directItems.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.purchasePrice) || 0), 0);

  // ─── Submit From-PO ────────────────────────────────────────────────────────
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;
    const valid = receiptItems.filter(it => parseInt(it.quantity) > 0);
    if (valid.length === 0) { showError('Enter quantity for at least one item'); return; }
    for (const it of valid) {
      if (parseInt(it.quantity) > it.remainingQty) { showError(`Qty for ${it.productName} exceeds remaining (${it.remainingQty})`); return; }
      if (!it.batchNumber.trim()) { showError(`Batch number required for ${it.productName}`); return; }
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('http://localhost:5000/api/purchase-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'PO_Backed',
          purchaseOrderId: selectedPO.id,
          supplierId: selectedPO.supplierId,
          notes: poNotes,
          receivedBy: currentUser,
          items: valid.map(it => ({
            purchaseOrderItemId: it.purchaseOrderItemId,
            productId: it.productId,
            batchNumber: it.batchNumber,
            quantity: parseInt(it.quantity),
            purchasePrice: parseFloat(it.purchasePrice),
            expiryDate: it.expiryDate || null
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showSuccess('Purchase recorded — inventory updated.');
      setShowModal(false);
      fetchData();
    } catch (err: any) { showError(err.message); }
    finally { setSubmitting(false); }
  };

  // ─── Submit Direct ─────────────────────────────────────────────────────────
  const handleSubmitDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directSupplierId) { showError('Select a supplier'); return; }
    if (!directInvoiceNo.trim()) { showError('Supplier invoice number is required'); return; }
    const valid = directItems.filter(it => it.productId && it.quantity && it.purchasePrice);
    if (valid.length === 0) { showError('Add at least one item'); return; }
    setSubmitting(true);
    try {
      const res = await apiFetch('http://localhost:5000/api/purchase-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'Direct',
          supplierId: parseInt(directSupplierId),
          supplierInvoiceNo: directInvoiceNo.trim(),
          receivedDate: directDate || null,
          notes: directNotes,
          receivedBy: currentUser,
          items: valid.map(it => ({
            productId: parseInt(it.productId),
            batchNumber: it.batchNumber,
            quantity: parseInt(it.quantity),
            purchasePrice: parseFloat(it.purchasePrice),
            expiryDate: it.expiryDate || null
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showSuccess('Direct purchase recorded — inventory updated.');
      setShowModal(false);
      fetchData();
    } catch (err: any) { showError(err.message); }
    finally { setSubmitting(false); }
  };

  // ─── Void ─────────────────────────────────────────────────────────────────
  const handleVoid = async (p: Purchase) => {
    const reason = prompt(`Void purchase ${p.receiptNumber}?\n\nThis will reverse all inventory added by this purchase.\nEnter reason for voiding:`);
    if (reason === null) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/purchase-receipts/${p.id}/void`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: reason, username: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to void');
      showSuccess('Purchase voided — inventory reversed.');
      setDetailPurchase(null);
      fetchData();
    } catch (err: any) { showError(err.message); }
  };

  // ─── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (p: Purchase) => {
    setEditPurchase(p);
    setEditDate(p.receivedDate ? p.receivedDate.slice(0, 10) : '');
    setEditNotes(p.notes || '');
    setEditInvoiceNo(p.supplierInvoiceNo || '');
    const qtys: Record<number, string> = {};
    p.items.forEach(it => { qtys[it.id] = String(it.quantity); });
    setEditItemQtys(qtys);
    setDetailPurchase(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPurchase) return;
    setEditSubmitting(true);
    try {
      const isDirect = editPurchase.purchaseType === 'Direct';
      const body: any = {
        receivedDate: editDate || null,
        notes: editNotes,
        username: currentUser,
      };
      if (isDirect) {
        body.supplierInvoiceNo = editInvoiceNo;
        body.items = editPurchase.items.map(it => ({ id: it.id, quantity: editItemQtys[it.id] ?? String(it.quantity) }));
      }
      const res = await apiFetch(`http://localhost:5000/api/purchase-receipts/${editPurchase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      showSuccess('Purchase updated — inventory adjusted.');
      setEditPurchase(null);
      fetchData();
    } catch (err: any) { showError(err.message); }
    finally { setEditSubmitting(false); }
  };

  // ─── Reactivate ────────────────────────────────────────────────────────────
  const handleReactivate = async (p: Purchase) => {
    if (!window.confirm(`Reactivate ${p.receiptNumber}?\n\nThis will restore the inventory that was reversed when the purchase was voided.`)) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/purchase-receipts/${p.id}/reactivate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reactivate');
      showSuccess('Purchase reactivated — inventory restored.');
      setDetailPurchase(null);
      fetchData();
    } catch (err: any) { showError(err.message); }
  };

  // ─── filter + export ───────────────────────────────────────────────────────
  const activeFilterCount = [search, typeFilter, supplierFilter, dateFrom, dateTo].filter(Boolean).length;

  const openFilterModal = () => {
    setPendingSearch(search); setPendingType(typeFilter);
    setPendingSupplier(supplierFilter); setPendingDateFrom(dateFrom); setPendingDateTo(dateTo);
    setShowFilterModal(true);
  };
  const applyFilters = () => {
    setSearch(pendingSearch); setTypeFilter(pendingType);
    setSupplierFilter(pendingSupplier); setDateFrom(pendingDateFrom); setDateTo(pendingDateTo);
    setPage(1); setShowFilterModal(false);
  };
  const clearFilters = () => {
    setSearch(''); setTypeFilter(''); setSupplierFilter(''); setDateFrom(''); setDateTo('');
    setPendingSearch(''); setPendingType(''); setPendingSupplier(''); setPendingDateFrom(''); setPendingDateTo('');
    setPage(1); setShowFilterModal(false);
  };

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.receiptNumber.toLowerCase().includes(q) ||
      p.supplier.name.toLowerCase().includes(q) ||
      (p.purchaseOrder?.poNumber || '').toLowerCase().includes(q) ||
      (p.supplierInvoiceNo || '').toLowerCase().includes(q);
    const matchT = !typeFilter || p.purchaseType === typeFilter;
    const matchS = !supplierFilter || p.supplierId === parseInt(supplierFilter);
    const matchFrom = !dateFrom || new Date(p.receivedDate) >= new Date(dateFrom);
    const matchTo   = !dateTo   || new Date(p.receivedDate) <= new Date(dateTo + 'T23:59:59');
    return matchQ && matchT && matchS && matchFrom && matchTo;
  });

  const rows = filtered.flatMap((p, pi) =>
    (p.items || []).map((it, idx) => ({
      no: pi * 1000 + idx + 1,
      receiptNum: p.receiptNumber,
      type: p.purchaseType,
      poNumber: p.purchaseOrder?.poNumber || '—',
      supplierInvoice: p.supplierInvoiceNo || '—',
      supplier: p.supplier?.name || '—',
      product: it.product?.name || `#${it.productId}`,
      sku: it.product?.sku || '—',
      batch: it.batchNumber,
      qty: it.quantity,
      price: it.purchasePrice,
      subtotal: it.quantity * it.purchasePrice,
      expiry: fmtDate(it.expiryDate),
      receivedDate: fmtDate(p.receivedDate),
      receivedBy: p.receivedBy || 'System',
    }))
  );

  const totalValue = filtered.reduce((s, p) => s + (p.items || []).reduce((s2, it) => s2 + it.quantity * it.purchasePrice, 0), 0);
  const totalQty   = filtered.reduce((s, p) => s + (p.items || []).reduce((s2, it) => s2 + it.quantity, 0), 0);

  const exportConfig: ExportOptions = {
    title: 'Purchases Report',
    subtitle: `Exported: ${new Date().toLocaleDateString('en-GB')} · ${filtered.length} purchases`,
    filename: `purchases_${new Date().toISOString().slice(0, 10)}`,
    orientation: 'landscape',
    summary: [
      { label: 'Purchases',   value: filtered.length },
      { label: 'Total Qty',   value: totalQty.toLocaleString() },
      { label: 'Total Value', value: fmtMoney(totalValue) },
    ],
    columns: [
      { key: 'no',             label: '#',             align: 'center', width: 8  },
      { key: 'receiptNum',     label: 'Purchase #',                     width: 28 },
      { key: 'type',           label: 'Type',          align: 'center', width: 16 },
      { key: 'poNumber',       label: 'PO #',                           width: 22 },
      { key: 'supplierInvoice',label: 'Supplier Inv',                   width: 20 },
      { key: 'supplier',       label: 'Supplier',                       width: 34 },
      { key: 'product',        label: 'Product',                        width: 40 },
      { key: 'sku',            label: 'SKU',                            width: 18 },
      { key: 'batch',          label: 'Batch #',                        width: 20 },
      { key: 'qty',            label: 'Qty',           align: 'center', width: 12 },
      { key: 'price',          label: 'Unit Price',    align: 'right',  width: 18, format: (v: number) => fmtMoney(v) },
      { key: 'subtotal',       label: 'Subtotal',      align: 'right',  width: 20, format: (v: number) => fmtMoney(v) },
      { key: 'expiry',         label: 'Expiry',                         width: 18 },
      { key: 'receivedDate',   label: 'Date',                           width: 18 },
      { key: 'receivedBy',     label: 'By',                             width: 20 },
    ],
    data: rows,
    totalsRows: [
      { label: 'Total Qty',   value: totalQty.toLocaleString() },
      { label: 'TOTAL VALUE', value: fmtMoney(totalValue), accent: true },
    ],
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
      <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>Loading Purchases...
    </div>
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0 }}>Purchases</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.15rem 0 0 0' }}>
            Record goods received — from a Purchase Order or directly from supplier
          </p>
        </div>
        {canCreate && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canDirect && (
              <button className="btn-secondary" onClick={() => openCreate('direct')} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }}>
                + Direct Purchase
              </button>
            )}
            {openPOs.length > 0 && (
              <button className="btn-primary" onClick={() => openCreate('po')} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
                + From PO
              </button>
            )}
          </div>
        )}
      </header>

      {canCreate && openPOs.length === 0 && !canDirect && (
        <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', fontSize: '0.78rem', color: '#fbbf24' }}>
          No POs ready to receive against. A PO must go through Draft → Submit → Manager Approval → Send before it can be received here.
        </div>
      )}

      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <ReportExportToolbar exportOptions={exportConfig} variant="compact" disabled={filtered.length === 0} />
      </div>

      <div className="glass-panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
          <button className="btn-secondary" onClick={openFilterModal} style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem', border: activeFilterCount > 0 ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)', color: activeFilterCount > 0 ? 'var(--accent-hover)' : 'var(--text-muted)' }}>
            ⚙ Filters{activeFilterCount > 0 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '999px', padding: '0 0.4rem', fontSize: '0.65rem', fontWeight: 700 }}>{activeFilterCount}</span>}
          </button>
          {activeFilterCount > 0 && (
            <button className="btn-secondary" onClick={clearFilters} style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>✕ Clear</button>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                <th style={{ padding: '0.5rem 0.4rem' }}>PURCHASE #</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>TYPE</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>SUPPLIER</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>PO / INV #</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>ITEMS</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>TOTAL</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>DATE</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>BY</th>
                <th style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage).map(p => {
                const lineTotal = (p.items || []).reduce((s, it) => s + it.quantity * it.purchasePrice, 0);
                return (
                  <tr key={p.id} onClick={() => setDetailPurchase(p)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem', cursor: 'pointer', transition: 'background 0.12s', opacity: p.isVoided ? 0.55 : 1 }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '0.6rem 0.4rem' }}>
                      <strong style={{ color: p.isVoided ? 'var(--text-muted)' : 'var(--accent-hover)', textDecoration: p.isVoided ? 'line-through' : 'none' }}>{p.receiptNumber}</strong>
                      {p.isVoided && <span style={{ marginLeft: '0.4rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>VOID</span>}
                    </td>
                    <td style={{ padding: '0.6rem 0.4rem' }}><TypeBadge type={p.purchaseType} /></td>
                    <td style={{ padding: '0.6rem 0.4rem' }}>{p.supplier.name}</td>
                    <td style={{ padding: '0.6rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {p.purchaseType === 'PO_Backed' ? (p.purchaseOrder?.poNumber || '—') : (p.supplierInvoiceNo || '—')}
                    </td>
                    <td style={{ padding: '0.6rem 0.4rem' }}>
                      <span style={{ background: 'rgba(96,165,250,0.12)', color: '#93bbfc', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600 }}>
                        {p.items.length} item{p.items.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.4rem', color: p.isVoided ? 'var(--text-muted)' : '#6ee7b7', fontWeight: 600, textDecoration: p.isVoided ? 'line-through' : 'none' }}>{fmtMoney(lineTotal)}</td>
                    <td style={{ padding: '0.6rem 0.4rem', fontSize: '0.75rem' }}>{fmtDate(p.receivedDate)}</td>
                    <td style={{ padding: '0.6rem 0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.receivedBy || '—'}</td>
                    <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      {!p.isVoided && (
                        <button className="btn-secondary" onClick={() => openEdit(p)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>Edit</button>
                      )}
                      {p.isVoided && canDirect && (
                        <button className="btn-secondary" onClick={() => handleReactivate(p)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>Reactivate</button>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={9} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No purchases found.</td></tr>
              )}
            </tbody>
          </table>
          {filtered.length > rowsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
              <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 0.4rem' }}>{page} / {Math.ceil(filtered.length / rowsPerPage)}</span>
              <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={page >= Math.ceil(filtered.length / rowsPerPage)} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      {detailPurchase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '860px', padding: '1.5rem 2rem', borderRadius: '20px', background: 'rgba(17,24,39,0.98)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', maxHeight: '90vh', overflow: 'auto' }}>
            <button onClick={() => setDetailPurchase(null)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            {(() => {
              const hasConsumed = detailPurchase.items.some(it => it.batch && it.batch.quantity < it.batch.initialQuantity);
              return (
              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                <h2 className="text-gradient" style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, textDecoration: detailPurchase.isVoided ? 'line-through' : 'none' }}>{detailPurchase.receiptNumber}</h2>
                <TypeBadge type={detailPurchase.purchaseType} />
                {detailPurchase.isVoided && <span style={{ padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>VOIDED</span>}
                {hasConsumed && !detailPurchase.isVoided && <span style={{ padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>Inventory Sold</span>}
                {!detailPurchase.isVoided && (
                  <button className="btn-secondary" onClick={() => openEdit(detailPurchase)} style={{ marginLeft: 'auto', padding: '0.25rem 0.65rem', fontSize: '0.72rem', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>Edit</button>
                )}
                {!detailPurchase.isVoided && canDirect && (
                  <button className="btn-secondary" onClick={() => handleVoid(detailPurchase)} disabled={hasConsumed} title={hasConsumed ? 'Cannot void: inventory from this purchase has been sold' : ''} style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem', border: '1px solid rgba(239,68,68,0.3)', color: hasConsumed ? 'rgba(248,113,113,0.35)' : '#f87171', cursor: hasConsumed ? 'not-allowed' : 'pointer' }}>Void</button>
                )}
                {detailPurchase.isVoided && canDirect && (
                  <button className="btn-secondary" onClick={() => handleReactivate(detailPurchase)} style={{ marginLeft: 'auto', padding: '0.25rem 0.65rem', fontSize: '0.72rem', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>Reactivate</button>
                )}
              </div>
              {hasConsumed && !detailPurchase.isVoided && (
                <div style={{ marginBottom: '0.75rem', padding: '0.45rem 0.75rem', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', borderRadius: '7px', fontSize: '0.72rem', color: '#fbbf24' }}>
                  Some batches from this purchase have been sold. Void and quantity edits are locked. To correct, raise a manual inventory adjustment.
                </div>
              )}
              </>
            );
            })()}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>Supplier: {detailPurchase.supplier.name}</p>

            {detailPurchase.isVoided && (
              <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}>
                <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 600 }}>Voided by {detailPurchase.voidedBy} on {fmtDate(detailPurchase.voidedAt)}</span>
                {detailPurchase.voidReason && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> — {detailPurchase.voidReason}</span>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
              {[
                { label: 'DATE',        val: fmtDate(detailPurchase.receivedDate) },
                { label: 'BY',          val: detailPurchase.receivedBy || '—' },
                detailPurchase.purchaseType === 'PO_Backed'
                  ? { label: 'PO #',        val: detailPurchase.purchaseOrder?.poNumber || '—' }
                  : { label: 'SUPPLIER INV',val: detailPurchase.supplierInvoiceNo || '—' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: '0.15rem' }}>{item.val}</div>
                </div>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  <th style={{ padding: '0.4rem', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '0.4rem', textAlign: 'left' }}>Batch #</th>
                  <th style={{ padding: '0.4rem', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>Subtotal</th>
                  <th style={{ padding: '0.4rem', textAlign: 'center' }}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {detailPurchase.items.map(it => (
                  <tr key={it.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <span onClick={() => { setDetailPurchase(null); router.push(`/inventory/${it.productId}`); }} style={{ cursor: 'pointer', color: 'var(--accent-hover)', fontWeight: 600 }} title="Go to product">{it.product.name}</span>
                      {' '}<span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>({it.product.sku})</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.4rem', fontFamily: 'monospace', color: '#93bbfc', fontSize: '0.75rem' }}>{it.batchNumber}</td>
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', fontWeight: 600 }}>{it.quantity}</td>
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>{fmtMoney(it.purchasePrice)}</td>
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', color: '#6ee7b7', fontWeight: 600 }}>{fmtMoney(it.quantity * it.purchasePrice)}</td>
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', fontSize: '0.75rem', color: it.expiryDate && new Date(it.expiryDate) < new Date() ? '#fca5a5' : 'var(--text-muted)' }}>
                      {fmtDate(it.expiryDate)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>Total:</td>
                  <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', color: '#6ee7b7' }}>{fmtMoney(detailPurchase.items.reduce((s, it) => s + it.quantity * it.purchasePrice, 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            {detailPurchase.notes && (
              <div style={{ marginTop: '1rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>NOTES</div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem' }}>{detailPurchase.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '1000px', padding: '1.5rem 2rem', borderRadius: '20px', background: 'rgba(17,24,39,0.98)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', maxHeight: '92vh', overflow: 'auto' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            <h2 className="text-gradient" style={{ fontSize: '1.4rem', margin: '0 0 1rem 0', fontWeight: 800 }}>Record Purchase</h2>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden', width: 'fit-content' }}>
              <button onClick={() => setCreateTab('po')} style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: createTab === 'po' ? 'var(--accent)' : 'transparent', color: createTab === 'po' ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                From Purchase Order
              </button>
              {canDirect && (
                <button onClick={() => setCreateTab('direct')} style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: createTab === 'direct' ? 'rgba(251,191,36,0.85)' : 'transparent', color: createTab === 'direct' ? '#000' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                  Direct Purchase
                </button>
              )}
            </div>

            {/* ─── FROM PO TAB ──────────────────────────────────────── */}
            {createTab === 'po' && (
              <>
                {!selectedPO ? (
                  <div>
                    {openPOs.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No POs ready to receive. A PO must be Manager Approved → Sent first.
                      </div>
                    ) : (
                      <>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>Select a Purchase Order to receive against:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {openPOs.map(po => (
                            <div key={po.id} onClick={() => loadPO(po.id)} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ color: '#fff' }}>{po.poNumber}</strong>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{po.supplier.name}</span>
                                <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 600, background: po.status === 'Partial_Received' ? 'rgba(245,158,11,0.15)' : 'rgba(34,211,238,0.12)', color: po.status === 'Partial_Received' ? '#fde047' : '#22d3ee' }}>{po.status.replace('_', ' ')}</span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{po.items.length} items · {fmtMoney(po.totalAmount)}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSubmitPO} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)', borderRadius: '8px', padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: '#93bbfc' }}>{selectedPO.poNumber}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{selectedPO.supplier.name}</span>
                      </div>
                      <button type="button" className="btn-secondary" onClick={() => { setSelectedPO(null); setReceiptItems([]); }} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Change PO</button>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes</label>
                      <textarea className="form-control" style={{ minHeight: '44px', resize: 'none' }} value={poNotes} onChange={e => setPoNotes(e.target.value)} placeholder="Delivery notes..." />
                    </div>
                    <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                      <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.82rem', color: '#6ee7b7' }}>Items to Receive</div>
                      <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                            <th style={{ padding: '0.3rem', textAlign: 'left' }}>Product</th>
                            <th style={{ padding: '0.3rem', textAlign: 'right' }}>Ordered</th>
                            <th style={{ padding: '0.3rem', textAlign: 'right' }}>Remaining</th>
                            <th style={{ padding: '0.3rem', textAlign: 'right' }}>Qty Now</th>
                            <th style={{ padding: '0.3rem', textAlign: 'right' }}>Unit Cost</th>
                            <th style={{ padding: '0.3rem', textAlign: 'left' }}>Batch #</th>
                            <th style={{ padding: '0.3rem', textAlign: 'left' }}>Expiry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receiptItems.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '0.4rem 0.3rem' }}>
                                <div>{it.productName}</div>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{it.productSku}</div>
                              </td>
                              <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right' }}>{it.orderedQty}</td>
                              <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: it.remainingQty === 0 ? '#6ee7b7' : 'var(--text-muted)' }}>{it.remainingQty}</td>
                              <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right' }}>
                                <input type="number" min="0" max={it.remainingQty} className="form-control"
                                  value={it.quantity} placeholder="0"
                                  onChange={e => { const n = [...receiptItems]; n[idx].quantity = e.target.value; setReceiptItems(n); }}
                                  style={{ padding: '0.22rem', fontSize: '0.75rem', width: '100%', minWidth: '60px', textAlign: 'right' }} />
                              </td>
                              <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', fontSize: '0.78rem' }}>${it.purchasePrice}</td>
                              <td style={{ padding: '0.4rem 0.3rem' }}>
                                <input type="text" className="form-control" value={it.batchNumber}
                                  onChange={e => { const n = [...receiptItems]; n[idx].batchNumber = e.target.value; setReceiptItems(n); }}
                                  style={{ padding: '0.22rem', fontSize: '0.72rem', width: '100%', minWidth: '100px' }} />
                              </td>
                              <td style={{ padding: '0.4rem 0.3rem' }}>
                                <input type="date" className="form-control" value={it.expiryDate}
                                  onChange={e => { const n = [...receiptItems]; n[idx].expiryDate = e.target.value; setReceiptItems(n); }}
                                  style={{ padding: '0.22rem', fontSize: '0.72rem', width: '100%', minWidth: '110px' }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>{/* end scroll wrapper */}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.25rem' }}>
                      <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                      <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Confirm Receipt'}</button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* ─── DIRECT PURCHASE TAB ──────────────────────────────── */}
            {createTab === 'direct' && (
              <form onSubmit={handleSubmitDirect} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', fontSize: '0.75rem', color: '#fbbf24' }}>
                  Direct purchases bypass the PO workflow. Use for petty cash, urgent or walk-in supplier buys. A supplier invoice number is required for audit.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Supplier *</label>
                    <select className="form-control" value={directSupplierId} onChange={e => setDirectSupplierId(e.target.value)} required>
                      <option value="">Select supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Supplier Invoice # *</label>
                    <input type="text" className="form-control" value={directInvoiceNo} onChange={e => setDirectInvoiceNo(e.target.value)} placeholder="e.g. INV-2024-001" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Purchase Date</label>
                    <input type="date" className="form-control" value={directDate} onChange={e => setDirectDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes / Justification</label>
                  <textarea className="form-control" style={{ minHeight: '44px', resize: 'none' }} value={directNotes} onChange={e => setDirectNotes(e.target.value)} placeholder="Reason for direct purchase..." />
                </div>

                <div style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#fbbf24' }}>Items</span>
                    <button type="button" className="btn-secondary" onClick={addDirectItem} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>+ Add Item</button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                  {directItems.map((it, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr 1.2fr 1.2fr auto', gap: '0.4rem', marginBottom: '0.4rem', alignItems: 'end', minWidth: '620px' }}>
                      <div>
                        {idx === 0 && <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Product</label>}
                        <select className="form-control" value={it.productId} onChange={e => updateDirectItem(idx, 'productId', e.target.value)} required style={{ padding: '0.28rem', fontSize: '0.75rem' }}>
                          <option value="">Select product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
                      </div>
                      <div>
                        {idx === 0 && <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Qty</label>}
                        <input type="number" min="1" className="form-control" value={it.quantity} onChange={e => updateDirectItem(idx, 'quantity', e.target.value)} required style={{ padding: '0.28rem', fontSize: '0.75rem' }} />
                      </div>
                      <div>
                        {idx === 0 && <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Unit Price</label>}
                        <input type="number" step="0.01" min="0" className="form-control" value={it.purchasePrice} onChange={e => updateDirectItem(idx, 'purchasePrice', e.target.value)} required style={{ padding: '0.28rem', fontSize: '0.75rem' }} />
                      </div>
                      <div>
                        {idx === 0 && <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Batch #</label>}
                        <input type="text" className="form-control" value={it.batchNumber} onChange={e => updateDirectItem(idx, 'batchNumber', e.target.value)} required style={{ padding: '0.28rem', fontSize: '0.72rem' }} />
                      </div>
                      <div>
                        {idx === 0 && <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Expiry</label>}
                        <input type="date" className="form-control" value={it.expiryDate} onChange={e => updateDirectItem(idx, 'expiryDate', e.target.value)} style={{ padding: '0.28rem', fontSize: '0.72rem' }} />
                      </div>
                      <button type="button" onClick={() => removeDirectItem(idx)} disabled={directItems.length === 1} className="btn-secondary" style={{ padding: '0.28rem 0.45rem', fontSize: '0.7rem', color: '#ef4444', alignSelf: 'flex-end' }}>×</button>
                    </div>
                  ))}
                  </div>{/* end scroll wrapper */}
                  <div style={{ textAlign: 'right', marginTop: '0.4rem', padding: '0.4rem 0.5rem', background: 'rgba(16,185,129,0.08)', borderRadius: '6px' }}>
                    <span style={{ color: '#6ee7b7', fontWeight: 700, fontSize: '0.88rem' }}>Total: {fmtMoney(directTotal)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.25rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'rgba(251,191,36,0.85)', color: '#000' }} disabled={submitting}>
                    {submitting ? 'Saving...' : 'Record Direct Purchase'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      {editPurchase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '680px', padding: '1.5rem 2rem', borderRadius: '20px', background: 'rgba(17,24,39,0.98)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', maxHeight: '90vh', overflow: 'auto' }}>
            <button onClick={() => setEditPurchase(null)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            {(() => { const qtyLocked = editPurchase.items.some(it => it.batch && it.batch.quantity < it.batch.initialQuantity); return (
            <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: qtyLocked ? '0.5rem' : '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#fff' }}>Edit Purchase</h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{editPurchase.receiptNumber}</span>
              <TypeBadge type={editPurchase.purchaseType} />
            </div>
            {qtyLocked && (
              <div style={{ marginBottom: '1rem', padding: '0.45rem 0.75rem', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', fontSize: '0.72rem', color: '#fbbf24' }}>
                Quantities are locked — inventory from this purchase has been sold. You can still update date and notes.
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: editPurchase.purchaseType === 'Direct' ? '1fr 1fr' : '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Received Date</label>
                  <input type="date" className="form-control" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ fontSize: '0.82rem' }} />
                </div>
                {editPurchase.purchaseType === 'Direct' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Supplier Invoice # *</label>
                    <input type="text" className="form-control" value={editInvoiceNo} onChange={e => setEditInvoiceNo(e.target.value)} required style={{ fontSize: '0.82rem' }} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes</label>
                <textarea className="form-control" style={{ minHeight: '52px', resize: 'none', fontSize: '0.82rem' }} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>

              {/* Items — quantities editable for Direct, read-only for PO-backed */}
              <div style={{ background: editPurchase.purchaseType === 'Direct' ? 'rgba(251,191,36,0.04)' : 'rgba(96,165,250,0.04)', border: `1px solid ${editPurchase.purchaseType === 'Direct' ? 'rgba(251,191,36,0.15)' : 'rgba(96,165,250,0.12)'}`, borderRadius: '10px', padding: '0.75rem 1rem' }}>
                <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: editPurchase.purchaseType === 'Direct' ? '#fbbf24' : '#93bbfc' }}>Items</span>
                  {editPurchase.purchaseType !== 'Direct' && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Quantities locked for PO-backed purchases</span>
                  )}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                      <th style={{ padding: '0.3rem', textAlign: 'left' }}>Product</th>
                      <th style={{ padding: '0.3rem', textAlign: 'left' }}>Batch #</th>
                      <th style={{ padding: '0.3rem', textAlign: 'right' }}>Quantity</th>
                      <th style={{ padding: '0.3rem', textAlign: 'right' }}>Unit Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editPurchase.items.map(it => (
                      <tr key={it.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.4rem 0.3rem' }}>
                          <div style={{ fontWeight: 600 }}>{it.product.name}</div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{it.product.sku}</div>
                        </td>
                        <td style={{ padding: '0.4rem 0.3rem', fontFamily: 'monospace', color: '#93bbfc', fontSize: '0.75rem' }}>{it.batchNumber}</td>
                        <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right' }}>
                          {editPurchase.purchaseType === 'Direct' && !qtyLocked ? (
                            <input type="number" min="1" className="form-control"
                              value={editItemQtys[it.id] ?? String(it.quantity)}
                              onChange={e => setEditItemQtys(q => ({ ...q, [it.id]: e.target.value }))}
                              style={{ padding: '0.22rem', fontSize: '0.78rem', width: '80px', textAlign: 'right' }} />
                          ) : (
                            <span style={{ fontWeight: 600, color: it.batch && it.batch.quantity < it.batch.initialQuantity ? '#fbbf24' : '#fff' }}>{it.quantity}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right' }}>{fmtMoney(it.purchasePrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editPurchase.purchaseType === 'Direct' && (
                  <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.5rem', background: 'rgba(16,185,129,0.08)', borderRadius: '6px', textAlign: 'right' }}>
                    <span style={{ color: '#6ee7b7', fontWeight: 700, fontSize: '0.85rem' }}>
                      Total: {fmtMoney(editPurchase.items.reduce((s, it) => s + (parseFloat(editItemQtys[it.id] ?? String(it.quantity)) || 0) * it.purchasePrice, 0))}
                    </span>
                  </div>
                )}
              </div>

              {editPurchase.purchaseType === 'Direct' && (
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '8px', fontSize: '0.72rem', color: '#fbbf24' }}>
                  Changing quantities will log inventory adjustments automatically. Reducing below what's been sold will be blocked.
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditPurchase(null)} disabled={editSubmitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
            </> ); })()}
          </div>
        </div>
      )}

      {/* ── Filter Modal ─────────────────────────────────────────────────────── */}
      {showFilterModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', borderRadius: '20px', background: 'rgba(17,24,39,0.98)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
            <button onClick={() => setShowFilterModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}>&times;</button>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.25rem 0', color: '#fff' }}>Filter Purchases</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SEARCH</label>
                <input type="text" className="form-control" placeholder="Purchase #, supplier, PO, invoice..." value={pendingSearch} onChange={e => setPendingSearch(e.target.value)} style={{ fontSize: '0.82rem' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TYPE</label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {[{ val: '', label: 'All' }, { val: 'PO_Backed', label: 'From PO' }, { val: 'Direct', label: 'Direct' }].map(t => (
                    <button key={t.val} type="button" onClick={() => setPendingType(t.val)} style={{ padding: '0.3rem 0.85rem', fontSize: '0.78rem', fontWeight: 600, border: pendingType === t.val ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', cursor: 'pointer', background: pendingType === t.val ? 'rgba(99,102,241,0.15)' : 'transparent', color: pendingType === t.val ? 'var(--accent-hover)' : 'var(--text-muted)' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SUPPLIER</label>
                <select className="form-control" value={pendingSupplier} onChange={e => setPendingSupplier(e.target.value)} style={{ fontSize: '0.82rem' }}>
                  <option value="">All suppliers</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DATE FROM</label>
                  <input type="date" className="form-control" value={pendingDateFrom} onChange={e => setPendingDateFrom(e.target.value)} style={{ fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DATE TO</label>
                  <input type="date" className="form-control" value={pendingDateTo} onChange={e => setPendingDateTo(e.target.value)} style={{ fontSize: '0.82rem' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => { setPendingSearch(''); setPendingType(''); setPendingSupplier(''); setPendingDateFrom(''); setPendingDateTo(''); }} style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: '#f87171' }}>Reset</button>
              <button className="btn-secondary" onClick={() => setShowFilterModal(false)} style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>Cancel</button>
              <button className="btn-primary" onClick={applyFilters} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Apply Filters</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
