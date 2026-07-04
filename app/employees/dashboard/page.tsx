'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { showError } from '../../../lib/toast';

interface Department {
  id: number;
  departmentName: string;
  employeeCount: number;
}

interface EmployeeStat {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
  idNumber: string;
  department: { id: number; departmentName: string };
  customerCount: number;
  invoiceCount: number;
  totalSales: number;
  totalCollected: number;
  totalOutstanding: number;
  overdueAmount: number;
  overdueInvoiceCount: number;
  thisMonthSales: number;
  lastMonthSales: number;
  monthOverMonth: number;
  customerBalance: number;
  customerPurchase: number;
  hasLogin: boolean;
  loginRole: string | null;
  loginUsername: string | null;
  collectionRate: number;
}

interface StatsResponse {
  employees: EmployeeStat[];
  departments: Department[];
  totals: {
    totalEmployees: number;
    totalCustomers: number;
    totalSales: number;
    totalCollected: number;
    totalOutstanding: number;
    totalOverdue: number;
    employeesWithLogins: number;
  };
}

type SortKey = 'name' | 'department' | 'customerCount' | 'totalSales' | 'totalCollected' | 'totalOutstanding' | 'overdueAmount' | 'collectionRate' | 'thisMonthSales';
type SortDir = 'asc' | 'desc';

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== column) return <span style={{ opacity: 0.3, marginLeft: '0.25rem' }}>⇅</span>;
  return <span style={{ marginLeft: '0.25rem' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
}

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<number | 'All'>('All');
  const [sortKey, setSortKey] = useState<SortKey>('totalSales');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const fullName = (e: EmployeeStat) =>
    [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ').trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('http://localhost:5000/api/employees/stats');
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setData(json);
        } else {
          showError('Failed to load employee statistics');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch employee stats', err);
        showError('Failed to load employee statistics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    return data.employees.filter(e => {
      if (departmentFilter !== 'All' && e.department.id !== departmentFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = fullName(e).toLowerCase();
        const dept = e.department.departmentName.toLowerCase();
        const username = (e.loginUsername || '').toLowerCase();
        if (!name.includes(q) && !dept.includes(q) && !username.includes(q) && !e.idNumber.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [data, searchQuery, departmentFilter]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortKey) {
        case 'name':
          aVal = fullName(a); bVal = fullName(b);
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'department':
          aVal = a.department.departmentName; bVal = b.department.departmentName;
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'customerCount':
          aVal = a.customerCount; bVal = b.customerCount;
          break;
        case 'totalSales':
          aVal = a.totalSales; bVal = b.totalSales;
          break;
        case 'totalCollected':
          aVal = a.totalCollected; bVal = b.totalCollected;
          break;
        case 'totalOutstanding':
          aVal = a.totalOutstanding; bVal = b.totalOutstanding;
          break;
        case 'overdueAmount':
          aVal = a.overdueAmount; bVal = b.overdueAmount;
          break;
        case 'collectionRate':
          aVal = a.collectionRate; bVal = b.collectionRate;
          break;
        case 'thisMonthSales':
          aVal = a.thisMonthSales; bVal = b.thisMonthSales;
          break;
        default:
          aVal = 0; bVal = 0;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredEmployees, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedEmployees.length / rowsPerPage));
  const paginatedEmployees = sortedEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'department' ? 'asc' : 'desc');
    }
  };

  const formatCurrency = (n: number) =>
    `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="dashboard-container">
      <header className="page-header gen-page-header">
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800 }}>
            Employee Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Sales performance, customer portfolios, and account activity by employee.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn-secondary"
            onClick={() => router.push('/employees')}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
          >
            📁 Directory
          </button>
          <button
            className="btn-primary"
            onClick={() => router.push('/employees/new')}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
          >
            + Register Employee
          </button>
        </div>
      </header>

      {loading ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading employee statistics...
        </div>
      ) : !data || data.employees.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No employees registered yet.
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-title">Total Employees</div>
              <div className="stat-value" style={{ color: '#3b82f6' }}>{data.totals.totalEmployees}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {data.totals.employeesWithLogins} with system login
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-title">Total Sales</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {formatCurrency(data.totals.totalSales)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Collected: {formatCurrency(data.totals.totalCollected)}
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="stat-title">Outstanding</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                {formatCurrency(data.totals.totalOutstanding)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Across {data.totals.totalCustomers} customers
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="stat-title">Overdue</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>
                {formatCurrency(data.totals.totalOverdue)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Past payment date
              </div>
            </div>
          </div>

          {/* Department Breakdown + Top Performers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--accent-hover)' }}>Department Breakdown</h3>
              {data.departments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem' }}>No departments defined.</p>
              ) : (
                <>
                <div className="tbl-mobile">
                  {data.departments.map(d => {
                    const share = data.totals.totalEmployees > 0 ? (d.employeeCount / data.totals.totalEmployees) * 100 : 0;
                    return (
                      <div className="gen-mobile-card" key={d.id}>
                        <div className="gen-mobile-card-header">
                          <div className="gen-mobile-card-title">{d.departmentName}</div>
                        </div>
                        <div className="gen-mobile-card-body">
                          <div className="gen-mobile-card-row">
                            <span className="gen-mobile-card-label">Employees</span>
                            <span className="gen-mobile-card-value">{d.employeeCount}</span>
                          </div>
                          <div className="gen-mobile-card-row">
                            <span className="gen-mobile-card-label">Share</span>
                            <span className="gen-mobile-card-value">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${share}%`, background: 'var(--accent-color)', borderRadius: '3px' }} />
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{share.toFixed(0)}%</span>
                              </div>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="tbl-desktop">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.6rem 0.5rem' }}>Department</th>
                          <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Employees</th>
                          <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.departments.map(d => {
                          const share = data.totals.totalEmployees > 0 ? (d.employeeCount / data.totals.totalEmployees) * 100 : 0;
                          return (
                            <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{d.departmentName}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{d.employeeCount}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                  <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${share}%`, background: 'var(--accent-color)', borderRadius: '3px' }} />
                                  </div>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{share.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--accent-hover)' }}>Top Performers (by Sales)</h3>
              {sortedEmployees.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem' }}>No data.</p>
              ) : (
                <>
                <div className="tbl-mobile">
                  {[...sortedEmployees]
                    .sort((a, b) => b.totalSales - a.totalSales)
                    .slice(0, 5)
                    .map((e, idx) => (
                      <div className="gen-mobile-card" key={e.id}>
                        <div className="gen-mobile-card-header">
                          <div className="gen-mobile-card-title">
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: idx === 0 ? 'rgba(245, 158, 11, 0.2)' : idx === 1 ? 'rgba(156, 163, 175, 0.2)' : idx === 2 ? 'rgba(180, 83, 9, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : 'var(--text-muted)',
                              fontSize: '0.7rem', fontWeight: 700, marginRight: '0.5rem'
                            }}>{idx + 1}</span>
                            <Link href={`/employees?id=${e.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>
                              {fullName(e)}
                            </Link>
                          </div>
                        </div>
                        <div className="gen-mobile-card-body">
                          <div className="gen-mobile-card-row">
                            <span className="gen-mobile-card-label">Customers</span>
                            <span className="gen-mobile-card-value">{e.customerCount}</span>
                          </div>
                          <div className="gen-mobile-card-row">
                            <span className="gen-mobile-card-label">Sales</span>
                            <span className="gen-mobile-card-value" style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(e.totalSales)}</span>
                          </div>
                          <div className="gen-mobile-card-row">
                            <span className="gen-mobile-card-label">MoM</span>
                            <span className="gen-mobile-card-value" style={{ color: e.monthOverMonth > 0 ? 'var(--success)' : e.monthOverMonth < 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                              {e.monthOverMonth > 0 ? '↑' : e.monthOverMonth < 0 ? '↓' : '—'} {Math.abs(e.monthOverMonth).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="tbl-desktop">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.6rem 0.5rem' }}>Employee</th>
                          <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Customers</th>
                          <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Sales</th>
                          <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>MoM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...sortedEmployees]
                          .sort((a, b) => b.totalSales - a.totalSales)
                          .slice(0, 5)
                          .map((e, idx) => (
                            <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '22px', height: '22px', borderRadius: '50%',
                                    background: idx === 0 ? 'rgba(245, 158, 11, 0.2)' : idx === 1 ? 'rgba(156, 163, 175, 0.2)' : idx === 2 ? 'rgba(180, 83, 9, 0.2)' : 'rgba(255,255,255,0.05)',
                                    color: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : 'var(--text-muted)',
                                    fontSize: '0.7rem', fontWeight: 700
                                  }}>{idx + 1}</span>
                                  <Link href={`/employees?id=${e.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>
                                    {fullName(e)}
                                  </Link>
                                </div>
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{e.customerCount}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(e.totalSales)}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                                <span style={{
                                  color: e.monthOverMonth > 0 ? 'var(--success)' : e.monthOverMonth < 0 ? 'var(--danger)' : 'var(--text-muted)',
                                  fontWeight: 600, fontSize: '0.78rem'
                                }}>
                                  {e.monthOverMonth > 0 ? '↑' : e.monthOverMonth < 0 ? '↓' : '—'} {Math.abs(e.monthOverMonth).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
              )}
            </div>
          </div>

          {/* Performance Table */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-hover)' }}>
                Employee Performance ({sortedEmployees.length})
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search by name, department, ID, login..."
                  className="form-control"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ maxWidth: '320px', padding: '0.5rem 0.9rem' }}
                />
                <select
                  className="form-control"
                  value={departmentFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDepartmentFilter(v === 'All' ? 'All' : parseInt(v));
                    setCurrentPage(1);
                  }}
                  style={{ maxWidth: '180px', padding: '0.5rem 0.9rem' }}
                >
                  <option value="All">All Departments</option>
                  {data.departments.map(d => (
                    <option key={d.id} value={d.id}>{d.departmentName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="tbl-mobile">
              {paginatedEmployees.length === 0 ? (
                <div className="gen-mobile-card">
                  <div className="gen-mobile-card-body">
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No employees match your filters.</p>
                  </div>
                </div>
              ) : (
                paginatedEmployees.map(e => {
                  const collColor = e.collectionRate >= 80 ? 'var(--success)' : e.collectionRate >= 50 ? 'var(--warning)' : 'var(--danger)';
                  return (
                    <div className="gen-mobile-card" key={e.id}>
                      <div className="gen-mobile-card-header">
                        <div className="gen-mobile-card-title">
                          <Link href={`/employees?id=${e.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600 }}>
                            {fullName(e)}
                          </Link>
                        </div>
                        <div className="gen-mobile-card-subtitle" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {e.idNumber}</div>
                      </div>
                      <div className="gen-mobile-card-body">
                        <div className="gen-mobile-card-row">
                          <span className="gen-mobile-card-label">Department</span>
                          <span className="gen-mobile-card-value">{e.department.departmentName}</span>
                        </div>
                        <div className="gen-mobile-card-row">
                          <span className="gen-mobile-card-label">Login</span>
                          <span className="gen-mobile-card-value">
                            {e.hasLogin ? (
                              <>
                                <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                                  ✓ {e.loginRole}
                                </span>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{e.loginUsername}</div>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                            )}
                          </span>
                        </div>
                        <div className="gen-mobile-card-row">
                          <span className="gen-mobile-card-label">Customers</span>
                          <span className="gen-mobile-card-value">{e.customerCount}</span>
                        </div>
                        <div className="gen-mobile-card-row">
                          <span className="gen-mobile-card-label">This Month</span>
                          <span className="gen-mobile-card-value">
                            <div>{formatCurrency(e.thisMonthSales)}</div>
                            {e.lastMonthSales > 0 && (
                              <div style={{ fontSize: '0.7rem', color: e.monthOverMonth > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {e.monthOverMonth > 0 ? '↑' : '↓'} {Math.abs(e.monthOverMonth).toFixed(1)}%
                              </div>
                            )}
                          </span>
                        </div>
                        <div className="gen-mobile-card-row">
                          <span className="gen-mobile-card-label">Total Sales</span>
                          <span className="gen-mobile-card-value" style={{ fontWeight: 700 }}>{formatCurrency(e.totalSales)}</span>
                        </div>
                        <div className="gen-mobile-card-row">
                          <span className="gen-mobile-card-label">Collected</span>
                          <span className="gen-mobile-card-value" style={{ color: 'var(--success)' }}>{formatCurrency(e.totalCollected)}</span>
                        </div>
                        <div className="gen-mobile-card-row">
                          <span className="gen-mobile-card-label">Outstanding</span>
                          <span className="gen-mobile-card-value" style={{ color: e.totalOutstanding > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{formatCurrency(e.totalOutstanding)}</span>
                        </div>
                        <div className="gen-mobile-card-row">
                          <span className="gen-mobile-card-label">Overdue</span>
                          <span className="gen-mobile-card-value" style={{ color: e.overdueAmount > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: e.overdueAmount > 0 ? 700 : 400 }}>
                            {formatCurrency(e.overdueAmount)}
                          </span>
                        </div>
                        <div className="gen-mobile-card-row">
                          <span className="gen-mobile-card-label">Coll. Rate</span>
                          <span className="gen-mobile-card-value" style={{ color: collColor, fontWeight: 700 }}>{e.collectionRate.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="tbl-desktop">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.85rem 0.75rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                        Employee <SortIcon column="name" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('department')}>
                        Department <SortIcon column="department" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Login</th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('customerCount')}>
                        Customers <SortIcon column="customerCount" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('thisMonthSales')}>
                        This Month <SortIcon column="thisMonthSales" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('totalSales')}>
                        Total Sales <SortIcon column="totalSales" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('totalCollected')}>
                        Collected <SortIcon column="totalCollected" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('totalOutstanding')}>
                        Outstanding <SortIcon column="totalOutstanding" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('overdueAmount')}>
                        Overdue <SortIcon column="overdueAmount" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('collectionRate')}>
                        Coll. Rate <SortIcon column="collectionRate" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No employees match your filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedEmployees.map(e => {
                        const collColor = e.collectionRate >= 80 ? 'var(--success)' : e.collectionRate >= 50 ? 'var(--warning)' : 'var(--danger)';
                        return (
                          <tr key={e.id} className="hover-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                            <td style={{ padding: '0.75rem' }}>
                              <Link href={`/employees?id=${e.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600 }}>
                                {fullName(e)}
                              </Link>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {e.idNumber}</div>
                            </td>
                            <td style={{ padding: '0.75rem' }}>{e.department.departmentName}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              {e.hasLogin ? (
                                <div>
                                  <span style={{
                                    padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                                    background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)'
                                  }}>
                                    ✓ {e.loginRole}
                                  </span>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{e.loginUsername}</div>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{e.customerCount}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              <div>{formatCurrency(e.thisMonthSales)}</div>
                              {e.lastMonthSales > 0 && (
                                <div style={{ fontSize: '0.7rem', color: e.monthOverMonth > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  {e.monthOverMonth > 0 ? '↑' : '↓'} {Math.abs(e.monthOverMonth).toFixed(1)}%
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(e.totalSales)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(e.totalCollected)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: e.totalOutstanding > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{formatCurrency(e.totalOutstanding)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: e.overdueAmount > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: e.overdueAmount > 0 ? 700 : 400 }}>
                              {formatCurrency(e.overdueAmount)}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: collColor, fontWeight: 700 }}>
                              {e.collectionRate.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {sortedEmployees.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Showing {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, sortedEmployees.length)} of {sortedEmployees.length}
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
