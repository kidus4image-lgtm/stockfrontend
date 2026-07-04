'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { showSuccess, showError } from '../../lib/toast';
import { confirmAsync } from '../../lib/confirm';

interface Product {
  id: number;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  minStock: number;
  purchaseUnit: string;
  sellingUnit: string;
  conversionFactor: number;
  totalStock: number;
  totalSellingUnits: number;
  availableStock: number;
  batchCount: number;
  showOnPriceList?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Batch {
  id: number;
  productId: number;
  batchNumber: string;
  quantity: number;
  reservedQuantity: number;
  initialQuantity: number;
  purchasePrice: number;
  expiryDate: string | null;
  receivedDate: string;
  product?: { name: string; sku: string };
}

interface Adjustment {
  id: number;
  productId: number;
  batchId: number | null;
  adjustmentType: string;
  quantityChanged: number;
  reason: string;
  adjustedBy: string;
  createdAt: string;
  product?: { name: string; sku: string };
  batch?: { batchNumber: string };
}

function InventoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTabParam = searchParams.get('tab') || 'products';

  // State Management
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Search & Filtering
  const [productSearch, setProductSearch] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [adjustmentSearch, setAdjustmentSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);
  const [adjustmentPage, setAdjustmentPage] = useState(1);
  const rowsPerPage = 10;

