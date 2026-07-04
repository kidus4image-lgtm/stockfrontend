'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '../../../../lib/api';
import { showSuccess, showError } from '../../../../lib/toast';

export default function AssignBatchesPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<{ [itemId: number]: { batchId: number; quantity: number }[] }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, [orderId]);

  const fetchData = async () => {
    try {
      const [orderRes, batchesRes] = await Promise.all([
        apiFetch(`http://localhost:5000/api/orders/${orderId}`),
        apiFetch('http://localhost:5000/api/inventory/batches')
      ]);
      
      if (orderRes.ok && batchesRes.ok) {
        const specificOrder = await orderRes.json();
        if (!specificOrder || specificOrder.error) {
          setErrorMsg(`Order not found for ID: ${orderId}`);
          setLoading(false);
          return;
        }
        setOrder(specificOrder);
        setBatches(await batchesRes.json());
        
        // Initialize allocations from existing data
        const initAlloc: any = {};
        specificOrder.items.forEach((item: any) => {
          if (item.allocations && item.allocations.length > 0) {
            initAlloc[item.id] = item.allocations.map((a: any) => ({
              batchId: a.batchId,
              quantity: a.quantity
            }));
          } else {
            initAlloc[item.id] = [];
          }
        });
        setAllocations(initAlloc);
      } else {
        const oText = await orderRes.text();
        const bText = await batchesRes.text();
        setErrorMsg(`API Error. Orders: ${oText}. Batches: ${bText}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Fetch failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllocation = (itemId: number, batchId: number, qtyToAlloc: number) => {
    setAllocations(prev => {
      const current = [...(prev[itemId] || [])];
      const existingIdx = current.findIndex(a => a.batchId === batchId);
      if (existingIdx >= 0) {
        current[existingIdx].quantity += qtyToAlloc;
      } else {
        current.push({ batchId, quantity: qtyToAlloc });
      }
      return { ...prev, [itemId]: current };
    });
  };

  const handleQtyChange = (itemId: number, batchIdx: number, newQty: number) => {
    setAllocations(prev => {
      const current = [...(prev[itemId] || [])];
      if (newQty <= 0) {
        current.splice(batchIdx, 1);
      } else {
        current[batchIdx] = { ...current[batchIdx], quantity: newQty };
      }
      return { ...prev, [itemId]: current };
    });
  };

  const handleRemoveAllocation = (itemId: number, batchIdx: number) => {
    setAllocations(prev => {
      const current = [...(prev[itemId] || [])];
      current.splice(batchIdx, 1);
      return { ...prev, [itemId]: current };
    });
  };

  const handleSubmit = async () => {
    // validation is handled by button disabled state
    setSubmitting(true);
    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    
    // flatten allocations
    const flatAllocations = [];
    for (const [itemId, allocs] of Object.entries(allocations)) {
      for (const a of allocs) {
        flatAllocations.push({
          orderItemId: parseInt(itemId),
          batchId: a.batchId,
          quantity: a.quantity
        });
      }
    }

    try {
      const res = await apiFetch(`http://localhost:5000/api/orders/${orderId}/store-confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: flatAllocations,
          username: user?.username || 'System'
        })
      });
      
      if (res.ok) {
        showSuccess('Batches assigned and order confirmed by store!');
        router.push('/orders');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to confirm');
      }
    } catch (err) {
      console.error(err);
      showError('Error confirming order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading...</div>;
  if (errorMsg) return <div style={{ padding: '3rem', textAlign: 'center', color: 'red' }}>Error: {errorMsg}</div>;
  if (!order) return <div style={{ padding: '3rem', textAlign: 'center', wordBreak: 'break-all' }}>Order not found. Requested ID: {orderId}</div>;

  // Check if fully allocated
  let isFullyAllocated = true;
  order.items.forEach((item: any) => {
    const allocatedForThis = (allocations[item.id] || []).reduce((sum, a) => sum + a.quantity, 0);
    if (allocatedForThis !== item.quantity) {
      isFullyAllocated = false;
    }
  });

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
          <button onClick={() => router.back()} style={{ 
            background: 'transparent', border: 'none', color: 'var(--text-muted)', 
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', 
            fontSize: '0.85rem', marginBottom: '1rem', transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            ← Back to Order
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(to right, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Assign Batches: {order.orderNumber}
            </h1>
            <span style={{ 
              fontSize: '0.75rem', padding: '0.4rem 0.8rem', borderRadius: '50px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              background: isFullyAllocated ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: isFullyAllocated ? '#10b981' : '#f59e0b',
              border: `1px solid ${isFullyAllocated ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
            }}>
              {isFullyAllocated ? 'Fully Allocated' : 'Pending Allocation'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            Customer: <span style={{ color: '#60a5fa', fontWeight: 500 }}>{order.customer?.customerName || 'Unknown'}</span> • Total: ${(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {order.items.map((item: any) => {
          const productBatches = batches.filter(b => b.productId === item.productId && b.quantity - b.reservedQuantity > 0);
          const currentAllocations = allocations[item.id] || [];
          const totalAllocated = currentAllocations.reduce((sum, a) => sum + a.quantity, 0);
          const remainingToAlloc = item.quantity - totalAllocated;
          const isItemFullyAllocated = remainingToAlloc === 0;

          return (
            <div key={item.id} className="glass-panel" style={{ padding: '2rem', borderLeft: `4px solid ${isItemFullyAllocated ? '#10b981' : '#f59e0b'}`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontSize: '1.2rem' }}>
                    📦
                  </div>
                  {item.product?.name} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>({item.product?.sku})</span>
                </h3>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Required Qty: <strong style={{ color: '#f8fafc', fontSize: '1.1rem' }}>{item.quantity}</strong></p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: isItemFullyAllocated ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
                    Remaining: {remainingToAlloc}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Current Allocations */}
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Batches</h4>
                  {currentAllocations.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {currentAllocations.map((alloc, idx) => {
                        const bInfo = productBatches.find(b => b.id === alloc.batchId);
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                            <span style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>Batch: <strong style={{ color: '#f8fafc' }}>{bInfo?.batchNumber || alloc.batchId}</strong></span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <input
                                type="number"
                                min="1"
                                value={alloc.quantity}
                                onChange={(e) => handleQtyChange(item.id, idx, parseInt(e.target.value) || 0)}
                                style={{ width: '80px', padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#f8fafc', textAlign: 'center', fontSize: '0.9rem' }}
                              />
                              <button type="button" onClick={() => handleRemoveAllocation(item.id, idx)} style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.1)'}>
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No batches assigned yet.
                    </div>
                  )}
                </div>

                {/* Available Batches */}
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available to Pull From</h4>
                  {remainingToAlloc > 0 ? (
                    <div className="table-responsive" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(15,23,42,0.6)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <th style={{ padding: '0.75rem' }}>Batch</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Avail</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Expiry</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productBatches.map(batch => {
                            const avail = batch.quantity - (batch.reservedQuantity || 0);
                            const maxToTake = Math.min(avail, remainingToAlloc);
                            if (maxToTake <= 0) return null;

                            return (
                              <tr key={batch.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ padding: '0.75rem', fontWeight: 600, fontSize: '0.85rem' }}>{batch.batchNumber}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: '#10b981' }}>{avail}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '-'}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                  <button 
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(56,189,248,0.1)'}
                                    onClick={() => handleAddAllocation(item.id, batch.id, maxToTake)}
                                  >
                                    + Take {maxToTake}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {productBatches.length === 0 && (
                            <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: '#fb7185', fontSize: '0.9rem' }}>No batches available in inventory! Cannot fulfill order.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', color: '#34d399', height: '100%', minHeight: '100px' }}>
                      <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</span>
                      <strong style={{ fontSize: '1rem' }}>Fully Allocated</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Floating Action Bar */}
      <div className="sticky-footer-bar" style={{ justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '1200px', justifyContent: 'flex-end', alignItems: 'center' }}>
          
          <div style={{ marginRight: 'auto' }}>
            {!isFullyAllocated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', color: '#fbbf24', fontSize: '0.85rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span> 
                <strong>Please allocate all items to proceed.</strong>
              </div>
            )}
          </div>

          <button className="btn-secondary" onClick={() => router.back()} style={{ padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px' }}>
            Cancel
          </button>
          
          <button 
            disabled={!isFullyAllocated || submitting}
            onClick={handleSubmit}
            style={{ 
              padding: '0.7rem 2rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', 
              background: !isFullyAllocated || submitting ? 'rgba(16, 185, 129, 0.3)' : 'linear-gradient(135deg, #10b981, #059669)', 
              border: 'none', color: '#fff', cursor: !isFullyAllocated || submitting ? 'not-allowed' : 'pointer', 
              boxShadow: !isFullyAllocated || submitting ? 'none' : '0 4px 15px rgba(16,185,129,0.3)', transition: 'all 0.2s' 
            }} 
            onMouseEnter={e => { if (!(!isFullyAllocated || submitting)) e.currentTarget.style.transform='translateY(-2px)' }} 
            onMouseLeave={e => { if (!(!isFullyAllocated || submitting)) e.currentTarget.style.transform='none' }}
          >
            {submitting ? 'Confirming...' : 'Confirm Store Allocation ✅'}
          </button>
        </div>
      </div>
    </div>
  );
}
