'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

interface Bank {
  id: number;
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  balance: number;
  createdAt: string;
}

interface Transaction {
  id: number;
  amount: number;
  paymentMethod: string;
  chequeNumber: string | null;
  slipNumber: string | null;
  status: string;
  receivedDate: string;
  createdAt: string;
  bank: string | null;
  invoiceNumber: string;
  invoice?: {
    id: number;
    customer?: {
      id: number;
      customerName: string;
    };
  };
}

export default function BanksPage() {
  const router = useRouter();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [bankTransactions, setBankTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const rowsPerPage = 10;

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/banks');
      if (res.ok) {
        const data = await res.json();
        setBanks(data);
        if (data.length > 0) {
          handleSelectBank(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch banks', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBank = async (bank: Bank) => {
    setSelectedBank(bank);
    setDetailsLoading(true);
    setStatusFilter('All');
    setMethodFilter('All');
    setTimeFilter('all');
    setShowLedger(false);
    setLedger([]);
    try {
      const res = await apiFetch(`http://localhost:5000/api/banks/${bank.id}`);
      if (res.ok) {
        const data = await res.json();
        setBankTransactions(data.transactions || []);
        setSelectedBank({ ...bank, balance: data.balance ?? bank.balance });
      }
    } catch (err) {
      console.error('Failed to fetch bank details', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchBankLedger = async (bankId: number) => {
    setLedgerLoading(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/banks/${bankId}/ledger`);
      if (res.ok) {
        const data = await res.json();
        setLedger(data.entries || []);
      }
    } catch {}
    finally { setLedgerLoading(false); }
  };

  const filterByTime = (dateString: string) => {
    const d = new Date(dateString);
    if (timeFilter === 'custom') {
      const s = startDate ? new Date(startDate) : null;
      const e = endDate ? new Date(endDate) : null;
      if (s && d < s) return false;
      if (e) {
        const end = new Date(e);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    }
    if (timeFilter === 'all') return true;
    const now = new Date();
    if (timeFilter === 'thisMonth') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (timeFilter === 'thisYear') return d.getFullYear() === now.getFullYear();
    if (timeFilter === 'today') return d.toDateString() === now.toDateString();
    return true;
  };

  const filteredTransactions = useMemo(() => {
    return bankTransactions.filter((tx) => {
      const timeMatch = filterByTime(tx.receivedDate || tx.createdAt);
      const statusMatch = statusFilter === 'All' || tx.status === statusFilter;
      const methodMatch = methodFilter === 'All' || tx.paymentMethod === methodFilter;
      return timeMatch && statusMatch && methodMatch;
    });
  }, [bankTransactions, statusFilter, methodFilter, timeFilter, startDate, endDate]);

  const totalFilteredAmount = useMemo(
    () => filteredTransactions.reduce((s, tx) => s + (tx.amount || 0), 0),
    [filteredTransactions]
  );

  const totalCollected = useMemo(
    () => bankTransactions.filter((t) => t.status === 'Collected').reduce((s, t) => s + t.amount, 0),
    [bankTransactions]
  );
  const totalUncollected = useMemo(
    () => bankTransactions.filter((t) => t.status === 'Uncollected' || t.status === 'Deposited').reduce((s, t) => s + t.amount, 0),
    [bankTransactions]
  );
  const totalBounced = useMemo(
    () => bankTransactions.filter((t) => t.status === 'Bounced').reduce((s, t) => s + t.amount, 0),
    [bankTransactions]
  );

  const filteredBanks = banks.filter((b) => {
    const s = searchQuery.trim().toLowerCase();
    if (!s) return true;
    return (
      b.bankName.toLowerCase().includes(s) ||
      (b.branchName || '').toLowerCase().includes(s) ||
      b.accountNumber.toLowerCase().includes(s)
    );
  });
  const paginatedBanks = filteredBanks.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const totalPages = Math.max(1, Math.ceil(filteredBanks.length / rowsPerPage));

  return (
    <div className="dashboard-container employee-page-shell">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0, flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800 }}>Corporate Banks</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
            Bank account directory, deposit history, and cheque clearance tracking.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={() => router.push('/banks/dashboard')} style={{ padding: '0.6rem 1.2rem' }}>Dashboard</button>
          <button className="btn-primary" onClick={() => router.push('/banks/new')} style={{ padding: '0.6rem 1.25rem' }}>+ Register Bank</button>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading bank accounts...</div>
      ) : banks.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No bank accounts registered. Set up a bank to start accepting cheque payments.
        </div>
      ) : (
        <div className="employee-grid" style={{ flex: 1, minHeight: 0 }}>

          {/* Bank List */}
          <div className="glass-panel employee-list-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Search banks by name, branch, or account..."
                className="form-control"
                style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Mobile card list */}
            <div className="customer-mobile-search-results">
              {paginatedBanks.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
                  {searchQuery ? 'No banks match your search.' : 'No banks found.'}
                </p>
              ) : (
                paginatedBanks.map((bank) => (
                  <div
                    key={bank.id}
                    className="customer-mobile-search-item"
                    style={{ background: selectedBank?.id === bank.id ? 'rgba(23, 79, 73, 0.12)' : undefined }}
                    onClick={() => handleSelectBank(bank)}
                  >
                    <div>
                      <span
                        style={{ fontWeight: '700', color: 'var(--accent-hover)', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/banks/${bank.id}`);
                        }}
                      >
                        {bank.bankName}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {bank.branchName || 'Head Office'} · {bank.accountNumber}
                      </div>
                    </div>
                    <div style={{ color: 'var(--success)', fontWeight: '600', fontSize: '0.85rem' }}>
                      ${bankTransactions
                        .filter((t) => t.bank === bank.bankName)
                        .reduce((s, t) => s + t.amount, 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="table-wrap employee-list-scroll customer-table-desktop-only">
              <table className="customer-table" style={{ borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Bank</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Branch</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Total Deposits</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBanks.map((bank) => (
                    <tr
                      key={bank.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        background: selectedBank?.id === bank.id ? 'rgba(23, 79, 73, 0.12)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => handleSelectBank(bank)}
                    >
                      <td
                        style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: 'var(--accent-hover)', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/banks/${bank.id}`);
                        }}
                      >
                        {bank.bankName}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {bank.branchName || 'Head Office'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--success)', fontWeight: '600', textAlign: 'right', fontSize: '0.85rem' }}>
                        ${bankTransactions
                          .filter((t) => t.bank === bank.bankName)
                          .reduce((s, t) => s + t.amount, 0)
                          .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Desktop pagination */}
            <div className="customer-table-desktop-only" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              <button className="btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Prev</button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Page {currentPage} of {totalPages}</span>
              <button className="btn-secondary" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Next</button>
            </div>
          </div>

          {/* Bank Details Panel */}
          {selectedBank && (
            <div className="glass-panel employee-detail-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }} className="text-gradient">{selectedBank.bankName}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {selectedBank.branchName || 'Head Office'} · A/C: {selectedBank.accountNumber}
                  </p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', padding: '0.25rem 0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Balance:</span>
                    <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.95rem' }}>
                      ${(selectedBank.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => { if (!showLedger) fetchBankLedger(selectedBank.id); setShowLedger(v => !v); }}>
                    {showLedger ? 'Hide Ledger' : 'View Ledger'}
                  </button>
                  <button className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => router.push(`/banks/${selectedBank.id}`)}>
                    Full Report
                  </button>
                </div>
              </div>

              {/* Filter Row */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', flexWrap: 'wrap', flexShrink: 0 }}>
                <select className="form-control" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} style={{ width: 'auto', padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="thisMonth">This Month</option>
                  <option value="thisYear">This Year</option>
                  <option value="custom">Custom</option>
                </select>
                {timeFilter === 'custom' && (
                  <>
                    <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 'auto', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
                    <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 'auto', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }} />
                  </>
                )}
                <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto', padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <option value="All">All Statuses</option>
                  <option value="Collected">Collected</option>
                  <option value="Uncollected">Uncollected</option>
                  <option value="Deposited">Deposited</option>
                  <option value="Bounced">Bounced</option>
                  <option value="Void">Void</option>
                </select>
                <select className="form-control" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} style={{ width: 'auto', padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <option value="All">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {detailsLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading transactions...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Balance Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                      {[
                        { label: 'Deposits', value: bankTransactions.reduce((s, t) => s + t.amount, 0), color: 'var(--success)' },
                        { label: 'Collected', value: totalCollected, color: 'var(--success)' },
                        { label: 'Uncollected', value: totalUncollected, color: 'var(--warning)' },
                        { label: 'Bounced', value: totalBounced, color: 'var(--danger)' },
                      ].map((stat) => (
                        <div key={stat.label} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{stat.label}</label>
                          <p style={{ fontSize: '0.9rem', fontWeight: 800, color: stat.color, margin: '0.1rem 0 0 0' }}>
                            ${stat.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Transactions */}
                    {filteredTransactions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {filteredTransactions.map((tx) => (
                          <div
                            key={tx.id}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '0.6rem 0.8rem', borderRadius: '8px', cursor: 'pointer' }}
                            onClick={() => tx.invoice?.id && router.push(`/invoices/${tx.invoice.id}`)}
                          >
                            <div>
                              <p style={{ fontWeight: '700', fontSize: '0.85rem', margin: 0 }}>{tx.paymentMethod} Receipt</p>
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                                {tx.invoiceNumber || '-'} · {tx.invoice?.customer?.customerName || '-'}
                                {tx.chequeNumber ? ` · Chq# ${tx.chequeNumber}` : ''}
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: '700', color: tx.status === 'Bounced' ? 'var(--danger)' : 'var(--success)', fontSize: '0.85rem' }}>
                                ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                              <span style={{
                                background: tx.status === 'Collected' ? 'rgba(16,185,129,0.15)' : tx.status === 'Bounced' ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
                                color: tx.status === 'Collected' ? 'var(--success)' : tx.status === 'Bounced' ? 'var(--danger)' : 'var(--warning)',
                                padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600
                              }}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No transactions found.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Bank Ledger */}
              {showLedger && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', flexShrink: 0 }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Bank Ledger</h4>
                  {ledgerLoading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>Loading...</p>
                  ) : ledger.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No ledger entries.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {ledger.map(entry => (
                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '0.5rem 0.7rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{entry.description}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>{new Date(entry.date).toLocaleDateString()}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <span style={{ color: entry.debit > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                              {entry.debit > 0 ? `$${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                            </span>
                            <span style={{ color: entry.credit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                              {entry.credit > 0 ? `$${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
