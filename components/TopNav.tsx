'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../lib/api';

interface SessionUser {
  id: number;
  username: string;
  role: string;
  employeeId?: number | null;
}

interface Employee {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
}

interface CompanySettings {
  companyName: string | null;
  companyLogo: string | null;
}

interface NotificationItem {
  id: number;
  userId: number | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  async function fetchSettings() {
    try {
      const res = await apiFetch('http://localhost:5000/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch settings in TopNav:', err);
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setShowProfileDropdown(false);
    setShowNotifDropdown(false);

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        if (parsed.employeeId) {
          apiFetch(`http://localhost:5000/api/employees/${parsed.employeeId}`)
            .then(r => r.ok ? r.json() : null)
            .then((data: Employee | null) => { if (data) setEmployee(data); })
            .catch(() => {});
        }
      } catch (err) {
        console.error('Failed to parse user session in TopNav:', err);
      }
    }

    fetchSettings();
  }, [pathname]);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('http://localhost:5000/api/notifications/read-all', { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotifClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      try {
        await apiFetch(`http://localhost:5000/api/notifications/${n.id}/read`, { method: 'PATCH' });
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
    if (n.link) router.push(n.link);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'US';

  // Do not display top nav on login page
  if (pathname === '/login') {
    return null;
  }

  const toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (sidebar) {
      sidebar.classList.toggle('mobile-open');
    }
  };

  return (
    <header className="top-nav">
      {/* LEFT: HAMBURGER + BRANDING */}
      <div className="top-nav-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          className="top-nav-hamburger"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.2rem',
            color: '#e2e8f0',
            flexShrink: 0,
          }}
        >
          ☰
        </button>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          {settings?.companyLogo ? (
            <img 
              src={settings.companyLogo.startsWith('data:image') ? settings.companyLogo : `data:image/png;base64,${settings.companyLogo}`}
              alt="Company Logo"
              style={{ height: '36px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }}
            />
          ) : (
            <span style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center' }}>🏢</span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px', lineHeight: 1.2 }}>
              {settings?.companyName || 'Nexlify'}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Inventory & Payment Hub
            </span>
          </div>
        </Link>
      </div>

      {/* RIGHT: NOTIFICATIONS & USER ACCOUNT */}
      <div className="top-nav-right">
        
        {/* NOTIFICATIONS BELL */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button 
            className="top-nav-icon-btn" 
            onClick={() => {
              setShowNotifDropdown(!showNotifDropdown);
              setShowProfileDropdown(false);
            }}
            aria-label="View notifications"
          >
            <span style={{ fontSize: '1.25rem' }}>🔔</span>
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount}</span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="top-nav-dropdown notif-dropdown">
              <div className="dropdown-header">
                <span style={{ fontWeight: 700, color: '#fff' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-btn">Mark all read</button>
                )}
              </div>
              <div className="dropdown-body">
                {notifications.map(n => (
                  <div key={n.id} className={`notif-item ${!n.isRead ? 'unread' : ''}`} onClick={() => handleNotifClick(n)} style={{ cursor: n.link ? 'pointer' : 'default' }}>
                    <div className="notif-bullet"></div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.3 }}>{n.title}: {n.message}</p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.08)' }}></div>

        {/* USER PROFILE DIRECT ACCESS */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button 
            className="top-nav-profile-trigger"
            onClick={() => {
              setShowProfileDropdown(!showProfileDropdown);
              setShowNotifDropdown(false);
            }}
          >
            <div className="user-avatar">{initials}</div>
            <div className="user-info-text">
              <span className="username-label">{user?.username || 'User Account'}</span>
              {employee && <span className="employee-name-label">{employee.firstName} {employee.lastName}</span>}
              <span className="role-label">{user?.role || 'Guest'}</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>▼</span>
          </button>

          {showProfileDropdown && (
            <div className="top-nav-dropdown profile-dropdown">
              <div className="dropdown-profile-header">
                <div className="large-avatar">{initials}</div>
                <div>
                  <h4 style={{ margin: 0, color: '#fff', fontSize: '0.9rem' }}>{user?.username}</h4>
                  {employee && (
                    <span style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'block', marginTop: '0.1rem' }}>
                      {employee.firstName} {employee.middleName} {employee.lastName}
                    </span>
                  )}
                  <span style={{ fontSize: '0.75rem', color: '#6ee7b7', textTransform: 'uppercase', fontWeight: 700 }}>
                    {user?.role}
                  </span>
                </div>
              </div>
              
              <div className="dropdown-divider"></div>
              
              <Link href="/settings" className="dropdown-link-item" onClick={() => setShowProfileDropdown(false)}>
                <span>⚙️</span> Settings & Profile
              </Link>
              
              <Link href="/inventory?tab=products" className="dropdown-link-item" onClick={() => setShowProfileDropdown(false)}>
                <span>📦</span> Inventory Catalog
              </Link>
              
              <Link href="/price-list" className="dropdown-link-item" onClick={() => setShowProfileDropdown(false)}>
                <span>📋</span> Price List
              </Link>
              
              <div className="dropdown-divider"></div>
              
              <button onClick={handleLogout} className="dropdown-action-btn logout-btn">
                <span>🚪</span> Sign Out
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
