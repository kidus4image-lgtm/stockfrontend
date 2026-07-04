'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

interface Notification {
  id: number;
  userId: number | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchNotifications();
  }, [router]);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/notifications');
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await apiFetch(`http://localhost:5000/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('http://localhost:5000/api/notifications/read-all', { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`http://localhost:5000/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleClick = (n: Notification) => {
    if (!n.isRead) handleMarkRead(n.id);
    if (n.link) router.push(n.link);
  };

  const filtered = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.5rem' }}>Notifications</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {unreadCount} unread / {notifications.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
              background: filter === 'all' ? 'var(--accent)' : 'transparent',
              color: filter === 'all' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem'
            }}
          >All</button>
          <button
            onClick={() => setFilter('unread')}
            style={{
              padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
              background: filter === 'unread' ? 'var(--accent)' : 'transparent',
              color: filter === 'unread' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem'
            }}
          >Unread</button>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} style={{
              padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid var(--accent)',
              background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem'
            }}>Mark All Read</button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No notifications found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(n => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem',
                background: n.isRead ? 'rgba(255,255,255,0.02)' : 'rgba(23, 79, 73, 0.12)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px', cursor: n.link ? 'pointer' : 'default',
                transition: 'background 0.2s'
              }}
            >
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: n.isRead ? 'var(--text-muted)' : '#6ee7b7',
                boxShadow: n.isRead ? 'none' : '0 0 8px #6ee7b7',
                flexShrink: 0
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                    color: n.type === 'low_stock' ? '#f59e0b' :
                           n.type === 'payment_cleared' ? '#10b981' :
                           n.type === 'expiry_alert' ? '#ef4444' :
                           n.type === 'invoice_overdue' ? '#f97316' :
                           n.type === 'order_approved' ? '#3b82f6' :
                           'var(--text-muted)'
                  }}>{n.type.replace(/_/g, ' ')}</span>
                  {!n.isRead && <span style={{
                    fontSize: '0.65rem', background: 'var(--accent)', color: '#fff',
                    padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700
                  }}>NEW</span>}
                </div>
                <p style={{ margin: '0.25rem 0', color: '#e2e8f0', fontSize: '0.9rem' }}>
                  <strong>{n.title}</strong>: {n.message}
                </p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '1.1rem', padding: '0.25rem', flexShrink: 0
                }}
                title="Delete"
              >&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
