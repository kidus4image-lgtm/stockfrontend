'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { showError, showSuccess } from '../../../lib/toast';

interface Customer {
  id: number;
  customerName: string;
}

interface Employee {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
}

interface SystemSettings {
  withholdPercent: number;
  creditGraceDays: number;
  cashGraceDays: number;
}

// Reusable, highly-styled glassmorphic Searchable Dropdown component
function SearchableSelect<T>({
  id,
  options,
  labelKey,
  valueKey,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false
}: {
  id: string;
  options: T[];
  labelKey: (option: T) => string;
  valueKey: keyof T;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Find selected option
  const selectedOption = options.find(opt => String(opt[valueKey]) === value);
  const displayValue = selectedOption ? labelKey(selectedOption) : '';

  // Filter options based on search query
  const filteredOptions = options.filter(opt =>
    labelKey(opt).toLowerCase().includes(search.toLowerCase())
  );

  // Reset search when closed
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  // Click outside detection
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type="text"
          className="form-control"
          style={{
            width: '100%',
            padding: '0.85rem 2.5rem 0.85rem 0.85rem',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            color: '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
            caretColor: isOpen ? '#fff' : 'transparent',
          }}
          placeholder={isOpen ? 'Type to search...' : placeholder}
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            if (isOpen) setSearch(e.target.value);
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              setSearch('');
            }
          }}
          disabled={disabled}
          autoComplete="off"
        />
        
        {/* Chevron Down or Up */}
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          style={{
            position: 'absolute',
            right: '1rem',
            top: '50%',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            fontSize: '0.8rem',
            transition: 'transform 0.2s',
            transformOrigin: 'center',
            transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
          }}
        >
          ▼
        </div>

        {/* Clear selection option inside input for optional fields */}
        {!required && value && !isOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            style={{
              position: 'absolute',
              right: '2.2rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'rgba(244, 63, 94, 0.7)',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Clear selection"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            right: 0,
            maxHeight: '250px',
            overflowY: 'auto',
            background: 'rgba(17, 24, 39, 0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            zIndex: 1000,
            padding: '0.5rem',
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
              No matches found
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = String(option[valueKey]) === value;
              return (
                <div
                  key={String(option[valueKey])}
                  onClick={() => {
                    onChange(String(option[valueKey]));
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    color: isSelected ? '#fff' : '#d1d5db',
                    background: isSelected ? 'var(--accent-hover)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.15s',
                    marginBottom: '2px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = '#fff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#d1d5db';
                    }
                  }}
                >
                  {labelKey(option)}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function NewInvoicePage() {
  const router = useRouter();

  // Form Fields
  const [customerId, setCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [salesRepId, setSalesRepId] = useState('');
  const [salesType, setSalesType] = useState('Credit');
  const [amount, setAmount] = useState('');
  const [includeWithhold, setIncludeWithhold] = useState(false);
  const [fsNumber, setFsNumber] = useState('');
  const [crv, setCrv] = useState('');

  // Loaded lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, empRes, setRes] = await Promise.all([
          apiFetch('http://localhost:5000/api/customers'),
          apiFetch('http://localhost:5000/api/employees'),
          apiFetch('http://localhost:5000/api/settings')
        ]);
        if (custRes.ok) setCustomers(await custRes.json());
        if (empRes.ok) setEmployees(await empRes.json());
        if (setRes.ok) {
          const settingsData = await setRes.json();
          if (settingsData.blockDirectInvoice) {
            setShowBlockedModal(true);
            return;
          }
          setSettings(settingsData);
        }
      } catch (err) {
        console.error('Failed to load data details', err);
      }
    };
    fetchData();

    // Default invoiceDate to today
    const today = new Date().toISOString().split('T')[0];
    setInvoiceDate(today);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Front-end Validations
    if (!customerId) {
      showError('Please select a Customer Account.');
      setLoading(false);
      return;
    }
    if (!invoiceNumber) {
      showError('Please enter an Invoice Number.');
      setLoading(false);
      return;
    }
    if (!invoiceDate) {
      showError('Please select an Invoice Date.');
      setLoading(false);
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      showError('Please enter a valid sales Amount greater than 0.');
      setLoading(false);
      return;
    }

    // Invoice date validation: cannot be greater than today
    const selectedDate = new Date(invoiceDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      showError('Invoice Date cannot be greater than today.');
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch('http://localhost:5000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: parseInt(customerId),
          invoiceNumber,
          invoiceDate,
          salesRepId: salesRepId ? parseInt(salesRepId) : null,
          salesType,
          amount: parseFloat(amount),
          includeWithhold,
          fsNumber: fsNumber || null,
          crv: crv || null
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register invoice');
      }

      showSuccess('Invoice successfully registered in the ledger!');

      // Redirect to invoices list after a brief delay
      setTimeout(() => {
        router.push('/invoices');
      }, 1500);
    } catch (err: any) {
      showError(err.message || 'Connection error registering invoice.');
      setLoading(false);
    }
  };

  // Calculations for display
  const withholdingValue = settings && includeWithhold
    ? (settings.withholdPercent / 100) * parseFloat(amount || '0')
    : 0;

  const initialRemaining = parseFloat(amount || '0') - withholdingValue;

  return (
    <div className="dashboard-container" style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '1050px', // Spacious widescreen layout
        padding: '3rem',
        borderRadius: '24px',
        background: 'rgba(17, 24, 39, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s ease-in-out'
      }}>
        {/* Glow Effects */}
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '300px', height: '300px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '300px', height: '300px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--accent-hover)', fontWeight: 700 }}>Sales Registry</span>
              <h1 className="text-gradient" style={{ fontSize: '2.5rem', margin: '0.25rem 0 0 0', fontWeight: 800 }}>Invoice Entry</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Create a new financial sales record in the system.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2.5rem' }}>
              
              {/* LEFT COLUMN: Header & Verification */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* SECTION 1: Sales Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 700 }}>1. Sales Header</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Identify the customer account and primary billing markers.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-field">
                      <label htmlFor="customerId" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Customer Account *</label>
                      <SearchableSelect
                        id="customerId"
                        options={customers}
                        labelKey={(cust) => cust.customerName}
                        valueKey="id"
                        value={customerId}
                        onChange={setCustomerId}
                        placeholder="-- Choose Customer --"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="salesRepId" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Sales Representative</label>
                      <SearchableSelect
                        id="salesRepId"
                        options={employees}
                        labelKey={(emp) => `${emp.firstName} ${emp.middleName ? emp.middleName + ' ' : ''}${emp.lastName}`}
                        valueKey="id"
                        value={salesRepId}
                        onChange={setSalesRepId}
                        placeholder="-- Choose Sales Rep --"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-field">
                      <label htmlFor="invoiceNumber" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Invoice Number *</label>
                      <input
                        type="text"
                        id="invoiceNumber"
                        className="form-control"
                        style={{ width: '100%', padding: '0.85rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '10px', color: '#fff' }}
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="INV-XXXXXX"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="invoiceDate" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Invoice Date *</label>
                      <input
                        type="date"
                        id="invoiceDate"
                        className="form-control"
                        style={{ width: '100%', padding: '0.85rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '10px', color: '#fff' }}
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Legal Verification */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 700 }}>2. Legal Verification</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Provide mandatory legal references and audit trail codes.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-field">
                      <label htmlFor="fsNumber" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>FS Number (Fiscal Voucher)</label>
                      <input
                        type="text"
                        id="fsNumber"
                        className="form-control"
                        style={{ width: '100%', padding: '0.85rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '10px', color: '#fff' }}
                        value={fsNumber}
                        onChange={(e) => setFsNumber(e.target.value)}
                        placeholder="FS-XXXXXX"
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="crv" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>CRV Number (Receipt Voucher)</label>
                      <input
                        type="text"
                        id="crv"
                        className="form-control"
                        style={{ width: '100%', padding: '0.85rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '10px', color: '#fff' }}
                        value={crv}
                        onChange={(e) => setCrv(e.target.value)}
                        placeholder="CRV-XXXXXX"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Financial Terms & Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* SECTION 3: Financial Terms */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 700 }}>3. Financial Terms</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Define transaction amount, terms of sales, and tax rules.</p>
                  </div>

                  <div className="form-field">
                    <label style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Sales Type</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div
                        onClick={() => setSalesType('Credit')}
                        style={{
                          padding: '0.85rem',
                          borderRadius: '10px',
                          border: `1px solid ${salesType === 'Credit' ? 'var(--accent-hover)' : 'rgba(255,255,255,0.06)'}`,
                          background: salesType === 'Credit' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s',
                          boxShadow: salesType === 'Credit' ? '0 0 10px rgba(59, 130, 246, 0.1)' : 'none'
                        }}
                      >
                        <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>📝</div>
                        <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.9rem' }}>Credit Sales</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{settings?.creditGraceDays || 30} Days credit limit</div>
                      </div>

                      <div
                        onClick={() => setSalesType('Cash')}
                        style={{
                          padding: '0.85rem',
                          borderRadius: '10px',
                          border: `1px solid ${salesType === 'Cash' ? '#10b981' : 'rgba(255,255,255,0.06)'}`,
                          background: salesType === 'Cash' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s',
                          boxShadow: salesType === 'Cash' ? '0 0 10px rgba(16, 185, 129, 0.1)' : 'none'
                        }}
                      >
                        <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>💵</div>
                        <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.9rem' }}>Cash Sales</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{settings?.cashGraceDays || 3} Days clearance</div>
                      </div>
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="amount" style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}>Sales Amount (USD) *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: '600' }}>$</span>
                      <input
                        type="number"
                        id="amount"
                        className="form-control"
                        style={{ width: '100%', padding: '0.85rem 0.85rem 0.85rem 2rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '10px', color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  {/* WITHHOLDING TAX CALCULATION PANEL */}
                  <div style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-color)',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    transition: 'all 0.3s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id="includeWithhold"
                        style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer', accentColor: 'var(--accent-hover)' }}
                        checked={includeWithhold}
                        onChange={(e) => setIncludeWithhold(e.target.checked)}
                      />
                      <label htmlFor="includeWithhold" style={{ cursor: 'pointer', fontWeight: '700', color: '#e5e7eb', userSelect: 'none', fontSize: '0.85rem' }}>
                        Apply corporate withholding tax ({settings?.withholdPercent || 2.0}%)?
                      </label>
                    </div>
                  </div>

                  {/* Audit summary panel */}
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.04)',
                    border: '1px solid rgba(59, 130, 246, 0.15)',
                    padding: '1.25rem',
                    borderRadius: '12px'
                  }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--accent-hover)', fontWeight: 700, fontSize: '0.9rem' }}>⚙️ Ledger Calculations Summary</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Net Remaining Due:</span>
                        <p style={{ fontWeight: '700', color: 'var(--success)', margin: '0.1rem 0 0 0', fontSize: '1.1rem' }}>
                          ${initialRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Withholding Deductions:</span>
                        <p style={{ fontWeight: '700', color: includeWithhold ? 'var(--warning)' : '#fff', margin: '0.1rem 0 0 0', fontSize: '1.1rem' }}>
                          ${withholdingValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Sales Policy Mode:</span>
                        <p style={{ fontWeight: '700', color: '#fff', margin: '0.1rem 0 0 0' }}>{salesType}</p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Grace Timeframe:</span>
                        <p style={{ fontWeight: '700', color: '#fff', margin: '0.1rem 0 0 0' }}>
                          {salesType === 'Credit'
                            ? `${settings?.creditGraceDays || 30} Days credit limit`
                            : `${settings?.cashGraceDays || 3} Days swift clearance`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            <div style={{ height: '5rem' }} />
            <div className="sticky-footer-bar">
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: '700' }}
                disabled={loading}
              >
                {loading ? '⏳ Submitting...' : '💾 Register Invoice'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', width: 'auto' }}
                onClick={() => router.push('/invoices')}
                disabled={loading}
              >
                Cancel
              </button>
            </div>

          </form>
        </div>
      </div>
      
      {/* Dynamic Keyframe Animations inside styled block */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />

      {/* Blocked Modal Overlay */}
      {showBlockedModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '400px', padding: '2rem', textAlign: 'center', borderRadius: '16px', border: '1px solid var(--border-color)', background: '#111827', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: 'var(--danger)', fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 700 }}>Direct Invoice Creation Blocked</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Your system settings require all invoices to be generated from an Order. Please create an Order first, and then convert it into an Invoice.
            </p>
            <button className="btn-primary" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', fontWeight: 700 }} onClick={() => router.push('/invoices')}>
              Return to Invoices
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
