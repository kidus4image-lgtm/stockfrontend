'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { showError, showSuccess } from '../../../lib/toast';

export default function NewBankPage() {
  const router = useRouter();
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  
  // Statuses
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankName || !accountNumber) {
      showError('Bank Name and Account Number are required.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('http://localhost:5000/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName, branchName, accountNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register bank');
      }

      showSuccess('Bank successfully registered!');
      setBankName('');
      setBranchName('');
      setAccountNumber('');
    } catch (err: any) {
      showError(err.message || 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-panel glass-panel">
      <header style={{ marginBottom: '2rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.25rem' }}>Bank Account Registration</h1>
        <p style={{ color: 'var(--text-muted)' }}>Register bank accounts for receiving cheque deposits and tracking payments.</p>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="bankName">Bank Name</label>
            <input
              type="text"
              id="bankName"
              className="form-control"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Commercial Bank of Ethiopia"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="branchName">Branch Name</label>
            <input
              type="text"
              id="branchName"
              className="form-control"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g. Bole Branch"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="accountNumber">Account Number</label>
            <input
              type="text"
              id="accountNumber"
              className="form-control"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. 100023942384"
              disabled={loading}
            />
          </div>
        </div>

        <div style={{ height: '5rem' }} />
        <div className="sticky-footer-bar">
          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
            {loading ? '⏳ Registering...' : '💾 Register Bank'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.push('/')} disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
