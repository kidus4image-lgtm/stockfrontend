'use client';

import React, { useState, useMemo } from 'react';
import ReportExportToolbar from './ReportExportToolbar';
import { type ExportOptions } from '../lib/exportUtils';

interface ChequeReportsProps {
  reportType: string;
  data: {
    chequesDueToday: any[]; chequesDueTodaySummary: any;
    overdueForDeposit: any[]; overdueForDepositSummary: any;
    upcomingMaturity: any[]; upcomingMaturitySummary: any;
    pendingClearance: any[]; pendingClearanceSummary: any;
    bouncedCheques: any[]; bouncedChequesSummary: any;
    collectedThisPeriod: any[]; collectedThisPeriodSummary: any;
    cashVsChequeSummary: any; cashVsChequeMonthly: any[];
    chequeAgingBuckets: any[]; chequeAgingSummary: any;
    depositBankData: any[]; bulkPaymentBatches: any[];
  };
  accentColor: string;
  loading: boolean;
}

function formatDate(d: string | Date | null): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmt(v: number | null | undefined): string {
  return `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function StatCard({ label, value, color, accent }: { label: string; value: string; color?: string; accent?: string }) {
  return (
    <div style={{
      padding: '1.25rem', borderRadius: '12px',
      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)',
      borderLeft: `4px solid ${color || accent || 'var(--accent-color)'}`
    }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--text-main)' }}>{value}</div>
    </div>
  );
}

function Table({ headers, rows, accentColor }: { headers: string[]; rows: any[][]; accentColor: string }) {
  return (
    <div className="table-responsive" style={{ marginTop: '1rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '0.65rem 0.75rem', background: accentColor, color: '#fff', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No data</td></tr>
          ) : rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '0.55rem 0.75rem', color: typeof cell === 'number' ? '#f8fafc' : 'var(--text-main)' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChequeCollectionReports({ reportType, data, accentColor, loading }: ChequeReportsProps) {
  const now = new Date();
  const [searchFilter, setSearchFilter] = useState('');
  const [daysAhead, setDaysAhead] = useState(7);
  const [bounceReasonFilter, setBounceReasonFilter] = useState('');
  const [agingFilter, setAgingFilter] = useState('all');

  const exportConfig = useMemo((): ExportOptions | null => {
    const base = { title: '', filename: `${reportType}_${new Date().toISOString().slice(0, 10)}` };
    switch (reportType) {
      case 'cheques_due_today':
        return { ...base, title: 'Cheques Due Today', columns: [
          { key: 'chequeNumber', label: 'Cheque #' }, { key: 'customerName', label: 'Customer' },
          { key: 'amount', label: 'Amount', align: 'right', format: (v: number) => fmt(v) },
          { key: 'dueDateStr', label: 'Due Date' }, { key: 'invoiceNumber', label: 'Invoice #' },
        ], data: data.chequesDueToday.map((c: any) => ({ ...c, dueDateStr: formatDate(c.dueDate), customerName: c.invoice?.customer?.customerName || 'N/A', invoiceNumber: c.invoice?.invoiceNumber || 'N/A', chequeNumber: c.chequeNumber || 'N/A' })),
        summary: data.chequesDueTodaySummary ? [{ label: 'Total', value: fmt(data.chequesDueTodaySummary.totalAmount) }, { label: 'Count', value: data.chequesDueTodaySummary.count }] : undefined };
      case 'overdue_for_deposit':
        return { ...base, title: 'Overdue for Deposit', columns: [
          { key: 'chequeNumber', label: 'Cheque #' }, { key: 'customerName', label: 'Customer' },
          { key: 'amount', label: 'Amount', align: 'right', format: (v: number) => fmt(v) },
          { key: 'dueDateStr', label: 'Due Date' }, { key: 'daysOverdue', label: 'Days Overdue', align: 'center' },
        ], data: data.overdueForDeposit.map((c: any) => ({ ...c, dueDateStr: formatDate(c.dueDate), customerName: c.invoice?.customer?.customerName || 'N/A', daysOverdue: Math.floor((now.getTime() - new Date(c.dueDate).getTime()) / (1000 * 60 * 60 * 24)) })),
        summary: data.overdueForDepositSummary ? [{ label: 'Total', value: fmt(data.overdueForDepositSummary.totalAmount) }, { label: 'Count', value: data.overdueForDepositSummary.count }, { label: 'Avg Days', value: data.overdueForDepositSummary.avgDaysOverdue }] : undefined };
      case 'upcoming_maturity':
        return { ...base, title: 'Upcoming Maturity', columns: [
          { key: 'chequeNumber', label: 'Cheque #' }, { key: 'customerName', label: 'Customer' },
          { key: 'amount', label: 'Amount', align: 'right', format: (v: number) => fmt(v) },
          { key: 'dueDateStr', label: 'Maturity Date' }, { key: 'daysUntil', label: 'Days Until', align: 'center' },
        ], data: data.upcomingMaturity.map((c: any) => ({ ...c, dueDateStr: formatDate(c.dueDate), customerName: c.invoice?.customer?.customerName || 'N/A', daysUntil: Math.ceil((new Date(c.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) })) };
      case 'pending_clearance':
        return { ...base, title: 'Pending Clearance', columns: [
          { key: 'chequeNumber', label: 'Cheque #' }, { key: 'customerName', label: 'Customer' },
          { key: 'amount', label: 'Amount', align: 'right', format: (v: number) => fmt(v) },
          { key: 'depositBank', label: 'Deposit Bank' }, { key: 'depositDateStr', label: 'Deposit Date' },
        ], data: data.pendingClearance.map((c: any) => ({ ...c, depositDateStr: formatDate(c.depositDate), customerName: c.invoice?.customer?.customerName || 'N/A', depositBank: c.depositBank || 'N/A' })) };
      case 'bounced_cheques':
        return { ...base, title: 'Bounced Cheques', columns: [
          { key: 'chequeNumber', label: 'Cheque #' }, { key: 'customerName', label: 'Customer' },
          { key: 'amount', label: 'Amount', align: 'right', format: (v: number) => fmt(v) },
          { key: 'bounceReason', label: 'Reason' }, { key: 'bouncedDateStr', label: 'Bounced Date' },
        ], data: data.bouncedCheques.map((c: any) => ({ ...c, bouncedDateStr: formatDate(c.bouncedDate), customerName: c.invoice?.customer?.customerName || 'N/A', chequeNumber: c.chequeNumber || 'N/A' })) };
      case 'collected_this_period':
        return { ...base, title: 'Collected This Period', columns: [
          { key: 'chequeNumber', label: 'Cheque #' }, { key: 'customerName', label: 'Customer' },
          { key: 'amount', label: 'Amount', align: 'right', format: (v: number) => fmt(v) },
          { key: 'clearedDateStr', label: 'Cleared Date' }, { key: 'daysToClear', label: 'Days to Clear', align: 'center' },
        ], data: data.collectedThisPeriod.map((c: any) => ({ ...c, clearedDateStr: formatDate(c.clearedDate), customerName: c.invoice?.customer?.customerName || 'N/A', daysToClear: c.receivedDate && c.clearedDate ? Math.round((new Date(c.clearedDate).getTime() - new Date(c.receivedDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A' })) };
      case 'cash_vs_cheque':
        return { ...base, title: 'Cash vs Cheque Summary', columns: [
          { key: 'month', label: 'Month' }, { key: 'cashCount', label: 'Cash Count', align: 'center' },
          { key: 'cashAmount', label: 'Cash Amount', align: 'right', format: (v: number) => fmt(v) },
          { key: 'chequeCount', label: 'Cheque Count', align: 'center' }, { key: 'chequeAmount', label: 'Cheque Amount', align: 'right', format: (v: number) => fmt(v) },
        ], data: data.cashVsChequeMonthly || [] };
      case 'cheque_aging':
        return { ...base, title: 'Cheque Aging', columns: [
          { key: 'label', label: 'Bucket' }, { key: 'count', label: 'Count', align: 'center' },
          { key: 'amount', label: 'Amount', align: 'right', format: (v: number) => fmt(v) },
        ], data: data.chequeAgingBuckets || [] };
      case 'deposit_bank_breakdown':
        return { ...base, title: 'Deposit Bank Breakdown', columns: [
          { key: 'bankName', label: 'Bank' }, { key: 'totalCheques', label: 'Total', align: 'center' },
          { key: 'totalAmount', label: 'Total Amount', align: 'right', format: (v: number) => fmt(v) },
          { key: 'collectedCount', label: 'Cleared', align: 'center' },
        ], data: (data.depositBankData || []).map((b: any) => ({ ...b, collectedCount: b.collected?.count || 0 })) };
      case 'bulk_payment_tracker':
        return { ...base, title: 'Bulk Payment Tracker', columns: [
          { key: 'bulkPaymentId', label: 'Batch ID' }, { key: 'customerName', label: 'Customer' },
          { key: 'chequeCount', label: 'Cheques', align: 'center' }, { key: 'totalAmount', label: 'Total', align: 'right', format: (v: number) => fmt(v) },
          { key: 'batchStatus', label: 'Status' },
        ], data: data.bulkPaymentBatches || [] };
      default: return null;
    }
  }, [reportType, data, now]);

  if (loading) return null;

  // ── 1. CHEQUES DUE TODAY ──
  if (reportType === 'cheques_due_today') {
    const filtered = data.chequesDueToday.filter((c: any) => {
      const q = searchFilter.toLowerCase();
      return !q || (c.chequeNumber || '').toLowerCase().includes(q) || (c.invoice?.customer?.customerName || '').toLowerCase().includes(q);
    });
    return (
      <div>
        <div className="no-print" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          <input type="text" placeholder="Search cheque #, customer..." className="form-control" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} style={{ maxWidth: '280px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} />
          <ReportExportToolbar exportOptions={exportConfig!} variant="compact" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Cheques Due Today" value={String(data.chequesDueTodaySummary?.count || 0)} accent={accentColor} />
          <StatCard label="Total Amount" value={fmt(data.chequesDueTodaySummary?.totalAmount)} color="#10b981" />
        </div>
        <Table headers={['Cheque #', 'Customer', 'Amount', 'Due Date', 'Invoice #', 'Bank']} accentColor={accentColor}
          rows={filtered.map((c: any) => [c.chequeNumber || '—', c.invoice?.customer?.customerName || 'N/A', fmt(c.amount), formatDate(c.dueDate), c.invoice?.invoiceNumber || '—', c.bank || c.depositBank || '—'])} />
      </div>
    );
  }

  // ── 2. OVERDUE FOR DEPOSIT ──
  if (reportType === 'overdue_for_deposit') {
    const filtered = data.overdueForDeposit.filter((c: any) => {
      const q = searchFilter.toLowerCase();
      return !q || (c.chequeNumber || '').toLowerCase().includes(q) || (c.invoice?.customer?.customerName || '').toLowerCase().includes(q);
    });
    return (
      <div>
        <div className="no-print" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          <input type="text" placeholder="Search..." className="form-control" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} style={{ maxWidth: '280px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} />
          <ReportExportToolbar exportOptions={exportConfig!} variant="compact" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Overdue Cheques" value={String(data.overdueForDepositSummary?.count || 0)} color="#dc2626" />
          <StatCard label="Total Amount" value={fmt(data.overdueForDepositSummary?.totalAmount)} color="#dc2626" />
          <StatCard label="Avg Days Overdue" value={String(data.overdueForDepositSummary?.avgDaysOverdue || 0)} accent={accentColor} />
        </div>
        <Table headers={['Cheque #', 'Customer', 'Amount', 'Due Date', 'Days Overdue', 'Invoice #']} accentColor={accentColor}
          rows={filtered.map((c: any) => {
            const days = Math.floor((now.getTime() - new Date(c.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            return [c.chequeNumber || '—', c.invoice?.customer?.customerName || 'N/A', fmt(c.amount), formatDate(c.dueDate),
              <span key="d" style={{ color: days > 30 ? '#dc2626' : days > 14 ? '#f59e0b' : '#f97316', fontWeight: 700 }}>{days}d</span>,
              c.invoice?.invoiceNumber || '—'];
          })} />
      </div>
    );
  }

  // ── 3. UPCOMING MATURITY ──
  if (reportType === 'upcoming_maturity') {
    return (
      <div>
        <div className="no-print" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Days ahead:</span>
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setDaysAhead(d)}
                style={{ padding: '0.3rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: daysAhead === d ? accentColor : 'rgba(255,255,255,0.04)', color: daysAhead === d ? '#fff' : 'var(--text-main)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                {d} days
              </button>
            ))}
          </div>
          <ReportExportToolbar exportOptions={exportConfig!} variant="compact" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Upcoming Maturities" value={String(data.upcomingMaturitySummary?.count || 0)} accent={accentColor} />
          <StatCard label="Total Amount" value={fmt(data.upcomingMaturitySummary?.totalAmount)} color="#10b981" />
        </div>
        <Table headers={['Cheque #', 'Customer', 'Amount', 'Maturity Date', 'Days Until', 'Invoice #']} accentColor={accentColor}
          rows={data.upcomingMaturity.map((c: any) => {
            const days = Math.ceil((new Date(c.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return [c.chequeNumber || '—', c.invoice?.customer?.customerName || 'N/A', fmt(c.amount), formatDate(c.dueDate),
              <span key="d" style={{ color: days <= 3 ? '#dc2626' : days <= 7 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>{days}d</span>,
              c.invoice?.invoiceNumber || '—'];
          })} />
      </div>
    );
  }

  // ── 4. PENDING CLEARANCE ──
  if (reportType === 'pending_clearance') {
    return (
      <div>
        <div className="no-print" style={{ marginBottom: '1rem' }}><ReportExportToolbar exportOptions={exportConfig!} variant="compact" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Pending Clearance" value={String(data.pendingClearanceSummary?.count || 0)} color="#f59e0b" />
          <StatCard label="Total Amount" value={fmt(data.pendingClearanceSummary?.totalAmount)} color="#f59e0b" />
          <StatCard label="Avg Days Pending" value={String(data.pendingClearanceSummary?.avgDaysPending || 0)} accent={accentColor} />
        </div>
        <Table headers={['Cheque #', 'Customer', 'Amount', 'Deposit Bank', 'Deposit Date', 'Days Pending']} accentColor={accentColor}
          rows={data.pendingClearance.map((c: any) => {
            const days = c.depositDate ? Math.floor((now.getTime() - new Date(c.depositDate).getTime()) / (1000 * 60 * 60 * 24)) : '—';
            return [c.chequeNumber || '—', c.invoice?.customer?.customerName || 'N/A', fmt(c.amount), c.depositBank || '—', formatDate(c.depositDate), days];
          })} />
      </div>
    );
  }

  // ── 5. BOUNCED CHEQUES ──
  if (reportType === 'bounced_cheques') {
    const reasons = [...new Set(data.bouncedCheques.map((c: any) => c.bounceReason).filter(Boolean))];
    const filtered = bounceReasonFilter ? data.bouncedCheques.filter((c: any) => c.bounceReason === bounceReasonFilter) : data.bouncedCheques;
    return (
      <div>
        <div className="no-print" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          <select value={bounceReasonFilter} onChange={e => setBounceReasonFilter(e.target.value)} className="form-control" style={{ maxWidth: '200px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            <option value="">All Reasons</option>
            {reasons.map((r: any) => <option key={r} value={r}>{r}</option>)}
          </select>
          <ReportExportToolbar exportOptions={exportConfig!} variant="compact" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Bounced Cheques" value={String(data.bouncedChequesSummary?.count || 0)} color="#dc2626" />
          <StatCard label="Total Amount" value={fmt(data.bouncedChequesSummary?.totalAmount)} color="#dc2626" />
        </div>
        {data.bouncedChequesSummary?.byReason && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {Object.entries(data.bouncedChequesSummary.byReason).map(([reason, info]: any) => (
              <div key={reason} style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <span style={{ fontSize: '0.7rem', color: '#fb7185', fontWeight: 600, display: 'block' }}>{reason}</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f43f5e' }}>{info.count} — {fmt(info.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <Table headers={['Cheque #', 'Customer', 'Amount', 'Reason', 'Bounced Date', 'Invoice #', 'Sales Rep']} accentColor={accentColor}
          rows={filtered.map((c: any) => [c.chequeNumber || '—', c.invoice?.customer?.customerName || 'N/A', fmt(c.amount), c.bounceReason || '—', formatDate(c.bouncedDate), c.invoice?.invoiceNumber || '—', c.invoice?.salesRep ? `${c.invoice.salesRep.firstName || ''} ${c.invoice.salesRep.lastName || ''}`.trim() : '—'])} />
      </div>
    );
  }

  // ── 6. COLLECTED THIS PERIOD ──
  if (reportType === 'collected_this_period') {
    return (
      <div>
        <div className="no-print" style={{ marginBottom: '1rem' }}><ReportExportToolbar exportOptions={exportConfig!} variant="compact" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Cleared Cheques" value={String(data.collectedThisPeriodSummary?.count || 0)} color="#10b981" />
          <StatCard label="Total Collected" value={fmt(data.collectedThisPeriodSummary?.totalAmount)} color="#10b981" />
          <StatCard label="Avg Days to Clear" value={String(data.collectedThisPeriodSummary?.avgDaysToClear || 0)} accent={accentColor} />
        </div>
        <Table headers={['Cheque #', 'Customer', 'Amount', 'Received', 'Cleared', 'Days to Clear', 'Invoice #']} accentColor={accentColor}
          rows={data.collectedThisPeriod.map((c: any) => {
            const days = c.receivedDate && c.clearedDate ? Math.round((new Date(c.clearedDate).getTime() - new Date(c.receivedDate).getTime()) / (1000 * 60 * 60 * 24)) : '—';
            return [c.chequeNumber || '—', c.invoice?.customer?.customerName || 'N/A', fmt(c.amount), formatDate(c.receivedDate), formatDate(c.clearedDate), days, c.invoice?.invoiceNumber || '—'];
          })} />
      </div>
    );
  }

  // ── 7. CASH VS CHEQUE ──
  if (reportType === 'cash_vs_cheque') {
    const s = data.cashVsChequeSummary;
    return (
      <div>
        <div className="no-print" style={{ marginBottom: '1rem' }}><ReportExportToolbar exportOptions={exportConfig!} variant="compact" /></div>
        {s && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <StatCard label="Cash Payments" value={`${s.cashCount}x — ${fmt(s.cashTotal)}`} color="#10b981" />
            <StatCard label="Cheque Payments" value={`${s.chequeCount}x — ${fmt(s.chequeTotal)}`} color="#f59e0b" />
            <StatCard label="Grand Total" value={fmt(s.grandTotal)} accent={accentColor} />
            <StatCard label="Cheque %" value={`${s.chequePercent}%`} accent={accentColor} />
          </div>
        )}
        <Table headers={['Month', 'Cash Count', 'Cash Amount', 'Cheque Count', 'Cheque Amount']} accentColor={accentColor}
          rows={(data.cashVsChequeMonthly || []).map((m: any) => [m.month, m.cash.count, fmt(m.cash.amount), m.cheque.count, fmt(m.cheque.amount)])} />
      </div>
    );
  }

  // ── 8. CHEQUE AGING ──
  if (reportType === 'cheque_aging') {
    const buckets = data.chequeAgingBuckets || [];
    const filteredBuckets = agingFilter === 'all' ? buckets : buckets.filter((b: any) => b.label === agingFilter);
    return (
      <div>
        <div className="no-print" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          <select value={agingFilter} onChange={e => setAgingFilter(e.target.value)} className="form-control" style={{ maxWidth: '150px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            <option value="all">All Buckets</option>
            {buckets.map((b: any) => <option key={b.label} value={b.label}>{b.label}</option>)}
          </select>
          <ReportExportToolbar exportOptions={exportConfig!} variant="compact" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Total Uncollected" value={fmt(data.chequeAgingSummary?.totalUncollected)} color="#dc2626" />
          <StatCard label="Oldest (Days)" value={String(data.chequeAgingSummary?.oldestDays || 0)} accent={accentColor} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {buckets.map((b: any) => (
            <div key={b.label} style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.15s', borderLeft: `4px solid ${b.label === '30+ days' ? '#dc2626' : b.label === '15-30 days' ? '#f59e0b' : b.label === '8-14 days' ? '#f97316' : accentColor}` }}
              onClick={() => setAgingFilter(b.label)}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{b.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: b.label === '30+ days' ? '#dc2626' : 'var(--text-main)' }}>{b.count} chq — {fmt(b.amount)}</div>
            </div>
          ))}
        </div>
        {filteredBuckets.map((bucket: any) => (
          <div key={bucket.label} style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{bucket.label} — {bucket.count} cheques</h4>
            <Table headers={['Cheque #', 'Customer', 'Amount', 'Received', 'Due Date', 'Age (days)']} accentColor={accentColor}
              rows={(bucket.cheques || []).map((c: any) => [c.chequeNumber || '—', c.invoice?.customer?.customerName || 'N/A', fmt(c.amount), formatDate(c.receivedDate), formatDate(c.dueDate), c.daysSince])} />
          </div>
        ))}
      </div>
    );
  }

  // ── 9. DEPOSIT BANK BREAKDOWN ──
  if (reportType === 'deposit_bank_breakdown') {
    return (
      <div>
        <div className="no-print" style={{ marginBottom: '1rem' }}><ReportExportToolbar exportOptions={exportConfig!} variant="compact" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {(data.depositBankData || []).map((bank: any) => (
            <div key={bank.bankName} style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: accentColor, fontWeight: 700 }}>{bank.bankName}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Total:</span> <strong>{bank.totalCheques}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Amount:</span> <strong>{fmt(bank.totalAmount)}</strong></div>
                <div><span style={{ color: '#10b981' }}>✓ Cleared:</span> <strong>{bank.collected?.count || 0}</strong></div>
                <div><span style={{ color: '#10b981' }}>✓</span> <strong>{fmt(bank.collected?.amount || 0)}</strong></div>
                <div><span style={{ color: '#f59e0b' }}>⏳ Deposited:</span> <strong>{bank.deposited?.count || 0}</strong></div>
                <div><span style={{ color: '#f59e0b' }}>⏳</span> <strong>{fmt(bank.deposited?.amount || 0)}</strong></div>
                <div><span style={{ color: '#dc2626' }}>✗ Bounced:</span> <strong>{bank.bounced?.count || 0}</strong></div>
                <div><span style={{ color: '#dc2626' }}>✗</span> <strong>{fmt(bank.bounced?.amount || 0)}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Pending:</span> <strong>{bank.uncollected?.count || 0}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Pending</span> <strong>{fmt(bank.uncollected?.amount || 0)}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── 10. BULK PAYMENT TRACKER ──
  if (reportType === 'bulk_payment_tracker') {
    return (
      <div>
        <div className="no-print" style={{ marginBottom: '1rem' }}><ReportExportToolbar exportOptions={exportConfig!} variant="compact" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Total Batches" value={String(data.bulkPaymentBatches.length)} accent={accentColor} />
          <StatCard label="Total Cheques" value={String(data.bulkPaymentBatches.reduce((s: number, b: any) => s + (b.chequeCount || 0), 0))} color="#10b981" />
          <StatCard label="Total Value" value={fmt(data.bulkPaymentBatches.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0))} color="#10b981" />
        </div>
        <Table headers={['Batch ID', 'Customer', 'Cheques', 'Total Amount', 'Status', 'Received']} accentColor={accentColor}
          rows={data.bulkPaymentBatches.map((b: any) => {
            const statusColor = b.batchStatus === 'Fully Cleared' ? '#10b981' : b.batchStatus === 'Partially Cleared' ? '#f59e0b' : b.batchStatus === 'All Bounced' ? '#dc2626' : 'var(--text-muted)';
            return [
              <span key="id" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{(b.bulkPaymentId || '').slice(0, 8)}...</span>,
              b.customerName || 'N/A', b.chequeCount || 0, fmt(b.totalAmount),
              <span key="s" style={{ color: statusColor, fontWeight: 700 }}>{b.batchStatus}</span>,
              formatDate(b.receivedDate)
            ];
          })} />
      </div>
    );
  }

  return null;
}
