'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiFetch } from '../lib/api';

interface Customer {
  id: number;
  customerName: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  amount: number;
  customer: Customer;
}

interface Payment {
  id: number;
  amount: number;
  paymentMethod: string;
  status: string;
  invoiceId: number;
  invoice: Invoice;
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customer: Customer;
}

interface Supplier {
  id: number;
  name: string;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  status: string;
  totalAmount: number;
  supplier: Supplier;
}

interface SearchResults {
  customers: Customer[];
  invoices: Invoice[];
  products: Product[];
  payments: Payment[];
  orders: Order[];
  purchaseOrders: PurchaseOrder[];
}

export default function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await apiFetch(`http://localhost:5000/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults({
            customers: data.customers || [],
            invoices: data.invoices || [],
            products: data.products || [],
            payments: data.payments || [],
            orders: data.orders || [],
            purchaseOrders: data.purchaseOrders || [],
          });
        }
      } catch (err) {
        console.error('Global search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const close = () => {
    setIsOpen(false);
    setQuery('');
    setResults(null);
  };

  const goTo = (path: string) => {
    router.push(path);
    close();
  };

  if (pathname === '/login') {
    return null;
  }

  const hasResults = results && (
    results.products.length || results.invoices.length || results.customers.length ||
    results.payments.length || results.orders.length || results.purchaseOrders.length
  );

  return (
    <div ref={containerRef}>
      {/* Floating Search Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="no-print floating-btn search-floating-btn"
        aria-label="Search products, invoices, payments, orders and purchases"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '6rem',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)',
          zIndex: 10000,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(245, 158, 11, 0.5)'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.3)'; }}
      >
        {isOpen ? '✕' : '🔍'}
      </button>

      {/* Search Panel */}
      {isOpen && (
        <div
          className="no-print floating-panel search-floating-panel"
          style={{
            position: 'fixed',
            bottom: '6rem',
            right: '2rem',
            width: '420px',
            maxHeight: '65vh',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10000,
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1))',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, invoices, payments, orders, purchases..."
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '0.6rem 0.9rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
            {loading && (
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', padding: '0.75rem 1.25rem', margin: 0 }}>Searching...</p>
            )}

            {!loading && query.trim() && !hasResults && (
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', padding: '0.75rem 1.25rem', margin: 0 }}>No results found.</p>
            )}

            {results && results.products.length > 0 && (
              <SearchSection title="Products">
                {results.products.map(p => (
                  <ResultItem
                    key={`product-${p.id}`}
                    title={p.name}
                    subtitle={`SKU: ${p.sku}`}
                    trailing={`$${p.price.toLocaleString()}`}
                    onClick={() => goTo(`/inventory/${p.id}`)}
                  />
                ))}
              </SearchSection>
            )}

            {results && results.invoices.length > 0 && (
              <SearchSection title="Invoices">
                {results.invoices.map(inv => (
                  <ResultItem
                    key={`invoice-${inv.id}`}
                    title={inv.invoiceNumber}
                    subtitle={inv.customer?.customerName}
                    trailing={`$${inv.amount.toLocaleString()}`}
                    onClick={() => goTo(`/invoices/${inv.id}`)}
                  />
                ))}
              </SearchSection>
            )}

            {results && results.payments.length > 0 && (
              <SearchSection title="Payments">
                {results.payments.map(pay => (
                  <ResultItem
                    key={`payment-${pay.id}`}
                    title={`${pay.paymentMethod} • ${pay.status}`}
                    subtitle={pay.invoice ? `Invoice ${pay.invoice.invoiceNumber}` : undefined}
                    trailing={`$${pay.amount.toLocaleString()}`}
                    onClick={() => goTo(`/invoices/${pay.invoiceId}`)}
                  />
                ))}
              </SearchSection>
            )}

            {results && results.orders.length > 0 && (
              <SearchSection title="Orders">
                {results.orders.map(o => (
                  <ResultItem
                    key={`order-${o.id}`}
                    title={o.orderNumber}
                    subtitle={o.customer?.customerName || o.status}
                    trailing={`$${o.totalAmount.toLocaleString()}`}
                    onClick={() => goTo(`/orders/${o.id}`)}
                  />
                ))}
              </SearchSection>
            )}

            {results && results.purchaseOrders.length > 0 && (
              <SearchSection title="Purchases">
                {results.purchaseOrders.map(po => (
                  <ResultItem
                    key={`po-${po.id}`}
                    title={po.poNumber}
                    subtitle={po.supplier?.name || po.status}
                    trailing={`$${po.totalAmount.toLocaleString()}`}
                    onClick={() => goTo('/purchasing/orders')}
                  />
                ))}
              </SearchSection>
            )}

            {results && results.customers.length > 0 && (
              <SearchSection title="Customers">
                {results.customers.map(c => (
                  <ResultItem
                    key={`customer-${c.id}`}
                    title={c.customerName}
                    onClick={() => goTo(`/customers/${c.id}`)}
                  />
                ))}
              </SearchSection>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <p style={{
        color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.5px', margin: 0, padding: '0.5rem 1.25rem 0.25rem',
      }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function ResultItem({ title, subtitle, trailing, onClick }: { title: string; subtitle?: string; trailing?: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.6rem 1.25rem', cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
        {subtitle && <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem' }}>{subtitle}</p>}
      </div>
      {trailing && <span style={{ color: '#6ee7b7', fontSize: '0.8rem', fontWeight: 700, marginLeft: '0.75rem', flexShrink: 0 }}>{trailing}</span>}
    </div>
  );
}
