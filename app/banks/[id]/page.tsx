'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';

export default function BankTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const [bank, setBank] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Ledger state
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showLedger, setShowLedger] = useState(false);

  // Filters
  const [timeFilter, setTimeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    fetchBankDetails();
  }, [id]);

  const fetchBankDetails = async () => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/banks/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBank(data);
      }
    } catch (err) {
      console.error('Failed to fetch bank details', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/banks/${id}/ledger`);
      const data = await res.json();
      if (res.ok) setLedger(data.entries || []);
    } catch {}
    finally { setLedgerLoading(false); }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!bank || !bank.transactions) return;
    const headers = ['Receipt Date', 'Customer', 'Inv. Ref', 'Amount', 'Method', 'Reference (Cheque/Slip)', 'Status'];
    const rows = filteredTransactions.map((tx: any) => [
      new Date(tx.receivedDate).toLocaleDateString(),
      tx.invoice?.customer?.customerName || 'Unknown',
      tx.invoiceNumber || 'N/A',
      tx.amount,
      tx.paymentMethod,
      tx.chequeNumber || tx.slipNumber || '',
      tx.status
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map((e: any[]) => e.map((cell: any) => `"${cell}"`).join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${bank.bankName}_transactions_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading Bank Transactions...
      </div>
    );
  }

  if (!bank) {
    return <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', marginTop: '2rem' }}>Bank not found. Ensure the ID is correct.</div>;
  }

  // ---- FILTERING LOGIC ----
  const filterByTime = (dateString: string) => {
    const d = new Date(dateString);
    
    if (timeFilter === 'custom') {
      const s = startDate ? new Date(startDate) : null;
      const e = endDate ? new Date(endDate) : null;
      if (s && d < s) return false;
      if (e) {
        // adjust end date to end of day
        const end = new Date(e);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    }

    if (timeFilter === 'all') return true;
    const now = new Date();
    if (timeFilter === 'thisMonth') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (timeFilter === 'thisYear') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filteredTransactions = bank.transactions?.filter((tx: any) => {
    const timeMatch = filterByTime(tx.receivedDate || tx.createdAt);
    const statusMatch = statusFilter === 'All' || tx.status === statusFilter;
    const methodMatch = methodFilter === 'All' || tx.paymentMethod === methodFilter;
    return timeMatch && statusMatch && methodMatch;
  }) || [];

  const totalFilteredAmount = filteredTransactions.reduce((sum: number, tx: any) => sum + tx.amount, 0);

  return (
    <div className="dashboard-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <button 
            onClick={() => router.push('/banks')} 
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-hover)', cursor: 'pointer', marginBottom: '1rem', fontWeight: 'bold' }}
          >
            &larr; Back to Banks
          </button>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>Bank Transactions</h1>
          <p style={{ color: 'var(--text-muted)' }}>Detailed deposit history for <strong>{bank.bankName}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-secondary" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📊 Export CSV (Excel)
          </button>
          <button className="btn-primary" onClick={handlePrintPdf} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🖨️ Export PDF / Print
          </button>
        </div>
      </header>

      {/* PRINTABLE HEADER AREA */}
      <div className="print-only" style={{ display: 'none', borderBottom: '2px solid #e5e7eb', paddingBottom: '2rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, color: '#111827' }}>{bank.bankName}</h2>
        <p style={{ fontSize: '1.1rem', color: '#4b5563', margin: '0.5rem 0 0 0' }}>Branch: <strong>{bank.branchName || 'Head Office'}</strong></p>
        <p style={{ fontSize: '1.1rem', color: '#4b5563', margin: '0.25rem 0 0 0' }}>Account Number: <strong>{bank.accountNumber}</strong></p>
        <div style={{ marginTop: '1rem' }}>
           <h3 style={{ margin: 0, color: '#6b7280', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Report Generated</h3>
           <p style={{ margin: '0.25rem 0 0 0', fontWeight: 600, color: '#111827' }}>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="glass-panel no-print" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--accent-hover)' }}>{bank.bankName}</h2>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)' }}>Branch: {bank.branchName || 'Head Office'} | A/C: <span style={{ fontFamily: 'monospace' }}>{bank.accountNumber}</span></p>
          <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Current Balance:</span>
            <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1.1rem' }}>
              {bank?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? '—'}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
          <div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Deposited (Filtered)</p>
            <h2 style={{ margin: 0, color: 'var(--success)' }}>${totalFilteredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          </div>
          <button
            className="btn-secondary"
            onClick={() => { if (!showLedger) fetchLedger(); setShowLedger(v => !v); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
          >
            📒 {showLedger ? 'Hide Ledger' : 'View Ledger'}
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="glass-panel no-print" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Filters</h3>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Time Period:</label>
          <select 
            className="form-control" 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem', fontSize: '0.85rem' }}
          >
            <option value="all" style={{ color: 'black' }}>All Time</option>
            <option value="thisMonth" style={{ color: 'black' }}>This Month</option>
            <option value="thisYear" style={{ color: 'black' }}>This Year</option>
            <option value="custom" style={{ color: 'black' }}>Custom Date Range</option>
          </select>
        </div>

        {timeFilter === 'custom' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>From:</label>
            <input 
              type="date" 
              className="form-control" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '0.4rem', fontSize: '0.85rem' }}
            />
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>To:</label>
            <input 
              type="date" 
              className="form-control" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '0.4rem', fontSize: '0.85rem' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Payment Type:</label>
          <select 
            className="form-control" 
            value={methodFilter} 
            onChange={(e) => setMethodFilter(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem', fontSize: '0.85rem' }}
          >
            <option value="All" style={{ color: 'black' }}>All Types</option>
            <option value="Cash" style={{ color: 'black' }}>Cash</option>
            <option value="Cheque" style={{ color: 'black' }}>Cheque</option>
            <option value="Transfer" style={{ color: 'black' }}>Transfer</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</label>
          <select 
            className="form-control" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem', fontSize: '0.85rem' }}
          >
            <option value="All" style={{ color: 'black' }}>All Statuses</option>
            <option value="Collected" style={{ color: 'black' }}>Collected</option>
            <option value="Uncollected" style={{ color: 'black' }}>Uncollected</option>
            <option value="Bounced" style={{ color: 'black' }}>Bounced</option>
          </select>
        </div>
      </div>

      {/* TRANSACTION REPORT TABLE */}
      <div className="glass-panel print-area" style={{ padding: '2rem' }}>
        <h3 className="no-print" style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--text-main)' }}>Transaction Detail Log</h3>
        
        {/* Mobile Cards */}
        <div className="tbl-mobile">
          {(() => {
            const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
            return paginatedTransactions.length > 0 ? (
              paginatedTransactions.map((tx: any) => (
                <div key={tx.id} className="gen-mobile-card">
                  <div className="gen-mobile-card-header">
                    <span className="gen-mobile-card-title">
                      {tx.invoice?.customer?.customerName || 'Unknown Customer'}
                    </span>
                    <span className="status-badge" style={{
                      background: tx.status === 'Collected' ? 'rgba(16, 185, 129, 0.15)' : tx.status === 'Bounced' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: tx.status === 'Collected' ? 'var(--success)' : tx.status === 'Bounced' ? 'var(--danger)' : 'var(--warning)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {tx.status}
                    </span>
                  </div>
                  <div className="gen-mobile-card-body">
                    <div className="gen-mobile-card-label">Receipt Date</div>
                    <div className="gen-mobile-card-value">{new Date(tx.receivedDate || tx.createdAt).toLocaleDateString()}</div>
                    <div className="gen-mobile-card-label">Inv. Ref</div>
                    <div className="gen-mobile-card-value">{tx.invoiceNumber || '-'}</div>
                    <div className="gen-mobile-card-label">Method & Ref</div>
                    <div className="gen-mobile-card-value">
                      <strong>{tx.paymentMethod}</strong>
                      {tx.chequeNumber ? ` | Chq: ${tx.chequeNumber}` : ''}
                      {tx.slipNumber ? ` | Slip: ${tx.slipNumber}` : ''}
                    </div>
                    <div className="gen-mobile-card-label">Amount</div>
                    <div className="gen-mobile-card-value" style={{ fontWeight: 600, color: tx.status === 'Bounced' ? 'var(--danger)' : 'var(--success)' }}>
                      ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="gen-mobile-card">
                <div className="gen-mobile-card-body" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found for the selected filters.</div>
              </div>
            );
          })()}
        </div>

        {/* Desktop Table */}
        <div className="tbl-desktop" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <th style={{ padding: '1rem' }}>Receipt Date</th>
                <th style={{ padding: '1rem' }}>Customer</th>
                <th style={{ padding: '1rem' }}>Inv. Ref</th>
                <th style={{ padding: '1rem' }}>Method & Ref</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                return paginatedTransactions.length > 0 ? (
                  paginatedTransactions.map((tx: any) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{new Date(tx.receivedDate || tx.createdAt).toLocaleDateString()}</td>
                      <td 
                        style={{ padding: '1rem', fontWeight: '600', color: tx.invoice?.customer?.id ? 'var(--accent-hover)' : 'var(--text-main)', cursor: tx.invoice?.customer?.id ? 'pointer' : 'default', textDecoration: tx.invoice?.customer?.id ? 'underline' : 'none' }}
                        title={tx.invoice?.customer?.id ? "Click to view customer dashboard" : ""}
                        onClick={() => {
                          if (tx.invoice?.customer?.id) {
                            router.push(`/customers/${tx.invoice.customer.id}`);
                          }
                        }}
                      >
                        {tx.invoice?.customer?.customerName || 'Unknown Customer'}
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{tx.invoiceNumber || '-'}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--text-main)' }}>{tx.paymentMethod}</strong>
                        {tx.chequeNumber ? ` | Chq: ${tx.chequeNumber}` : ''}
                        {tx.slipNumber ? ` | Slip: ${tx.slipNumber}` : ''}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: tx.status === 'Bounced' ? 'var(--danger)' : 'var(--success)' }}>
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span className="status-badge" style={{
                          background: tx.status === 'Collected' ? 'rgba(16, 185, 129, 0.15)' : tx.status === 'Bounced' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: tx.status === 'Collected' ? 'var(--success)' : tx.status === 'Bounced' ? 'var(--danger)' : 'var(--warning)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found for the selected filters.</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {(() => {
          const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / rowsPerPage));
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
        
        <div className="print-only" style={{ display: 'none', marginTop: '3rem', borderTop: '2px solid #e5e7eb', paddingTop: '1rem', textAlign: 'right' }}>
           <h3 style={{ margin: 0, color: '#111827' }}>Total Filtered Transactions: <span style={{ color: '#10b981' }}>${totalFilteredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></h3>
        </div>
      </div>

      {showLedger && (
        <div className="glass-panel no-print" style={{ padding: '2rem', marginTop: '2rem' }}>
          <h3 style={{ fontWeight: 700, marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--text-main)' }}>Bank Ledger</h3>
          {ledgerLoading ? <div style={{ color: 'var(--text-muted)' }}>Loading...</div> : (
            <>
              {/* Mobile Cards */}
              <div className="tbl-mobile">
                {ledger.length === 0 ? (
                  <div className="gen-mobile-card">
                    <div className="gen-mobile-card-body" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No ledger entries found.</div>
                  </div>
                ) : ledger.map(entry => (
                  <div key={entry.id} className="gen-mobile-card">
                    <div className="gen-mobile-card-header">
                      <span className="gen-mobile-card-title" style={{ fontSize: '0.85rem' }}>{entry.type.replace(/_/g, ' ')}</span>
                      <span className="gen-mobile-card-value" style={{ fontWeight: 600, color: entry.debit > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {entry.debit > 0
                          ? `-${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : entry.credit > 0
                            ? `+${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : '—'}
                      </span>
                    </div>
                    <div className="gen-mobile-card-body">
                      <div className="gen-mobile-card-label">Date</div>
                      <div className="gen-mobile-card-value">{new Date(entry.date).toLocaleDateString()}</div>
                      <div className="gen-mobile-card-label">Description</div>
                      <div className="gen-mobile-card-value">{entry.description}</div>
                      <div className="gen-mobile-card-label">Debit</div>
                      <div className="gen-mobile-card-value" style={{ color: entry.debit > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                      </div>
                      <div className="gen-mobile-card-label">Credit</div>
                      <div className="gen-mobile-card-value" style={{ color: entry.credit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="tbl-desktop" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {['Date', 'Type', 'Description', 'Debit', 'Credit'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 1rem', textAlign: h === 'Debit' || h === 'Credit' ? 'right' : 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No ledger entries found.</td>
                      </tr>
                    ) : ledger.map(entry => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(entry.date).toLocaleDateString()}</td>
                        <td style={{ padding: '0.6rem 1rem' }}>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                            background: entry.debit > 0 ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
                            color: entry.debit > 0 ? 'var(--danger)' : 'var(--success)'
                          }}>{entry.type.replace(/_/g, ' ')}</span>
                        </td>
                        <td style={{ padding: '0.6rem 1rem', color: 'var(--text-main)' }}>{entry.description}</td>
                        <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: entry.debit > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                        </td>
                        <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: entry.credit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                          {entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Sticky Quick Actions footer */}
      <div className="sticky-footer-bar no-print">
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>⚡ Quick Actions</span>
        <div style={{ width: '1px', height: '1.25rem', background: 'rgba(255,255,255,0.1)' }} />
        <button className="btn-secondary" onClick={handleExportCsv} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>📊 Export CSV</button>
        <button className="btn-primary" onClick={handlePrintPdf} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>🖨️ Export PDF</button>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={() => router.push('/banks')} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>← All Banks</button>
        </div>
      </div>
      <div style={{ height: '5rem' }} />

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
          .status-badge { background: none !important; padding: 0 !important; }
        }
      `}} />
    </div>
  );
}
