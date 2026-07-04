'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '../../../../lib/api';
import { showSuccess, showError, showWarning } from '../../../../lib/toast';

interface ProductOption {
  id: number;
  name: string;
  sku: string;
  price: number;
  [key: string]: unknown;
}

interface CustomerOption {
  id: number;
  customerName: string;
  tinNumber: string;
  [key: string]: unknown;
}

interface OrderItemForm {
  productId: string;
  productSearch: string;
  productObj: ProductOption | null;
  quantity: number;
  price: number;
}

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerObj, setCustomerObj] = useState<CustomerOption | null>(null);
  const [salesType, setSalesType] = useState('Credit');
  const [items, setItems] = useState<OrderItemForm[]>([]);
  const [originalStatus, setOriginalStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/customers');
      if (res.ok) setCustomers(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchProducts = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/inventory/products');
      if (res.ok) setProducts(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchOrder = async () => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}`);
      if (!res.ok) {
        showError('Failed to load order');
        router.push('/orders');
        return;
      }
      const order = await res.json();
      if (order.status !== 'Pending' && order.status !== 'Rejected') {
        showError(`Orders in "${order.status}" status cannot be edited.`);
        router.push(`/orders/${orderId}`);
        return;
      }
      const storedUser = localStorage.getItem('user');
      let myUsername = '';
      let myRole = '';
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          myUsername = parsed.username || '';
          myRole = (parsed.role || '').toLowerCase();
        } catch (e) { /* ignore */ }
      }
      const isAdmin = myRole === 'admin' || myRole === 'administrator';
      if (!isAdmin && order.createdBy && order.createdBy !== myUsername) {
        showError('Only the order creator can edit or resubmit this order.');
        router.push(`/orders/${orderId}`);
        return;
      }
      setOriginalStatus(order.status);
      setSelectedCustomerId(order.customerId?.toString() || '');
      setCustomerSearch(order.customer ? `${order.customer.customerName} (TIN: ${order.customer.tinNumber})` : '');
      setCustomerObj(order.customer || null);
      setSalesType(order.salesType || 'Credit');
      const mappedItems: OrderItemForm[] = (order.items || []).map((it: { productId: number; product?: ProductOption; quantity: number; price: number }) => ({
        productId: it.productId.toString(),
        productSearch: it.product ? `${it.product.name} (SKU: ${it.product.sku})` : '',
        productObj: it.product || null,
        quantity: it.quantity,
        price: it.price
      }));
      setItems(mappedItems);
    } catch (err) {
      console.error(err);
      showError('Error loading order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      await Promise.all([fetchCustomers(), fetchProducts(), fetchOrder().catch(() => {})]);
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  const addItem = () => {
    setItems([...items, { productId: '', productSearch: '', productObj: null, quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'productSearch' | 'quantity', value: string | number) => {
    const newItems = [...items];
    if (field === 'productSearch') {
      newItems[index].productSearch = String(value);
      const prod = products.find(p => `${p.name} (SKU: ${p.sku})` === value);
      if (prod) {
        newItems[index].productId = prod.id.toString();
        newItems[index].productObj = prod;
        newItems[index].price = prod.price;
      } else {
        newItems[index].productId = '';
        newItems[index].productObj = null;
        newItems[index].price = 0;
      }
    } else {
      newItems[index].quantity = typeof value === 'number' ? value : parseInt(String(value)) || 1;
    }
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = items.filter(i => i.productId).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return showWarning('Select a valid customer from the list');
    if (items.length === 0) return showWarning('Add at least one product');

    const validItems = items.filter(i => i.productId && (i.quantity > 0 || i.price > 0));
    if (validItems.length !== items.length) return showWarning('Ensure all items have a valid selected product and quantity or price > 0');

    setSubmitting(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          salesType,
          totalAmount,
          items: validItems
        })
      });

      if (res.ok) {
        showSuccess(originalStatus === 'Rejected' ? 'Order resubmitted for approval!' : 'Order updated successfully!');
        router.push(`/orders/${orderId}`);
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to update order');
      }
    } catch (err) {
      console.error(err);
      showError('Error updating order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        ⌛ Loading order...
      </div>
    );
  }

  const wasRejected = originalStatus === 'Rejected';

  return (
    <div className="dashboard-container">
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '2.5rem', background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.08))',
        padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid rgba(245,158,11,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f59e0b, #f97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', boxShadow: '0 4px 12px rgba(245,158,11,0.3)'
          }}>✏️</div>
          <div>
            <h1 className="text-gradient" style={{ fontSize: '2rem', margin: 0 }}>
              {wasRejected ? 'Edit & Resubmit Rejected Order' : 'Edit Order'}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              {wasRejected
                ? 'Update the items or customer, then resubmit for manager approval.'
                : 'Modify order details before it is approved.'}
            </p>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem' }}>
          ← Back
        </button>
      </header>

      {wasRejected && (
        <div style={{
          padding: '0.85rem 1.25rem', marginBottom: '1.5rem', borderRadius: '10px',
          background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
          color: '#fb7185', fontSize: '0.85rem'
        }}>
          ⚠️ This order was previously rejected. Submitting will reset its status to <strong>Pending</strong> and clear all approval history.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>👤</span>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-hover)' }}>Customer</h3>
            </div>
            <input
              type="text" list="customer-list"
              className="form-control"
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '10px',
                border: customerObj ? '2px solid rgba(16,185,129,0.4)' : '1px solid var(--border-color)',
                transition: 'border 0.2s'
              }}
              value={customerSearch}
              placeholder="🔍 Search customer name or TIN..."
              onChange={e => {
                setCustomerSearch(e.target.value);
                const found = customers.find(c => `${c.customerName} (TIN: ${c.tinNumber})` === e.target.value);
                setSelectedCustomerId(found ? found.id.toString() : '');
                setCustomerObj(found || null);
              }}
              required
            />
            <datalist id="customer-list">
              {customers.map(c => (
                <option key={c.id} value={`${c.customerName} (TIN: ${c.tinNumber})`} />
              ))}
            </datalist>
            {customerObj && (
              <div style={{
                marginTop: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: '8px',
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                fontSize: '0.8rem', color: 'var(--text-muted)'
              }}>
                ✅ <strong style={{ color: '#10b981' }}>{customerObj.customerName}</strong>
                {customerObj.tinNumber && ` — TIN: ${customerObj.tinNumber}`}
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>💳</span>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-hover)' }}>Sales Type</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {['Credit', 'Cash'].map(type => (
                <button key={type} type="button" onClick={() => setSalesType(type)}
                  style={{
                    padding: '1rem', borderRadius: '10px', cursor: 'pointer', border: 'none',
                    background: salesType === type
                      ? 'linear-gradient(135deg, #174f49, #10b981)'
                      : 'rgba(255,255,255,0.04)',
                    color: salesType === type ? '#fff' : 'var(--text-muted)',
                    boxShadow: salesType === type ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                    transition: 'all 0.2s', fontSize: '0.9rem', fontWeight: 600,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem'
                  }}>
                  <span style={{ fontSize: '1.3rem' }}>{type === 'Credit' ? '📋' : '💵'}</span>
                  {type === 'Credit' ? 'Credit Sales' : 'Cash Sales'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '1.25rem', paddingBottom: '0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🛒</span>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-hover)' }}>
                Order Items {totalItems > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({totalItems})</span>}
              </h3>
            </div>
            <button type="button" className="btn-primary" onClick={addItem}
              style={{
                padding: '0.5rem 1rem', fontSize: '0.85rem',
                background: 'linear-gradient(135deg, #174f49, #10b981)', border: 'none',
                display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}>
              + Add Product
            </button>
          </div>

          {items.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '3rem 2rem',
              border: '2px dashed rgba(255,255,255,0.06)', borderRadius: '12px'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🛍️</div>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                No products added yet
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                Click <strong style={{ color: 'var(--accent-hover)' }}>+ Add Product</strong> to start building your order
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map((item, index) => {
                const hasProduct = !!item.productObj;
                const rowTotal = item.price * item.quantity;
                return (
                  <div key={index} style={{
                    display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr auto',
                    gap: '0.75rem', alignItems: 'center',
                    padding: '1rem', borderRadius: '10px',
                    background: hasProduct ? 'rgba(16,185,129,0.03)' : 'rgba(255,255,255,0.015)',
                    border: hasProduct ? '1px solid rgba(16,185,129,0.12)' : '1px solid rgba(255,255,255,0.04)',
                    transition: 'all 0.2s'
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🔍 Product
                      </label>
                      <input type="text" list={`product-list-${index}`}
                        className="form-control"
                        style={{
                          width: '100%', padding: '0.55rem 0.65rem', fontSize: '0.85rem', borderRadius: '8px',
                          border: hasProduct ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-color)'
                        }}
                        value={item.productSearch}
                        placeholder="Type product name..."
                        onChange={e => updateItem(index, 'productSearch', e.target.value)} required
                      />
                      <datalist id={`product-list-${index}`}>
                        {products.map(p => (
                          <option key={p.id} value={`${p.name} (SKU: ${p.sku})`} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🔢 Qty
                      </label>
                      <input type="number" min="1" className="form-control"
                        style={{ width: '100%', padding: '0.55rem', fontSize: '0.85rem', borderRadius: '8px' }}
                        value={item.quantity}
                        onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} required />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        💰 Price
                      </label>
                      <div style={{
                        padding: '0.55rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                        background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                        color: item.price > 0 ? '#10b981' : 'var(--text-muted)'
                      }}>
                        ${item.price.toFixed(2)}
                        {rowTotal > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>
                          {' '}= ${rowTotal.toFixed(2)}
                        </span>}
                      </div>
                    </div>

                    <button type="button" onClick={() => removeItem(index)}
                      style={{
                        marginTop: '1.1rem', padding: '0.5rem 0.65rem', background: 'rgba(244,63,94,0.1)',
                        border: '1px solid rgba(244,63,94,0.2)', borderRadius: '8px',
                        color: '#f43f5e', cursor: 'pointer', fontSize: '1rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.1)'; }}
                      title="Remove item">
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel" style={{
          padding: '1.5rem 2rem', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              📊 Order Summary
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total:</span>
              <span style={{
                fontSize: '2rem', fontWeight: 800,
                color: totalAmount > 0 ? 'var(--success)' : 'var(--text-muted)',
                transition: 'color 0.3s'
              }}>
                ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ({totalItems} item{totalItems !== 1 ? 's' : ''})
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn-secondary" onClick={() => router.back()}
              style={{ padding: '0.85rem 1.5rem', fontSize: '0.95rem' }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary"
              disabled={submitting || items.length === 0 || !selectedCustomerId}
              style={{
                padding: '0.85rem 2rem', fontSize: '0.95rem', fontWeight: 700,
                background: submitting ? 'rgba(245,158,11,0.5)' : 'linear-gradient(135deg, #f59e0b, #f97316)',
                border: 'none', borderRadius: '10px',
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
                opacity: submitting || items.length === 0 || !selectedCustomerId ? 0.6 : 1,
                cursor: submitting || items.length === 0 || !selectedCustomerId ? 'not-allowed' : 'pointer'
              }}>
              {submitting ? '⏳ Saving...' : wasRejected ? '🔄 Resubmit Order' : '💾 Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
