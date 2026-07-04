'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { showError, showSuccess, showWarning } from '../../lib/toast';
import { confirmAsync } from '../../lib/confirm';

interface User {
  id: number;
  username: string;
  role: string;
  employeeId: number | null;
  employee?: { id: number; firstName: string; middleName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export default function UserManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<User | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('sales_user');
  const [employeeId, setEmployeeId] = useState('');

  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');

  const [employees, setEmployees] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Auth & Authorization check
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setCurrentUser(parsedUser);

    if (parsedUser.role?.toLowerCase() !== 'admin' && parsedUser.role?.toLowerCase() !== 'manager') {
      showError('Access Denied: Only admins and managers are permitted to access user management.');
      router.push('/');
      return;
    }

    fetchUsers();
    fetchEmployees();
  }, [router]);

  const fetchEmployees = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/employees');
      if (res.ok) setEmployees(await res.json());
    } catch {}
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('http://localhost:5000/api/users');
      if (res.ok) {
        setUsers(await res.json());
      } else {
        throw new Error('Failed to load system users');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to fetch user accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password || !role) {
      showError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, employeeId: employeeId || null })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      showSuccess(`User "${username}" created successfully with role "${role}"`);
      setShowCreateModal(false);

      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setRole('sales_user');
      setEmployeeId('');

      fetchUsers();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!showEditModal) return;

    try {
      setSubmitting(true);
      const payload: any = {
        username: editUsername,
        role: editRole,
        employeeId: editEmployeeId || null
      };
      if (editPassword) {
        payload.password = editPassword;
      }

      const res = await apiFetch(`http://localhost:5000/api/users/${showEditModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      showSuccess(`User details for "${editUsername}" successfully updated.`);

      // If we edited ourselves, update the local storage user session!
      if (currentUser && currentUser.id === showEditModal.id) {
        const updatedUserSession = { ...currentUser, username: editUsername, role: editRole };
        localStorage.setItem('user', JSON.stringify(updatedUserSession));
        setCurrentUser(updatedUserSession);
      }

      setShowEditModal(null);
      setEditPassword('');
      fetchUsers();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: number, uName: string) => {
    if (currentUser && currentUser.id === userId) {
      showWarning('Security Protection: You cannot delete your own logged-in manager account.');
      return;
    }

    if (!(await confirmAsync({ title: 'Delete User', message: `Are you absolutely sure you want to permanently delete user "${uName}"? This cannot be undone.`, variant: 'danger' }))) {
      return;
    }

    try {
      const res = await apiFetch(`http://localhost:5000/api/users/${userId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion failed');

      showSuccess(`User account "${uName}" successfully deleted.`);
      fetchUsers();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const openEditModal = (user: any) => {
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditEmployeeId(user.employeeId?.toString() || '');
    setShowEditModal(user);
  };

  const getRoleBadgeStyle = (userRole: string) => {
    switch (userRole?.toLowerCase()) {
      case 'admin':
      case 'administrator':
        return { bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' };
      case 'manager':
        return { bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' };
      case 'finance':
        return { bg: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' };
      case 'store_user':
        return { bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' };
      case 'sales_user':
        return { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' };
      case 'customer':
        return { bg: 'rgba(236, 72, 153, 0.12)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' };
      default:
        return { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' };
    }
  };

  if (loading && users.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Retrieving system users...
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-main)' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
            User Accounts & Roles
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            Manage logins, configure secure access controls, and assign Manager, Finance, or Collector roles.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setShowCreateModal(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          ➕ Register User
        </button>
      </div>

      {/* USERS CARD GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {users.map((user) => {
          const badge = getRoleBadgeStyle(user.role);
          return (
            <div key={user.id} className="glass-panel" style={{
              padding: '1.75rem',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1.25rem',
              transition: 'transform 0.2s',
              cursor: 'default'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{
                    ...badge,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    textTransform: 'uppercase'
                  }}>
                    🛡️ {user.role}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ID: #{user.id}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '700', color: '#fff' }}>
                  {user.username}
                </h3>
                
                {user.employee && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.35rem' }}>
                    👤 {user.employee.firstName} {user.employee.middleName} {user.employee.lastName}
                  </div>
                )}

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Created on {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
                <button
                  className="btn-secondary"
                  onClick={() => openEditModal(user)}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  ✏️ Edit / Role
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id, user.username)}
                  disabled={currentUser && currentUser.id === user.id}
                  style={{
                    flex: 1,
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: currentUser && currentUser.id === user.id ? 'var(--text-muted)' : '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    cursor: currentUser && currentUser.id === user.id ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (currentUser && currentUser.id !== user.id) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (currentUser && currentUser.id !== user.id) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                    }
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(10, 10, 18, 0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            width: '450px',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Register User</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter login username"
                  required
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>System Access Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', height: '38px' }}
                  >
                    <option value="admin" style={{ background: '#111827' }}>Admin (Full System Access)</option>
                    <option value="manager" style={{ background: '#111827' }}>Manager</option>
                    <option value="finance" style={{ background: '#111827' }}>Finance</option>
                    <option value="cashier" style={{ background: '#111827' }}>Cashier</option>
                    <option value="store_user" style={{ background: '#111827' }}>Store User</option>
                    <option value="sales_user" style={{ background: '#111827' }}>Sales User</option>
                  </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Linked Employee</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', height: '38px' }}
                >
                  <option value="" style={{ background: '#111827' }}>-- No Employee Link --</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id} style={{ background: '#111827' }}>
                      {emp.firstName} {emp.middleName} {emp.lastName} ({emp.idNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: '700', marginTop: '0.5rem' }}
              >
                {submitting ? '🔄 Processing...' : '✅ Save User Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER / ROLE MODAL */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(10, 10, 18, 0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            width: '450px',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Edit User</h2>
              <button 
                onClick={() => setShowEditModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>System Access Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', height: '38px' }}
                >
                  <option value="admin" style={{ background: '#111827' }}>Admin (Full System Access)</option>
                  <option value="manager" style={{ background: '#111827' }}>Manager</option>
                  <option value="finance" style={{ background: '#111827' }}>Finance</option>
                  <option value="cashier" style={{ background: '#111827' }}>Cashier</option>
                  <option value="store_user" style={{ background: '#111827' }}>Store User</option>
                  <option value="sales_user" style={{ background: '#111827' }}>Sales User</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Linked Employee</label>
                <select
                  value={editEmployeeId}
                  onChange={(e) => setEditEmployeeId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', height: '38px' }}
                >
                  <option value="" style={{ background: '#111827' }}>-- No Employee Link --</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id} style={{ background: '#111827' }}>
                      {emp.firstName} {emp.middleName} {emp.lastName} ({emp.idNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Reset Password <span style={{ textTransform: 'none', color: 'var(--text-muted)', fontWeight: '400' }}>(Leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new password to reset"
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: '700', marginTop: '0.5rem' }}
              >
                {submitting ? '🔄 Saving Changes...' : '✅ Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
      <div className="sticky-footer-bar no-print">
        <button className="btn-primary" onClick={() => { setShowCreateModal(true); }} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}>
          ➕ Register User
        </button>
      </div>
    </div>
  );
}
