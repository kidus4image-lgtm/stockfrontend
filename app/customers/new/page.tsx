'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { showError, showSuccess } from '../../../lib/toast';

interface Employee {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
}

const FINANCIAL_ROLES = ['admin', 'manager', 'finance'];

export default function NewCustomerPage() {
  const router = useRouter();
  const [isSalesUser, setIsSalesUser] = useState(false);
  const [canManageFinancials, setCanManageFinancials] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      const role = u.role?.toLowerCase() || '';
      setIsSalesUser(role === 'sales_user');
      setCanManageFinancials(FINANCIAL_ROLES.includes(role));
    } catch {}
  }, []);

  // State for all fields
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

  // Sales representatives list
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Statuses
  const [loading, setLoading] = useState(false);

  // Fetch sales reps (Employees) on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await apiFetch('http://localhost:5000/api/employees');
        if (res.ok) {
          const data = await res.json();
          setEmployees(data);
        }
      } catch (err) {
        console.error('Failed to fetch sales representatives', err);
      }
    };
    fetchEmployees();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName) {
      showError('Customer Name is required.');
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

    if (!isSalesUser && !salesRepId) {
      showError('Sales representative is required.');
      return;
    }

    setLoading(true);

    const body: any = {
      customerName,
      tinNumber: tinNumber || null,
      address: address || null,
      phoneNumber: phoneNumber || null,
      emailAddress: emailAddress || null,
      contactPerson: contactPerson || null,
      salesRepId: salesRepId ? parseInt(salesRepId) : null,
      chatId: chatId || null,
      userName: userName || null,
      licenceDate: licenceDate || null,
      expDate: expDate || null,
      waitDays: waitDays ? parseInt(waitDays) : 0
    };

    if (canManageFinancials) {
      Object.assign(body, {
        balance: balance ? parseFloat(balance) : 0,
        totalPurchase: totalPurchase ? parseFloat(totalPurchase) : 0,
        totalCredit: totalCredit ? parseFloat(totalCredit) : 0,
        totalCash: totalCash ? parseFloat(totalCash) : 0,
        totalCreditPayed: totalCreditPayed ? parseFloat(totalCreditPayed) : 0,
        totalCashPayed: totalCashPayed ? parseFloat(totalCashPayed) : 0,
        uncollectedCheque: uncollectedCheque ? parseFloat(uncollectedCheque) : 0,
        bouncedCheques: bouncedCheques ? parseFloat(bouncedCheques) : 0,
        totalPayed: totalPayed ? parseFloat(totalPayed) : 0,
      });
    }

    try {
      const res = await apiFetch('http://localhost:5000/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register customer');
      }

      showSuccess('Customer successfully registered!');

      setCustomerName('');
      setTinNumber('');
      setAddress('');
      setPhoneNumber('');
      setEmailAddress('');
      setContactPerson('');
      setSalesRepId('');
      setChatId('');
      setUserName('');
      setLicenceDate('');
      setExpDate('');
      setWaitDays('0');
      setBalance('0');
      setTotalPurchase('0');
      setTotalCredit('0');
      setTotalCash('0');
      setTotalCreditPayed('0');
      setTotalCashPayed('0');
      setUncollectedCheque('0');
      setBouncedCheques('0');
      setTotalPayed('0');
    } catch (err: any) {
      showError(err.message || 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-panel glass-panel">
      <header style={{ marginBottom: '2rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.25rem' }}>Customer Registration</h1>
        <p style={{ color: 'var(--text-muted)' }}>Create a detailed profile for tracking financial transactions, balance sheets, and sales metrics.</p>
      </header>

      <form onSubmit={handleSubmit}>
        
        {/* SECTION 1: General Info */}
        <h3 className="form-section-title">General Information</h3>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="customerName">Customer / Company Name *</label>
            <input
              type="text"
              id="customerName"
              className="form-control"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Astinka Trading PLC"
              disabled={loading}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="tinNumber">TIN Number *</label>
            <input
              type="text"
              id="tinNumber"
              className="form-control"
              value={tinNumber}
              onChange={(e) => setTinNumber(e.target.value)}
              placeholder="e.g. 0012345678"
              disabled={loading}
              required
            />
          </div>

          {!isSalesUser && (
            <div className="form-field">
              <label htmlFor="salesRepId">Sales Representative *</label>
              <select
                id="salesRepId"
                className="form-control form-select"
                value={salesRepId}
                onChange={(e) => setSalesRepId(e.target.value)}
                disabled={loading}
                required
              >
                <option value="">-- Select Sales Rep --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.firstName} {emp.middleName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="userName">User Name</label>
            <input
              type="text"
              id="userName"
              className="form-control"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. astinka_user"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="licenceDate">Licence Date</label>
            <input
              type="date"
              id="licenceDate"
              className="form-control"
              value={licenceDate}
              onChange={(e) => setLicenceDate(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="expDate">Expiration Date</label>
            <input
              type="date"
              id="expDate"
              className="form-control"
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="waitDays">Wait Days</label>
            <input
              type="number"
              id="waitDays"
              className="form-control"
              value={waitDays}
              onChange={(e) => setWaitDays(e.target.value)}
              min="0"
              disabled={loading}
            />
          </div>
        </div>

        {/* SECTION 2: Contact Details */}
        <h3 className="form-section-title">Contact & Communication</h3>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              className="form-control"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Addis Ababa, Bole Subcity"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input
              type="text"
              id="phoneNumber"
              className="form-control"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. +251 911 234567"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="emailAddress">Email Address</label>
            <input
              type="email"
              id="emailAddress"
              className="form-control"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="e.g. info@astinka.com"
              disabled={loading}
            />
          </div>

          </div>

        {!isSalesUser && (
          <>
            <h3 className="form-section-title">Contact & Additional</h3>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="contactPerson">Contact Person</label>
                <input
                  type="text"
                  id="contactPerson"
                  className="form-control"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Daniel Assefa"
                  disabled={loading}
                />
              </div>

              <div className="form-field">
                <label htmlFor="chatId">Telegram Chat ID</label>
                <input
                  type="text"
                  id="chatId"
                  className="form-control"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="e.g. @astinka_trading_bot"
                  disabled={loading}
                />
              </div>
            </div>
          </>
        )}

        {canManageFinancials && (
          <>
            <h3 className="form-section-title">Initial Balances (Money)</h3>
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

        <div style={{ height: '5rem' }} />
        <div className="sticky-footer-bar">
          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
            {loading ? '⏳ Registering...' : '💾 Register Customer'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.push('/')} disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
