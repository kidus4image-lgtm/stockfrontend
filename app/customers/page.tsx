'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

interface Employee {
  firstName: string;
  lastName: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  amount: number;
  remainingPayment: number;
  status: string;
  createdAt: string;
  paymentDate: string;
  computedStatus?: string;
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
  receivedDate: string;
  invoiceNumber: string;
  invoiceId: number;
}

interface Customer {
  id: number;
  customerName: string;
  tinNumber: string | null;
  address: string | null;
  phoneNumber: string | null;
  emailAddress: string | null;
  contactPerson: string | null;
  salesRep: Employee | null;
  chatId: string | null;
  userName: string | null;
  licenceDate: string | null;
  expDate: string | null;
  waitDays: number | null;
  balance: number | null;
  totalPurchase: number | null;
  totalCredit: number | null;
  totalCash: number | null;
  totalCreditPayed: number | null;
  totalCashPayed: number | null;
  uncollectedCheque: number | null;
  bouncedCheques: number | null;
  totalPayed: number | null;
  extraPayed: number | null;
  invoices: Invoice[];
  payments?: Payment[];
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeCustomerTab, setActiveCustomerTab] = useState<'info' | 'invoices' | 'payments'>('info');
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
  
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  useEffect(() => {
    fetchCustomers();
    fetchBanks();
  }, []);

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

  const handleRegisterBulkPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');

    if (!selectedCust) return;

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
      const res = await apiFetch(`http://localhost:5000/api/payments/customer/${selectedCust.id}/bulk`, {
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

      // Refresh customer details and list
      fetchCustomers();
      handleSelectCustomer(selectedCust);
      
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

  // Simulated allocations for visual confirmation
  const getSimulatedAllocations = () => {
    if (!selectedCust || !selectedCust.invoices) return { allocations: [], surplus: 0, totalAllocated: 0, overAllocated: 0 };
    const unpaid = selectedCust.invoices
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

  const handleSelectCustomer = async (cust: Customer) => {
    setSelectedCust(cust);
    setDetailsLoading(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/customers/${cust.id}`);
      if (res.ok) {
        const fullDetails = await res.json();
        setSelectedCust(fullDetails);
      }
    } catch (err) {
      console.error('Failed to fetch customer details', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
        if (data.length > 0) {
          handleSelectCustomer(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0, flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800 }}>Customer Ledger Accounts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>Detailed customer balance sheets, TIN verification status, credit outstanding, and purchases.</p>
        </div>
        <button className="btn-primary" onClick={() => router.push('/customers/new')} style={{ padding: '0.6rem 1.25rem' }}>
          + Register Customer
        </button>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading customers...
        </div>
      ) : customers.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No customers registered. Create a ledger account to begin.
        </div>
      ) : (
        <div className="customer-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '2rem', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
          
          {/* Customer List */}
          <div className="glass-panel customer-list-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
              <input 
                type="text" 
                placeholder="Search customers by name or TIN..." 
                className="form-control" 
                style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Customer</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>TIN Number</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Rep</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredCustomers = customers.filter(c => c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || (c.tinNumber && c.tinNumber.includes(searchQuery)));
                    const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                    return paginatedCustomers.map((cust) => (
                      <tr
                        key={cust.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          background: selectedCust?.id === cust.id ? 'rgba(23, 79, 73, 0.12)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                        onClick={() => handleSelectCustomer(cust)}
                      >
                        <td 
                          style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: 'var(--accent-hover)', cursor: 'pointer', textDecoration: 'underline' }}
                          title="Click to view customer dashboard"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/customers/${cust.id}`);
                          }}
                        >
                          {cust.customerName}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{cust.tinNumber || '-'}</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', color: cust.salesRep ? '#60a5fa' : 'var(--text-muted)' }}>
                          {cust.salesRep ? `${cust.salesRep.firstName} ${cust.salesRep.lastName}` : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--danger)', fontWeight: '600' }}>
                          ${(cust.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {(() => {
              const filteredCustomers = customers.filter(c => c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || (c.tinNumber && c.tinNumber.includes(searchQuery)));
              const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / rowsPerPage));
              return (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                  <button 
                    className="btn-secondary" 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Prev
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button 
                    className="btn-secondary" 
                    disabled={currentPage >= totalPages} 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Next
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Customer Details Panel */}
          {selectedCust && (
            <div className="glass-panel customer-detail-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              
              {/* Detailed view header */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }} className="text-gradient">
                    {selectedCust.customerName}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    TIN: <strong style={{ color: 'var(--text-main)' }}>{selectedCust.tinNumber || 'N/A'}</strong> | 
                    Rep: <strong style={{ color: 'var(--text-main)' }}>{selectedCust.salesRep ? `${selectedCust.salesRep.firstName} ${selectedCust.salesRep.lastName}` : 'N/A'}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
                    onClick={() => setShowPaymentModal(true)}
                  >
                    💸 Bulk Pay
                  </button>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                    onClick={() => router.push(`/customers/${selectedCust.id}/report`)}
                  >
                    📄 Report
                  </button>
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                    onClick={() => router.push(`/customers/${selectedCust.id}`)}
                  >
                    📊 Dashboard
                  </button>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'rgba(96, 165, 250, 0.15)', border: '1px solid rgba(96, 165, 250, 0.3)', color: '#60a5fa' }}
                    onClick={() => router.push(`/customers/${selectedCust.id}/edit`)}
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>

              {/* Tab Navigation header */}
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setActiveCustomerTab('info')}
                  style={{
                    padding: '0.45rem 1rem',
                    background: activeCustomerTab === 'info' ? 'rgba(23, 79, 73, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: activeCustomerTab === 'info' ? '#6ee7b7' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    borderBottom: activeCustomerTab === 'info' ? '2px solid #6ee7b7' : 'none'
                  }}
                >
                  ℹ️ Info & Balances
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCustomerTab('invoices')}
                  style={{
                    padding: '0.45rem 1rem',
                    background: activeCustomerTab === 'invoices' ? 'rgba(23, 79, 73, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: activeCustomerTab === 'invoices' ? '#6ee7b7' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    borderBottom: activeCustomerTab === 'invoices' ? '2px solid #6ee7b7' : 'none'
                  }}
                >
                  📜 Invoices ({selectedCust.invoices?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCustomerTab('payments')}
                  style={{
                    padding: '0.45rem 1rem',
                    background: activeCustomerTab === 'payments' ? 'rgba(23, 79, 73, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: activeCustomerTab === 'payments' ? '#6ee7b7' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    borderBottom: activeCustomerTab === 'payments' ? '2px solid #6ee7b7' : 'none'
                  }}
                >
                  💰 Payments ({selectedCust.payments?.length || 0})
                </button>
              </div>

              {/* Scrollable Tab content panel */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem', minHeight: 0 }}>
                {detailsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 1.5s infinite linear', display: 'inline-block' }}>⏳</span>
                    <p style={{ fontSize: '0.9rem' }}>Synchronizing ledger transactions...</p>
                  </div>
                ) : (
                  <>
                    {/* TAB 1: BASIC INFO & LEDGER BALANCES */}
                    {activeCustomerTab === 'info' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                        
                        {/* Grid 1: Basic & Licensing */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Contact Person</label>
                            <p style={{ fontWeight: '500', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>{selectedCust.contactPerson || '-'}</p>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Phone Number</label>
                            <p style={{ fontWeight: '500', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>{selectedCust.phoneNumber || '-'}</p>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Email Address</label>
                            <p style={{ fontWeight: '500', fontSize: '0.85rem', margin: '0.15rem 0 0 0', wordBreak: 'break-all' }}>{selectedCust.emailAddress || '-'}</p>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Address</label>
                            <p style={{ fontWeight: '500', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>{selectedCust.address || '-'}</p>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>License Date</label>
                            <p style={{ fontWeight: '500', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>
                              {selectedCust.licenceDate ? new Date(selectedCust.licenceDate).toLocaleDateString() : '-'}
                            </p>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>License Expiry</label>
                            <p style={{ fontWeight: '500', fontSize: '0.85rem', margin: '0.15rem 0 0 0', color: selectedCust.expDate && new Date(selectedCust.expDate) < new Date() ? 'var(--danger)' : 'var(--text-main)' }}>
                              {selectedCust.expDate ? new Date(selectedCust.expDate).toLocaleDateString() : '-'}
                            </p>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Credit Wait Days</label>
                            <p style={{ fontWeight: '500', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>{selectedCust.waitDays || 0} Days</p>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Telegram Chat ID</label>
                            <p style={{ fontWeight: '500', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>{selectedCust.chatId || '-'}</p>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>User Name</label>
                            <p style={{ fontWeight: '500', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>{selectedCust.userName || '-'}</p>
                          </div>
                        </div>

                        {/* Grid 2: Balance Sheet */}
                        <div>
                          <h4 style={{ fontSize: '0.95rem', color: '#6ee7b7', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem', fontWeight: 700 }}>
                            Ledger Balances
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Current Balance</label>
                              <p style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--danger)', margin: '0.15rem 0 0 0' }}>${(selectedCust.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Purchases</label>
                              <p style={{ fontSize: '1rem', fontWeight: '800', margin: '0.15rem 0 0 0', color: '#fff' }}>${(selectedCust.totalPurchase || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Credit</label>
                              <p style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--warning)', margin: '0.15rem 0 0 0' }}>${(selectedCust.totalCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Uncollected Cheques</label>
                              <p style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--warning)', margin: '0.15rem 0 0 0' }}>${(selectedCust.uncollectedCheque || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Bounced Cheques</label>
                              <p style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--danger)', margin: '0.15rem 0 0 0' }}>${(selectedCust.bouncedCheques || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Extra Paid</label>
                              <p style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--success)', margin: '0.15rem 0 0 0' }}>${(selectedCust.extraPayed || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* TAB 2: INVOICES LIST */}
                    {activeCustomerTab === 'invoices' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Invoices Ledger Record</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status Filter:</span>
                            <select 
                              className="form-control" 
                              value={invoiceFilter}
                              onChange={(e) => setInvoiceFilter(e.target.value)}
                              style={{ width: '130px', padding: '0.35rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
                            >
                              <option value="All" style={{ color: 'black' }}>All Invoices</option>
                              <option value="Paid" style={{ color: 'black' }}>Paid Only</option>
                              <option value="Unpaid" style={{ color: 'black' }}>Unpaid Only</option>
                            </select>
                          </div>
                        </div>

                        {selectedCust.invoices && selectedCust.invoices.length > 0 ? (() => {
                          const filteredInvoices = selectedCust.invoices.filter((inv) => {
                            if (invoiceFilter === 'All') return true;
                            const st = inv.computedStatus || inv.status;
                            if (invoiceFilter === 'Paid') return st === 'Paid';
                            if (invoiceFilter === 'Unpaid') return st !== 'Paid' && st !== 'Void';
                            return true;
                          });
                          
                          if (filteredInvoices.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1.5rem', textAlign: 'center' }}>No invoices match this filter.</p>;
                          
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {filteredInvoices.map((inv) => {
                                const statusStyle = (() => {
                                  const s = inv.computedStatus || inv.status;
                                  switch (s) {
                                    case 'Critical':
                                      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' };
                                    case 'Overdue':
                                      return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
                                    case 'Today':
                                      return { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' };
                                    case 'This Week':
                                      return { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' };
                                    case 'Upcoming':
                                      return { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)' };
                                    case 'Paid':
                                      return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' };
                                    case 'Void':
                                      return { background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)' };
                                    default:
                                      return { background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' };
                                  }
                                })();

                                return (
                                  <div
                                    key={inv.id}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      background: 'rgba(255,255,255,0.02)',
                                      border: '1px solid var(--border-color)',
                                      padding: '0.65rem 0.85rem',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      transition: 'background 0.2s'
                                    }}
                                    onClick={() => router.push(`/invoices/${inv.id}`)}
                                  >
                                    <div>
                                      <p style={{ fontWeight: '700', fontSize: '0.85rem', margin: 0, color: '#fff' }}>{inv.invoiceNumber}</p>
                                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                                        Bill: {new Date(inv.createdAt).toLocaleDateString()} | Due: {new Date(inv.paymentDate).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                      <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontWeight: '700', fontSize: '0.85rem', margin: 0, color: '#fff' }}>${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                        <p style={{ fontSize: '0.7rem', color: inv.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)', margin: '0.15rem 0 0 0' }}>
                                          Rem: ${inv.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                      <span style={{
                                        ...statusStyle,
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        fontWeight: '600'
                                      }}>
                                        {inv.computedStatus || inv.status}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })() : (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No billing history found.</p>
                        )}
                      </div>
                    )}

                    {/* TAB 3: PAYMENTS RECEIVED */}
                    {activeCustomerTab === 'payments' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Payment Receipts Ledger</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status Filter:</span>
                            <select 
                              className="form-control" 
                              value={paymentFilter}
                              onChange={(e) => setPaymentFilter(e.target.value)}
                              style={{ width: '130px', padding: '0.35rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
                            >
                              <option value="All" style={{ color: 'black' }}>All Payments</option>
                              <option value="Collected" style={{ color: 'black' }}>Collected</option>
                              <option value="Uncollected" style={{ color: 'black' }}>Uncollected</option>
                            </select>
                          </div>
                        </div>

                        {selectedCust.payments && selectedCust.payments.length > 0 ? (() => {
                          const filteredPayments = selectedCust.payments.filter((pmt) => {
                            if (paymentFilter === 'All') return true;
                            return pmt.status === paymentFilter;
                          });

                          if (filteredPayments.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1.5rem', textAlign: 'center' }}>No payments match this filter.</p>;

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {filteredPayments.map((pmt) => (
                                <div
                                  key={pmt.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(255,255,255,0.01)',
                                    border: '1px solid var(--border-color)',
                                    padding: '0.75rem 0.85rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                  }}
                                  onClick={() => router.push(`/invoices/${pmt.invoiceId}`)}
                                >
                                  <div>
                                    <p style={{ fontWeight: '700', fontSize: '0.85rem', margin: 0, color: '#fff' }}>
                                      💳 {pmt.paymentMethod} Receipt
                                    </p>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'inline-block' }}>
                                      Invoice: <strong style={{ color: 'var(--accent-hover)' }}>{pmt.invoiceNumber}</strong>
                                      {pmt.bank && ` | Bank: ${pmt.bank}`}
                                      {pmt.chequeNumber && ` | Cheque: ${pmt.chequeNumber}`}
                                      {pmt.slipNumber && ` | Slip: ${pmt.slipNumber}`}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div>
                                      <p style={{ fontWeight: '700', color: 'var(--success)', margin: 0, fontSize: '0.85rem' }}>
                                        +${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </p>
                                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                                        Recd: {new Date(pmt.receivedDate).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <span style={{
                                      background: pmt.status === 'Collected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                      color: pmt.status === 'Collected' ? 'var(--success)' : 'var(--warning)',
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      fontWeight: '600'
                                    }}>
                                      {pmt.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })() : (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                            No payment receipts found for this account.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BULK PAYMENT MODAL */}
      {showPaymentModal && selectedCust && (
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
                Allocate and register bulk payments for <strong>{selectedCust.customerName}</strong>. Auto-disperses oldest-to-newest with live override control.
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
                            allocations.forEach(a => {
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
                        {allocations.map((alloc) => (
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
      <div className="sticky-footer-bar no-print">
        <button className="btn-primary" onClick={() => router.push('/customers/new')} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
          ➕ Register Customer
        </button>
      </div>
    </div>
  );
}
