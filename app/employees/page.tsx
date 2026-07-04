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

  return (
    <div className="dashboard-container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>Employee Directory</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage corporate personnel, departments, and monitor their linked customer portfolios.</p>
        </div>
        <button className="btn-primary" onClick={() => router.push('/employees/new')}>
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
        <div className="employee-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
          
          {/* Employee List */}
          <div className="glass-panel employee-list-panel" style={{ padding: '1rem', overflowX: 'auto', alignSelf: 'start' }}>
            <div style={{ marginBottom: '1rem' }}>
              <input 
                type="text" 
                placeholder="Search employees by name or ID..." 
                className="form-control" 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <th style={{ padding: '1rem' }}>ID Number</th>
                  <th style={{ padding: '1rem' }}>Employee Name</th>
                  <th style={{ padding: '1rem' }}>Department</th>
                  <th style={{ padding: '1rem' }}>Customers</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredEmployees = employees.filter(e => 
                    `${e.firstName} ${e.middleName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    e.idNumber.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                  return paginatedEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        background: selectedEmp?.id === emp.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => handleSelectEmployee(emp)}
                    >
                      <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--accent-hover)' }}>{emp.idNumber}</td>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>
                        {emp.firstName} {emp.middleName} {emp.lastName}
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{emp.department?.departmentName || '-'}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                          {emp.customers?.length || 0}
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {(() => {
              const filteredEmployees = employees.filter(e => 
                `${e.firstName} ${e.middleName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || 
                e.idNumber.toLowerCase().includes(searchQuery.toLowerCase())
              );
              const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / rowsPerPage));
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

          {/* Employee Details Panel */}
          {selectedEmp && (
            <div className="glass-panel employee-detail-panel" style={{ padding: '2.5rem', alignSelf: 'start', position: 'sticky', top: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  {selectedEmp.firstName[0]}
                  {selectedEmp.lastName[0]}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem' }}>
                    {selectedEmp.firstName} {selectedEmp.lastName}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {selectedEmp.department?.departmentName || 'No Department'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>ID Number</label>
                    <p style={{ fontWeight: '500', fontSize: '1.1rem' }}>{selectedEmp.idNumber}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Middle Name</label>
                    <p style={{ fontWeight: '500' }}>{selectedEmp.middleName}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Department</label>
                    <p style={{ fontWeight: '500' }}>{selectedEmp.department?.departmentName || '-'}</p>
                  </div>
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
                  <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                    <button
                      onClick={() => setActiveSubTab('invoices')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: activeSubTab === 'invoices' ? 'var(--accent-hover)' : 'var(--text-muted)',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        paddingBottom: '0.5rem',
                        borderBottom: activeSubTab === 'invoices' ? '2px solid var(--accent-hover)' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      📜 Invoices ({selectedEmp.invoices?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveSubTab('payments')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: activeSubTab === 'payments' ? 'var(--accent-hover)' : 'var(--text-muted)',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        paddingBottom: '0.5rem',
                        borderBottom: activeSubTab === 'payments' ? '2px solid var(--accent-hover)' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      💰 Payments ({selectedEmp.payments?.length || 0})
                    </button>
                  </div>

                  {/* Render Invoices Tab */}
                  {activeSubTab === 'invoices' && (
                    <div>
                      {selectedEmp.invoices && selectedEmp.invoices.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                          {selectedEmp.invoices.map((inv) => {
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
                              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer' }} onClick={() => router.push(`/invoices/${inv.id}`)}>
                                <div>
                                  <p style={{ fontWeight: '600', margin: 0 }}>{inv.invoiceNumber}</p>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                                    Bill Date: {new Date(inv.createdAt).toLocaleDateString()} | Due: {new Date(inv.paymentDate).toLocaleDateString()}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontWeight: '600', margin: 0 }}>${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    <p style={{ fontSize: '0.75rem', color: inv.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)', margin: 0 }}>
                                      Remaining: ${inv.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <span style={{ ...statusStyle, padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                                    {inv.computedStatus || inv.status}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No billing history found.</p>
                      )}
                    </div>
                  )}

                  {/* Render Payments Tab */}
                  {activeSubTab === 'payments' && (
                    <div>
                      {selectedEmp.payments && selectedEmp.payments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                          {selectedEmp.payments.map((pmt) => (
                            <div key={pmt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '0.85rem 1.15rem', borderRadius: '8px', cursor: 'pointer' }} onClick={() => router.push(`/invoices/${pmt.invoiceId}`)}>
                              <div>
                                <p style={{ fontWeight: '600', margin: 0, fontSize: '0.95rem' }}>💳 {pmt.paymentMethod} Receipt</p>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Invoice: <strong style={{ color: 'var(--accent-hover)' }}>{pmt.invoiceNumber}</strong>
                                  {pmt.bank && ` | Bank: ${pmt.bank}`}
                                  {pmt.chequeNumber && ` | Cheque: ${pmt.chequeNumber}`}
                                </span>
                              </div>
                              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div>
                                  <p style={{ fontWeight: '700', color: 'var(--success)', margin: 0 }}>+${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Recd: {new Date(pmt.receivedDate).toLocaleDateString()}</p>
                                </div>
                                <span style={{ background: pmt.status === 'Collected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: pmt.status === 'Collected' ? 'var(--success)' : 'var(--warning)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                                  {pmt.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No payment receipts found.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
      <div className="sticky-footer-bar no-print">
        <button className="btn-primary" onClick={() => router.push('/employees/new')} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
          ➕ Register Employee
        </button>
      </div>
    </div>
  );
}
