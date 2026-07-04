'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { showError, showSuccess } from '../../../lib/toast';

interface Department {
  id: number;
  departmentName: string;
}

export default function NewEmployeePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Department Creation
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  
  // Statuses
  const [loading, setLoading] = useState(false);

  // Fetch departments on mount
  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error('Failed to fetch departments', err);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName) return;

    try {
      const res = await apiFetch('http://localhost:5000/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentName: newDeptName }),
      });
      const data = await res.json();
      if (res.ok) {
        setDepartments([...departments, data]);
        setDepartmentId(data.id.toString());
        setNewDeptName('');
        setShowAddDept(false);
      } else {
        showError(data.error || 'Failed to add department');
      }
    } catch (err) {
      console.error(err);
      showError('Network error adding department');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !middleName || !lastName || !idNumber || !departmentId) {
      showError('All fields are required.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('http://localhost:5000/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          middleName,
          lastName,
          idNumber,
          departmentId: parseInt(departmentId),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register employee');
      }

      showSuccess('Employee successfully registered!');
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setIdNumber('');
      setDepartmentId('');
    } catch (err: any) {
      showError(err.message || 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-panel glass-panel">
      <header style={{ marginBottom: '2rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.25rem' }}>Employee Registration</h1>
        <p style={{ color: 'var(--text-muted)' }}>Create a new employee profile to allocate sales reps and record cash deposits.</p>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              className="form-control"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Kidus"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="middleName">Middle Name</label>
            <input
              type="text"
              id="middleName"
              className="form-control"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="e.g. Daniel"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              className="form-control"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Assefa"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="idNumber">Employee ID / ID Number</label>
            <input
              type="text"
              id="idNumber"
              className="form-control"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. EMP-9824"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="departmentId">Department</label>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--accent-hover)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                onClick={() => setShowAddDept(!showAddDept)}
              >
                + Add Dept
              </button>
            </div>
            {showAddDept ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ flex: 1, padding: '0.5rem' }}
                  placeholder="Dept Name"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                />
                <button type="button" className="btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={handleAddDepartment}>
                  Save
                </button>
                <button type="button" className="btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => setShowAddDept(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <select
                id="departmentId"
                className="form-control form-select"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={loading}
              >
                <option value="">-- Select Department --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.departmentName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={{ height: '5rem' }} />
        <div className="sticky-footer-bar">
          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
            {loading ? '⏳ Registering...' : '💾 Register Employee'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.push('/')} disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
