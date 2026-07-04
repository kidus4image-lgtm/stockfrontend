'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { showSuccess, showError } from '../../lib/toast';
import { confirmAsync } from '../../lib/confirm';

interface Customer {
  id: number;
  customerName: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  customer: Customer;
}

interface Payment {
  id: number;
  amount: number;
  paymentMethod: string;
  bank: string | null;
  chequeNumber: string | null;
  slipNumber: string | null;
  status: string;
  dueDate: string | null;
  receivedDate: string | null;
  invoice: Invoice;
}

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [banks, setBanks] = useState<{ id: number; bankName: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [methodFilter, setMethodFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [depositModal, setDepositModal] = useState<{ pmtId: number } | null>(null);
  const [depositBank, setDepositBank] = useState('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [bounceModal, setBounceModal] = useState<{ pmtId: number } | null>(null);
  const [bounceReason, setBounceReason] = useState('');

  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const currentUser = storedUser ? JSON.parse(storedUser) : { role: 'sales_user' };
  const userRole = currentUser.role?.toLowerCase() || 'sales_user';
  const isAdmin = userRole === 'admin' || userRole === 'administrator';
  const isManager = userRole === 'manager' || isAdmin;
  const isFinance = userRole === 'finance' || isManager;
  const isCashier = userRole === 'cashier';
  const canManagePayments = isFinance || isManager;

  useEffect(() => {
    fetchPayments();
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/banks');
      if (res.ok) {
        setBanks(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const doDeposit = async (pmtId: number) => {
    if (!depositBank) { showError('Select a deposit bank'); return; }
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${pmtId}/deposit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositBank, depositDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deposit cheque');
      showSuccess('Cheque deposited successfully!');
      fetchPayments();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setDepositModal(null);
    }
  };

  const handleDeposit = (pmtId: number, dueDate?: string) => {
    if (dueDate) {
      const today = new Date().toISOString().split('T')[0];
      const maturity = new Date(dueDate).toISOString().split('T')[0];
      if (today < maturity) { showError(`Cheque cannot be deposited before its maturity date (${maturity})`); return; }
    }
    setDepositDate(new Date().toISOString().split('T')[0]);
    setDepositBank('');
    setDepositModal({ pmtId });
  };

  const handleClearCheque = async (paymentId: number, dueDate?: string) => {
    if (dueDate) {
      const today = new Date().toISOString().split('T')[0];
      const maturity = new Date(dueDate).toISOString().split('T')[0];
      if (today < maturity) { showError(`Cheque cannot be cleared before its maturity date (${maturity})`); return; }
    }
    const date = prompt('Enter cleared date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!date) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${paymentId}/clear`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearedDate: date })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear cheque');
      showSuccess('Cheque successfully cleared!');
      fetchPayments();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const doBounceCheque = async (paymentId: number, reason: string) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${paymentId}/bounce`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to bounce cheque');
      showSuccess('Cheque recorded as bounced.');
      fetchPayments();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setBounceModal(null);
      setBounceReason('');
    }
  };

  const handleBounceCheque = (paymentId: number, dueDate?: string) => {
    if (dueDate) {
      const today = new Date().toISOString().split('T')[0];
      const maturity = new Date(dueDate).toISOString().split('T')[0];
      if (today < maturity) { showError(`Cheque cannot be bounced before its maturity date (${maturity})`); return; }
    }
    setBounceReason('');
    setBounceModal({ pmtId: paymentId });
  };

  const handleVoidPayment = async (paymentId: number) => {
    if (!(await confirmAsync({ title: 'Void Payment', message: 'Are you sure you want to VOID this payment? This will reverse all ledger allocations!', variant: 'danger' }))) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${paymentId}/void`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to void payment');
      showSuccess('Payment transaction successfully voided.');
      fetchPayments();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/payments');
      if (res.ok) {
        setPayments(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch payments journal', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter((pmt) => {
    const matchesSearch =
      pmt.invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pmt.invoice.customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pmt.chequeNumber && pmt.chequeNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (pmt.slipNumber && pmt.slipNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMethod = methodFilter === 'All' || pmt.paymentMethod === methodFilter;

    return matchesSearch && matchesMethod;
  });

  return (
    <div className="dashboard-container">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>Settlement Journal</h1>
        <p style={{ color: 'var(--text-muted)' }}>Corporate audit trail of all Cash and Cheque settlements, with clear status and maturity records.</p>
      </header>

      {/* Search & Filter Controls */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            className="form-control"
            style={{ width: '100%' }}
            placeholder="Search by Invoice, Customer, Cheque #, or Slip..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ minWidth: '160px' }}>
          <select
            className="form-control form-select"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="All">All Methods</option>
            <option value="Cash">Cash Receipts</option>
            <option value="Cheque">Cheques Deposits</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading settlement transactions...
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No settlement logs found. Select an invoice to add payments.
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <th style={{ padding: '1rem' }}>Invoice No.</th>
                <th style={{ padding: '1rem' }}>Customer</th>
                <th style={{ padding: '1rem' }}>Method</th>
                <th style={{ padding: '1rem' }}>Amount</th>
                <th style={{ padding: '1rem' }}>Bank / Slip</th>
                <th style={{ padding: '1rem' }}>Cheque Number</th>
                <th style={{ padding: '1rem' }}>Maturity Date</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const paginatedPayments = filteredPayments.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                return paginatedPayments.map((pmt) => (
                  <tr
                    key={pmt.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => router.push(`/invoices/${pmt.invoice.id}`)}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--accent-hover)' }}>{pmt.invoice.invoiceNumber}</td>
                    <td 
                      style={{ padding: '1rem', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent-hover)' }}
                      title="Click to view customer dashboard"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/customers/${pmt.invoice.customer.id}`);
                      }}
                    >
                      {pmt.invoice.customer.customerName}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: pmt.paymentMethod === 'Cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: pmt.paymentMethod === 'Cash' ? 'var(--success)' : 'var(--warning)'
                      }}>
                        {pmt.paymentMethod}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>
                      ${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td 
                      style={{ 
                        padding: '1rem', 
                        color: pmt.paymentMethod === 'Cheque' ? 'var(--accent-hover)' : 'var(--text-muted)',
                        cursor: pmt.paymentMethod === 'Cheque' ? 'pointer' : 'default',
                        textDecoration: pmt.paymentMethod === 'Cheque' ? 'underline' : 'none'
                      }}
                      title={pmt.paymentMethod === 'Cheque' ? "Click to view bank transactions" : ""}
                      onClick={(e) => {
                        if (pmt.paymentMethod === 'Cheque' && pmt.bank) {
                          e.stopPropagation();
                          const bId = banks.find(b => b.bankName.toLowerCase() === pmt.bank?.toLowerCase())?.id;
                          if (bId) {
                            router.push(`/banks/${bId}`);
                          } else {
                            router.push('/banks');
                          }
                        }
                      }}
                    >
                      {pmt.paymentMethod === 'Cheque' ? pmt.bank : pmt.slipNumber || '-'}
                    </td>
                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>
                      {pmt.chequeNumber || '-'}
                    </td>
                    <td style={{ padding: '1rem', color: pmt.paymentMethod === 'Cheque' ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {pmt.dueDate ? new Date(pmt.dueDate).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        background: pmt.status === 'Collected' ? 'rgba(16, 185, 129, 0.2)' : pmt.status === 'Deposited' ? 'rgba(59, 130, 246, 0.2)' : pmt.status === 'Bounced' || pmt.status === 'Void' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: pmt.status === 'Collected' ? 'var(--success)' : pmt.status === 'Deposited' ? '#60a5fa' : pmt.status === 'Bounced' || pmt.status === 'Void' ? 'var(--danger)' : 'var(--warning)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {pmt.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                        {pmt.status === 'Uncollected' && pmt.paymentMethod === 'Cheque' && canManagePayments && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeposit(pmt.id, pmt.dueDate); }}
                              style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: '#60a5fa',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: '600'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = '#3b82f6';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                e.currentTarget.style.color = '#60a5fa';
                              }}
                            >
                              Deposit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBounceCheque(pmt.id, pmt.dueDate); }}
                              style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                color: 'var(--warning)',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: '600'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = 'var(--warning)';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                                e.currentTarget.style.color = 'var(--warning)';
                              }}
                            >
                              Bounce
                            </button>
                          </>
                        )}
                        {pmt.status === 'Deposited' && pmt.paymentMethod === 'Cheque' && canManagePayments && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClearCheque(pmt.id, pmt.dueDate); }}
                              style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: 'var(--success)',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: '600'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = 'var(--success)';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                                e.currentTarget.style.color = 'var(--success)';
                              }}
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBounceCheque(pmt.id, pmt.dueDate); }}
                              style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                color: 'var(--warning)',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: '600'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = 'var(--warning)';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                                e.currentTarget.style.color = 'var(--warning)';
                              }}
                            >
                              Bounce
                            </button>
                          </>
                        )}
                        {pmt.status !== 'Void' && canManagePayments && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVoidPayment(pmt.id); }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: 'var(--danger)',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              fontWeight: '600'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'var(--danger)';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                              e.currentTarget.style.color = 'var(--danger)';
                            }}
                          >
                            Void
                          </button>
                        )}
                        {pmt.status === 'Void' && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>No Actions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(filteredPayments.length / rowsPerPage));
            return (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                <button 
                  className="btn-secondary" 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  Prev
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  className="btn-secondary" 
                  disabled={currentPage >= totalPages} 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  Next
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Bounce Cheque Reason Modal */}
      {bounceModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 100000, padding: '1.5rem'
        }}
          onClick={(e) => { if (e.target === e.currentTarget) { setBounceModal(null); setBounceReason(''); } }}
        >
          <div className="glass-panel" style={{
            maxWidth: '460px', width: '100%', padding: '2.5rem 2rem 2rem',
            borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(239,68,68,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.25s ease'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', border: '2px solid rgba(239,68,68,0.25)'
            }}>
              <span style={{ fontSize: '2rem' }}>🚫</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#ef4444' }}>
              Bounce Cheque
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '0.9rem' }}>
              Mark this cheque as bounced. Select the reason below.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bounce Reason *</label>
              <select
                className="form-control form-select"
                value={bounceReason}
                onChange={(e) => setBounceReason(e.target.value)}
                style={{ padding: '0.7rem', borderRadius: '10px', width: '100%' }}
              >
                <option value="">-- Select Reason --</option>
                <option value="NSF">Insufficient Funds (NSF)</option>
                <option value="StopPayment">Stop Payment</option>
                <option value="AccountClosed">Account Closed</option>
                <option value="SignatureMismatch">Signature Mismatch</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem'
            }}>
              <button onClick={() => { setBounceModal(null); setBounceReason(''); }}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >Cancel</button>
              <button onClick={() => bounceReason ? doBounceCheque(bounceModal.pmtId, bounceReason) : null}
                disabled={!bounceReason}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 700,
                  background: !bounceReason ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none', borderRadius: '10px', color: !bounceReason ? 'rgba(255,255,255,0.4)' : '#fff',
                  cursor: !bounceReason ? 'not-allowed' : 'pointer',
                  boxShadow: !bounceReason ? 'none' : '0 4px 16px rgba(239,68,68,0.35)',
                  transition: 'all 0.2s'
                }}
              >🚫 Bounce Cheque</button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Cheque Modal */}
      {depositModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 100000, padding: '1.5rem'
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setDepositModal(null); }}
        >
          <div className="glass-panel" style={{
            maxWidth: '440px', width: '100%', padding: '2.5rem 2rem 2rem',
            borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(59,130,246,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            textAlign: 'center', animation: 'slideUp 0.25s ease'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', border: '2px solid rgba(59,130,246,0.25)'
            }}>
              <span style={{ fontSize: '2rem' }}>🏦</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: '#60a5fa' }}>Deposit Cheque</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Select the bank and date for this cheque deposit.
            </p>
            <select className="form-control"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.95rem', marginBottom: '1rem' }}
              value={depositBank}
              onChange={e => setDepositBank(e.target.value)}>
              <option value="">-- Select Deposit Bank --</option>
              {banks.map((b: any) => (
                <option key={b.id} value={b.bankName}>{b.bankName}</option>
              ))}
            </select>
            <input type="date" className="form-control"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '1rem', textAlign: 'center' }}
              value={depositDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setDepositDate(e.target.value)} />
            <div style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', marginTop: '1.5rem'
            }}>
              <button onClick={() => setDepositModal(null)}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >Cancel</button>
              <button onClick={() => doDeposit(depositModal.pmtId)}
                disabled={!depositBank}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 700,
                  background: !depositBank ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none', borderRadius: '10px', color: '#fff',
                  cursor: !depositBank ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
              >✅ Confirm Deposit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
