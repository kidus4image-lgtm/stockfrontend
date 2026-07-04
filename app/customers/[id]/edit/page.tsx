'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api';
import { showError, showSuccess } from '../../../../lib/toast';

interface Employee {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
}

const FINANCIAL_ROLES = ['admin', 'manager', 'finance'];

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();

  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const currentUser = storedUser ? JSON.parse(storedUser) : { role: 'admin' };
  const userRole = currentUser.role?.toLowerCase() || 'admin';
  const isSalesUser = userRole === 'sales_user';
  const canManageFinancials = FINANCIAL_ROLES.includes(userRole);

  const [customerName, setCustomerName] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [salesRepId, setSalesRepId] = useState('');
  const [chatId, setChatId] = useState('');
  const [userName, setUserName] = useState('');
  const [licenceDate, setLicenceDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [waitDays, setWaitDays] = useState('0');
  const [balance, setBalance] = useState('0');
  const [totalPurchase, setTotalPurchase] = useState('0');
  const [totalCredit, setTotalCredit] = useState('0');
  const [totalCash, setTotalCash] = useState('0');
  const [totalCreditPayed, setTotalCreditPayed] = useState('0');
  const [totalCashPayed, setTotalCashPayed] = useState('0');
  const [uncollectedCheque, setUncollectedCheque] = useState('0');
  const [bouncedCheques, setBouncedCheques] = useState('0');
  const [totalPayed, setTotalPayed] = useState('0');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, empRes] = await Promise.all([
          apiFetch(`http://localhost:5000/api/customers/${id}`),
          apiFetch('http://localhost:5000/api/employees')
        ]);
        if (empRes.ok) {
          setEmployees(await empRes.json());
        }
        if (custRes.ok) {
          const cust = await custRes.json();
          setCustomerName(cust.customerName || '');
          setTinNumber(cust.tinNumber || '');
          setAddress(cust.address || '');
          setPhoneNumber(cust.phoneNumber || '');
          setEmailAddress(cust.emailAddress || '');
          setContactPerson(cust.contactPerson || '');
          setSalesRepId(cust.salesRepId ? String(cust.salesRepId) : '');
          setChatId(cust.chatId || '');
          setUserName(cust.userName || '');
          setLicenceDate(cust.licenceDate ? cust.licenceDate.split('T')[0] : '');
          setExpDate(cust.expDate ? cust.expDate.split('T')[0] : '');
          setWaitDays(cust.waitDays != null ? String(cust.waitDays) : '0');
          setBalance(cust.balance != null ? String(cust.balance) : '0');
          setTotalPurchase(cust.totalPurchase != null ? String(cust.totalPurchase) : '0');
          setTotalCredit(cust.totalCredit != null ? String(cust.totalCredit) : '0');
          setTotalCash(cust.totalCash != null ? String(cust.totalCash) : '0');
          setTotalCreditPayed(cust.totalCreditPayed != null ? String(cust.totalCreditPayed) : '0');
          setTotalCashPayed(cust.totalCashPayed != null ? String(cust.totalCashPayed) : '0');
          setUncollectedCheque(cust.uncollectedCheque != null ? String(cust.uncollectedCheque) : '0');
          setBouncedCheques(cust.bouncedCheques != null ? String(cust.bouncedCheques) : '0');
          setTotalPayed(cust.totalPayed != null ? String(cust.totalPayed) : '0');
        } else {
          showError('Failed to load customer data');
        }
      } catch (err) {
        showError('Failed to load customer data');
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName) {
      showError('Customer name is required.');
      return;
    }
    if (!tinNumber) {
      showError('TIN Number is required.');
      return;
    }
    if (tinNumber.length !== 10 || !/^\d+$/.test(tinNumber)) {
      showError('TIN Number must be exactly 10 numeric digits.');
      return;
    }

    setLoading(true);

    try {
      const body: any = {
        customerName,
        tinNumber,
        address: address || null,
        phoneNumber: phoneNumber || null,
        emailAddress: emailAddress || null,
        waitDays: waitDays ? parseInt(waitDays) : 0,
      };

      if (!isSalesUser) {
        body.salesRepId = salesRepId ? parseInt(salesRepId) : null;
        body.contactPerson = contactPerson || null;
        body.chatId = chatId || null;
        body.userName = userName || null;
        body.licenceDate = licenceDate || null;
        body.expDate = expDate || null;
      }

      if (canManageFinancials) {
        body.balance = balance ? parseFloat(balance) : 0;
        body.totalPurchase = totalPurchase ? parseFloat(totalPurchase) : 0;
        body.totalCredit = totalCredit ? parseFloat(totalCredit) : 0;
        body.totalCash = totalCash ? parseFloat(totalCash) : 0;
        body.totalCreditPayed = totalCreditPayed ? parseFloat(totalCreditPayed) : 0;
        body.totalCashPayed = totalCashPayed ? parseFloat(totalCashPayed) : 0;
        body.uncollectedCheque = uncollectedCheque ? parseFloat(uncollectedCheque) : 0;
        body.bouncedCheques = bouncedCheques ? parseFloat(bouncedCheques) : 0;
        body.totalPayed = totalPayed ? parseFloat(totalPayed) : 0;
      }

      const res = await apiFetch(`http://localhost:5000/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update customer');
      }

      showSuccess('Customer updated successfully!');
      setTimeout(() => router.push(`/customers/${id}`), 1500);
    } catch (err: any) {
      showError(err.message || 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="form-panel glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Loading customer data...
      </div>
    );
  }

  return (
    <div className="form-panel glass-panel">
      <header style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => router.push(`/customers/${id}`)}
          style={{ background: 'transparent', border: 'none', color: 'var(--accent-hover)', cursor: 'pointer', marginBottom: '1rem', fontWeight: 'bold' }}
        >
          &larr; Back to Customer
        </button>
        <h1 className="text-gradient" style={{ fontSize: '2.25rem' }}>Edit Customer</h1>
        <p style={{ color: 'var(--text-muted)' }}>Update customer profile details.</p>
      </header>

      <form onSubmit={handleSubmit}>
        <h3 className="form-section-title">General Information</h3>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="customerName">Customer / Company Name *</label>
            <input type="text" id="customerName" className="form-control" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={loading} required />
          </div>

          <div className="form-field">
            <label htmlFor="tinNumber">TIN Number *</label>
            <input type="text" id="tinNumber" className="form-control" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} disabled={loading} required />
          </div>

          {!isSalesUser && (
            <div className="form-field">
              <label htmlFor="salesRepId">Sales Representative *</label>
              <select id="salesRepId" className="form-control form-select" value={salesRepId} onChange={(e) => setSalesRepId(e.target.value)} disabled={loading} required>
                <option value="">-- Select Sales Rep --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>{emp.firstName} {emp.middleName} {emp.lastName}</option>
                ))}
              </select>
            </div>
          )}

          {!isSalesUser && (
            <div className="form-field">
              <label htmlFor="userName">User Name</label>
              <input type="text" id="userName" className="form-control" value={userName} onChange={(e) => setUserName(e.target.value)} disabled={loading} />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="licenceDate">Licence Date</label>
            <input type="date" id="licenceDate" className="form-control" value={licenceDate} onChange={(e) => setLicenceDate(e.target.value)} disabled={loading} />
          </div>

          <div className="form-field">
            <label htmlFor="expDate">Expiration Date</label>
            <input type="date" id="expDate" className="form-control" value={expDate} onChange={(e) => setExpDate(e.target.value)} disabled={loading} />
          </div>

          <div className="form-field">
            <label htmlFor="waitDays">Wait Days</label>
            <input type="number" id="waitDays" className="form-control" value={waitDays} onChange={(e) => setWaitDays(e.target.value)} min="0" disabled={loading} />
          </div>
        </div>

        <h3 className="form-section-title">Contact Details</h3>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="address">Address</label>
            <input type="text" id="address" className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} disabled={loading} />
          </div>

          <div className="form-field">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input type="text" id="phoneNumber" className="form-control" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={loading} />
          </div>

          <div className="form-field">
            <label htmlFor="emailAddress">Email Address</label>
            <input type="email" id="emailAddress" className="form-control" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} disabled={loading} />
          </div>

          {!isSalesUser && (
            <div className="form-field">
              <label htmlFor="contactPerson">Contact Person</label>
              <input type="text" id="contactPerson" className="form-control" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} disabled={loading} />
            </div>
          )}

          {!isSalesUser && (
            <div className="form-field">
              <label htmlFor="chatId">Telegram Chat ID</label>
              <input type="text" id="chatId" className="form-control" value={chatId} onChange={(e) => setChatId(e.target.value)} disabled={loading} />
            </div>
          )}
        </div>

        {canManageFinancials && (
          <>
            <h3 className="form-section-title">Financial Balances</h3>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="balance">Balance</label>
                <input type="number" id="balance" className="form-control" value={balance} onChange={(e) => setBalance(e.target.value)} disabled={loading} step="0.01" />
              </div>
              <div className="form-field">
                <label htmlFor="totalPurchase">Total Purchase</label>
                <input type="number" id="totalPurchase" className="form-control" value={totalPurchase} onChange={(e) => setTotalPurchase(e.target.value)} disabled={loading} step="0.01" />
              </div>
              <div className="form-field">
                <label htmlFor="totalCredit">Total Credit</label>
                <input type="number" id="totalCredit" className="form-control" value={totalCredit} onChange={(e) => setTotalCredit(e.target.value)} disabled={loading} step="0.01" />
              </div>
              <div className="form-field">
                <label htmlFor="totalCash">Total Cash</label>
                <input type="number" id="totalCash" className="form-control" value={totalCash} onChange={(e) => setTotalCash(e.target.value)} disabled={loading} step="0.01" />
              </div>
              <div className="form-field">
                <label htmlFor="totalCreditPayed">Total Credit Paid</label>
                <input type="number" id="totalCreditPayed" className="form-control" value={totalCreditPayed} onChange={(e) => setTotalCreditPayed(e.target.value)} disabled={loading} step="0.01" />
              </div>
              <div className="form-field">
                <label htmlFor="totalCashPayed">Total Cash Paid</label>
                <input type="number" id="totalCashPayed" className="form-control" value={totalCashPayed} onChange={(e) => setTotalCashPayed(e.target.value)} disabled={loading} step="0.01" />
              </div>
              <div className="form-field">
                <label htmlFor="uncollectedCheque">Uncollected Cheques</label>
                <input type="number" id="uncollectedCheque" className="form-control" value={uncollectedCheque} onChange={(e) => setUncollectedCheque(e.target.value)} disabled={loading} step="0.01" />
              </div>
              <div className="form-field">
                <label htmlFor="bouncedCheques">Bounced Cheques</label>
                <input type="number" id="bouncedCheques" className="form-control" value={bouncedCheques} onChange={(e) => setBouncedCheques(e.target.value)} disabled={loading} step="0.01" />
              </div>
              <div className="form-field">
                <label htmlFor="totalPayed">Total Paid</label>
                <input type="number" id="totalPayed" className="form-control" value={totalPayed} onChange={(e) => setTotalPayed(e.target.value)} disabled={loading} step="0.01" />
              </div>
            </div>
          </>
        )}

        {/* spacer so content isn't hidden behind sticky footer */}
        <div style={{ height: '4rem' }} />

        {/* Sticky footer inside form so submit works */}
        <div className="sticky-footer-bar">
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>✏️ Edit Customer</span>
          <div style={{ width: '1px', height: '1.25rem', background: 'rgba(255,255,255,0.1)' }} />
          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
            {loading ? 'Saving...' : '💾 Save Changes'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.push(`/customers/${id}`)} disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
            Cancel
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <button type="button" className="btn-secondary" onClick={() => router.push(`/customers/${id}`)} disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>← Back to Customer</button>
          </div>
        </div>
      </form>
    </div>
  );
}
