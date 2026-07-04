'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { apiFetch } from '../../../lib/api';
import { showSuccess, showError } from '../../../lib/toast';
import { confirmAsync } from '../../../lib/confirm';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [timeFilter, setTimeFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [invoiceSalesTypeFilter, setInvoiceSalesTypeFilter] = useState('All');
  const [invoiceMinAmount, setInvoiceMinAmount] = useState('');
  const [invoiceMaxAmount, setInvoiceMaxAmount] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('All');
  const [paymentMinAmount, setPaymentMinAmount] = useState('');
  const [paymentMaxAmount, setPaymentMaxAmount] = useState('');
  const [paymentBankFilter, setPaymentBankFilter] = useState('');
  
  // Pagination
  const [currentPageInvoices, setCurrentPageInvoices] = useState(1);
  const [currentPagePayments, setCurrentPagePayments] = useState(1);
  const rowsPerPage = 10;

  // Corporate banks & Bulk Payment states
  const [banks, setBanks] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [payAmount, setPayAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [selectedBank, setSelectedBank] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [slipNumber, setSlipNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  
  // Custom Allocations Override states
  const [customAllocations, setCustomAllocations] = useState<{[key: number]: string}>({});
  const [isCustomAlloc, setIsCustomAlloc] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payments' | 'ledger'>('overview');
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [depositModal, setDepositModal] = useState<{ pmtId: number } | null>(null);
  const [depositBank, setDepositBank] = useState('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchCustomerDetails();
    fetchBanks();
  }, [id]);

  const fetchCustomerDetails = async () => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/customers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
      }
    } catch (err) {
      console.error('Failed to fetch customer details', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/banks');
      if (res.ok) {
        setBanks(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch corporate banks', err);
    }
  };

  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/customers/${id}/ledger`);
      const data = await res.json();
      if (res.ok) setLedger(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLedgerLoading(false); }
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
      fetchCustomerDetails();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setDepositModal(null);
    }
  };

  const handleDeposit = (pmtId: number) => {
    setDepositDate(new Date().toISOString().split('T')[0]);
    setDepositBank('');
    setDepositModal({ pmtId });
  };

  const handleClearCheque = async (paymentId: number) => {
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
      fetchCustomerDetails();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleBounceCheque = async (paymentId: number) => {
    if (!(await confirmAsync({ title: 'Bounce Cheque', message: 'Are you sure you want to BOUNCE this cheque?', variant: 'danger' }))) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${paymentId}/bounce`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to bounce cheque');
      showSuccess('Cheque recorded as bounced.');
      fetchCustomerDetails();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleVoidPayment = async (paymentId: number) => {
    if (!(await confirmAsync({ title: 'Void Payment', message: 'Are you sure you want to VOID this payment? This will reverse all ledger allocations!', variant: 'danger' }))) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${paymentId}/void`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to void payment');
      showSuccess('Payment transaction successfully voided.');
      fetchCustomerDetails();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleResolveReminder = async (reminderId: number) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/reminders/${reminderId}/resolve`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resolve reminder');
      }
      fetchCustomerDetails();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleRegisterBulkPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');

    if (!payAmount || parseFloat(payAmount) <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    if (!selectedBank) {
      setPaymentError('Deposit bank is required for all payments.');
      return;
    }

    if (paymentMethod === 'Cheque') {
      if (!chequeNumber || !dueDate) {
        setPaymentError('Cheque Number and Maturity Date are required for cheque payments.');
        return;
      }
    }

    setSubmittingPayment(true);

    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/customer/${id}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          paymentMethod,
          bank: selectedBank,
          chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : null,
          slipNumber: slipNumber || null,
          dueDate: paymentMethod === 'Cheque' ? dueDate : null,
          receivedDate: receivedDate || null,
          customAllocations: isCustomAlloc ? Object.keys(customAllocations).map(invoiceId => ({
            invoiceId: parseInt(invoiceId),
            amount: parseFloat(customAllocations[parseInt(invoiceId)]) || 0
          })) : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit bulk payment.');
      }

      setPaymentSuccess(data.message || 'Payment successfully registered and distributed!');
      setPayAmount('');
      setChequeNumber('');
      setSlipNumber('');
      setDueDate('');
      setReceivedDate('');
      setCustomAllocations({});
      setIsCustomAlloc(false);

      // Refresh customer details
      fetchCustomerDetails();
      
      // Close modal after a short delay
      setTimeout(() => {
        setShowPaymentModal(false);
        setPaymentSuccess('');
      }, 3000);

    } catch (err: any) {
      setPaymentError(err.message || 'Payment submission failed.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading Customer Dashboard...
      </div>
    );
  }

  if (!customer) {
    return <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', marginTop: '2rem' }}>Customer not found. Ensure the ID is correct.</div>;
  }

  // ---- FILTERING LOGIC ----
  const filterByTime = (dateString: string) => {
    if (timeFilter === 'all') return true;
    const d = new Date(dateString);
    const now = new Date();
    if (timeFilter === 'thisMonth') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (timeFilter === 'thisYear') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filteredInvoices = customer.invoices?.filter((inv: any) => {
    const timeMatch = filterByTime(inv.createdAt);
    const statusMatch = invoiceStatusFilter === 'All' || inv.computedStatus === invoiceStatusFilter || inv.status === invoiceStatusFilter;
    const searchMatch = !invoiceSearch || inv.invoiceNumber?.toLowerCase().includes(invoiceSearch.toLowerCase());
    const salesTypeMatch = invoiceSalesTypeFilter === 'All' || inv.salesType === invoiceSalesTypeFilter;
    const minMatch = !invoiceMinAmount || inv.amount >= parseFloat(invoiceMinAmount);
    const maxMatch = !invoiceMaxAmount || inv.amount <= parseFloat(invoiceMaxAmount);
    return timeMatch && statusMatch && searchMatch && salesTypeMatch && minMatch && maxMatch;
  }) || [];

  const filteredPayments = customer.payments?.filter((pmt: any) => {
    const timeMatch = filterByTime(pmt.receivedDate);
    const statusMatch = paymentStatusFilter === 'All' || pmt.status === paymentStatusFilter;
    const searchMatch = !paymentSearch || pmt.chequeNumber?.toLowerCase().includes(paymentSearch.toLowerCase()) || pmt.slipNumber?.toLowerCase().includes(paymentSearch.toLowerCase()) || pmt.paymentMethod?.toLowerCase().includes(paymentSearch.toLowerCase());
    const methodMatch = paymentMethodFilter === 'All' || pmt.paymentMethod === paymentMethodFilter;
    const minMatch = !paymentMinAmount || pmt.amount >= parseFloat(paymentMinAmount);
    const maxMatch = !paymentMaxAmount || pmt.amount <= parseFloat(paymentMaxAmount);
    const bankMatch = !paymentBankFilter || pmt.bank?.toLowerCase().includes(paymentBankFilter.toLowerCase());
    return timeMatch && statusMatch && searchMatch && methodMatch && minMatch && maxMatch && bankMatch;
  }) || [];

  // ---- CHARTS DATA PREPARATION ----
  const COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#60a5fa', '#8b5cf6'];

  // Invoice Chart Data
  const invoiceChartData = filteredInvoices.map((inv: any) => ({
    name: inv.invoiceNumber,
    Total: inv.amount,
    Remaining: inv.remainingPayment,
  })).slice(0, 10); // show top 10 recent

  // Payment Methods Pie Data
  const methodMap: any = {};
  filteredPayments.forEach((pmt: any) => {
    methodMap[pmt.paymentMethod] = (methodMap[pmt.paymentMethod] || 0) + pmt.amount;
  });
  const paymentPieData = Object.keys(methodMap).map(key => ({
    name: key,
    value: methodMap[key]
  }));

  // Collection Trend (Line Chart)
  // Group payments by month
  const trendMap: any = {};
  filteredPayments.forEach((pmt: any) => {
    const d = new Date(pmt.receivedDate);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    trendMap[month] = (trendMap[month] || 0) + pmt.amount;
  });
  const trendData = Object.keys(trendMap).sort().map(key => ({
    name: key,
    Collections: trendMap[key]
  }));

  // Simulated allocations for visual confirmation
  const getSimulatedAllocations = () => {
    if (!customer || !customer.invoices) return { allocations: [], surplus: 0, totalAllocated: 0, overAllocated: 0 };
    const unpaid = customer.invoices
      .filter((inv: any) => {
        const s = inv.computedStatus || inv.status;
        return s !== 'Paid' && s !== 'Void' && inv.remainingPayment > 0;
      })
      .sort((a: any, b: any) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

    const totalTyped = parseFloat(payAmount) || 0;

    if (isCustomAlloc) {
      let totalAllocated = 0;
      const allocations = unpaid.map((inv: any) => {
        const userVal = customAllocations[inv.id];
        const allocated = userVal !== undefined ? (parseFloat(userVal) || 0) : 0;
        totalAllocated += allocated;

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          paymentDate: inv.paymentDate,
          remainingPayment: inv.remainingPayment,
          allocated,
          newRemaining: Math.max(0, inv.remainingPayment - allocated)
        };
      });

      const overAllocated = Math.max(0, totalAllocated - totalTyped);
      const surplus = Math.max(0, totalTyped - totalAllocated);

      return { allocations, surplus, totalAllocated, overAllocated };
    } else {
      let simulatedLeft = totalTyped;
      let totalAllocated = 0;
      const allocations = unpaid.map((inv: any) => {
        const allocated = Math.min(simulatedLeft, inv.remainingPayment);
        simulatedLeft -= allocated;
        totalAllocated += allocated;
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          paymentDate: inv.paymentDate,
          remainingPayment: inv.remainingPayment,
          allocated,
          newRemaining: inv.remainingPayment - allocated
        };
      });

      return { allocations, surplus: simulatedLeft, totalAllocated, overAllocated: 0 };
    }
  };

  const { allocations, surplus, totalAllocated, overAllocated } = getSimulatedAllocations();
  const totalTyped = parseFloat(payAmount) || 0;

  return (
    <div className="dashboard-container">
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <button 
            onClick={() => router.push('/customers')} 
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-hover)', cursor: 'pointer', marginBottom: '1rem', fontWeight: 'bold' }}
          >
            &larr; Back to Accounts
          </button>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>Customer Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Interactive details & analytics for <strong>{customer.customerName}</strong></p>
          {customer.salesRep && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Sales Person: <strong>{customer.salesRep.firstName} {customer.salesRep.lastName}</strong>
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" onClick={() => setShowPaymentModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>
            💸 Register Bulk Payment
          </button>
          <button className="btn-secondary" onClick={() => router.push(`/customers/${customer.id}/report`)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📄 Printable Report
          </button>
          <button className="btn-secondary" onClick={() => router.push(`/customers/${customer.id}/edit`)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(96, 165, 250, 0.15)', border: '1px solid rgba(96, 165, 250, 0.3)', color: '#60a5fa' }}>
            ✏️ Edit Customer
          </button>
          <button className="btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🖨️ Print Dashboard
          </button>
        </div>
      </header>

      {/* TAB BAR */}
      <div className="no-print" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
        {(['overview', 'invoices', 'payments'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.6rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
              background: activeTab === tab ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: activeTab === tab ? '#60a5fa' : 'var(--text-muted)',
              border: activeTab === tab ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              borderRadius: '10px', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (activeTab !== tab) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; } }}
            onMouseLeave={e => { if (activeTab !== tab) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
          >
            {tab === 'overview' ? '📊 Overview' : tab === 'invoices' ? '📄 Invoices' : '💰 Payments'}
          </button>
        ))}
        <button
          onClick={() => { setActiveTab('ledger'); fetchLedger(); }}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '8px',
            border: activeTab === 'ledger' ? '1px solid rgba(96, 165, 250, 0.4)' : '1px solid transparent',
            background: activeTab === 'ledger' ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
            color: activeTab === 'ledger' ? '#60a5fa' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          📒 Ledger
        </button>
      </div>

      {/* BULK PAYMENT MODAL */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '1080px',
            padding: '2.5rem',
            borderRadius: '20px',
            background: 'rgba(17, 24, 39, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            position: 'relative'
          }}>
            <button
              onClick={() => {
                setShowPaymentModal(false);
                setCustomAllocations({});
                setIsCustomAlloc(false);
              }}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.5rem',
                cursor: 'pointer',
                transition: 'color 0.2s',
                zIndex: 10
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              &times;
            </button>

            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <h2 className="text-gradient" style={{ fontSize: '1.85rem', marginBottom: '0.25rem', fontWeight: 800 }}>Bulk Settlement Desk</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                Allocate and register bulk payments for <strong>{customer.customerName}</strong>. Auto-disperses oldest-to-newest with live override control.
              </p>
            </div>

            <form onSubmit={handleRegisterBulkPayment}>
              {paymentError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  ⚠️ {paymentError}
                </div>
              )}

              {paymentSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  ✅ {paymentSuccess}
                </div>
              )}

              {/* TWO COLUMN CONTENT */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr', gap: '2.5rem', marginBottom: '2rem' }}>
                
                {/* LEFT COLUMN: FORM CONTROLS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--accent-hover)', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', margin: 0 }}>
                    1. Receipt Details
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Payment Method</label>
                      <select
                        className="form-control"
                        style={{ width: '100%', padding: '0.75rem' }}
                        value={paymentMethod}
                        onChange={(e) => {
                          setPaymentMethod(e.target.value);
                          if (e.target.value === 'Cash') {
                            setChequeNumber('');
                            setDueDate('');
                          }
                        }}
                      >
                        <option value="Cash">Cash Receipts</option>
                        <option value="Cheque">Cheque Deposits</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Amount (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="form-control"
                        style={{ width: '100%', padding: '0.75rem' }}
                        placeholder="0.00"
                        value={payAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPayAmount(val);
                          if (isCustomAlloc) {
                            setCustomAllocations({});
                            setIsCustomAlloc(false);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Deposit / Reference Bank</label>
                    <select
                      className="form-control"
                      style={{ width: '100%', padding: '0.75rem' }}
                      required
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                    >
                      <option value="">-- Choose Corporate Bank --</option>
                      {banks.map((b) => (
                        <option key={b.id} value={b.bankName}>
                          {b.bankName} - {b.accountNumber}
                        </option>
                      ))}
                    </select>
                  </div>

                  {paymentMethod === 'Cheque' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cheque Number</label>
                        <input
                          type="text"
                          required
                          className="form-control"
                          style={{ width: '100%', padding: '0.75rem' }}
                          placeholder="CHQ-xxxxxx"
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Maturity / Due Date</label>
                        <input
                          type="date"
                          required
                          className="form-control"
                          style={{ width: '100%', padding: '0.75rem' }}
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Deposit Slip Number (Optional)</label>
                      <input
                        type="text"
                        className="form-control"
                        style={{ width: '100%', padding: '0.75rem' }}
                        placeholder="SLIP-xxxxxx"
                        value={slipNumber}
                        onChange={(e) => setSlipNumber(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Payment Received Date (Optional)</label>
                    <input
                      type="date"
                      className="form-control"
                      style={{ width: '100%', padding: '0.75rem' }}
                      value={receivedDate}
                      onChange={(e) => setReceivedDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN: LIVE SIMULATOR & CUSTOM OVERRIDES */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '1rem', color: 'var(--accent-hover)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                      2. Allocation Setup
                    </h4>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <input
                        type="checkbox"
                        checked={isCustomAlloc}
                        disabled={parseFloat(payAmount) <= 0}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsCustomAlloc(checked);
                          if (checked) {
                            const initialCustoms: any = {};
                            allocations.forEach((a: any) => {
                              initialCustoms[a.id] = a.allocated > 0 ? a.allocated.toString() : '';
                            });
                            setCustomAllocations(initialCustoms);
                          } else {
                            setCustomAllocations({});
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      ✏️ Edit Manually
                    </label>
                  </div>

                  {parseFloat(payAmount) > 0 ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {allocations.map((alloc: any) => (
                          <div key={alloc.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '8px',
                            background: alloc.allocated > 0 ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                            border: alloc.allocated > 0 ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(255,255,255,0.03)',
                            transition: 'all 0.2s'
                          }}>
                            <div>
                              <strong style={{ color: 'var(--text-main)', display: 'block' }}>{alloc.invoiceNumber}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Due: {new Date(alloc.paymentDate).toLocaleDateString()}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outstanding: ${alloc.remainingPayment.toLocaleString()}</span>
                                {alloc.allocated > 0 && !isCustomAlloc && (
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: alloc.newRemaining === 0 ? 'var(--success)' : 'var(--warning)', fontWeight: '600' }}>
                                    {alloc.newRemaining === 0 ? '✨ Settled' : `Leftover: $${alloc.newRemaining.toLocaleString()}`}
                                  </span>
                                )}
                              </div>

                              <div style={{ width: '130px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {isCustomAlloc ? (
                                  <div style={{ position: 'relative', width: '100%' }}>
                                    <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      className="form-control"
                                      style={{ width: '100%', padding: '0.35rem 0.5rem 0.35rem 1.25rem', fontSize: '0.85rem', textAlign: 'right', borderRadius: '6px' }}
                                      value={customAllocations[alloc.id] || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (parseFloat(val) > alloc.remainingPayment) {
                                          setCustomAllocations({ ...customAllocations, [alloc.id]: alloc.remainingPayment.toString() });
                                        } else {
                                          setCustomAllocations({ ...customAllocations, [alloc.id]: val });
                                        }
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <strong style={{ color: alloc.allocated > 0 ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.95rem' }}>
                                    {alloc.allocated > 0 ? `-$${alloc.allocated.toLocaleString()}` : '$0.00'}
                                  </strong>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* SUMMARY / OVERVIEW BOX */}
                      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Total Payment:</span>
                          <strong style={{ color: 'var(--text-main)' }}>${totalTyped.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Total Allocated:</span>
                          <strong style={{ color: 'var(--accent-hover)' }}>${totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>

                        {overAllocated > 0 && (
                          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: '#fca5a5', marginTop: '0.5rem' }}>
                            ⚠️ Over-allocated by <strong>${overAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>. Please reduce individual manual allocations.
                          </div>
                        )}

                        {surplus > 0 && (
                          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: '#93c5fd', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>💰</span>
                            <span>Surplus leftover: <strong>${surplus.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> (will be added to customer credit balance).</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px', minHeight: '150px' }}>
                      Enter a payment amount to preview live dispersal details.
                    </div>
                  )}
                </div>

              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setCustomAllocations({});
                    setIsCustomAlloc(false);
                  }}
                  disabled={submittingPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', padding: '0.75rem 2rem' }}
                  disabled={submittingPayment || overAllocated > 0}
                >
                  {submittingPayment ? 'Processing Settlement...' : 'Confirm Bulk Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === 'overview' && (
      <>
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f43f5e' }}>
          <div className="stat-title">Current Outstanding</div>
          <div className="stat-value" style={{ color: '#f43f5e' }}>
            ${(customer.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total uncollected balance</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-title">Total Purchases</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>
            ${(customer.totalPurchase || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lifetime purchases</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-title">Extra Paid</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            ${(customer.extraPayed || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Overpayments</div>
        </div>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-title">Bounced Cheques</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            ${(customer.bouncedCheques || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Unsuccessful collections</div>
        </div>
      </div>

      {/* REMINDERS / ALERTS */}
      {customer.reminders && customer.reminders.filter((r: any) => !r.isResolved).length > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚠️ Active Alerts & Reminders
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {customer.reminders.filter((r: any) => !r.isResolved).map((reminder: any) => (
              <div key={reminder.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <div style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                  {reminder.message}
                </div>
                <button
                  onClick={() => handleResolveReminder(reminder.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'var(--text-muted)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    marginLeft: '1rem'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="glass-panel no-print" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Filters</h3>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Time Period:</label>
          <select 
            className="form-control" 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem', fontSize: '0.85rem' }}
          >
            <option value="all">All Time</option>
            <option value="thisMonth">This Month</option>
            <option value="thisYear">This Year</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Invoice Status:</label>
          <select 
            className="form-control" 
            value={invoiceStatusFilter} 
            onChange={(e) => setInvoiceStatusFilter(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem', fontSize: '0.85rem' }}
          >
            <option value="All">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Critical">Critical</option>
            <option value="Upcoming">Upcoming</option>
          </select>
        </div>
      </div>

      {/* CHARTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Recent Invoices (Amt vs Remaining)</h3>
          <div style={{ height: '300px', width: '100%' }}>
            {invoiceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invoiceChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `$${val/1000}k`} />
                  <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="Total" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Remaining" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No invoice data for selected filters.</div>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Payment Methods Breakdown</h3>
          <div style={{ height: '300px', width: '100%' }}>
            {paymentPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {paymentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: any) => `$${Number(val).toLocaleString()}`} contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No payment data for selected filters.</div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--accent-hover)' }}>Collection Trend</h3>
        <div style={{ height: '300px', width: '100%' }}>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `$${val/1000}k`} />
                <RechartsTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                <Legend />
                <Line type="monotone" dataKey="Collections" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
             <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No collection trend data.</div>
          )}
        </div>
      </div>

      </>)} {/* end overview */}

      {/* ========== INVOICES TAB ========== */}
      {activeTab === 'invoices' && (
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Filtered Invoices Report</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" placeholder="🔍 Search invoice..." value={invoiceSearch} onChange={e => { setInvoiceSearch(e.target.value); setCurrentPageInvoices(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', width: '150px' }} />
            <select value={invoiceStatusFilter} onChange={e => { setInvoiceStatusFilter(e.target.value); setCurrentPageInvoices(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem' }}>
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Paid">Paid</option>
              <option value="Void">Void</option>
              <option value="Overdue">Overdue</option>
            </select>
            <select value={invoiceSalesTypeFilter} onChange={e => { setInvoiceSalesTypeFilter(e.target.value); setCurrentPageInvoices(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem' }}>
              <option value="All">All Types</option>
              <option value="Credit">Credit</option>
              <option value="Cash">Cash</option>
            </select>
            <input type="number" step="0.01" placeholder="Min $" value={invoiceMinAmount} onChange={e => { setInvoiceMinAmount(e.target.value); setCurrentPageInvoices(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', width: '80px' }} />
            <input type="number" step="0.01" placeholder="Max $" value={invoiceMaxAmount} onChange={e => { setInvoiceMaxAmount(e.target.value); setCurrentPageInvoices(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', width: '80px' }} />
            <select value={timeFilter} onChange={e => { setTimeFilter(e.target.value); setCurrentPageInvoices(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem' }}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <th style={{ padding: '1rem' }}>Invoice No.</th>
                <th style={{ padding: '1rem' }}>Bill Date</th>
                <th style={{ padding: '1rem' }}>Due Date</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Total Amount</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Remaining</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const paginatedInvoices = filteredInvoices.slice((currentPageInvoices - 1) * rowsPerPage, currentPageInvoices * rowsPerPage);
                return paginatedInvoices.length > 0 ? (
                  paginatedInvoices.map((inv: any) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: '1rem' }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem' }}>{new Date(inv.paymentDate).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: inv.remainingPayment > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        ${inv.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          background: inv.status === 'Paid' || inv.computedStatus === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: inv.status === 'Paid' || inv.computedStatus === 'Paid' ? 'var(--success)' : 'var(--warning)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {(() => {
                            const raw = inv.computedStatus || inv.status;
                            return raw === 'Overdue' ? 'Overdue - Not Paid' : raw === 'Critical' ? 'Critical - Not Paid' : raw;
                          })()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No invoices match the selected filters.</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / rowsPerPage));
            return (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                <button 
                  className="btn-secondary" 
                  disabled={currentPageInvoices === 1} 
                  onClick={() => setCurrentPageInvoices(p => Math.max(1, p - 1))}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  Prev
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Page {currentPageInvoices} of {totalPages}
                </span>
                <button 
                  className="btn-secondary" 
                  disabled={currentPageInvoices >= totalPages} 
                  onClick={() => setCurrentPageInvoices(p => Math.min(totalPages, p + 1))}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  Next
                </button>
              </div>
            );
          })()}
        </div>
      </div>)} {/* end invoices */}

      {/* ========== PAYMENTS TAB ========== */}
      {activeTab === 'payments' && (
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Filtered Payments Report</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" placeholder="🔍 Search cheque/slip..." value={paymentSearch} onChange={e => { setPaymentSearch(e.target.value); setCurrentPagePayments(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', width: '140px' }} />
            <select value={paymentStatusFilter} onChange={e => { setPaymentStatusFilter(e.target.value); setCurrentPagePayments(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem' }}>
              <option value="All">All Status</option>
              <option value="Collected">Collected</option>
              <option value="Uncollected">Uncollected</option>
              <option value="Deposited">Deposited</option>
              <option value="Bounced">Bounced</option>
              <option value="Void">Void</option>
            </select>
            <select value={paymentMethodFilter} onChange={e => { setPaymentMethodFilter(e.target.value); setCurrentPagePayments(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem' }}>
              <option value="All">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
            </select>
            <input type="text" placeholder="🏦 Bank" value={paymentBankFilter} onChange={e => { setPaymentBankFilter(e.target.value); setCurrentPagePayments(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', width: '100px' }} />
            <input type="number" step="0.01" placeholder="Min $" value={paymentMinAmount} onChange={e => { setPaymentMinAmount(e.target.value); setCurrentPagePayments(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', width: '70px' }} />
            <input type="number" step="0.01" placeholder="Max $" value={paymentMaxAmount} onChange={e => { setPaymentMaxAmount(e.target.value); setCurrentPagePayments(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', width: '70px' }} />
            <select value={timeFilter} onChange={e => { setTimeFilter(e.target.value); setCurrentPagePayments(1); }}
              style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem' }}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <th style={{ padding: '1rem' }}>Receipt Date</th>
                <th style={{ padding: '1rem' }}>Inv. Ref</th>
                <th style={{ padding: '1rem' }}>Method</th>
                <th style={{ padding: '1rem' }}>Bank / Ref</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'center' }} className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const paginatedPayments = filteredPayments.slice((currentPagePayments - 1) * rowsPerPage, currentPagePayments * rowsPerPage);
                return paginatedPayments.length > 0 ? (
                  paginatedPayments.map((pmt: any) => (
                    <tr key={pmt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem' }}>{new Date(pmt.receivedDate).toLocaleDateString()}</td>
                      <td 
                        style={{ padding: '1rem', fontWeight: '600', color: 'var(--accent-hover)', cursor: 'pointer', textDecoration: 'underline' }}
                        title="Click to view invoice details"
                        onClick={() => {
                          if (pmt.invoiceId) {
                            router.push(`/invoices/${pmt.invoiceId}`);
                          }
                        }}
                      >
                        {pmt.invoiceNumber}
                      </td>
                      <td style={{ padding: '1rem' }}>{pmt.paymentMethod}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                        {pmt.bank ? `Bank: ${pmt.bank} ` : ''}
                        {pmt.chequeNumber ? `| Chq: ${pmt.chequeNumber} ` : ''}
                        {pmt.slipNumber ? `| Slip: ${pmt.slipNumber}` : ''}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>
                        +${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          background: pmt.status === 'Collected' ? 'rgba(16, 185, 129, 0.15)' : pmt.status === 'Deposited' ? 'rgba(59, 130, 246, 0.15)' : pmt.status === 'Bounced' || pmt.status === 'Void' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: pmt.status === 'Collected' ? 'var(--success)' : pmt.status === 'Deposited' ? '#60a5fa' : pmt.status === 'Bounced' || pmt.status === 'Void' ? 'var(--danger)' : 'var(--warning)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {pmt.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }} className="no-print">
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                          {pmt.status === 'Uncollected' && pmt.paymentMethod === 'Cheque' && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeposit(pmt.id); }}
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
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBounceCheque(pmt.id); }}
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
                          {pmt.status === 'Deposited' && pmt.paymentMethod === 'Cheque' && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClearCheque(pmt.id); }}
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
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBounceCheque(pmt.id); }}
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
                          {pmt.status !== 'Void' && (
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No payments match the selected filters.</td>
                  </tr>
                );
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
                  disabled={currentPagePayments === 1} 
                  onClick={() => setCurrentPagePayments(p => Math.max(1, p - 1))}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  Prev
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Page {currentPagePayments} of {totalPages}
                </span>
                <button 
                  className="btn-secondary" 
                  disabled={currentPagePayments >= totalPages} 
                  onClick={() => setCurrentPagePayments(p => Math.min(totalPages, p + 1))}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  Next
                </button>
              </div>
            );
          })()}
        </div>
      </div>)} {/* end payments */}

      {/* ========== LEDGER TAB ========== */}
      {activeTab === 'ledger' && (
        <div style={{ padding: '1.5rem' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Transaction Ledger</h3>
          {ledgerLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading...</div>
          ) : ledger.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No ledger entries found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Date', 'Type', 'Description', 'Debit', 'Credit'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 1rem', textAlign: h === 'Debit' || h === 'Credit' ? 'right' : 'left', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '0.6rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.6rem 1rem' }}>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: entry.type.includes('void') || entry.type.includes('reversed')
                            ? 'rgba(244,63,94,0.1)'
                            : entry.type === 'overpayment'
                            ? 'rgba(167,139,250,0.15)'
                            : entry.type === 'extra_payment_used' || entry.type === 'credit_applied'
                            ? 'rgba(251,191,36,0.15)'
                            : 'rgba(16,185,129,0.1)',
                          color: entry.type.includes('void') || entry.type.includes('reversed')
                            ? 'var(--danger)'
                            : entry.type === 'overpayment'
                            ? '#a78bfa'
                            : entry.type === 'extra_payment_used' || entry.type === 'credit_applied'
                            ? '#fbbf24'
                            : 'var(--success)'
                        }}>
                          {entry.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 1rem', color: 'var(--text-primary)' }}>{entry.description}</td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: entry.debit > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: entry.credit > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      {/* Sticky Quick Actions footer */}
      <div className="sticky-footer-bar no-print">
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>⚡ Quick Actions</span>
        <div style={{ width: '1px', height: '1.25rem', background: 'rgba(255,255,255,0.1)' }} />
        <button className="btn-primary" onClick={() => setShowPaymentModal(true)} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>💸 Bulk Payment</button>
        <button className="btn-secondary" onClick={() => router.push(`/customers/${customer.id}/report`)} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>📄 Report</button>
        <button className="btn-secondary" onClick={() => router.push(`/customers/${customer.id}/edit`)} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}>✏️ Edit</button>
        <button className="btn-secondary" onClick={handlePrint} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>🖨️ Print</button>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={() => router.push('/customers')} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>← All Accounts</button>
        </div>
      </div>
      <div style={{ height: '5rem' }} />

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .sidebar { display: none !important; }
          .dashboard-container { margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
          .glass-panel { background: white !important; border: 1px solid #e5e7eb !important; box-shadow: none !important; color: black !important; }
          .text-gradient { background: none !important; -webkit-text-fill-color: #111827 !important; color: #111827 !important; }
          h1, h3, p, div, th, td { color: #111827 !important; }
        }
      `}} />
    </div>
  );
}
