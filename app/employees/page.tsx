'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../lib/api';

interface Department {
  departmentName: string;
}

interface Customer {
  id: number;
  customerName: string;
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

interface Employee {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
  idNumber: string;
  department: Department;
  customers: Customer[];
  invoices: Invoice[];
  payments?: Payment[];
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading Employees Directory...
      </div>
    }>
      <EmployeesDirectory />
    </Suspense>
  );
}

function EmployeesDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectIdStr = searchParams.get('id');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'payments'>('invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0 && selectIdStr) {
      const targetEmp = employees.find((e: any) => e.id === parseInt(selectIdStr));
      if (targetEmp) {
        handleSelectEmployee(targetEmp);
      }
    }
  }, [selectIdStr, employees]);

  const fetchEmployees = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
        if (data.length > 0) {
          const defaultSelect = selectIdStr ? (data.find((e: any) => e.id === parseInt(selectIdStr)) || data[0]) : data[0];
          handleSelectEmployee(defaultSelect);
        }
      }
    } catch (err) {
      console.error('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmployee = async (emp: Employee) => {
    setSelectedEmp(emp);
    setDetailsLoading(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/employees/${emp.id}`);
      if (res.ok) {
        const fullDetails = await res.json();
        setSelectedEmp(fullDetails);
      }
    } catch (err) {
      console.error('Failed to fetch employee details', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredEmployees = employees.filter(e =>
    `${e.firstName} ${e.middleName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.idNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / rowsPerPage));

  return (
    <div className="dashboard-container employee-page-shell">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0, flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800 }}>Employee Directory</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>Manage corporate personnel, departments, and monitor their linked customer portfolios.</p>
        </div>
        <button className="btn-primary" onClick={() => router.push('/employees/new')} style={{ padding: '0.6rem 1.25rem' }}>
          + Register Employee
        </button>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading employees...
        </div>
      ) : employees.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No employees registered. Create a profile to begin.
        </div>
      ) : (
        <div className="employee-grid" style={{ flex: 1, minHeight: 0 }}>

          {/* Employee List */}
          <div className="glass-panel employee-list-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Search employees by name or ID..."
                className="form-control"
                style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Mobile card list - always visible on mobile */}
            <div className="customer-mobile-search-results">
              {paginatedEmployees.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
                  {searchQuery ? 'No employees match your search.' : 'No employees found.'}
                </p>
              ) : (
                paginatedEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="customer-mobile-search-item"
                    onClick={() => handleSelectEmployee(emp)}
                  >
                    <div>
                      <span
                        style={{ fontWeight: '700', color: 'var(--accent-hover)', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/employees?id=${emp.id}`);
                        }}
                      >
                        {emp.firstName} {emp.middleName} {emp.lastName}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        ID: {emp.idNumber}
                        {emp.department ? ` · ${emp.department.departmentName}` : ''}
                      </div>
                    </div>
                    <div style={{ color: '#60a5fa', fontWeight: '600', fontSize: '0.85rem' }}>
                      {emp.customers?.length || 0} customers
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
                    <th style={{ padding: '0.75rem 0.5rem' }}>Employee</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>ID Number</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Department</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Customers</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        background: selectedEmp?.id === emp.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => handleSelectEmployee(emp)}
                    >
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span
                          style={{ fontWeight: '700', color: 'var(--accent-hover)', cursor: 'pointer', textDecoration: 'underline', display: 'block' }}
                          title="Click to view employee details"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/employees?id=${emp.id}`);
                          }}
                        >
                          {emp.firstName} {emp.middleName} {emp.lastName}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{emp.idNumber}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.department?.departmentName || '-'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                          {emp.customers?.length || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="customer-table-desktop-only" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
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
          </div>

          {/* Employee Details Panel */}
          {selectedEmp && (
            <div className="glass-panel employee-detail-panel" style={{ display: 'flex', flexDirection: 'column' }}>

              {/* Detailed view header */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: '1.1rem', fontWeight: 'bold', color: 'white', flexShrink: 0
                  }}>
                    {selectedEmp.firstName[0]}{selectedEmp.lastName[0]}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }} className="text-gradient">
                      {selectedEmp.firstName} {selectedEmp.lastName}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                      {selectedEmp.department?.departmentName || 'No Department'} · ID: {selectedEmp.idNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', paddingBottom: '1rem', flexShrink: 0 }}>
                <div>
                  <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>ID Number</label>
                  <p style={{ fontWeight: '600', fontSize: '0.95rem', margin: '0.15rem 0 0 0' }}>{selectedEmp.idNumber}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Middle Name</label>
                  <p style={{ fontWeight: '500', fontSize: '0.95rem', margin: '0.15rem 0 0 0' }}>{selectedEmp.middleName || '-'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Department</label>
                  <p style={{ fontWeight: '500', fontSize: '0.95rem', margin: '0.15rem 0 0 0' }}>{selectedEmp.department?.departmentName || '-'}</p>
                </div>
              </div>

              {detailsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ marginBottom: '1rem' }}>⌛</div>
                  <p style={{ fontSize: '0.95rem' }}>Loading portfolios...</p>
                </div>
              ) : (
                <>
                  {/* Sub Tab Navigation */}
                  <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '1rem', flexShrink: 0 }}>
                    <button
                      onClick={() => setActiveSubTab('invoices')}
                      style={{
                        background: 'transparent', border: 'none',
                        color: activeSubTab === 'invoices' ? 'var(--accent-hover)' : 'var(--text-muted)',
                        fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
                        paddingBottom: '0.5rem',
                        borderBottom: activeSubTab === 'invoices' ? '2px solid var(--accent-hover)' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      Invoices ({selectedEmp.invoices?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveSubTab('payments')}
                      style={{
                        background: 'transparent', border: 'none',
                        color: activeSubTab === 'payments' ? 'var(--accent-hover)' : 'var(--text-muted)',
                        fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
                        paddingBottom: '0.5rem',
                        borderBottom: activeSubTab === 'payments' ? '2px solid var(--accent-hover)' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      Payments ({selectedEmp.payments?.length || 0})
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="employee-tab-content">
                    {/* Invoices Tab */}
                    {activeSubTab === 'invoices' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedEmp.invoices && selectedEmp.invoices.length > 0 ? (
                          selectedEmp.invoices.map((inv) => {
                            const statusStyle = (() => {
                              const s = inv.computedStatus || inv.status;
                              switch (s) {
                                case 'Critical': return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' };
                                case 'Overdue': return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
                                case 'Today': return { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' };
                                case 'This Week': return { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' };
                                case 'Upcoming': return { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)' };
                                case 'Paid': return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' };
                                case 'Void': return { background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)' };
                                default: return { background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' };
                              }
                            })();

                            return (
                              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '0.65rem 0.85rem', borderRadius: '8px', cursor: 'pointer' }} onClick={() => router.push(`/invoices/${inv.id}`)}>
                                <div>
                                  <p style={{ fontWeight: '600', margin: 0, fontSize: '0.9rem' }}>{inv.invoiceNumber}</p>
                                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                                    Bill: {new Date(inv.createdAt).toLocaleDateString()} · Due: {new Date(inv.paymentDate).toLocaleDateString()}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontWeight: '600', margin: 0, fontSize: '0.85rem' }}>${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    <p style={{ fontSize: '0.7rem', color: inv.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)', margin: 0 }}>
                                      Rem: ${inv.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <span style={{ ...statusStyle, padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                    {inv.computedStatus || inv.status}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No billing history found.</p>
                        )}
                      </div>
                    )}

                    {/* Payments Tab */}
                    {activeSubTab === 'payments' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedEmp.payments && selectedEmp.payments.length > 0 ? (
                          selectedEmp.payments.map((pmt) => (
                            <div key={pmt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '0.65rem 0.85rem', borderRadius: '8px', cursor: 'pointer' }} onClick={() => router.push(`/invoices/${pmt.invoiceId}`)}>
                              <div>
                                <p style={{ fontWeight: '600', margin: 0, fontSize: '0.9rem' }}>{pmt.paymentMethod} Receipt</p>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  Inv: <strong style={{ color: 'var(--accent-hover)' }}>{pmt.invoiceNumber}</strong>
                                  {pmt.bank && ` · ${pmt.bank}`}
                                  {pmt.chequeNumber && ` · Chq# ${pmt.chequeNumber}`}
                                </span>
                              </div>
                              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div>
                                  <p style={{ fontWeight: '700', color: 'var(--success)', margin: 0, fontSize: '0.85rem' }}>+${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>Recd: {new Date(pmt.receivedDate).toLocaleDateString()}</p>
                                </div>
                                <span style={{ background: pmt.status === 'Collected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: pmt.status === 'Collected' ? 'var(--success)' : 'var(--warning)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
                                  {pmt.status}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No payment receipts found.</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
