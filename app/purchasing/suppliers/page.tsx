'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api';
import { showSuccess, showError } from '../../../lib/toast';
import { confirmAsync } from '../../../lib/confirm';

interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tinNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    tinNumber: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [currentUser, setCurrentUser] = useState('System User');
  const [userRole, setUserRole] = useState('sales_user');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setCurrentUser(u.username || 'System User');
        setUserRole(u.role || 'sales_user');
      } catch (err) {
        console.error('Failed to parse user session', err);
      }
    }
    fetchData(false);
  }, []);

  const fetchData = async (all = false) => {
    setLoading(true);
    try {
      const res = await apiFetch(`http://localhost:5000/api/suppliers${all ? '?all=true' : ''}`);
      if (res.ok) setSuppliers(await res.json());
    } catch (error) {
      console.error('Failed to fetch suppliers', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setErrors({});
    setForm({ name: '', contactPerson: '', phone: '', email: '', address: '', tinNumber: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setErrors({});
    setForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      tinNumber: s.tinNumber || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Supplier name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showError(Object.values(errs).join('. '));
      return;
    }

    setSubmitting(true);
    const url = editingSupplier
      ? `http://localhost:5000/api/suppliers/${editingSupplier.id}`
      : 'http://localhost:5000/api/suppliers';
    const method = editingSupplier ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save supplier');

      showSuccess(editingSupplier ? 'Supplier updated successfully!' : 'Supplier created successfully!');
      setShowModal(false);
      fetchData(showInactive);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!(await confirmAsync({ title: 'Deactivate Supplier', message: `Deactivate "${name}"? They will no longer appear in new POs.`, variant: 'danger' }))) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/suppliers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deactivate supplier');
      showSuccess('Supplier deactivated');
      fetchData(showInactive);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleReactivate = async (id: number, name: string) => {
    if (!(await confirmAsync({ title: 'Reactivate Supplier', message: `Reactivate "${name}"?`, variant: 'info' }))) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/suppliers/${id}/reactivate`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reactivate supplier');
      showSuccess('Supplier reactivated');
      fetchData(showInactive);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const toggleInactive = () => {
    const next = !showInactive;
    setShowInactive(next);
    fetchData(next);
  };

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
      (s.tinNumber && s.tinNumber.toLowerCase().includes(q));
  });

  const canManage = ['admin', 'manager'].includes(userRole.toLowerCase());

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading Suppliers...
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0 }}>Suppliers</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.15rem 0 0 0' }}>Manage supplier directory for purchase orders</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn-secondary"
            onClick={toggleInactive}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', border: showInactive ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.1)', color: showInactive ? '#fbbf24' : 'var(--text-muted)' }}
          >
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </button>
          {canManage && (
            <button className="btn-primary" onClick={handleOpenAdd} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
              + Add Supplier
            </button>
          )}
        </div>
      </header>

      <div className="glass-panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem' }}>
          <h2 className="text-gradient" style={{ fontSize: '1.1rem', margin: 0 }}>Supplier Directory</h2>
          <input
            type="text"
            placeholder="Search by name, contact, TIN..."
            className="form-control"
            style={{ maxWidth: '280px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <th style={{ padding: '0.5rem 0.4rem' }}>NAME</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>CONTACT</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>PHONE</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>EMAIL</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>TIN</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>STATUS</th>
                {canManage && <th style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage).map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
                    <td style={{ padding: '0.6rem 0.4rem' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{s.name}</strong>
                    </td>
                    <td style={{ padding: '0.6rem 0.4rem' }}>{s.contactPerson || '-'}</td>
                    <td style={{ padding: '0.6rem 0.4rem' }}>{s.phone || '-'}</td>
                    <td style={{ padding: '0.6rem 0.4rem' }}>{s.email || '-'}</td>
                    <td style={{ padding: '0.6rem 0.4rem' }}>{s.tinNumber || '-'}</td>
                    <td style={{ padding: '0.6rem 0.4rem' }}>
                      <span style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '8px',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        background: s.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: s.isActive ? '#6ee7b7' : '#fca5a5'
                      }}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                          {s.isActive && (
                            <button className="btn-secondary" onClick={() => handleOpenEdit(s)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)' }}>Edit</button>
                          )}
                          {s.isActive ? (
                            <button className="btn-secondary" onClick={() => handleDelete(s.id, s.name)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>Deactivate</button>
                          ) : (
                            <button className="btn-secondary" onClick={() => handleReactivate(s.id, s.name)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>Reactivate</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canManage ? 7 : 6} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No suppliers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > rowsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
              <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 0.4rem' }}>
                {page} / {Math.ceil(filtered.length / rowsPerPage)}
              </span>
              <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', width: 'auto' }} disabled={page >= Math.ceil(filtered.length / rowsPerPage)} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '1.25rem 2rem', borderRadius: '20px', background: 'rgba(17, 24, 39, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 className="text-gradient" style={{ fontSize: '1.5rem', margin: 0, fontWeight: 800 }}>
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Supplier Name *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                  style={{ border: errors.name ? '1px solid #ef4444' : '' }}
                />
                {errors.name && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{errors.name}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Contact Person</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
                  style={{ border: errors.email ? '1px solid #ef4444' : '' }}
                />
                {errors.email && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{errors.email}</span>}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIN Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.tinNumber}
                  onChange={(e) => setForm({ ...form, tinNumber: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingSupplier ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {canManage && (
        <div className="sticky-footer-bar no-print">
          <button className="btn-primary" onClick={handleOpenAdd} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
            ➕ Add Supplier
          </button>
        </div>
      )}
    </div>
  );
}