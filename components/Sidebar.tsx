'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import './Sidebar.css';
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

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        if (parsed.employeeId) {
          apiFetch(`http://localhost:5000/api/employees/${parsed.employeeId}`)
            .then(r => r.ok ? r.json() : null)
            .then((data: Employee | null) => {
              if (data) setEmployee(data);
            })
            .catch(() => {});
        }
      } catch (e) {
        console.error('Failed to parse stored user', e);
      }
    }
  }, [pathname]);

  // Auto-close mobile menu when navigating
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);


  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const userRole = user?.role?.toLowerCase() || 'sales_user';
  const isAdmin = userRole === 'admin' || userRole === 'administrator';
  const isManager = userRole === 'manager' || isAdmin;
  const isFinance = userRole === 'finance' || isManager;
  const isStore = userRole === 'store_user' || isManager;
  const isSales = userRole === 'sales_user' || isManager;
  const isCashier = userRole === 'cashier' || isManager || isFinance;
  const isCustomer = userRole === 'customer';

  const canViewSettings = isAdmin;
  const canViewUsers = isAdmin || isManager;
  const canViewReports = isManager || isFinance || isSales || isStore || isCashier;
  const canViewEmployees = isManager;
  const canViewBanks = isManager || isFinance || isCashier;
  const canViewInventory = isManager || isStore || isFinance;
  const canViewCustomers = isManager || isFinance || isSales || isCashier;
  const canViewOrders = isManager || isFinance || isStore || isSales || isCashier;
  const canViewInvoices = isManager || isFinance || isSales || isCashier;
  const canViewPayments = isManager || isFinance || isCashier;
  const canViewPurchasing = isManager || isStore || isFinance;


  // Early return AFTER all hooks
  if (pathname === '/login') {
    return null;
  }

  const roleColor = (() => {
    switch (userRole) {
      case 'admin': case 'administrator': return '#f87171';
      case 'manager': return '#fb923c';
      case 'finance': return '#818cf8';
      case 'cashier': return '#22d3ee';
      case 'store_user': return '#34d399';
      case 'sales_user': return '#c084fc';
      case 'customer': return '#f472b6';
      default: return '#fbbf24';
    }
  })();

  const roleLabel = (() => {
    switch (userRole) {
      case 'admin': case 'administrator': return 'Admin';
      case 'manager': return 'Manager';
      case 'finance': return 'Finance';
      case 'cashier': return 'Cashier';
      case 'store_user': return 'Store';
      case 'sales_user': return 'Sales';
      case 'customer': return 'Customer';
      default: return userRole;
    }
  })();

  const userInitial = user?.username ? user.username.charAt(0).toUpperCase() : '?';

  return (
    <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      {/* ── Logo Header ── */}
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">🛍️</div>
        <h2>Nexlify</h2>
        <button 
          className="mobile-hamburger" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      <nav className="sidebar-nav">
        
        {/* ═══ MAIN ═══ */}
    <div className="sidebar-section-label">Main</div>

    {!isCustomer && userRole !== 'sales_user' && userRole !== 'cashier' && (
      <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
        <span className="icon">📊</span>
        Dashboard
      </Link>
    )}
    {userRole === 'cashier' && (
      <Link href="/cashier-dashboard" className={`nav-item ${pathname === '/cashier-dashboard' ? 'active' : ''}`}>
        <span className="icon">📊</span>
        Cashier Dashboard
      </Link>
    )}
    {userRole === 'sales_user' && (
      <Link href="/seller-dashboard" className={`nav-item ${pathname === '/seller-dashboard' ? 'active' : ''}`}>
        <span className="icon">📊</span>
        Seller Dashboard
      </Link>
    )}
    {isCustomer && (
      <Link href="/customer-portal" className={`nav-item ${pathname.startsWith('/customer-portal') ? 'active' : ''}`}>
        <span className="icon">🏦</span>
        Customer Portal
      </Link>
    )}

    {/* Sync Dashboard */}
    {(isAdmin || isManager) && (
      <Link href="/sync-dashboard" className={`nav-item ${pathname === '/sync-dashboard' ? 'active' : ''}`}>
        <span className="icon">🔄</span>
        Sync Dashboard
      </Link>
    )}

        {/* ═══ OPERATIONS ═══ */}
        {(canViewCustomers || canViewOrders || canViewInvoices || canViewPayments) && (
          <div className="sidebar-section-label">Operations</div>
        )}

        {/* Customers */}
        {canViewCustomers && (
          <Link href="/customers" className={`nav-item ${pathname.startsWith('/customers') ? 'active' : ''}`}>
            <span className="icon">👥</span>
            Customers
          </Link>
        )}

        {/* Orders */}
        {canViewOrders && (
          <Link href="/orders" className={`nav-item ${pathname.startsWith('/orders') ? 'active' : ''}`}>
            <span className="icon">🛒</span>
            Orders
          </Link>
        )}

        {/* Invoices */}
        {canViewInvoices && (
          <Link href="/invoices" className={`nav-item ${pathname.startsWith('/invoices') ? 'active' : ''}`}>
            <span className="icon">📄</span>
            Invoices
          </Link>
        )}

        {/* Payments */}
        {canViewPayments && (
          <Link href="/payments" className={`nav-item ${pathname.startsWith('/payments') ? 'active' : ''}`}>
            <span className="icon">💰</span>
            Payments
          </Link>
        )}

        {/* ═══ MANAGEMENT ═══ */}
        {(canViewEmployees || canViewBanks || canViewInventory || canViewPurchasing) && (
          <div className="sidebar-section-label">Management</div>
        )}

        {/* Employees */}
        {canViewEmployees && (
          <Link href="/employees" className={`nav-item ${pathname.startsWith('/employees') ? 'active' : ''}`}>
            <span className="icon">👤</span>
            Employees
          </Link>
        )}

        {/* Banks */}
        {canViewBanks && (
          <Link href="/banks" className={`nav-item ${pathname.startsWith('/banks') ? 'active' : ''}`}>
            <span className="icon">🏦</span>
            Banks
          </Link>
        )}

        {/* Inventory */}
        {canViewInventory && (
          <Link href="/inventory" className={`nav-item ${pathname.startsWith('/inventory') || pathname.startsWith('/price-list') ? 'active' : ''}`}>
            <span className="icon">📦</span>
            Inventory
          </Link>
        )}

        {/* Purchasing sub-section */}
        {canViewPurchasing && (
          <>
            <div className="sidebar-section-label" style={{ marginTop: '0.25rem', fontSize: '0.6rem', letterSpacing: '0.08em' }}>Purchasing</div>
            <Link href="/purchasing/orders" className={`nav-item ${pathname.startsWith('/purchasing/orders') ? 'active' : ''}`} style={{ paddingLeft: '1.5rem' }}>
              <span className="icon">📋</span>
              Purchase Orders
            </Link>
            <Link href="/purchasing/purchases" className={`nav-item ${pathname.startsWith('/purchasing/purchases') ? 'active' : ''}`} style={{ paddingLeft: '1.5rem' }}>
              <span className="icon">📥</span>
              Purchases
            </Link>
            <Link href="/purchasing/suppliers" className={`nav-item ${pathname.startsWith('/purchasing/suppliers') ? 'active' : ''}`} style={{ paddingLeft: '1.5rem' }}>
              <span className="icon">🏭</span>
              Suppliers
            </Link>
          </>
        )}

        {/* Import Sales */}
        {(isManager || isFinance) && (
          <Link href="/import" className={`nav-item ${pathname === '/import' ? 'active' : ''}`}>
            <span className="icon">📥</span>
            Import Sales
          </Link>
        )}

        {/* ═══ INSIGHTS ═══ */}
        {(canViewReports || canViewUsers || canViewSettings) && (
          <div className="sidebar-section-label">Insights & System</div>
        )}

        {/* Reports */}
        {canViewReports && (
          <Link href="/reports" className={`nav-item ${pathname.startsWith('/reports') ? 'active' : ''}`}>
            <span className="icon">📊</span>
            Reports
          </Link>
        )}

        {/* Users */}
        {canViewUsers && (
          <Link href="/users" className={`nav-item ${pathname.startsWith('/users') ? 'active' : ''}`}>
            <span className="icon">🛡️</span>
            Users
          </Link>
        )}

        {/* Settings */}
        {canViewSettings && (
          <Link href="/settings" className={`nav-item ${pathname.startsWith('/settings') ? 'active' : ''}`}>
            <span className="icon">⚙️</span>
            Settings
          </Link>
        )}
      </nav>
      
      {/* ── User Card & Logout ── */}
      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar" style={{ background: `linear-gradient(135deg, ${roleColor}, color-mix(in srgb, ${roleColor} 70%, #000))` }}>
              {userInitial}
            </div>
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">{user?.username || 'System User'}</div>
              {employee && (
                <div className="sidebar-user-employee">{employee.firstName} {employee.lastName}</div>
              )}
              <div className="sidebar-user-role" style={{ background: `color-mix(in srgb, ${roleColor} 12%, transparent)`, color: roleColor }}>
                {roleLabel}
              </div>
            </div>
          </div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          <span className="icon">🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
