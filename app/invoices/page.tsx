'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

interface Customer {
  id: number;
  customerName: string;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  fsNumber: string | null;
  amount: number;
  remainingPayment: number;
  totalPayed: number;
  uncollectedPayment: number;
  status: string;
  invoiceDate: string | null;
  paymentDate: string | null;
  salesType: string | null;
  crv: string | null;
  customer: Customer;
  salesRep: Employee | null;
}

export default function InvoicesListPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockDirectInvoice, setBlockDirectInvoice] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [statusFilter, setStatusFilter] = useState('All');
  const [salesTypeFilter, setSalesTypeFilter] = useState('All');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [salesRepFilter, setSalesRepFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/settings');
      if (res.ok) {
        const data = await res.json();
        setBlockDirectInvoice(data.blockDirectInvoice);
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique customers and sales reps for dropdown filters
  const uniqueCustomers = useMemo(() => {
    const map = new Map<number, string>();
    invoices.forEach(inv => map.set(inv.customer.id, inv.customer.customerName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [invoices]);

  const uniqueSalesReps = useMemo(() => {
    const map = new Map<number, string>();
    invoices.forEach(inv => {
      if (inv.salesRep) map.set(inv.salesRep.id, `${inv.salesRep.firstName} ${inv.salesRep.lastName}`);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [invoices]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.fsNumber && inv.fsNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      inv.customer.customerName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    const matchesType = salesTypeFilter === 'All' || inv.salesType === salesTypeFilter || (salesTypeFilter === 'Credit' && !inv.salesType);
    const matchesCustomer = customerFilter === 'All' || inv.customer.id.toString() === customerFilter;
    const matchesRep = salesRepFilter === 'All' || (inv.salesRep && inv.salesRep.id.toString() === salesRepFilter);

    // Amount range filter
    let matchesAmount = true;
    if (amountMin && inv.amount < parseFloat(amountMin)) matchesAmount = false;
    if (amountMax && inv.amount > parseFloat(amountMax)) matchesAmount = false;

    // Time filter
    let matchesTime = true;
    if (timeFilter !== 'all') {
      if (!inv.invoiceDate) {
        matchesTime = false;
      } else {
        const d = new Date(inv.invoiceDate);
        if (timeFilter === 'thisMonth') {
          const now = new Date();
          matchesTime = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (timeFilter === 'thisYear') {
          const now = new Date();
          matchesTime = d.getFullYear() === now.getFullYear();
        } else if (timeFilter === 'custom') {
          const s = startDate ? new Date(startDate) : null;
          const e = endDate ? new Date(endDate) : null;
          if (s && d < s) matchesTime = false;
          if (e) {
            const end = new Date(e);
            end.setHours(23, 59, 59, 999);
            if (d > end) matchesTime = false;
          }
        }
      }
    }

    return matchesSearch && matchesStatus && matchesType && matchesCustomer && matchesRep && matchesAmount && matchesTime;
  });

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalRemaining = filteredInvoices.reduce((sum, inv) => sum + inv.remainingPayment, 0);
  const overdueCount = filteredInvoices.filter(inv => inv.status === 'Overdue' || inv.status === 'Critical').length;

  const handleExportCsv = () => {
    const headers = ['Invoice No.', 'Date', 'Payment Due', 'FS Number', 'Customer', 'Sales Rep', 'Type', 'Amount', 'Paid', 'Remaining', 'CRV', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : 'N/A',
      inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : 'N/A',
      inv.fsNumber || '',
      inv.customer.customerName,
      inv.salesRep ? `${inv.salesRep.firstName} ${inv.salesRep.lastName}` : '',
      inv.salesType || 'Credit',
      inv.amount,
      inv.totalPayed,
      inv.remainingPayment,
      inv.crv || '',
      inv.status
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `invoice_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setSalesTypeFilter('All');
    setCustomerFilter('All');
    setSalesRepFilter('All');
    setTimeFilter('all');
    setStartDate('');
    setEndDate('');
    setAmountMin('');
    setAmountMax('');
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'Paid': return { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' };
      case 'Void': return { bg: 'rgba(244, 63, 94, 0.15)', color: 'var(--danger)' };
      case 'Overdue': return { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
      case 'Critical': return { bg: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e' };
      default: return { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-hover)' };
    }
  };

  const selectStyle = { fontSize: '0.85rem' };

  return (
    <div className="dashboard-container">
      <header className="no-print gen-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>Sales Invoices Report</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage sales headers, track outstanding amounts, and generate reports.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            📊 Export CSV
          </button>
          <button className="btn-secondary" onClick={handlePrintPdf} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            🖨️ Print / PDF
          </button>
          {!blockDirectInvoice && (
            <button className="btn-primary" onClick={() => router.push('/invoices/new')}>
              + Register Invoice
            </button>
          )}
        </div>
      </header>

      {/* PRINT HEADER */}
      <div className="print-only" style={{ display: 'none', borderBottom: '2px solid #e5e7eb', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', margin: 0, color: '#111827' }}>Sales Invoice Ledger Report</h2>
        <p style={{ fontSize: '1rem', color: '#4b5563', margin: '0.5rem 0 0 0' }}>Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        <div style={{ display: 'flex', gap: '3rem', marginTop: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase' }}>Invoices</span>
            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{filteredInvoices.length}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase' }}>Total Amount</span>
            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase' }}>Outstanding</span>
            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>${totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Amount</p>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', color: 'var(--success)' }}>${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Outstanding</p>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', color: 'var(--warning)' }}>${totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Invoice Count</p>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', color: 'var(--text-main)' }}>{filteredInvoices.length}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: overdueCount > 0 ? '3px solid #f43f5e' : undefined }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Overdue / Critical</p>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', color: overdueCount > 0 ? '#f43f5e' : 'var(--text-main)' }}>{overdueCount}</h2>
        </div>
      </div>

      {/* PRIMARY FILTERS */}
      <div className="glass-panel no-print gen-page-filters" style={{ padding: '1.5rem', marginBottom: showAdvanced ? '0' : '2rem', borderBottomLeftRadius: showAdvanced ? 0 : undefined, borderBottomRightRadius: showAdvanced ? 0 : undefined, display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Search</label>
          <input
            type="text"
            className="form-control"
            style={{ width: '100%', ...selectStyle }}
            placeholder="Invoice #, FS #, or Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Status</label>
          <select className="form-control form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Critical">Critical (7+ days)</option>
            <option value="Void">Void</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Sales Type</label>
          <select className="form-control form-select" value={salesTypeFilter} onChange={(e) => setSalesTypeFilter(e.target.value)} style={selectStyle}>
            <option value="All">All Types</option>
            <option value="Cash">Cash</option>
            <option value="Credit">Credit</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Date Range</label>
          <select className="form-control form-select" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} style={selectStyle}>
            <option value="all">All Time</option>
            <option value="thisMonth">This Month</option>
            <option value="thisYear">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {timeFilter === 'custom' && (
          <>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>From</label>
              <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={selectStyle} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>To</label>
              <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={selectStyle} />
            </div>
          </>
        )}

        <button 
          className="btn-secondary" 
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {showAdvanced ? '▲ Less Filters' : '▼ More Filters'}
        </button>
      </div>

      {/* ADVANCED FILTERS */}
      {showAdvanced && (
        <div className="glass-panel no-print" style={{ padding: '1.5rem', marginBottom: '2rem', borderTop: '1px dashed var(--border-color)', borderTopLeftRadius: 0, borderTopRightRadius: 0, display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Customer</label>
            <select className="form-control form-select" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} style={{ ...selectStyle, minWidth: '180px' }}>
              <option value="All">All Customers</option>
              {uniqueCustomers.map(([id, name]) => (
                <option key={id} value={id.toString()}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Sales Rep</label>
            <select className="form-control form-select" value={salesRepFilter} onChange={(e) => setSalesRepFilter(e.target.value)} style={{ ...selectStyle, minWidth: '180px' }}>
              <option value="All">All Reps</option>
              {uniqueSalesReps.map(([id, name]) => (
                <option key={id} value={id.toString()}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Min Amount ($)</label>
            <input type="number" className="form-control" placeholder="0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} style={{ ...selectStyle, width: '120px' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Max Amount ($)</label>
            <input type="number" className="form-control" placeholder="∞" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} style={{ ...selectStyle, width: '120px' }} />
          </div>

          <button 
            className="btn-secondary" 
            onClick={clearAllFilters}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.3)' }}
          >
            ✕ Clear All
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading invoices...
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No invoices found. Modify your filters or search.
        </div>
      ) : (
        <div className="glass-panel print-area" style={{ padding: '1rem', overflowX: 'auto' }}>
          <div className="tbl-mobile">
            {(() => {
              const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return paginatedInvoices.map((inv) => {
                const sc = statusColor(inv.status);
                return (
                  <div className="gen-mobile-card" key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="gen-mobile-card-header">
                      <span className="gen-mobile-card-title">{inv.invoiceNumber}</span>
                      <span style={{ background: sc.bg, color: sc.color, padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: '600' }}>
                        {inv.status === 'Overdue' ? 'Overdue' : inv.status === 'Critical' ? 'Critical' : inv.status}
                      </span>
                    </div>
                    <div className="gen-mobile-card-body">
                      <div>
                        <div className="gen-mobile-card-label">Customer</div>
                        <div className="gen-mobile-card-value">{inv.customer.customerName}</div>
                      </div>
                      <div>
                        <div className="gen-mobile-card-label">Date</div>
                        <div className="gen-mobile-card-value">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</div>
                      </div>
                      <div>
                        <div className="gen-mobile-card-label">Amount</div>
                        <div className="gen-mobile-card-value">${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="gen-mobile-card-label">Remaining</div>
                        <div className="gen-mobile-card-value" style={{ color: inv.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)' }}>
                          ${inv.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      {inv.salesRep && (
                        <div>
                          <div className="gen-mobile-card-label">Sales Rep</div>
                          <div className="gen-mobile-card-value">{inv.salesRep.firstName} {inv.salesRep.lastName}</div>
                        </div>
                      )}
                      <div>
                        <div className="gen-mobile-card-label">Type</div>
                        <div className="gen-mobile-card-value">{inv.salesType || 'Credit'}</div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <div className="tbl-desktop">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Invoice No.</th>
                <th style={{ padding: '0.85rem 1rem' }}>Inv. Date</th>
                <th style={{ padding: '0.85rem 1rem' }}>Due Date</th>
                <th style={{ padding: '0.85rem 1rem' }}>FS No.</th>
                <th style={{ padding: '0.85rem 1rem' }}>Customer</th>
                <th style={{ padding: '0.85rem 1rem' }}>Sales Rep</th>
                <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Remaining</th>
                <th style={{ padding: '0.85rem 1rem' }}>CRV</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                return paginatedInvoices.map((inv) => {
                  const sc = statusColor(inv.status);
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => router.push(`/invoices/${inv.id}`)} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '600' }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                      <td style={{ padding: '0.85rem 1rem', color: (inv.status === 'Overdue' || inv.status === 'Critical') ? '#f43f5e' : 'var(--text-muted)', fontWeight: (inv.status === 'Overdue' || inv.status === 'Critical') ? '600' : '400' }}>
                        {inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{inv.fsNumber || '-'}</td>
                      <td 
                        style={{ padding: '0.85rem 1rem', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent-hover)' }}
                        title="Click to view customer dashboard"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/customers/${inv.customer.id}`);
                        }}
                      >
                        {inv.customer.customerName}
                      </td>
                      <td 
                        style={{ 
                          padding: '0.85rem 1rem', 
                          color: inv.salesRep ? 'var(--accent-hover)' : 'var(--text-muted)',
                          cursor: inv.salesRep ? 'pointer' : 'default',
                          textDecoration: inv.salesRep ? 'underline' : 'none',
                          fontWeight: inv.salesRep ? '500' : 'normal'
                        }}
                        title={inv.salesRep ? "Click to view sales rep details" : ""}
                        onClick={(e) => {
                          if (inv.salesRep) {
                            e.stopPropagation();
                            router.push(`/employees?id=${inv.salesRep.id}`);
                          }
                        }}
                      >
                        {inv.salesRep ? `${inv.salesRep.firstName} ${inv.salesRep.lastName}` : '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: inv.salesType === 'Cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: inv.salesType === 'Cash' ? 'var(--success)' : 'var(--accent-hover)' }}>
                          {inv.salesType || 'Credit'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: inv.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: '600' }}>
                        ${inv.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{inv.crv || '-'}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          background: sc.bg,
                          color: sc.color,
                          padding: '0.2rem 0.65rem',
                          borderRadius: '9999px',
                          fontSize: '0.7rem',
                          fontWeight: '600'
                        }}>
                          {inv.status === 'Overdue' ? 'Overdue - Not Paid' : inv.status === 'Critical' ? 'Critical - Not Paid' : inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          </div>
          
          {/* Pagination Controls */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / rowsPerPage));
            return (
              <div className="no-print" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
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

      {/* PRINT FOOTER SUMMARY */}
      <div className="print-only" style={{ display: 'none', marginTop: '2rem', borderTop: '2px solid #e5e7eb', paddingTop: '1rem', textAlign: 'right' }}>
        <p style={{ margin: 0, color: '#111827' }}>
          <strong>Total Amount:</strong> ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} &nbsp;&nbsp;|&nbsp;&nbsp;
          <strong>Total Outstanding:</strong> <span style={{ color: '#f59e0b' }}>${totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </p>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: #111827 !important; }
          .no-print { display: none !important; }
          .sidebar { display: none !important; }
          .dashboard-container { margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
          .print-only { display: block !important; }
          .glass-panel { background: white !important; border: none !important; box-shadow: none !important; color: #111827 !important; }
          table, th, td { border-color: #e5e7eb !important; color: #111827 !important; }
          th { background-color: #f9fafb !important; }
        }
      `}} />
      <div className="sticky-footer-bar no-print">
        <button className="btn-primary" onClick={() => router.push('/invoices/new')} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
          ➕ Register Invoice
        </button>
      </div>
    </div>
  );
}