  // Modals visibility
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form States
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    description: '',
    price: '',
    minStock: '0',
    purchaseUnit: 'Unit',
    sellingUnit: 'Unit',
    conversionFactor: '1',
    showOnPriceList: true
  });

  const [batchForm, setBatchForm] = useState({
    productId: '',
    batchNumber: '',
    quantity: '',
    purchasePrice: '',
    expiryDate: ''
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    productId: '',
    batchId: '',
    adjustmentType: 'Reduction',
    quantityChanged: '',
    reason: ''
  });

  // Field-level error tracking
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [batchErrors, setBatchErrors] = useState<Record<string, string>>({});
  const [adjustmentErrors, setAdjustmentErrors] = useState<Record<string, string>>({});

  const errorBorder = (hasError: boolean) => hasError ? '1px solid #ef4444' : '';
  const errorLabel = (hasError: boolean) => hasError ? '#ef4444' : 'var(--text-muted)';

  // Current session user for adjustments
  const [currentUser, setCurrentUser] = useState('System User');
  const [userRole, setUserRole] = useState('Collector');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setCurrentUser(u.username || 'System User');
        setUserRole(u.role || 'Collector');
      } catch (err) {
        console.error('Failed to parse user session', err);
      }
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, adjRes] = await Promise.all([
        apiFetch('http://localhost:5000/api/inventory/products'),
        apiFetch('http://localhost:5000/api/inventory/adjustments')
      ]);

      if (prodRes.ok && adjRes.ok) {
        const prodData = await prodRes.json();
        const adjData = await adjRes.json();

        // Derive batch ledger list from products and compute availableStock
        const derivedBatches: Batch[] = [];
        const productsWithAvail = prodData.map((p: any) => {
          const batches = p.batches || [];
          batches.forEach((b: any) => {
            derivedBatches.push({ ...b, product: { name: p.name, sku: p.sku } });
          });
          const availableStock = batches.reduce((sum: number, b: any) =>
            sum + Math.max(0, b.quantity - (b.reservedQuantity || 0)), 0);
          return { ...p, availableStock };
        });

        setProducts(productsWithAvail);
        setAdjustments(adjData);
        derivedBatches.sort((a, b) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime());
        setBatches(derivedBatches);
      }
    } catch (error) {
      console.error('Failed to fetch inventory data', error);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- PRODUCT HANDLERS ----------------
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductErrors({});
    setProductForm({ name: '', sku: '', description: '', price: '', minStock: '0', purchaseUnit: 'Unit', sellingUnit: 'Unit', conversionFactor: '1', showOnPriceList: true });
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductErrors({});
    setProductForm({
      name: p.name,
      sku: p.sku,
      description: p.description || '',
      price: p.price.toString(),
      minStock: p.minStock.toString(),
      purchaseUnit: p.purchaseUnit || 'Unit',
      sellingUnit: p.sellingUnit || 'Unit',
      conversionFactor: (p.conversionFactor || 1).toString(),
      showOnPriceList: p.showOnPriceList !== false
    });
    setShowProductModal(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!productForm.name.trim()) errors.name = 'Product name is required';
    if (!productForm.sku.trim()) errors.sku = 'SKU is required';
    if (!productForm.price || parseFloat(productForm.price) <= 0) errors.price = 'Valid price is required';
    if (!productForm.minStock || parseInt(productForm.minStock) < 0) errors.minStock = 'Valid min stock is required';
    setProductErrors(errors);
    if (Object.keys(errors).length > 0) {
      showError(Object.values(errors).join('. '));
      return;
    }

    setSubmitting(true);
    const url = editingProduct 
      ? `http://localhost:5000/api/inventory/products/${editingProduct.id}`
      : 'http://localhost:5000/api/inventory/products';
    const method = editingProduct ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productForm.name,
          sku: productForm.sku,
          description: productForm.description,
          price: parseFloat(productForm.price),
          minStock: parseInt(productForm.minStock),
          purchaseUnit: productForm.purchaseUnit,
          sellingUnit: productForm.sellingUnit,
          conversionFactor: parseFloat(productForm.conversionFactor),
          showOnPriceList: productForm.showOnPriceList
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');

      showSuccess(editingProduct ? 'Product updated successfully!' : 'Product created successfully!');
      setShowProductModal(false);
      fetchData();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: number, productName: string) => {
    if (!(await confirmAsync({ title: 'Delete Product', message: `Are you sure you want to delete "${productName}"? This will soft-delete the item but preserve historical batches and adjustment records.`, variant: 'danger' }))) {
      return;
    }

    try {
      const res = await apiFetch(`http://localhost:5000/api/inventory/products/${productId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete product');

      showSuccess('Product successfully deleted!');
      fetchData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // ---------------- BATCH HANDLERS ----------------
  const handleOpenAddBatch = (productId?: number) => {
    setBatchErrors({});
    setBatchForm({
      productId: productId ? productId.toString() : '',
      batchNumber: `BAT-${Math.floor(100000 + Math.random() * 900000)}`,
      quantity: '',
      purchasePrice: '',
      expiryDate: ''
    });
    setShowBatchModal(true);
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!batchForm.productId) errors.productId = 'Product is required';
    if (!batchForm.batchNumber.trim()) errors.batchNumber = 'Batch number is required';
    if (!batchForm.quantity || parseInt(batchForm.quantity) <= 0) errors.quantity = 'Valid quantity is required';
    if (!batchForm.purchasePrice || parseFloat(batchForm.purchasePrice) <= 0) errors.purchasePrice = 'Valid purchase price is required';
    setBatchErrors(errors);
    if (Object.keys(errors).length > 0) {
      showError(Object.values(errors).join('. '));
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('http://localhost:5000/api/inventory/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: parseInt(batchForm.productId),
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
      setShowBatchModal(false);
      fetchData();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- ADJUSTMENT HANDLERS ----------------
  const handleOpenAdjustment = (productId?: number, batchId?: number) => {
    setAdjustmentErrors({});
    setAdjustmentForm({
      productId: productId ? productId.toString() : '',
      batchId: batchId ? batchId.toString() : '',
      adjustmentType: 'Reduction',
      quantityChanged: '',
      reason: ''
    });
    setShowAdjustmentModal(true);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!adjustmentForm.productId) errors.productId = 'Product is required';
    if (!adjustmentForm.quantityChanged || parseInt(adjustmentForm.quantityChanged) <= 0) errors.quantityChanged = 'Valid quantity is required';
    if (!adjustmentForm.reason.trim()) errors.reason = 'Reason is required';

    const targetBatchId = parseInt(adjustmentForm.batchId);
    const targetQty = parseInt(adjustmentForm.quantityChanged);

    // Front-end negative stock protection verification
    if (adjustmentForm.adjustmentType === 'Reduction' && targetBatchId) {
      const selectedBatch = batches.find(b => b.id === targetBatchId);
      if (selectedBatch && selectedBatch.quantity < targetQty) {
        errors.quantityChanged = `Insufficient stock! Available: ${selectedBatch.quantity}, requested: ${targetQty}`;
      }
    }

    setAdjustmentErrors(errors);
    if (Object.keys(errors).length > 0) {
      showError(Object.values(errors).join('. '));
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('http://localhost:5000/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: parseInt(adjustmentForm.productId),
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
      setShowAdjustmentModal(false);
      fetchData();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- DATA FILTER & KPI DERIVATIONS ----------------
  const filteredProducts = products.filter(p => {
    const s = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
  });

  const filteredBatches = batches.filter(b => {
    const s = batchSearch.toLowerCase();
    return (
      b.batchNumber.toLowerCase().includes(s) ||
      (b.product && b.product.name.toLowerCase().includes(s)) ||
      (b.product && b.product.sku.toLowerCase().includes(s))
    );
  });

  const filteredAdjustments = adjustments.filter(a => {
    const s = adjustmentSearch.toLowerCase();
    return (
      a.reason.toLowerCase().includes(s) ||
      a.adjustedBy.toLowerCase().includes(s) ||
      (a.product && a.product.name.toLowerCase().includes(s)) ||
      (a.batch && a.batch.batchNumber.toLowerCase().includes(s))
    );
  });

  // KPIs
  const totalProductsCount = products.length;
  const totalStockCount = products.reduce((sum, p) => sum + p.totalStock, 0);
  const totalValuation = batches.reduce((sum, b) => sum + (b.quantity * b.purchasePrice), 0);
  const lowStockCount = products.filter(p => (p.availableStock ?? p.totalStock) <= p.minStock).length;

  const canManageInventory = userRole.toLowerCase() === 'manager' || userRole.toLowerCase() === 'finance' || userRole.toLowerCase() === 'store_user';

  const handleToggleShowOnPriceList = async (productId: number, currentValue: boolean) => {
    const newValue = !currentValue;
    // Optimistic update
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, showOnPriceList: newValue } : p));
    try {
      const res = await apiFetch(`http://localhost:5000/api/inventory/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnPriceList: newValue })
      });
      if (!res.ok) {
        // Revert on failure
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, showOnPriceList: currentValue } : p));
        showError('Failed to update price list visibility');
      }
    } catch {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, showOnPriceList: currentValue } : p));
      showError('Failed to update price list visibility');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading Inventory Module...
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* HEADER SECTION */}
      <header className="no-print gen-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0 }}>Inventory</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.15rem 0 0 0' }}>Batch tracking, valuations, and stock adjustments</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canManageInventory && (
            <>
              <button className="btn-primary" onClick={handleOpenAddProduct} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
                + Product
              </button>
              <button className="btn-secondary" onClick={() => handleOpenAddBatch()} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.85rem', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                + Batch
              </button>
              <button className="btn-primary" onClick={() => handleOpenAdjustment()} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.85rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}>
                Adjust
              </button>
            </>
          )}
        </div>
      </header>

      {/* KPI CARDS GRID */}
      <div className="dashboard-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: '3px solid #60a5fa', padding: '0.75rem 1rem' }}>
          <div className="stat-title" style={{ fontSize: '0.7rem' }}>Products</div>
          <div className="stat-value" style={{ color: '#60a5fa', fontSize: '1.5rem' }}>{totalProductsCount}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Unique items</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '3px solid #10b981', padding: '0.75rem 1rem' }}>
          <div className="stat-title" style={{ fontSize: '0.7rem' }}>Valuation</div>
          <div className="stat-value" style={{ color: '#10b981', fontSize: '1.5rem' }}>${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Batch cost value</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '3px solid #818cf8', padding: '0.75rem 1rem' }}>
          <div className="stat-title" style={{ fontSize: '0.7rem' }}>Total Stock</div>
          <div className="stat-value" style={{ color: '#818cf8', fontSize: '1.5rem' }}>{totalStockCount.toLocaleString()}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>All batches sum</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: `3px solid ${lowStockCount > 0 ? '#ef4444' : '#10b981'}`, padding: '0.75rem 1rem' }}>
          <div className="stat-title" style={{ fontSize: '0.7rem' }}>Low Stock</div>
          <div className="stat-value" style={{ color: lowStockCount > 0 ? '#f87171' : '#10b981', fontSize: '1.5rem' }}>{lowStockCount}</div>
          <div style={{ fontSize: '0.7rem', color: lowStockCount > 0 ? '#fca5a5' : 'var(--text-muted)' }}>
            {lowStockCount > 0 ? 'Below threshold' : 'All healthy'}
          </div>
        </div>
      </div>

      {/* TABS CONTROLLERS */}
      <div className="glass-panel no-print" style={{ padding: '0.3rem', marginBottom: '1rem', display: 'flex', gap: '0.3rem', background: 'rgba(255, 255, 255, 0.02)' }}>
        <button
          className={`btn-secondary ${activeTabParam === 'products' ? 'active' : ''}`}
          onClick={() => router.push('/inventory?tab=products')}
          style={{ flex: 1, padding: '0.5rem', background: activeTabParam === 'products' ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
        >
          Products
        </button>
        <button
          className={`btn-secondary ${activeTabParam === 'batches' ? 'active' : ''}`}
          onClick={() => router.push('/inventory?tab=batches')}
          style={{ flex: 1, padding: '0.5rem', background: activeTabParam === 'batches' ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
        >
          Batches
        </button>
        <button
          className={`btn-secondary ${activeTabParam === 'adjustments' ? 'active' : ''}`}
          onClick={() => router.push('/inventory?tab=adjustments')}
          style={{ flex: 1, padding: '0.5rem', background: activeTabParam === 'adjustments' ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
        >
          Audit Logs
        </button>
      </div>

      {/* --- TAB CONTENT: PRODUCTS DIRECTORY --- */}
      {activeTabParam === 'products' && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div className="gen-page-filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.1rem', margin: 0 }}>Products Catalog</h2>
            <input
              type="text"
              placeholder="Search by name or SKU..."
              className="form-control"
              style={{ maxWidth: '280px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              value={productSearch}
               onChange={(e) => { setProductSearch(e.target.value); setProductPage(1); }}
             />
           </div>

           <div className="tbl-mobile">
             {filteredProducts.length > 0 ? (
               filteredProducts.slice((productPage - 1) * rowsPerPage, productPage * rowsPerPage).map(p => {
                 const availStock = p.availableStock ?? p.totalStock;
                 const isLowStock = availStock <= p.minStock;
                 const isOutOfStock = availStock === 0;

                 return (
                   <div className="gen-mobile-card" key={p.id}>
                     <div className="gen-mobile-card-header">
                       <Link href={`/inventory/${p.id}`} className="gen-mobile-card-title" style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>{p.name}</Link>
                       <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>{p.sku}</span>
                     </div>
                     <div className="gen-mobile-card-body">
                       <div><span className="gen-mobile-card-label">Price</span><span className="gen-mobile-card-value">${p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                       <div><span className="gen-mobile-card-label">Stock</span><span className="gen-mobile-card-value" style={{ color: isOutOfStock ? '#fca5a5' : isLowStock ? '#fde047' : '#a7f3d0' }}>{isOutOfStock ? 'OUT' : isLowStock ? `LOW (${availStock})` : availStock}</span></div>
                       <div><span className="gen-mobile-card-label">Units</span><span className="gen-mobile-card-value">{p.purchaseUnit || 'Unit'} → {p.sellingUnit || 'Unit'}</span></div>
                       <div><span className="gen-mobile-card-label">Batches</span><span className="gen-mobile-card-value">{p.batchCount}</span></div>
                       <div><span className="gen-mobile-card-label">List</span><span className="gen-mobile-card-value">{p.showOnPriceList !== false ? 'Yes' : 'No'}</span></div>
                     </div>
                     {canManageInventory && (
                       <div className="gen-mobile-card-actions">
                         <button className="btn-secondary" onClick={() => handleOpenAddBatch(p.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)' }}>+Batch</button>
                         <button className="btn-secondary" onClick={() => handleOpenAdjustment(p.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)', color: '#f59e0b' }}>Adjust</button>
                         <button className="btn-secondary" onClick={() => handleOpenEditProduct(p)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)' }}>Edit</button>
                         <button className="btn-secondary" onClick={() => handleDeleteProduct(p.id, p.name)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>Del</button>
                       </div>
                     )}
                   </div>
                 );
               })
             ) : (
               <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No products found matching your search.</div>
             )}
           </div>

           <div className="tbl-desktop">
             <div className="table-wrap">
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                     <th style={{ padding: '0.5rem 0.4rem' }}>PRODUCT & SKU</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>PRICE</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>UNITS</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>BATCHES</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>AVAIL. STOCK</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>LIST</th>
                     <th style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>ACTIONS</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredProducts.length > 0 ? (
                     filteredProducts.slice((productPage - 1) * rowsPerPage, productPage * rowsPerPage).map(p => {
                       const availStock = p.availableStock ?? p.totalStock;
                       const isLowStock = availStock <= p.minStock;
                       const isOutOfStock = availStock === 0;
                       const hasReserved = p.totalStock > availStock;

                       return (
                         <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             <Link href={`/inventory/${p.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>
                               <strong style={{ color: 'inherit' }}>{p.name}</strong>
                             </Link>
                             <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '3px', marginLeft: '0.3rem' }}>
                               {p.sku}
                             </span>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', fontWeight: 600, color: 'var(--text-main)' }}>
                             ${p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>
                               {p.purchaseUnit || 'Unit'}
                             </span>
                             <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', margin: '0 0.15rem' }}>→</span>
                             <span style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>
                               {p.sellingUnit || 'Unit'}
                             </span>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             <span style={{ color: '#fff', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem' }}>
                               {p.batchCount}
                             </span>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                               <span style={{
                                 padding: '0.15rem 0.5rem',
                                 borderRadius: '10px',
                                 fontSize: '0.7rem',
                                 fontWeight: 600,
                                 background: isOutOfStock ? 'rgba(239, 68, 68, 0.1)' : isLowStock ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                 color: isOutOfStock ? '#fca5a5' : isLowStock ? '#fde047' : '#a7f3d0',
                                 border: `1px solid ${isOutOfStock ? 'rgba(239,68,68,0.2)' : isLowStock ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`
                               }}>
                                 {isOutOfStock ? 'OUT' : isLowStock ? `LOW (${availStock})` : availStock}
                               </span>
                               {hasReserved && (
                                 <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                   {p.totalStock} total · {p.totalStock - availStock} reserved
                                 </span>
                               )}
                               {(p.conversionFactor || 1) > 1 && availStock > 0 && (
                                 <span style={{ fontSize: '0.6rem', color: '#6ee7b7' }}>
                                   ~{(availStock * (p.conversionFactor || 1)).toLocaleString()} {p.sellingUnit || 'Unit'}
                                 </span>
                               )}
                             </div>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                             <input
                               type="checkbox"
                               checked={p.showOnPriceList !== false}
                               onChange={() => handleToggleShowOnPriceList(p.id, p.showOnPriceList !== false)}
                               style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: '#174f49' }}
                             />
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>
                             <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                               {canManageInventory && (
                                 <>
                                   <button className="btn-secondary" onClick={() => handleOpenAddBatch(p.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)' }}>+Batch</button>
                                   <button className="btn-secondary" onClick={() => handleOpenAdjustment(p.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)', color: '#f59e0b' }}>Adjust</button>
                                   <button className="btn-secondary" onClick={() => handleOpenEditProduct(p)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)' }}>Edit</button>
                                   <button className="btn-secondary" onClick={() => handleDeleteProduct(p.id, p.name)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>Del</button>
                                 </>
                               )}
                             </div>
                           </td>
                         </tr>
                       );
                     })
                   ) : (
                     <tr>
                       <td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                         No products found matching your search.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
               {filteredProducts.length > rowsPerPage && (
                 <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
                   <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={productPage === 1} onClick={() => setProductPage(p => Math.max(1, p - 1))}>← Prev</button>
                   <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 0.4rem' }}>
                     {productPage} / {Math.ceil(filteredProducts.length / rowsPerPage)}
                   </span>
                   <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={productPage >= Math.ceil(filteredProducts.length / rowsPerPage)} onClick={() => setProductPage(p => p + 1)}>Next →</button>
                 </div>
               )}
             </div>
           </div>
        </div>
      )}

      {/* --- TAB CONTENT: BATCHES LEDGER --- */}
      {activeTabParam === 'batches' && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div className="gen-page-filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.1rem', margin: 0 }}>Batches Ledger</h2>
            <input
              type="text"
              placeholder="Search batch, product, SKU..."
              className="form-control"
              style={{ maxWidth: '280px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              value={batchSearch}
              onChange={(e) => { setBatchSearch(e.target.value); setBatchPage(1); }}
            />
          </div>

           <div className="tbl-mobile">
             {filteredBatches.length > 0 ? (
               filteredBatches.slice((batchPage - 1) * rowsPerPage, batchPage * rowsPerPage).map(b => {
                 const isExpired = b.expiryDate && new Date(b.expiryDate) < new Date();
                 const isSoonExpiring = b.expiryDate && !isExpired && new Date(b.expiryDate).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;

                 return (
                   <div className="gen-mobile-card" key={b.id}>
                     <div className="gen-mobile-card-header">
                       <span className="gen-mobile-card-title">{b.batchNumber}</span>
                       <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{b.product?.sku}</span>
                     </div>
                     <div className="gen-mobile-card-body">
                       <div><span className="gen-mobile-card-label">Product</span><span className="gen-mobile-card-value">{b.product?.name}</span></div>
                       <div><span className="gen-mobile-card-label">Unit Cost</span><span className="gen-mobile-card-value">${b.purchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                       <div><span className="gen-mobile-card-label">Stock</span><span className="gen-mobile-card-value" style={{ color: b.quantity === 0 ? '#ef4444' : '#fff' }}>{b.quantity} / {b.initialQuantity}</span></div>
                       <div><span className="gen-mobile-card-label">Expiry</span><span className="gen-mobile-card-value" style={{ color: isExpired ? '#fca5a5' : isSoonExpiring ? '#fde047' : 'var(--text-muted)' }}>{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : 'N/A'}</span></div>
                       <div><span className="gen-mobile-card-label">Received</span><span className="gen-mobile-card-value">{new Date(b.receivedDate).toLocaleDateString()}</span></div>
                     </div>
                     {canManageInventory && b.quantity > 0 && (
                       <div className="gen-mobile-card-actions">
                         <button className="btn-secondary" onClick={() => handleOpenAdjustment(b.productId, b.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)', color: '#f59e0b' }}>Adjust</button>
                       </div>
                     )}
                   </div>
                 );
               })
             ) : (
               <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No batches registered or found.</div>
             )}
           </div>

           <div className="tbl-desktop">
             <div className="table-wrap">
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                     <th style={{ padding: '0.5rem 0.4rem' }}>BATCH</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>PRODUCT</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>UNIT COST</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>INITIAL</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>REMAINING</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>EXPIRY</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>RECEIVED</th>
                     <th style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>ACTIONS</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredBatches.length > 0 ? (
                     filteredBatches.slice((batchPage - 1) * rowsPerPage, batchPage * rowsPerPage).map(b => {
                       const isExpired = b.expiryDate && new Date(b.expiryDate) < new Date();
                       const isSoonExpiring = b.expiryDate && !isExpired && new Date(b.expiryDate).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;

                       return (
                         <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             <strong style={{ color: 'var(--text-main)' }}>{b.batchNumber}</strong>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             <strong style={{ color: 'var(--text-main)' }}>{b.product?.name}</strong>
                             <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>{b.product?.sku}</span>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', fontWeight: 600, color: 'var(--text-main)' }}>
                             ${b.purchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', color: 'var(--text-muted)' }}>
                             {b.initialQuantity}
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             <strong style={{ color: b.quantity === 0 ? 'var(--danger)' : '#fff' }}>{b.quantity}</strong>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             {b.expiryDate ? (
                               <span style={{ color: isExpired ? '#fca5a5' : isSoonExpiring ? '#fde047' : 'var(--text-muted)', fontWeight: (isExpired || isSoonExpiring) ? 'bold' : 'normal', fontSize: '0.7rem' }}>
                                 {new Date(b.expiryDate).toLocaleDateString()}
                               </span>
                             ) : (
                               <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.7rem' }}>N/A</span>
                             )}
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                             {new Date(b.receivedDate).toLocaleDateString()}
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>
                             {canManageInventory && b.quantity > 0 && (
                               <button className="btn-secondary" onClick={() => handleOpenAdjustment(b.productId, b.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)', color: '#f59e0b' }}>Adjust</button>
                             )}
                           </td>
                         </tr>
                       );
                     })
                   ) : (
                     <tr>
                       <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                         No batches registered or found.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
               {filteredBatches.length > rowsPerPage && (
                 <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
                   <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={batchPage === 1} onClick={() => setBatchPage(p => Math.max(1, p - 1))}>← Prev</button>
                   <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 0.4rem' }}>
                     {batchPage} / {Math.ceil(filteredBatches.length / rowsPerPage)}
                   </span>
                   <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={batchPage >= Math.ceil(filteredBatches.length / rowsPerPage)} onClick={() => setBatchPage(p => p + 1)}>Next →</button>
                 </div>
               )}
             </div>
           </div>
        </div>
      )}

      {/* --- TAB CONTENT: AUDIT LOGS --- */}
      {activeTabParam === 'adjustments' && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div className="gen-page-filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.1rem', margin: 0 }}>Audit Logs</h2>
            <input
              type="text"
              placeholder="Search auditor, product, reason..."
              className="form-control"
              style={{ maxWidth: '280px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              value={adjustmentSearch}
              onChange={(e) => { setAdjustmentSearch(e.target.value); setAdjustmentPage(1); }}
            />
          </div>

           <div className="tbl-mobile">
             {filteredAdjustments.length > 0 ? (
               filteredAdjustments.slice((adjustmentPage - 1) * rowsPerPage, adjustmentPage * rowsPerPage).map(a => {
                 const isAddition = a.adjustmentType === 'Addition';
                 return (
                   <div className="gen-mobile-card" key={a.id}>
                     <div className="gen-mobile-card-header">
                       <span className="gen-mobile-card-title">{a.product?.name}</span>
                       <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '8px', fontWeight: 'bold', background: isAddition ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isAddition ? '#a7f3d0' : '#fca5a5' }}>{isAddition ? 'IN' : 'OUT'}</span>
                     </div>
                     <div className="gen-mobile-card-body">
                       <div><span className="gen-mobile-card-label">Timestamp</span><span className="gen-mobile-card-value" style={{ fontSize: '0.7rem' }}>{new Date(a.createdAt).toLocaleString()}</span></div>
                       <div><span className="gen-mobile-card-label">Batch</span><span className="gen-mobile-card-value">{a.batch?.batchNumber || 'FIFO'}</span></div>
                       <div><span className="gen-mobile-card-label">Quantity</span><span className="gen-mobile-card-value" style={{ color: isAddition ? '#10b981' : '#ef4444', fontWeight: 600 }}>{isAddition ? `+${a.quantityChanged}` : `-${a.quantityChanged}`}</span></div>
                       <div><span className="gen-mobile-card-label">Reason</span><span className="gen-mobile-card-value">{a.reason}</span></div>
                       <div><span className="gen-mobile-card-label">Audited By</span><span className="gen-mobile-card-value" style={{ color: 'var(--accent-hover)' }}>{a.adjustedBy}</span></div>
                     </div>
                   </div>
                 );
               })
             ) : (
               <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No adjustment entries recorded in log.</div>
             )}
           </div>

           <div className="tbl-desktop">
             <div className="table-wrap">
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                     <th style={{ padding: '0.5rem 0.4rem' }}>TIMESTAMP</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>PRODUCT</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>BATCH</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>TYPE</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>UNITS</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>REASON</th>
                     <th style={{ padding: '0.5rem 0.4rem' }}>AUDITED BY</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredAdjustments.length > 0 ? (
                     filteredAdjustments.slice((adjustmentPage - 1) * rowsPerPage, adjustmentPage * rowsPerPage).map(a => {
                       const isAddition = a.adjustmentType === 'Addition';
                       return (
                         <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
                           <td style={{ padding: '0.6rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                             {new Date(a.createdAt).toLocaleString()}
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             <strong style={{ color: 'var(--text-main)' }}>{a.product?.name}</strong>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', fontSize: '0.7rem' }}>
                             <strong style={{ color: 'var(--text-main)' }}>{a.batch?.batchNumber || 'FIFO'}</strong>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem' }}>
                             <span style={{ padding: '0.15rem 0.5rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 'bold',
                               background: isAddition ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                               color: isAddition ? '#a7f3d0' : '#fca5a5'
                             }}>
                               {isAddition ? 'IN' : 'OUT'}
                             </span>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', fontWeight: 600 }}>
                             <span style={{ color: isAddition ? 'var(--success)' : 'var(--danger)' }}>
                               {isAddition ? `+${a.quantityChanged}` : `-${a.quantityChanged}`}
                             </span>
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', color: 'var(--text-main)', fontSize: '0.75rem' }}>
                             {a.reason}
                           </td>
                           <td style={{ padding: '0.6rem 0.4rem', fontWeight: 'bold', color: 'var(--accent-hover)', fontSize: '0.7rem' }}>
                             {a.adjustedBy}
                           </td>
                         </tr>
                       );
                     })
                   ) : (
                     <tr>
                       <td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                         No adjustment entries recorded in log.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
               {filteredAdjustments.length > rowsPerPage && (
                 <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
                   <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={adjustmentPage === 1} onClick={() => setAdjustmentPage(p => Math.max(1, p - 1))}>← Prev</button>
                   <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 0.4rem' }}>
                     {adjustmentPage} / {Math.ceil(filteredAdjustments.length / rowsPerPage)}
                   </span>
                   <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={adjustmentPage >= Math.ceil(filteredAdjustments.length / rowsPerPage)} onClick={() => setAdjustmentPage(p => p + 1)}>Next →</button>
                 </div>
               )}
             </div>
           </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ======================= MODALS ========================= */}
      {/* ======================================================== */}

      {/* 1. PRODUCT MODAL */}
      {showProductModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '960px', padding: '1.25rem 2rem', borderRadius: '20px', background: 'rgba(17, 24, 39, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)', position: 'relative' }}>
            <button onClick={() => setShowProductModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 className="text-gradient" style={{ fontSize: '1.5rem', margin: 0, fontWeight: 800 }}>
                {editingProduct ? 'Edit Catalog Product' : 'Add New Catalog Product'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.15rem 0 0 0' }}>Register unique inventory items with threshold targets</p>
            </div>
            
            <form onSubmit={handleProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* BASIC INFORMATION */}
              <div style={{ background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.15)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                <div style={{ marginBottom: '0.6rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#93bbfc' }}>Basic Information</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: errorLabel(!!productErrors.name), fontWeight: 600 }}>Product Name *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="e.g. Aspirin 81mg"
                      value={productForm.name}
                      onChange={(e) => { setProductForm({ ...productForm, name: e.target.value }); if (productErrors.name) setProductErrors(prev => ({ ...prev, name: '' })); }}
                      style={{ border: errorBorder(!!productErrors.name) }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: errorLabel(!!productErrors.sku), fontWeight: 600 }}>Unique SKU *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="e.g. ASP-81-MG"
                      value={productForm.sku}
                      onChange={(e) => { setProductForm({ ...productForm, sku: e.target.value }); if (productErrors.sku) setProductErrors(prev => ({ ...prev, sku: '' })); }}
                      style={{ border: errorBorder(!!productErrors.sku) }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '0.6rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Description</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '50px', resize: 'none' }}
                    placeholder="Enter product specification notes..."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  />
                </div>
              </div>

              {/* PRICING & STOCK */}
              <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                <div style={{ marginBottom: '0.6rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#6ee7b7' }}>Pricing & Stock</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: errorLabel(!!productErrors.price), fontWeight: 600 }}>Selling Price (ETB) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="form-control"
                      placeholder="0.00"
                      value={productForm.price}
                      onChange={(e) => { setProductForm({ ...productForm, price: e.target.value }); if (productErrors.price) setProductErrors(prev => ({ ...prev, price: '' })); }}
                      style={{ border: errorBorder(!!productErrors.price) }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: errorLabel(!!productErrors.minStock), fontWeight: 600 }}>Min Stock Target (Alert) *</label>
                    <input
                      type="number"
                      required
                      className="form-control"
                      placeholder="50"
                      value={productForm.minStock}
                      onChange={(e) => { setProductForm({ ...productForm, minStock: e.target.value }); if (productErrors.minStock) setProductErrors(prev => ({ ...prev, minStock: '' })); }}
                      style={{ border: errorBorder(!!productErrors.minStock) }}
                    />
                  </div>
                </div>
              </div>

              {/* UNIT CONVERSION */}
              <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#a5b4fc' }}>Unit Conversion</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>(e.g., buy in Cases, sell in Pieces)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Purchase Unit</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Case"
                      value={productForm.purchaseUnit}
                      onChange={(e) => setProductForm({ ...productForm, purchaseUnit: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Selling Unit</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Piece"
                      value={productForm.sellingUnit}
                      onChange={(e) => setProductForm({ ...productForm, sellingUnit: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Conversion Factor</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-control"
                      placeholder="1"
                      value={productForm.conversionFactor}
                      onChange={(e) => setProductForm({ ...productForm, conversionFactor: e.target.value })}
                    />
                  </div>
                </div>
                {parseFloat(productForm.conversionFactor) > 1 && (
                  <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: 'rgba(16,185,129,0.08)', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6ee7b7' }}>
                      1 {productForm.purchaseUnit || 'Unit'} = {productForm.conversionFactor} {productForm.sellingUnit || 'Unit'}
                    </span>
                  </div>
                )}
              </div>

              {/* DISPLAY OPTIONS */}
              <div style={{ background: 'rgba(23, 79, 73, 0.08)', border: '1px solid rgba(23, 79, 73, 0.2)', borderRadius: '10px', padding: '0.6rem 1rem' }}>
                <div style={{ marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#6ee7b7' }}>Display Options</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    type="checkbox"
                    id="showOnPriceList"
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: '#174f49' }}
                    checked={productForm.showOnPriceList}
                    onChange={(e) => setProductForm({ ...productForm, showOnPriceList: e.target.checked })}
                  />
                  <div>
                    <label htmlFor="showOnPriceList" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#6ee7b7', cursor: 'pointer', display: 'block' }}>Show on Price List</label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Appear in the generated branded price list.</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowProductModal(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. BATCH MODAL */}
      {showBatchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '2.5rem', borderRadius: '20px', background: 'rgba(17, 24, 39, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)', position: 'relative' }}>
            <button onClick={() => setShowBatchModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800 }}>Receive Stock Batch</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>Log arrival of products with batch tracking and costing metrics</p>
            </div>

            <form onSubmit={handleBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label htmlFor="batch-product-select" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: errorLabel(!!batchErrors.productId), fontWeight: 600 }}>Select Product</label>
                <select
                  id="batch-product-select"
                  required
                  className="form-control"
                  value={batchForm.productId}
                  onChange={(e) => { setBatchForm({ ...batchForm, productId: e.target.value }); if (batchErrors.productId) setBatchErrors(prev => ({ ...prev, productId: '' })); }}
                  style={{ border: errorBorder(!!batchErrors.productId) }}
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: errorLabel(!!batchErrors.batchNumber), fontWeight: 600 }}>Batch Number</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. BAT-12345"
                    value={batchForm.batchNumber}
                    onChange={(e) => { setBatchForm({ ...batchForm, batchNumber: e.target.value }); if (batchErrors.batchNumber) setBatchErrors(prev => ({ ...prev, batchNumber: '' })); }}
                    style={{ border: errorBorder(!!batchErrors.batchNumber) }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: errorLabel(!!batchErrors.quantity), fontWeight: 600 }}>Quantity Received</label>
                  <input
                    type="number"
                    required
                    className="form-control"
                    placeholder="100"
                    value={batchForm.quantity}
                    onChange={(e) => { setBatchForm({ ...batchForm, quantity: e.target.value }); if (batchErrors.quantity) setBatchErrors(prev => ({ ...prev, quantity: '' })); }}
                    style={{ border: errorBorder(!!batchErrors.quantity) }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: errorLabel(!!batchErrors.purchasePrice), fontWeight: 600 }}>Purchase Price Cost (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="form-control"
                    placeholder="0.00"
                    value={batchForm.purchasePrice}
                    onChange={(e) => { setBatchForm({ ...batchForm, purchasePrice: e.target.value }); if (batchErrors.purchasePrice) setBatchErrors(prev => ({ ...prev, purchasePrice: '' })); }}
                    style={{ border: errorBorder(!!batchErrors.purchasePrice) }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Expiry Date (Optional)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={batchForm.expiryDate}
                    onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowBatchModal(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Register Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADJUSTMENT MODAL */}
      {showAdjustmentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '2.5rem', borderRadius: '20px', background: 'rgba(17, 24, 39, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)', position: 'relative' }}>
            <button onClick={() => setShowAdjustmentModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800, background: 'linear-gradient(135deg, #f59e0b, #d97706)', WebkitBackgroundClip: 'text' }}>Stock Correction Desk</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>Log manual stock corrections with strict positive remaining verification</p>
            </div>

            <form onSubmit={handleAdjustmentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: errorLabel(!!adjustmentErrors.productId), fontWeight: 600 }}>Select Product</label>
                  <select
                    required
                    className="form-control"
                    value={adjustmentForm.productId}
                    onChange={(e) => { setAdjustmentForm({ ...adjustmentForm, productId: e.target.value, batchId: '' }); if (adjustmentErrors.productId) setAdjustmentErrors(prev => ({ ...prev, productId: '' })); }}
                    style={{ border: errorBorder(!!adjustmentErrors.productId) }}
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Select Batch (Recommended)</label>
                  <select
                    className="form-control"
                    value={adjustmentForm.batchId}
                    required={adjustmentForm.adjustmentType === 'Addition'}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, batchId: e.target.value })}
                  >
                    <option value="">
                      {adjustmentForm.adjustmentType === 'Reduction' ? '-- FIFO Reduction (Auto-choose) --' : '-- Choose Batch --'}
                    </option>
                    {batches
                      .filter(b => b.productId === parseInt(adjustmentForm.productId))
                      .map(b => (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} (Stock: {b.quantity} units, Cost: ${b.purchasePrice})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Correction Type</label>
                  <select
                    required
                    className="form-control"
                    value={adjustmentForm.adjustmentType}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value })}
                  >
                    <option value="Reduction">Stock Reduction (Loss / Damage / Audit)</option>
                    <option value="Addition">Stock Addition (Re-evaluation / Audit)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: errorLabel(!!adjustmentErrors.quantityChanged), fontWeight: 600 }}>Quantity to Change</label>
                  <input
                    type="number"
                    required
                    className="form-control"
                    placeholder="10"
                    value={adjustmentForm.quantityChanged}
                    onChange={(e) => { setAdjustmentForm({ ...adjustmentForm, quantityChanged: e.target.value }); if (adjustmentErrors.quantityChanged) setAdjustmentErrors(prev => ({ ...prev, quantityChanged: '' })); }}
                    style={{ border: errorBorder(!!adjustmentErrors.quantityChanged) }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: errorLabel(!!adjustmentErrors.reason), fontWeight: 600 }}>Audit/Correction Reason</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. Expired batch units discarded, damaged in transit..."
                  value={adjustmentForm.reason}
                  onChange={(e) => { setAdjustmentForm({ ...adjustmentForm, reason: e.target.value }); if (adjustmentErrors.reason) setAdjustmentErrors(prev => ({ ...prev, reason: '' })); }}
                  style={{ border: errorBorder(!!adjustmentErrors.reason) }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAdjustmentModal(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }} disabled={submitting}>
                  {submitting ? 'Applying...' : 'Apply Stock Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading Inventory Module...
      </div>
    }>
      <InventoryContent />
    </Suspense>
  );
}
