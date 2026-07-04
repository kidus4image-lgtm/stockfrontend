'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api';

export default function CustomerReportPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerDetails();
  }, [params.id]);

  const fetchCustomerDetails = async () => {
    try {
      const resolvedParams = await params;
      const res = await apiFetch(`http://localhost:5000/api/customers/${resolvedParams.id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
      }
    } catch (err) {
      console.error('Failed to fetch customer report details', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Generating full ledger report...
      </div>
    );
  }

  if (!customer) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Customer not found.</div>;
  }

  return (
    <div className="dashboard-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <button 
            onClick={() => router.back()} 
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-hover)', cursor: 'pointer', marginBottom: '1rem', fontWeight: 'bold' }}
          >
            &larr; Back to Customers
          </button>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>Customer Ledger Report</h1>
          <p style={{ color: 'var(--text-muted)' }}>Complete financial report for {customer.customerName}</p>
        </div>
        <button className="btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🖨️ Export / Print Report
        </button>
      </header>

      {/* PRINTABLE AREA */}
      <div className="glass-panel report-print-area" style={{ padding: '3rem', background: '#ffffff', color: '#1f2937' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e5e7eb', paddingBottom: '2rem', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, color: '#111827' }}>{customer.customerName}</h2>
            <p style={{ fontSize: '1.1rem', color: '#4b5563', margin: '0.5rem 0 0 0' }}>TIN: <strong>{customer.tinNumber || 'N/A'}</strong></p>
            <p style={{ fontSize: '0.95rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>{customer.address || 'No Address Provided'}</p>
            <p style={{ fontSize: '0.95rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>{customer.phoneNumber || 'No Phone Provided'} | {customer.emailAddress || 'No Email Provided'}</p>
            <p style={{ fontSize: '0.95rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>Contact Person: {customer.contactPerson || 'N/A'}</p>
            <p style={{ fontSize: '0.95rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>Chat ID: {customer.chatId || 'N/A'} | User Name: {customer.userName || 'N/A'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, color: '#6b7280', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Report Generated</h3>
            <p style={{ margin: '0.25rem 0 1rem 0', fontWeight: 600 }}>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
            <h3 style={{ margin: 0, color: '#6b7280', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Sales Rep</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontWeight: 600 }}>{customer.salesRep ? `${customer.salesRep.firstName} ${customer.salesRep.lastName}` : 'Unassigned'}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
          <div style={{ background: '#f3f4f6', padding: '1.25rem', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Total Outstanding</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>${(customer.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div style={{ background: '#f3f4f6', padding: '1.25rem', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Total Purchases</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#1f2937' }}>${(customer.totalPurchase || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div style={{ background: '#f3f4f6', padding: '1.25rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Uncollected Cheques</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>${(customer.uncollectedCheque || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div style={{ background: '#f3f4f6', padding: '1.25rem', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Extra Paid</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>${(customer.extraPayed || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.5rem', color: '#111827', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Invoice Billing History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>Invoice No.</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>Bill Date</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>Due Date</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563', textAlign: 'right' }}>Total Amount</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563', textAlign: 'right' }}>Remaining</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {customer.invoices && customer.invoices.length > 0 ? (
                customer.invoices.map((inv: any) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{new Date(inv.paymentDate).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: inv.remainingPayment > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                      ${inv.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span style={{
                        background: inv.status === 'Paid' ? '#d1fae5' : '#fef3c7',
                        color: inv.status === 'Paid' ? '#065f46' : '#92400e',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {inv.computedStatus || inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No billing history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h3 style={{ fontSize: '1.5rem', color: '#111827', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Payments & Receipts Log</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>Receipt Date</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>Inv. Ref</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>Method</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>Bank & Ref Details</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.75rem 1rem', color: '#4b5563', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {customer.payments && customer.payments.length > 0 ? (
                customer.payments.map((pmt: any) => (
                  <tr key={pmt.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>{new Date(pmt.receivedDate).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{pmt.invoiceNumber}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{pmt.paymentMethod}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>
                      {pmt.bank ? `Bank: ${pmt.bank} ` : ''}
                      {pmt.chequeNumber ? `| Chq: ${pmt.chequeNumber} ` : ''}
                      {pmt.slipNumber ? `| Slip: ${pmt.slipNumber}` : ''}
                      {!pmt.bank && !pmt.chequeNumber && !pmt.slipNumber && '-'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                      +${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span style={{
                        background: pmt.status === 'Collected' ? '#d1fae5' : '#fef3c7',
                        color: pmt.status === 'Collected' ? '#065f46' : '#92400e',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {pmt.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No payment receipts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Sticky Quick Actions footer */}
      <div className="sticky-footer-bar no-print">
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>⚡ Quick Actions</span>
        <div style={{ width: '1px', height: '1.25rem', background: 'rgba(255,255,255,0.1)' }} />
        <button className="btn-primary" onClick={handlePrint} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>🖨️ Export / Print Report</button>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={() => router.back()} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>← Back to Customers</button>
        </div>
      </div>
      <div style={{ height: '5rem' }} />

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .sidebar { display: none !important; }
          .dashboard-container { margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
          .report-print-area { padding: 0 !important; border: none !important; box-shadow: none !important; }
        }
      `}} />
    </div>
  );
}
