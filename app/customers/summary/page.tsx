'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';

interface Employee {
  firstName: string;
  lastName: string;
}

interface CustomerSummary {
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
  balance: number;
  totalPurchase: number;
  totalCredit: number;
  totalCash: number;
  totalCreditPayed: number;
  totalCashPayed: number;
  uncollectedCheque: number;
  bouncedCheques: number;
  totalPayed: number;
  extraPayed: number;
}

type SortKey = 'customerName' | 'balance' | 'totalPurchase' | 'totalPayed' | 'totalCredit' | 'uncollectedCheque' | 'bouncedCheques';

export default function CustomerSummaryPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('balance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setLoading(false);
    }
  };

  const aggregates = useMemo(() => {
    return customers.reduce(
      (acc, c) => {
        acc.totalCustomers += 1;
        acc.totalBalance += c.balance || 0;
        acc.totalPurchase += c.totalPurchase || 0;
        acc.totalPayed += c.totalPayed || 0;
        acc.totalCredit += c.totalCredit || 0;
        acc.totalCash += c.totalCash || 0;
        acc.totalCreditPayed += c.totalCreditPayed || 0;
        acc.totalCashPayed += c.totalCashPayed || 0;
        acc.totalUncollectedCheque += c.uncollectedCheque || 0;
        acc.totalBouncedCheques += c.bouncedCheques || 0;
        acc.totalExtraPayed += c.extraPayed || 0;
        if ((c.balance || 0) > 0) acc.customersWithBalance += 1;
        if ((c.bouncedCheques || 0) > 0) acc.customersWithBounced += 1;
        if (c.expDate && new Date(c.expDate) < new Date()) acc.expiredLicenses += 1;
        return acc;
      },
      {
        totalCustomers: 0,
        totalBalance: 0,
        totalPurchase: 0,
        totalPayed: 0,
        totalCredit: 0,
        totalCash: 0,
        totalCreditPayed: 0,
        totalCashPayed: 0,
        totalUncollectedCheque: 0,
        totalBouncedCheques: 0,
        totalExtraPayed: 0,
        customersWithBalance: 0,
        customersWithBounced: 0,
        expiredLicenses: 0,
      }
    );
  }, [customers]);

  const sortedCustomers = useMemo(() => {
    const filtered = customers.filter(c =>
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.tinNumber && c.tinNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return [...filtered].sort((a, b) => {
      let aVal: any = a[sortKey] || 0;
      let bVal: any = b[sortKey] || 0;
      if (sortKey === 'customerName') {
        return sortDir === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [customers, searchQuery, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedCustomers.length / rowsPerPage));
  const paginatedCustomers = sortedCustomers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const formatCurrency = (n: number) =>
    `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span style={{ opacity: 0.3, marginLeft: '0.25rem' }}>⇅</span>;
    return <span style={{ marginLeft: '0.25rem' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="dashboard-container">
      <header className="page-header">
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800 }}>
            Customer Summary Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Consolidated financial overview of all customer ledger accounts, balances, and exposures.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn-secondary"
            onClick={() => router.push('/customers')}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
          >
            📁 Directory
          </button>
          <button
            className="btn-primary"
            onClick={() => router.push('/customers/new')}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
          >
            + New Customer
          </button>
        </div>
      </header>

      {loading ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading customer summary...
        </div>
      ) : customers.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No customers registered. Create a ledger account to begin.
        </div>
      ) : (
        <>
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-title">Total Customers</div>
              <div className="stat-value" style={{ color: '#3b82f6' }}>{aggregates.totalCustomers}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {aggregates.customersWithBalance} with outstanding balance
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="stat-title">Total Outstanding</div>
              <div className="stat-value" style={{ color: 'var(--danger)', fontSize: '1.5rem' }}>
                {formatCurrency(aggregates.totalBalance)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Receivables across all customers
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-title">Total Revenue</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {formatCurrency(aggregates.totalPurchase)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Collected: {formatCurrency(aggregates.totalPayed)}
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="stat-title">Uncollected Cheques</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                {formatCurrency(aggregates.totalUncollectedCheque)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Bounced: {formatCurrency(aggregates.totalBouncedCheques)}
              </div>
            </div>
          </div>

          <div className="dashboard-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' as any }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Credit Sales
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                {formatCurrency(aggregates.totalCredit)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Settled: {formatCurrency(aggregates.totalCreditPayed)}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Cash Sales
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                {formatCurrency(aggregates.totalCash)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Settled: {formatCurrency(aggregates.totalCashPayed)}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Extra Payments
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)' }}>
                {formatCurrency(aggregates.totalExtraPayed)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Advance / overpayments
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Risk Indicators
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--danger)' }}>
                    {aggregates.customersWithBounced}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Bounced</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--warning)' }}>
                    {aggregates.expiredLicenses}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Expired Lic.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-hover)' }}>
                Customer Financial Summary ({sortedCustomers.length})
              </h3>
              <input
                type="text"
                placeholder="Search by name or TIN..."
                className="form-control"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ maxWidth: '300px', padding: '0.5rem 0.9rem' }}
              />
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '0.85rem 0.75rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('customerName')}>
                      Customer <SortIcon column="customerName" />
                    </th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>TIN</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>Rep</th>
                    <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('totalPurchase')}>
                      Total Purchases <SortIcon column="totalPurchase" />
                    </th>
                    <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('totalCredit')}>
                      Credit <SortIcon column="totalCredit" />
                    </th>
                    <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('totalPayed')}>
                      Total Paid <SortIcon column="totalPayed" />
                    </th>
                    <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('uncollectedCheque')}>
                      Uncoll. Cheques <SortIcon column="uncollectedCheque" />
                    </th>
                    <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('bouncedCheques')}>
                      Bounced <SortIcon column="bouncedCheques" />
                    </th>
                    <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('balance')}>
                      Balance <SortIcon column="balance" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No customers match your search.
                      </td>
                    </tr>
                  ) : (
                    paginatedCustomers.map((cust) => (
                      <tr key={cust.id} className="hover-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <Link
                            href={`/customers/${cust.id}`}
                            style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600 }}
                          >
                            {cust.customerName}
                          </Link>
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{cust.tinNumber || '-'}</td>
                        <td style={{ padding: '0.75rem', color: cust.salesRep ? '#60a5fa' : 'var(--text-muted)' }}>
                          {cust.salesRep ? `${cust.salesRep.firstName} ${cust.salesRep.lastName}` : '—'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#fff' }}>{formatCurrency(cust.totalPurchase)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--warning)' }}>{formatCurrency(cust.totalCredit)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(cust.totalPayed)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--warning)' }}>{formatCurrency(cust.uncollectedCheque)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: (cust.bouncedCheques || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: (cust.bouncedCheques || 0) > 0 ? 700 : 400 }}>
                          {formatCurrency(cust.bouncedCheques)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: (cust.balance || 0) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 800 }}>
                          {formatCurrency(cust.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {sortedCustomers.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Showing {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, sortedCustomers.length)} of {sortedCustomers.length}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn-secondary"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    ← Prev
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 0.5rem' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="btn-secondary"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
