'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { showSuccess, showError } from '../../../lib/toast';
import { confirmAsync } from '../../../lib/confirm';
import ReportExportToolbar from '../../../components/ReportExportToolbar';
import { type ExportOptions } from '../../../lib/exportUtils';
import { useSettings } from '../../../lib/SettingsContext';



interface Customer {
  id: number;
  customerName: string;
  tinNumber: string | null;
  extraPayed?: number;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
}

interface Bank {
  id: number;
  bankName: string;
  accountNumber: string;
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
  receivedDate: string | null;
  createdAt: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  invoiceDate: string | null;
  amount: number;
  remainingPayment: number;
  totalPayed: number;
  uncollectedPayment: number;
  status: string;
  fsNumber: string | null;
  crv: string | null;
  salesType: string | null;
  includeWithhold?: boolean;
  customer: Customer;
  salesRep: Employee | null;
  payments: Payment[];
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;
  const { settings } = useSettings();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerCredit, setCustomerCredit] = useState(0);
  const [applyingCredit, setApplyingCredit] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');

  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const currentUser = storedUser ? JSON.parse(storedUser) : { role: 'sales_user' };
  const userRole = currentUser.role?.toLowerCase() || 'sales_user';
  const isAdmin = userRole === 'admin' || userRole === 'administrator';
  const isManager = userRole === 'manager' || isAdmin;
  const isFinance = userRole === 'finance' || isManager;
  const isCashier = userRole === 'cashier';
  const canManagePayments = isFinance || isManager || isCashier;

  // Form State
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [selectedBank, setSelectedBank] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [slipNumber, setSlipNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Statuses
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);
  const [clearDateModal, setClearDateModal] = useState<{ pmtId: number } | null>(null);
  const [clearDate, setClearDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositModal, setDepositModal] = useState<{ pmtId: number } | null>(null);
  const [depositBank, setDepositBank] = useState('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [bounceModal, setBounceModal] = useState<{ pmtId: number } | null>(null);
  const [bounceReason, setBounceReason] = useState('');

  // Edit Payment
  const [editPaymentModal, setEditPaymentModal] = useState<{ pmtId: number } | null>(null);
  const [editPmtAmount, setEditPmtAmount] = useState('');
  const [editPmtMethod, setEditPmtMethod] = useState('Cash');
  const [editPmtBank, setEditPmtBank] = useState('');
  const [editPmtCheque, setEditPmtCheque] = useState('');
  const [editPmtSlip, setEditPmtSlip] = useState('');
  const [editPmtDueDate, setEditPmtDueDate] = useState('');
  const [editPmtReceivedDate, setEditPmtReceivedDate] = useState('');

  // Invoice Actions & Edit Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editSalesType, setEditSalesType] = useState('Credit');
  const [editIncludeWithhold, setEditIncludeWithhold] = useState(false);
  const [editFsNumber, setEditFsNumber] = useState('');
  const [editCrv, setEditCrv] = useState('');

  const startEditing = () => {
    if (!invoice) return;
    setEditInvoiceNumber(invoice.invoiceNumber);
    setEditInvoiceDate(invoice.invoiceDate ? invoice.invoiceDate.split('T')[0] : '');
    setEditAmount(invoice.amount.toString());
    setEditSalesType(invoice.salesType || 'Credit');
    setEditIncludeWithhold(invoice.includeWithhold || false);
    setEditFsNumber(invoice.fsNumber || '');
    setEditCrv(invoice.crv || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();


    setSubmitting(true);

    if (!editInvoiceDate) {
      showError('Invoice Date is required.');
      setSubmitting(false);
      return;
    }

    // Invoice Date Validation: cannot be greater than today
    const selectedDate = new Date(editInvoiceDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      showError('Invoice Date cannot be greater than today.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await apiFetch(`http://localhost:5000/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: editInvoiceNumber,
          invoiceDate: editInvoiceDate || null,
          amount: parseFloat(editAmount),
          salesType: editSalesType,
          includeWithhold: editIncludeWithhold,
          fsNumber: editFsNumber || null,
          crv: editCrv || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update invoice.');
      showSuccess('Invoice details updated successfully!');
      setIsEditing(false);
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Edit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!(await confirmAsync({ title: 'Void Invoice', message: 'Are you sure you want to void this invoice? This will set outstanding balance to 0 and adjust the customer ledger.', variant: 'warning' }))) return;


    setSubmitting(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/invoices/${id}/void`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to void invoice.');
      showSuccess('Invoice voided successfully!');
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Void failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!(await confirmAsync({ title: 'Delete Invoice', message: 'CRITICAL WARNING: Are you sure you want to permanently delete this invoice? This will delete all payments and reverse customer credit. This cannot be undone.', variant: 'danger' }))) return;


    setSubmitting(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/invoices/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete invoice.');
      showSuccess('Invoice successfully deleted!');
      router.push('/invoices');
    } catch (err: any) {
      showError(err.message || 'Delete failed.');
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchInvoiceDetails();
    fetchBanks();
  }, [id]);

  const fetchInvoiceDetails = async () => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data);
        fetchCustomerCredit(data.customer.id);
      } else {
        showError('Invoice not found.');
      }
    } catch (err) {
      console.error(err);
      showError('Connection error fetching invoice.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerCredit = async (customerId: number) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/customers/${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerCredit(data.extraPayed || 0);
      }
    } catch (err) {
      console.error('Failed to fetch customer credit', err);
    }
  };

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

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();



    if (!amount || parseFloat(amount) <= 0) {
      showError('Payment amount must be greater than zero.');
      return;
    }

    if (!selectedBank) {
      showError('Deposit bank is required for all payments.');
      return;
    }

    if (receivedDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (receivedDate > todayStr) {
        showError('Received date cannot be in the future.');
        return;
      }
    }

    if (paymentMethod === 'Cheque') {
      if (!chequeNumber || !dueDate) {
        showError('Cheque Number and Maturity Date are required for cheque payments.');
        return;
      }
      // Maturity date restriction removed
    }

    const amountDecimals = (amount.split('.')[1] || '').length;
    if (amountDecimals > 2) {
      showError('Amount cannot have more than 2 decimal places.');
      return;
    }

    setSubmitting(true);

    try {
      let photoUrl = null;
      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        const uploadRes = await fetch('http://localhost:5000/api/upload', {
          method: 'POST',
          body: formData
        });
        if (!uploadRes.ok) throw new Error('Photo upload failed');
        const uploadData = await uploadRes.json();
        photoUrl = uploadData.photoUrl;
      }

      const res = await apiFetch(`http://localhost:5000/api/payments/invoice/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentMethod,
          bank: selectedBank,
          chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : null,
          slipNumber: slipNumber || null,
          photo: photoUrl,
          dueDate: paymentMethod === 'Cheque' ? dueDate : null,
          receivedDate: receivedDate || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit payment transaction.');
      }

      showSuccess('Payment successfully registered and accounts updated!');
      setAmount('');
      setChequeNumber('');
      setSlipNumber('');
      setDueDate('');
      setReceivedDate('');
      setSelectedBank('');
      setPhotoFile(null);
      
      // Reload details to display updated ledger metrics
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Payment submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyCredit = async () => {
    const amt = parseFloat(creditAmount);
    if (!amt || amt <= 0) { showError('Enter a valid credit amount.'); return; }
    if (amt > customerCredit) { showError(`Amount exceeds available credit of ${customerCredit.toFixed(2)}`); return; }
    if (!invoice || invoice.status !== 'Active') { showError('Invoice must be active to apply credit.'); return; }

    setApplyingCredit(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/invoice/${id}/apply-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply credit.');
      showSuccess(`Applied ${amt.toFixed(2)} from customer credit balance!`);
      setCreditAmount('');
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Apply credit failed.');
    } finally {
      setApplyingCredit(false);
    }
  };

  const doDeposit = async (pmtId: number) => {
    if (!depositBank) { showError('Select a deposit bank'); return; }
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${pmtId}/deposit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositBank, depositDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deposit cheque.');
      showSuccess('Cheque deposited successfully!');
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Deposit failed.');
    } finally {
      setDepositModal(null);
    }
  };

  const handleDeposit = (pmtId: number, dueDate?: string) => {
    if (dueDate) {
      const today = new Date().toISOString().split('T')[0];
      const maturity = new Date(dueDate).toISOString().split('T')[0];
      if (today < maturity) { showError(`Cheque cannot be deposited before its maturity date (${maturity})`); return; }
    }
    setDepositDate(new Date().toISOString().split('T')[0]);
    setDepositModal({ pmtId });
  };

  const doClearCheque = async (pmtId: number, date: string) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${pmtId}/clear`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearedDate: date })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear cheque.');
      showSuccess('Cheque successfully cleared and balances updated!');
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Cheque clearing failed.');
    } finally {
      setClearDateModal(null);
    }
  };

  const handleClearCheque = (pmtId: number, dueDate?: string) => {
    if (dueDate) {
      const today = new Date().toISOString().split('T')[0];
      const maturity = new Date(dueDate).toISOString().split('T')[0];
      if (today < maturity) { showError(`Cheque cannot be cleared before its maturity date (${maturity})`); return; }
    }
    setClearDate(new Date().toISOString().split('T')[0]);
    setClearDateModal({ pmtId });
  };

  const doBounceCheque = async (pmtId: number, reason: string) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${pmtId}/bounce`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to bounce cheque.');
      showSuccess('Cheque marked as Bounced! Outstanding balance remains active.');
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Cheque bouncing failed.');
    } finally {
      setBounceModal(null);
      setBounceReason('');
    }
  };

  const handleBounceCheque = (pmtId: number, dueDate?: string) => {
    if (dueDate) {
      const today = new Date().toISOString().split('T')[0];
      const maturity = new Date(dueDate).toISOString().split('T')[0];
      if (today < maturity) { showError(`Cheque cannot be bounced before its maturity date (${maturity})`); return; }
    }
    setBounceReason('');
    setBounceModal({ pmtId });
  };

  const doVoidPayment = async (pmtId: number) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${pmtId}/void`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to void payment.');
      showSuccess('Payment voided successfully!');
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Void failed.');
    } finally {
      setConfirmModal(null);
    }
  };

  const handleVoidPayment = (pmtId: number) => {
    setConfirmModal({
      title: 'Void Payment',
      message: 'Are you sure you want to void this payment? This will reverse all ledger allocations.',
      action: () => doVoidPayment(pmtId)
    });
  };

  const doReactivate = async (pmtId: number) => {
    try {
      const res = await apiFetch(`http://localhost:5000/api/payments/${pmtId}/reactivate`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reactivate payment.');
      showSuccess('Payment reactivated successfully!');
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Reactivate failed.');
    } finally {
      setConfirmModal(null);
    }
  };

  const handleReactivate = (pmtId: number) => {
    setConfirmModal({
      title: 'Reactivate Payment',
      message: 'Are you sure you want to reactivate this voided payment? This will restore ledger entries.',
      action: () => doReactivate(pmtId)
    });
  };

  const openEditPayment = (pmt: any) => {
    setEditPmtAmount(pmt.amount.toString());
    setEditPmtMethod(pmt.paymentMethod);
    setEditPmtBank(pmt.bank || '');
    setEditPmtCheque(pmt.chequeNumber || '');
    setEditPmtSlip(pmt.slipNumber || '');
    setEditPmtDueDate(pmt.dueDate ? new Date(pmt.dueDate).toISOString().split('T')[0] : '');
    setEditPmtReceivedDate(pmt.receivedDate ? new Date(pmt.receivedDate).toISOString().split('T')[0] : '');
    setEditPaymentModal({ pmtId: pmt.id });
  };

  const doEditPayment = async () => {
    if (!editPaymentModal) return;
    const pmtId = editPaymentModal.pmtId;
    try {
      const body: any = { amount: parseFloat(editPmtAmount), paymentMethod: editPmtMethod };
      body.bank = editPmtBank;
      if (editPmtMethod === 'Cheque') { body.chequeNumber = editPmtCheque; }
      else { body.slipNumber = editPmtSlip; }
      if (editPmtDueDate) body.dueDate = editPmtDueDate;
      if (editPmtReceivedDate) body.receivedDate = editPmtReceivedDate;
      const res = await apiFetch(`http://localhost:5000/api/payments/${pmtId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payment.');
      showSuccess('Payment updated successfully!');
      setEditPaymentModal(null);
      fetchInvoiceDetails();
    } catch (err: any) {
      showError(err.message || 'Update failed.');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
        Loading invoice details...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        {error || 'Invoice not found.'}
      </div>
    );
  }

  const percentPaid = Math.min(100, Math.round((invoice.totalPayed / invoice.amount) * 100));

  const fmtAmt = (n: number) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  const salesRepName = invoice.salesRep
    ? `${invoice.salesRep.firstName} ${invoice.salesRep.lastName}`
    : '—';
  const withholdAmt = invoice.includeWithhold
    ? invoice.amount * ((settings.withholdPercent || 2) / 100)
    : 0;

  const invoiceStatusWatermark = (s: string): 'green' | 'red' | 'orange' | 'blue' | 'gray' => {
    if (s === 'Paid')    return 'green';
    if (s === 'Void')    return 'gray';
    if (s === 'Overdue') return 'red';
    if (s === 'Active')  return 'blue';
    return 'orange';
  };

  const invoiceExportConfig: ExportOptions = {
    title: `Invoice — ${invoice.invoiceNumber}`,
    filename: `invoice_${invoice.invoiceNumber}_${new Date().toISOString().slice(0, 10)}`,
    orientation: 'portrait',

    watermark: {
      text: invoice.status,
      color: invoiceStatusWatermark(invoice.status),
    },

    infoBlock: {
      leftTitle: 'Customer Details',
      rightTitle: 'Invoice Details',
      left: [
        { label: 'Customer',    value: invoice.customer?.customerName || '—' },
        { label: 'TIN',         value: invoice.customer?.tinNumber || '—' },
        { label: 'Extra Paid',  value: fmtAmt(invoice.customer?.extraPayed || 0), valueColor: (invoice.customer?.extraPayed || 0) > 0 ? 'green' : undefined },
        { label: 'Sales Type',  value: invoice.salesType || '—' },
        { label: 'Sales Rep',   value: salesRepName },
      ],
      right: [
        { label: 'Invoice #',   value: invoice.invoiceNumber },
        { label: 'Date',        value: fmtDate(invoice.invoiceDate) },
        { label: 'FS Number',   value: invoice.fsNumber || '—' },
        { label: 'CRV',         value: invoice.crv || '—' },
        { label: 'Withhold',    value: invoice.includeWithhold ? `Yes — ${fmtAmt(withholdAmt)} (${settings.withholdPercent || 2}%)` : 'No' },
        { label: 'Status',      value: invoice.status },
      ],
    },

    // Payments table
    columns: [
      { key: 'no',       label: '#',         align: 'center', width: 8  },
      { key: 'method',   label: 'Method',                     width: 22 },
      { key: 'amount',   label: 'Amount',    align: 'right',  width: 28, format: (v: number) => fmtAmt(v) },
      { key: 'bank',     label: 'Bank',                       width: 30 },
      { key: 'cheque',   label: 'Cheque #',                   width: 26 },
      { key: 'slip',     label: 'Slip #',                     width: 22 },
      { key: 'dueDate',  label: 'Due Date',                   width: 24 },
      { key: 'received', label: 'Received',                   width: 24 },
      { key: 'status',   label: 'Status',    align: 'center', width: 18 },
    ],

    data: (invoice.payments || []).map((p, idx) => ({
      no:       idx + 1,
      method:   p.paymentMethod,
      amount:   p.amount,
      bank:     p.bank || '—',
      cheque:   p.chequeNumber || '—',
      slip:     p.slipNumber || '—',
      dueDate:  fmtDate(p.dueDate),
      received: fmtDate(p.receivedDate),
      status:   p.status,
    })),

    totalsRows: [
      { label: 'Invoice Amount',   value: fmtAmt(invoice.amount) },
      ...(withholdAmt > 0 ? [{ label: `WHT (${settings.withholdPercent || 2}%)`, value: fmtAmt(withholdAmt), bold: true }] : []),
      { label: 'Total Paid',       value: fmtAmt(invoice.totalPayed), bold: true },
      { label: 'Uncollected',      value: fmtAmt(invoice.uncollectedPayment) },
      { label: 'REMAINING',        value: fmtAmt(invoice.remainingPayment), accent: true },
    ],
  };

  return (
    <div className="dashboard-container">
      {/* Back link */}
      <button
        onClick={() => router.push('/invoices')}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent-hover)',
          cursor: 'pointer',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.95rem'
        }}
      >
        ← Back to Invoices
      </button>

      {/* EXPORT TOOLBAR */}
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <ReportExportToolbar
          exportOptions={invoiceExportConfig}
          variant="compact"
          disabled={!invoice}
        />
      </div>

      {/* Actions and Controls Bar */}
      <div className="action-bar" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-color)',
        padding: '0.75rem 1.5rem',
        borderRadius: '14px',
        marginBottom: '2rem',
        boxShadow: 'var(--card-shadow)'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</span>
          <span style={{
            background: invoice.status === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : invoice.status === 'Void' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: invoice.status === 'Paid' ? 'var(--success)' : invoice.status === 'Void' ? 'var(--danger)' : 'var(--warning)',
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: '600'
          }}>
            {invoice.status}
          </span>
        </div>
        
        <div className="action-buttons" style={{ display: 'flex', gap: '0.75rem' }}>
          {invoice.status !== 'Void' && (
            <>
              <button 
                onClick={startEditing} 
                className="btn-secondary" 
                style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                ✏️ Edit Invoice
              </button>
              <button 
                onClick={handleVoidInvoice} 
                className="btn-secondary" 
                style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', border: '1px solid rgba(244, 63, 94, 0.2)', color: '#fb7185', background: 'rgba(244, 63, 94, 0.05)' }}
              >
                🚫 Void
              </button>
            </>
          )}
          <button 
            onClick={handleDeleteInvoice} 
            className="btn-secondary" 
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.05)' }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      <div className="invoice-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
        
        {/* LEFT COLUMN: Metadata & Payment History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Invoice Summary Card */}
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div className="invoice-header gen-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sales Invoice Header</span>
                <h1 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '2.25rem' }} className="text-gradient">
                  {invoice.invoiceNumber}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>Customer:</span>
                  <strong 
                    style={{ color: 'var(--accent-hover)', cursor: 'pointer', textDecoration: 'underline' }} 
                    title="Click to view customer dashboard"
                    onClick={() => router.push(`/customers/${invoice.customer.id}`)}
                  >
                    {invoice.customer.customerName}
                  </strong>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  <span>TIN: <strong style={{ color: 'var(--text-main)' }}>{invoice.customer.tinNumber || 'N/A'}</strong></span>
                  {invoice.salesRep && (
                    <>
                      <span style={{ color: 'var(--border-color)' }}>|</span>
                      <span>Sales Rep:</span>
                      <strong
                        style={{ color: 'var(--accent-hover)', cursor: 'pointer', textDecoration: 'underline' }}
                        title="Click to view sales rep details"
                        onClick={() => router.push(`/employees?id=${invoice.salesRep?.id}`)}
                      >
                        {invoice.salesRep.firstName} {invoice.salesRep.lastName}
                      </strong>
                    </>
                  )}
                </p>
              </div>
              <span style={{
                background: invoice.status === 'Paid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: invoice.status === 'Paid' ? 'var(--success)' : 'var(--warning)',
                padding: '0.4rem 1rem',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: '600'
              }}>
                {invoice.status}
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                <span>Payment Settlement Progress</span>
                <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{percentPaid}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${percentPaid}%`, height: '100%', background: 'linear-gradient(to right, #10b981, #3b82f6)', borderRadius: '999px', transition: 'width 0.5s ease' }}></div>
              </div>
            </div>

            {/* Financial Ledger details */}
            <div className="ledger-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Amount</span>
                <p style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>${invoice.amount.toLocaleString()}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Paid</span>
                <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--success)', margin: 0 }}>${invoice.totalPayed.toLocaleString()}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining</span>
                <p style={{ fontSize: '1.1rem', fontWeight: '700', color: invoice.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)', margin: 0 }}>
                  ${invoice.remainingPayment.toLocaleString()}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Uncollected</span>
                <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--warning)', margin: 0 }}>${invoice.uncollectedPayment.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Payment Timeline / History */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--accent-hover)' }}>Payment History & Settlements</h3>
            
            {invoice.payments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>
                No payment transactions recorded for this invoice yet.
              </p>
            ) : (
              <>
              {/* Mobile payment cards */}
              <div className="tbl-mobile">
                {invoice.payments.map((pmt) => (
                  <div className="gen-mobile-card" key={`mobile-${pmt.id}`}>
                    <div className="gen-mobile-card-header">
                      <span className="gen-mobile-card-title">{pmt.paymentMethod} Payment</span>
                      <span style={{
                        fontSize: '0.7rem',
                        background: pmt.status === 'Collected' ? 'rgba(16, 185, 129, 0.15)' : pmt.status === 'Deposited' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: pmt.status === 'Collected' ? 'var(--success)' : pmt.status === 'Deposited' ? '#60a5fa' : 'var(--warning)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        {pmt.status}
                      </span>
                    </div>
                    <div className="gen-mobile-card-body">
                      <div>
                        <span className="gen-mobile-card-label">Amount</span>
                        <p className="gen-mobile-card-value" style={{ color: pmt.paymentMethod === 'Cash' ? 'var(--success)' : 'var(--warning)', fontSize: '1.05rem', fontWeight: 700 }}>
                          ${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {pmt.paymentMethod === 'Cheque' ? (
                        <>
                          <div>
                            <span className="gen-mobile-card-label">Bank</span>
                            <p className="gen-mobile-card-value">{pmt.bank || '—'}</p>
                          </div>
                          <div>
                            <span className="gen-mobile-card-label">Cheque #</span>
                            <p className="gen-mobile-card-value">{pmt.chequeNumber || '—'}</p>
                          </div>
                          {pmt.dueDate && (
                            <div>
                              <span className="gen-mobile-card-label">Maturity Date</span>
                              <p className="gen-mobile-card-value" style={{ color: 'var(--warning)' }}>{new Date(pmt.dueDate).toLocaleDateString()}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div>
                          <span className="gen-mobile-card-label">Slip Reference</span>
                          <p className="gen-mobile-card-value">{pmt.slipNumber || 'N/A'}</p>
                        </div>
                      )}
                      <div>
                        <span className="gen-mobile-card-label">Received Date</span>
                        <p className="gen-mobile-card-value">{pmt.receivedDate ? new Date(pmt.receivedDate).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                    {canManagePayments && (
                      <div className="gen-mobile-card-actions">
                        {pmt.status === 'Uncollected' && (
                          <>
                            <button onClick={() => handleDeposit(pmt.id, pmt.dueDate ?? undefined)}
                              className="btn-primary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                            >🏦 Deposit</button>
                            <button onClick={() => handleBounceCheque(pmt.id, pmt.dueDate ?? undefined)}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.05)' }}
                            >🚨 Bounce</button>
                          </>
                        )}
                        {pmt.status === 'Deposited' && (
                          <>
                            <button onClick={() => handleClearCheque(pmt.id, pmt.dueDate ?? undefined)}
                              className="btn-primary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                            >💰 Clear</button>
                            <button onClick={() => handleBounceCheque(pmt.id, pmt.dueDate ?? undefined)}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.05)' }}
                            >🚨 Bounce</button>
                          </>
                        )}
                        {pmt.status === 'Void' && (
                          <>
                            <button onClick={() => openEditPayment(pmt)}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', background: 'rgba(59,130,246,0.08)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, flex: 1 }}
                            >✏️ Edit</button>
                            <button onClick={() => handleReactivate(pmt.id)}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, flex: 1 }}
                            >🔁 Activate</button>
                          </>
                        )}
                        {pmt.status !== 'Void' && pmt.status !== 'Uncollected' && pmt.status !== 'Deposited' && (
                          <>
                            <button onClick={() => openEditPayment(pmt)}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', background: 'rgba(59,130,246,0.08)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, flex: 1 }}
                            >✏️ Edit</button>
                            <button onClick={() => handleVoidPayment(pmt.id)}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--danger)', background: 'rgba(244,63,94,0.08)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, flex: 1 }}
                            >🗑️ Void</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop payment rows */}
              <div className="tbl-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {invoice.payments.map((pmt) => (
                  <div className="payment-row"
                    key={pmt.id}
                    style={{
                      borderLeft: `4px solid ${pmt.paymentMethod === 'Cash' ? 'var(--success)' : 'var(--warning)'}`,
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '1rem 1.25rem',
                      borderRadius: '0 8px 8px 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: '600' }}>{pmt.paymentMethod} Payment</span>
                        <span style={{
                          fontSize: '0.7rem',
                          background: pmt.status === 'Collected' ? 'rgba(16, 185, 129, 0.15)' : pmt.status === 'Deposited' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: pmt.status === 'Collected' ? 'var(--success)' : pmt.status === 'Deposited' ? '#60a5fa' : 'var(--warning)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px'
                        }}>
                          {pmt.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        {pmt.paymentMethod === 'Cheque' ? (
                          <>
                            Bank: <strong style={{ color: 'var(--text-main)' }}>{pmt.bank}</strong> | Cheque: <strong style={{ color: 'var(--text-main)' }}>{pmt.chequeNumber}</strong>
                            {pmt.dueDate && (
                              <div style={{ marginTop: '0.25rem', color: 'var(--warning)' }}>
                                Maturity Date: <strong>{new Date(pmt.dueDate).toLocaleDateString()}</strong>
                              </div>
                            )}
                          </>
                        ) : (
                          <>Slip Reference: <strong style={{ color: 'var(--text-main)' }}>{pmt.slipNumber || 'N/A'}</strong></>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                        Date: {pmt.receivedDate ? new Date(pmt.receivedDate).toLocaleDateString() : '-'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: '700', fontSize: '1.15rem', color: pmt.paymentMethod === 'Cash' ? 'var(--success)' : 'var(--warning)', margin: 0 }}>
                        ${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      {pmt.status === 'Uncollected' && (
                        <div className="payment-actions" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          {canManagePayments && (
                            <button onClick={() => handleDeposit(pmt.id, pmt.dueDate ?? undefined)}
                              className="btn-primary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                            >🏦 Deposit</button>
                          )}
                          {canManagePayments && (
                            <button onClick={() => handleBounceCheque(pmt.id, pmt.dueDate ?? undefined)}
                              className="btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.05)' }}
                            >🚨 Bounce</button>
                          )}
                        </div>
                      )}
                      {pmt.status === 'Deposited' && (
                        <div className="payment-actions" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          {canManagePayments && (
                            <button onClick={() => handleClearCheque(pmt.id, pmt.dueDate ?? undefined)}
                              className="btn-primary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                            >💰 Clear</button>
                          )}
                          {canManagePayments && (
                            <button onClick={() => handleBounceCheque(pmt.id, pmt.dueDate ?? undefined)}
                              className="btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--danger)', background: 'rgba(244, 63, 94, 0.05)' }}
                            >🚨 Bounce</button>
                          )}
                        </div>
                      )}
                      {pmt.status === 'Void' ? (
                        <div className="payment-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
                          {canManagePayments && (
                            <button onClick={() => openEditPayment(pmt)}
                              style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', background: 'rgba(59,130,246,0.08)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.18)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                            >✏️ Edit</button>
                          )}
                          {canManagePayments && (
                            <button onClick={() => handleReactivate(pmt.id)}
                              style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.18)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; }}
                            >🔁 Activate</button>
                          )}
                        </div>
                      ) : (
                        <div className="payment-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
                          {canManagePayments && (
                            <button onClick={() => openEditPayment(pmt)}
                              style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', background: 'rgba(59,130,246,0.08)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.18)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                            >✏️ Edit</button>
                          )}
                          {canManagePayments && (
                            <button onClick={() => handleVoidPayment(pmt.id)}
                              style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--danger)', background: 'rgba(244,63,94,0.08)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,63,94,0.18)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}
                            >🗑️ Void</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'start', position: 'sticky', top: '2rem' }}>

        {/* Apply Customer Credit Card */}
        {canManagePayments && customerCredit > 0 && invoice?.status === 'Active' && (
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.1rem' }}>💳</span>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--success)' }}>Apply Customer Credit</h3>
              <span style={{ marginLeft: 'auto', fontSize: '0.82rem', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '999px', padding: '0.2rem 0.75rem', fontWeight: 600 }}>
                Available: {customerCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="creditAmount" style={{ fontSize: '0.82rem' }}>Amount to Apply</label>
                <input
                  type="number"
                  id="creditAmount"
                  className="form-control"
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  max={Math.min(customerCredit, invoice?.remainingPayment || 0).toFixed(2)}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  disabled={applyingCredit}
                />
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}
                onClick={handleApplyCredit}
                disabled={applyingCredit}
              >
                {applyingCredit ? 'Applying...' : 'Apply Credit'}
              </button>
            </div>
            <button
              type="button"
              style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              onClick={() => setCreditAmount(Math.min(customerCredit, invoice?.remainingPayment || 0).toFixed(2))}
              disabled={applyingCredit}
            >
              Use full available ({Math.min(customerCredit, invoice?.remainingPayment || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </button>
          </div>
        )}

        {/* Add Payment Card */}
        <div className="glass-panel invoice-sticky-panel" style={{ padding: '2.5rem', position: 'static' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Add Invoice Payment</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Process full or partial payments. Cheques will trigger uncollected tracking metrics in customer accounts.
          </p>

          {/* Messages displayed via Toast */}

          <form onSubmit={handleAddPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div className="form-field">
              <label>Payment Method</label>
              <div className="payment-method-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <button
                  type="button"
                  className={paymentMethod === 'Cash' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setPaymentMethod('Cash')}
                  style={{ padding: '0.6rem 0' }}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  className={paymentMethod === 'Cheque' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setPaymentMethod('Cheque')}
                  style={{ padding: '0.6rem 0' }}
                >
                  📝 Cheque
                </button>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="amount">Payment Amount ($) *</label>
              <input
                type="number"
                id="amount"
                className="form-control"
                placeholder="0.00"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={submitting}
              />
              {paymentMethod === 'Cash' && amount && parseFloat(amount) > (invoice?.remainingPayment || 0) && (
                <p style={{ color: 'var(--accent-hover)', fontSize: '0.8rem', marginTop: '0.4rem', fontWeight: 500 }}>
                  Extra {(parseFloat(amount) - (invoice?.remainingPayment || 0)).toFixed(2)} will be saved as customer credit
                </p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="receivedDate">Received Date</label>
              <input
                type="date"
                id="receivedDate"
                className="form-control"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                disabled={submitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="selectedBank">Deposit Bank *</label>
              <select
                id="selectedBank"
                className="form-control form-select"
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="">-- Select Bank --</option>
                {banks.map((bk) => (
                  <option key={bk.id} value={bk.bankName}>
                    {bk.bankName} - {bk.accountNumber}
                  </option>
                ))}
              </select>
              {banks.length === 0 && (
                <p style={{ color: 'var(--warning)', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  ⚠️ Please register a corporate bank account in the "Banks" tab first!
                </p>
              )}
            </div>

            {paymentMethod === 'Cash' ? (
              <div className="form-field">
                <label htmlFor="slipNumber">Slip Reference Number</label>
                <input
                  type="text"
                  id="slipNumber"
                  className="form-control"
                  placeholder="e.g. SLIP-23423"
                  value={slipNumber}
                  onChange={(e) => setSlipNumber(e.target.value)}
                  disabled={submitting}
                />
              </div>
            ) : (
              <>
                <div className="form-field">
                  <label htmlFor="chequeNumber">Cheque Number *</label>
                  <input
                    type="text"
                    id="chequeNumber"
                    className="form-control"
                    placeholder="e.g. CHQ-928423"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="dueDate">Cheque Maturity Date *</label>
                  <input
                    type="date"
                    id="dueDate"
                    className="form-control"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </>
            )}

            <div className="form-field">
              <label htmlFor="photo">Payment Slip/Cheque Photo (Optional)</label>
              <input
                type="file"
                id="photo"
                accept="image/*"
                className="form-control"
                style={{ padding: '0.5rem' }}
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ marginTop: '1rem', padding: '0.85rem' }}
              disabled={submitting}
            >
              {submitting ? 'Processing Settlement...' : 'Submit Payment'}
            </button>
          </form>

        </div>
        </div>
      </div>

      {/* EDIT MODAL OVERLAY */}
      {isEditing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel form-panel" style={{ width: '90%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '3rem', borderRadius: '24px' }}>
            <h2 className="text-gradient" style={{ marginBottom: '2rem', fontWeight: 800 }}>Edit Invoice Details</h2>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                <div className="form-field">
                  <label htmlFor="editInvoiceNumber" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Invoice Number *</label>
                  <input
                    type="text"
                    id="editInvoiceNumber"
                    className="form-control"
                    value={editInvoiceNumber}
                    onChange={(e) => setEditInvoiceNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="editInvoiceDate" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Invoice Date *</label>
                  <input
                    type="date"
                    id="editInvoiceDate"
                    className="form-control"
                    value={editInvoiceDate}
                    onChange={(e) => setEditInvoiceDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]} // Cannot be greater than today
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="editAmount" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Invoice Amount ($) *</label>
                  <input
                    type="number"
                    id="editAmount"
                    className="form-control"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    step="0.01"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="editSalesType" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Sales Type *</label>
                  <select
                    id="editSalesType"
                    className="form-control form-select"
                    value={editSalesType}
                    onChange={(e) => setEditSalesType(e.target.value)}
                    required
                  >
                    <option value="Credit">Credit</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="editFsNumber" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>FS Number (Fiscal Voucher)</label>
                  <input
                    type="text"
                    id="editFsNumber"
                    className="form-control"
                    value={editFsNumber}
                    onChange={(e) => setEditFsNumber(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="editCrv" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>CRV Number (Receipt Voucher)</label>
                  <input
                    type="text"
                    id="editCrv"
                    className="form-control"
                    value={editCrv}
                    onChange={(e) => setEditCrv(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', margin: '0.5rem 0' }}>
                <input
                  type="checkbox"
                  id="editIncludeWithhold"
                  checked={editIncludeWithhold}
                  onChange={(e) => setEditIncludeWithhold(e.target.checked)}
                  style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', accentColor: 'var(--accent-hover)' }}
                />
                <label htmlFor="editIncludeWithhold" style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: '600', color: '#e5e7eb' }}>
                  Apply Corporate Withholding Tax Deduction
                </label>
              </div>

              <div className="form-actions" style={{
                marginTop: '1.5rem',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '1.5rem',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem'
              }}>
                <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)} disabled={submitting} style={{ padding: '0.6rem 2rem', borderRadius: '8px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '0.6rem 2.5rem', borderRadius: '8px' }}>
                  {submitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Cheque Modal */}
      {depositModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 100000, padding: '1.5rem'
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setDepositModal(null); }}
        >
          <div className="glass-panel" style={{
            maxWidth: '440px', width: '100%', padding: '2.5rem 2rem 2rem',
            borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(59,130,246,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            textAlign: 'center', animation: 'slideUp 0.25s ease'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', border: '2px solid rgba(59,130,246,0.25)'
            }}>
              <span style={{ fontSize: '2rem' }}>🏦</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: '#60a5fa' }}>
              Deposit Cheque
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Select the bank and date for this cheque deposit.
            </p>
            <select className="form-control"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.95rem', marginBottom: '1rem' }}
              value={depositBank}
              onChange={e => setDepositBank(e.target.value)}
            >
              <option value="">-- Select Deposit Bank --</option>
              {banks.map((b: any) => (
                <option key={b.id} value={b.bankName}>{b.bankName} - {b.accountNumber}</option>
              ))}
            </select>
            <input type="date" className="form-control"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '1rem', textAlign: 'center' }}
              value={depositDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setDepositDate(e.target.value)} />
            <div style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', marginTop: '1.5rem'
            }}>
              <button onClick={() => setDepositModal(null)}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >Cancel</button>
              <button onClick={() => doDeposit(depositModal.pmtId)}
                disabled={!depositBank}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 700,
                  background: !depositBank ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none', borderRadius: '10px', color: '#fff', cursor: !depositBank ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
                onMouseEnter={e => { if (depositBank) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.45)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.35)'; }}
              >✅ Confirm Deposit</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editPaymentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 100000, padding: '1.5rem'
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditPaymentModal(null); }}
        >
          <div className="glass-panel" style={{
            maxWidth: '480px', width: '100%', padding: '2.5rem 2rem 2rem',
            borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(59,130,246,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            textAlign: 'center', animation: 'slideUp 0.25s ease'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', border: '2px solid rgba(59,130,246,0.25)'
            }}>
              <span style={{ fontSize: '2rem' }}>✏️</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: '#60a5fa' }}>
              Edit Payment
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Update payment details.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
              <input type="number" step="0.01" className="form-control" placeholder="Amount"
                style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                value={editPmtAmount} onChange={e => setEditPmtAmount(e.target.value)} />
              <div className="payment-method-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button type="button"
                  style={{ padding: '0.5rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, border: editPmtMethod === 'Cash' ? '2px solid var(--success)' : '1px solid rgba(255,255,255,0.1)', background: editPmtMethod === 'Cash' ? 'rgba(16,185,129,0.1)' : 'transparent', color: editPmtMethod === 'Cash' ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => setEditPmtMethod('Cash')}>💵 Cash</button>
                <button type="button"
                  style={{ padding: '0.5rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, border: editPmtMethod === 'Cheque' ? '2px solid var(--warning)' : '1px solid rgba(255,255,255,0.1)', background: editPmtMethod === 'Cheque' ? 'rgba(245,158,11,0.1)' : 'transparent', color: editPmtMethod === 'Cheque' ? 'var(--warning)' : 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => setEditPmtMethod('Cheque')}>🏦 Cheque</button>
              </div>
              <select className="form-control form-select"
                style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                value={editPmtBank} onChange={e => setEditPmtBank(e.target.value)}>
                <option value="">-- Select Bank --</option>
                {banks.map(bk => (
                  <option key={bk.id} value={bk.bankName}>{bk.bankName} - {bk.accountNumber}</option>
                ))}
              </select>
              {editPmtMethod === 'Cheque' ? (
                <input type="text" className="form-control" placeholder="Cheque Number"
                  style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                  value={editPmtCheque} onChange={e => setEditPmtCheque(e.target.value)} />
              ) : (
                <input type="text" className="form-control" placeholder="Slip Reference"
                  style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                  value={editPmtSlip} onChange={e => setEditPmtSlip(e.target.value)} />
              )}
              <div className="date-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Due Date</label>
                  <input type="date" className="form-control"
                    style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                    value={editPmtDueDate} onChange={e => setEditPmtDueDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Received Date</label>
                  <input type="date" className="form-control"
                    style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                    value={editPmtReceivedDate} onChange={e => setEditPmtReceivedDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="btn-group" style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', marginTop: '1.5rem'
            }}>
              <button onClick={() => setEditPaymentModal(null)}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >Cancel</button>
              <button onClick={doEditPayment}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.35)'; }}
              >✅ Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Cheque Date Modal */}
      {clearDateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 100000, padding: '1.5rem'
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setClearDateModal(null); }}
        >
          <div className="glass-panel" style={{
            maxWidth: '400px', width: '100%', padding: '2.5rem 2rem 2rem',
            borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(16,185,129,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            textAlign: 'center', animation: 'slideUp 0.25s ease'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', border: '2px solid rgba(16,185,129,0.25)'
            }}>
              <span style={{ fontSize: '2rem' }}>🏦</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: '#34d399' }}>
              Bank Deposit Date
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Enter the date the cheque was deposited/cleared at the bank.
            </p>
            <input type="date" className="form-control"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '1rem', textAlign: 'center' }}
              value={clearDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setClearDate(e.target.value)} />
            <div style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', marginTop: '1.5rem'
            }}>
              <button onClick={() => setClearDateModal(null)}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >Cancel</button>
              <button onClick={() => doClearCheque(clearDateModal.pmtId, clearDate)}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,185,129,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.35)'; }}
              >✅ Clear Cheque</button>
            </div>
          </div>
        </div>
      )}

      {/* Bounce Cheque Reason Modal */}
      {bounceModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 100000, padding: '1.5rem'
        }}
          onClick={(e) => { if (e.target === e.currentTarget) { setBounceModal(null); setBounceReason(''); } }}
        >
          <div className="glass-panel" style={{
            maxWidth: '460px', width: '100%', padding: '2.5rem 2rem 2rem',
            borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(239,68,68,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.25s ease'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', border: '2px solid rgba(239,68,68,0.25)'
            }}>
              <span style={{ fontSize: '2rem' }}>🚫</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#ef4444' }}>
              Bounce Cheque
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '0.9rem' }}>
              Mark this cheque as bounced. Select the reason below and confirm.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bounce Reason *</label>
              <select
                className="form-control form-select"
                value={bounceReason}
                onChange={(e) => setBounceReason(e.target.value)}
                style={{ padding: '0.7rem', borderRadius: '10px', width: '100%' }}
              >
                <option value="">-- Select Reason --</option>
                <option value="NSF">Insufficient Funds (NSF)</option>
                <option value="StopPayment">Stop Payment</option>
                <option value="AccountClosed">Account Closed</option>
                <option value="SignatureMismatch">Signature Mismatch</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem'
            }}>
              <button onClick={() => { setBounceModal(null); setBounceReason(''); }}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >Cancel</button>
              <button onClick={() => bounceReason ? doBounceCheque(bounceModal.pmtId, bounceReason) : null}
                disabled={!bounceReason}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 700,
                  background: !bounceReason ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none', borderRadius: '10px', color: !bounceReason ? 'rgba(255,255,255,0.4)' : '#fff',
                  cursor: !bounceReason ? 'not-allowed' : 'pointer',
                  boxShadow: !bounceReason ? 'none' : '0 4px 16px rgba(239,68,68,0.35)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
              >🚫 Bounce Cheque</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 100000, padding: '1.5rem'
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmModal(null); }}
        >
          <div className="glass-panel" style={{
            maxWidth: '420px', width: '100%', padding: '2.5rem 2rem 2rem',
            borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
            border: '1px solid rgba(249,115,22,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            textAlign: 'center',
            animation: 'slideUp 0.25s ease'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(234,88,12,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', border: '2px solid rgba(249,115,22,0.25)'
            }}>
              <span style={{ fontSize: '2rem' }}>⚡</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#fb923c' }}>
              {confirmModal.title}
            </h3>
            <p style={{
              color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6',
              fontSize: '0.9rem', padding: '0 0.5rem'
            }}>
              {confirmModal.message}
            </p>
            <div style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem'
            }}>
              <button onClick={() => setConfirmModal(null)}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >Cancel</button>
              <button onClick={confirmModal.action}
                style={{
                  padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(249,115,22,0.35)',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(249,115,22,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,115,22,0.35)'; }}
              >✅ Confirm</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* Sticky Quick Actions footer */}
      <div className="sticky-footer-bar no-print">
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>⚡ Quick Actions</span>
        <div style={{ width: '1px', height: '1.25rem', background: 'rgba(255,255,255,0.1)' }} />
        {invoice.status !== 'Void' && (
          <>
            <button className="btn-secondary" onClick={startEditing} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>✏️ Edit Invoice</button>
            <button className="btn-secondary" onClick={handleVoidInvoice} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', background: 'rgba(244,63,94,0.05)' }}>🚫 Void</button>
          </>
        )}
        <button className="btn-secondary" onClick={handleDeleteInvoice} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto', border: '1px solid rgba(244,63,94,0.3)', color: 'var(--danger)', background: 'rgba(244,63,94,0.05)' }}>🗑️ Delete</button>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={() => router.push('/invoices')} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>← All Invoices</button>
        </div>
      </div>
      <div style={{ height: '5rem' }} />

      <style dangerouslySetInnerHTML={{__html: `
        .form-panel .form-control {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .form-panel .form-control:focus {
          transform: scale(1.02);
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
          border-color: rgba(59, 130, 246, 0.9) !important;
          background: rgba(0, 0, 0, 0.4) !important;
        }
        .form-panel .form-control:hover:not(:focus) {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
        }
        @media (max-width: 1024px) {
          .invoice-grid { grid-template-columns: 1fr !important; gap: 1.5rem !important; }
          .invoice-sticky-panel { position: static !important; }
          .ledger-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .action-bar { flex-direction: column !important; align-items: stretch !important; gap: 1rem !important; }
          .action-buttons { justify-content: center !important; flex-wrap: wrap !important; }
          .payment-row { flex-direction: column !important; align-items: stretch !important; gap: 1rem !important; text-align: left !important; }
          .payment-row > div:last-child { justify-content: flex-start !important; }
          .payment-actions { width: 100% !important; justify-content: flex-start !important; }
        }
        @media (max-width: 640px) {
          .dashboard-container { padding: 1rem !important; }
          .ledger-grid { grid-template-columns: 1fr !important; }
          .invoice-header { flex-direction: column !important; align-items: flex-start !important; gap: 1rem !important; }
          .invoice-header h1 { font-size: 1.5rem !important; }
          .payment-method-grid { grid-template-columns: 1fr !important; }
          .date-grid { grid-template-columns: 1fr !important; }
          .btn-group { flex-direction: column !important; }
          .btn-group button { width: 100% !important; justify-content: center !important; }
        }
      `}} />
    </div>
  );
}
