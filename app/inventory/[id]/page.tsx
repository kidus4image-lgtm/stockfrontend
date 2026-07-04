'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { showSuccess, showError, showWarning } from '../../../lib/toast';

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showAdjustStock, setShowAdjustStock] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [batchPage, setBatchPage] = useState(1);
  const [adjustmentPage, setAdjustmentPage] = useState(1);
  const rowsPerPage = 5;

  const [batchForm, setBatchForm] = useState({
    batchNumber: '', quantity: '', purchasePrice: '', expiryDate: ''
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    batchId: '', adjustmentType: 'Reduction', quantityChanged: '', reason: ''
  });
  const [editForm, setEditForm] = useState({
    name: '', sku: '', description: '', price: '', minStock: '', purchaseUnit: '', sellingUnit: '', conversionFactor: '', showOnPriceList: false
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try { setCurrentUser(JSON.parse(storedUser).username || ''); } catch {}
    }
  }, []);

  const fetchProduct = async () => {
    if (!productId) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/inventory/products/${productId}`);
      if (res.ok) {
        setProduct(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch product', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProduct(); setBatchPage(1); setAdjustmentPage(1); }, [productId]);

  // ---- BATCH HANDLERS ----
  const handleOpenAddBatch = () => {
    setBatchForm({
      batchNumber: `BAT-${Math.floor(100000 + Math.random() * 900000)}`,
      quantity: '', purchasePrice: '', expiryDate: ''
    });
    setShowAddBatch(true);
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('http://localhost:5000/api/inventory/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: parseInt(productId),
          batchNumber: batchForm.batchNumber,
          quantity: parseInt(batchForm.quantity),
          purchasePrice: parseFloat(batchForm.purchasePrice),
          expiryDate: batchForm.expiryDate || null,
          adjustedBy: currentUser
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register batch');
      showSuccess('New batch registered successfully!');
      setShowAddBatch(false);
      setBatchPage(1);
      fetchProduct();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- ADJUSTMENT HANDLERS ----
  const handleOpenAdjustStock = () => {
    setAdjustmentForm({ batchId: '', adjustmentType: 'Reduction', quantityChanged: '', reason: '' });
    setShowAdjustStock(true);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const targetBatchId = parseInt(adjustmentForm.batchId);
    const targetQty = parseInt(adjustmentForm.quantityChanged);
    if (adjustmentForm.adjustmentType === 'Reduction' && targetBatchId) {
      const selectedBatch = product.batches?.find((b: any) => b.id === targetBatchId);
      if (selectedBatch) {
        const availableInBatch = selectedBatch.quantity - (selectedBatch.reservedQuantity || 0);
        if (availableInBatch < targetQty) {
          showWarning(`Insufficient available stock! On hand: ${selectedBatch.quantity}, reserved: ${selectedBatch.reservedQuantity || 0}, available: ${availableInBatch}, requested reduction: ${targetQty}.`);
          setSubmitting(false);
          return;
        }
      }
    }
    try {
      const res = await apiFetch('http://localhost:5000/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: parseInt(productId),
          batchId: targetBatchId || null,
          adjustmentType: adjustmentForm.adjustmentType,
          quantityChanged: targetQty,
          reason: adjustmentForm.reason,
          adjustedBy: currentUser
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save adjustment');
      showSuccess('Stock adjustment logged successfully!');
      setShowAdjustStock(false);
      setAdjustmentPage(1);
      fetchProduct();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- EDIT PRODUCT HANDLERS ----
  const handleOpenEditProduct = () => {
    setEditForm({
      name: product.name || '',
      sku: product.sku || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      minStock: product.minStock?.toString() || '',
      purchaseUnit: product.purchaseUnit || '',
      sellingUnit: product.sellingUnit || '',
      conversionFactor: product.conversionFactor?.toString() || '',
      showOnPriceList: product.showOnPriceList || false
    });
    setShowEditProduct(true);
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/inventory/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          sku: editForm.sku,
          description: editForm.description,
          price: parseFloat(editForm.price) || 0,
          minStock: parseInt(editForm.minStock) || 0,
          purchaseUnit: editForm.purchaseUnit,
          sellingUnit: editForm.sellingUnit,
          conversionFactor: parseInt(editForm.conversionFactor) || 1,
          showOnPriceList: editForm.showOnPriceList
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update product');
      showSuccess('Product updated successfully!');
      setShowEditProduct(false);
      fetchProduct();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading product details...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="dashboard-container">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem' }}>Product not found.</p>
        <div style={{ textAlign: 'center' }}>
          <button className="btn-secondary" onClick={() => router.push('/inventory')}>Back to Inventory</button>
        </div>
      </div>
    );
  }

  const totalStock = product.batches?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0;
  const totalReserved = product.batches?.reduce((sum: number, b: any) => sum + (b.reservedQuantity || 0), 0) || 0;
  const totalAvailable = totalStock - totalReserved;
  const totalValue = product.batches?.reduce((sum: number, b: any) => sum + (b.quantity * b.purchasePrice), 0) || 0;
  const outOfStock = totalAvailable <= 0;
  const lowStock = product.minStock > 0 && totalAvailable <= product.minStock;

  return (
    <div className="dashboard-container">
      <header className="page-header">
        <div>
          <h1 className="text-gradient">{product.name}</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            SKU: {product.sku || 'N/A'} {product.description ? `— ${product.description}` : ''}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={() => router.push('/inventory')} style={{ width: 'auto' }}>← Back to Inventory</button>
          <button className="btn-primary" onClick={handleOpenEditProduct} style={{ width: 'auto' }}>Edit Product</button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: `4px solid ${outOfStock ? '#ef4444' : lowStock ? '#f59e0b' : '#10b981'}` }}>
          <div className="stat-title">Available Stock</div>
          <div className="stat-value" style={{ color: outOfStock ? '#ef4444' : lowStock ? '#f59e0b' : '#10b981' }}>
            {totalAvailable}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {totalStock} total — {totalReserved} reserved — {product.batches?.length || 0} batches
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Reserved Quantity</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            {totalReserved}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Allocated to approved orders
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-title">Stock Value</div>
          <div className="stat-value" style={{ color: '#6366f1' }}>
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            At avg ${totalStock > 0 ? (totalValue / totalStock).toFixed(2) : '0.00'} / unit
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Selling Price</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            ${(product.price || 0).toFixed(2)}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {product.sellingUnit || 'unit'} ({product.conversionFactor || 1}x conversion)
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: `4px solid ${outOfStock ? '#ef4444' : '#10b981'}` }}>
          <div className="stat-title">Status</div>
          <div className="stat-value" style={{ color: outOfStock ? '#ef4444' : lowStock ? '#f59e0b' : '#10b981', fontSize: '1.2rem' }}>
            {outOfStock ? 'OUT OF STOCK' : lowStock ? 'LOW STOCK' : 'IN STOCK'}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Min stock: {product.minStock || 0}
          </div>
        </div>
      </div>

      <div className="grid-split" style={{ marginBottom: '3rem' }}>
        {/* Batches */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Batches</h3>
          {(!product.batches || product.batches.length === 0) ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No batches recorded.</p>
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem' }}>Batch #</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>On Hand</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Reserved</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Available</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Unit Cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '0.75rem' }}>Received</th>
                    <th style={{ padding: '0.75rem' }}>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const start = (batchPage - 1) * rowsPerPage;
                    return product.batches.slice(start, start + rowsPerPage).map((b: any) => (
                      <tr key={b.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.85rem' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{b.batchNumber}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{b.quantity}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: (b.reservedQuantity || 0) > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{b.reservedQuantity || 0}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: b.quantity - (b.reservedQuantity || 0) > 0 ? '#10b981' : '#ef4444' }}>{b.quantity - (b.reservedQuantity || 0)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${b.purchasePrice.toFixed(2)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>${(b.quantity * b.purchasePrice).toFixed(2)}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{new Date(b.receivedDate).toISOString().split('T')[0]}</td>
                        <td style={{ padding: '0.75rem', color: b.expiryDate ? (new Date(b.expiryDate) < new Date() ? '#ef4444' : 'var(--text-muted)') : 'var(--text-muted)' }}>
                          {b.expiryDate ? new Date(b.expiryDate).toISOString().split('T')[0] : 'N/A'}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
              {product.batches.length > rowsPerPage && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', width: 'auto' }} disabled={batchPage === 1} onClick={() => setBatchPage(p => Math.max(1, p - 1))}>← Prev</button>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0 0.5rem' }}>
                    {batchPage} / {Math.ceil(product.batches.length / rowsPerPage)}
                  </span>
                  <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', width: 'auto' }} disabled={batchPage >= Math.ceil(product.batches.length / rowsPerPage)} onClick={() => setBatchPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Adjustments */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Stock Adjustments</h3>
          {(!product.adjustments || product.adjustments.length === 0) ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No adjustments recorded.</p>
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem' }}>Type</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '0.75rem' }}>Reason</th>
                    <th style={{ padding: '0.75rem' }}>Adjusted By</th>
                    <th style={{ padding: '0.75rem' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const start = (adjustmentPage - 1) * rowsPerPage;
                    return product.adjustments.slice(start, start + rowsPerPage).map((a: any) => (
                      <tr key={a.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.85rem' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{ color: a.adjustmentType === 'Addition' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {a.adjustmentType}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{a.quantityChanged}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{a.reason}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{a.adjustedBy}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{new Date(a.createdAt).toISOString().split('T')[0]}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
              {product.adjustments.length > rowsPerPage && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', width: 'auto' }} disabled={adjustmentPage === 1} onClick={() => setAdjustmentPage(p => Math.max(1, p - 1))}>← Prev</button>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0 0.5rem' }}>
                    {adjustmentPage} / {Math.ceil(product.adjustments.length / rowsPerPage)}
                  </span>
                  <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', width: 'auto' }} disabled={adjustmentPage >= Math.ceil(product.adjustments.length / rowsPerPage)} onClick={() => setAdjustmentPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions — sticky bottom bar */}
      <div className="sticky-footer-bar no-print">
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>⚡ Quick Actions</span>
        <div style={{ width: '1px', height: '1.25rem', background: 'rgba(255,255,255,0.1)' }} />
        <button className="btn-primary" onClick={handleOpenAddBatch} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>➕ Add Batch</button>
        <button className="btn-secondary" onClick={handleOpenAdjustStock} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>🔧 Adjust Stock</button>
        <button className="btn-secondary" onClick={() => router.push('/inventory')} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>📦 All Products</button>
      </div>
      {/* spacer so content isn't hidden behind the sticky bar */}
      <div style={{ height: '5rem' }} />

      {/* ADD BATCH MODAL */}
      {showAddBatch && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', padding: '2.5rem', borderRadius: '20px', background: 'rgba(17, 24, 39, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)', position: 'relative' }}>
            <button onClick={() => setShowAddBatch(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h2 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800 }}>Receive Stock Batch</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>Log arrival of products with batch tracking and costing metrics</p>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-hover)', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap' }}>📦 {product.name}</div>
            </div>
            <form onSubmit={handleBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>🔖 Batch Number</label>
                  <input type="text" required className="form-control" placeholder="e.g. BAT-12345" value={batchForm.batchNumber} onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>📦 Quantity Received</label>
                  <input type="number" required className="form-control" placeholder="100" value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>💰 Purchase Price (USD)</label>
                  <input type="number" step="0.01" required className="form-control" placeholder="0.00" value={batchForm.purchasePrice} onChange={(e) => setBatchForm({ ...batchForm, purchasePrice: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>📅 Expiry Date</label>
                  <input type="date" className="form-control" value={batchForm.expiryDate} onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddBatch(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Registering...' : 'Register Batch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      {showAdjustStock && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', padding: '2.5rem', borderRadius: '20px', background: 'rgba(17, 24, 39, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)', position: 'relative' }}>
            <button onClick={() => setShowAdjustStock(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h2 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800, background: 'linear-gradient(135deg, #f59e0b, #d97706)', WebkitBackgroundClip: 'text' }}>Stock Correction Desk</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>Log manual stock corrections with strict positive remaining verification</p>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-hover)', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap' }}>📦 {product.name}</div>
            </div>
            <form onSubmit={handleAdjustmentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>🏷️ Select Batch</label>
                  <select className="form-control" value={adjustmentForm.batchId} required={adjustmentForm.adjustmentType === 'Addition'} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, batchId: e.target.value })}>
                    <option value="">{adjustmentForm.adjustmentType === 'Reduction' ? '-- FIFO Reduction (Auto-choose) --' : '-- Choose Batch --'}</option>
                    {(product.batches || []).map((b: any) => {
                      const avail = b.quantity - (b.reservedQuantity || 0);
                      return (
                        <option key={b.id} value={b.id}>{b.batchNumber} (On Hand: {b.quantity}, Reserved: {b.reservedQuantity || 0}, Avail: {avail}, Cost: ${b.purchasePrice})</option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>🔧 Correction Type</label>
                  <select required className="form-control" value={adjustmentForm.adjustmentType} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value })}>
                    <option value="Reduction">Stock Reduction (Loss / Damage / Audit)</option>
                    <option value="Addition">Stock Addition (Re-evaluation / Audit)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>📊 Quantity to Change</label>
                  <input type="number" required className="form-control" placeholder="10" value={adjustmentForm.quantityChanged} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantityChanged: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>📝 Reason for Correction</label>
                  <input type="text" required className="form-control" placeholder="e.g. Damage, Audit adjustment" value={adjustmentForm.reason} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAdjustStock(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Adjustment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {showEditProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', padding: '2.5rem', borderRadius: '20px', background: 'rgba(17, 24, 39, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)', position: 'relative' }}>
            <button onClick={() => setShowEditProduct(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h2 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800 }}>Edit Product</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>Update product details and pricing</p>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-hover)', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap' }}>📦 {product.name}</div>
            </div>
            <form onSubmit={handleEditProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>🏷️ Product Name</label>
                  <input type="text" required className="form-control" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>🔤 SKU</label>
                  <input type="text" required className="form-control" value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>📄 Description</label>
                <input type="text" className="form-control" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>💰 Selling Price ($)</label>
                  <input type="number" step="0.01" required className="form-control" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>📦 Min Stock Level</label>
                  <input type="number" className="form-control" value={editForm.minStock} onChange={(e) => setEditForm({ ...editForm, minStock: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>📏 Purchase Unit</label>
                  <input type="text" className="form-control" placeholder="e.g. pcs" value={editForm.purchaseUnit} onChange={(e) => setEditForm({ ...editForm, purchaseUnit: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>📐 Selling Unit</label>
                  <input type="text" className="form-control" placeholder="e.g. box" value={editForm.sellingUnit} onChange={(e) => setEditForm({ ...editForm, sellingUnit: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>🔄 Conversion Factor</label>
                  <input type="number" className="form-control" placeholder="1" value={editForm.conversionFactor} onChange={(e) => setEditForm({ ...editForm, conversionFactor: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowEditProduct(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
