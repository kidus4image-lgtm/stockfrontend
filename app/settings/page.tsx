'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { showError, showSuccess } from '../../lib/toast';
import { confirmAsync } from '../../lib/confirm';
import { useSettings, type DocumentTemplate } from '../../lib/SettingsContext';

interface POSConnection {
  id?: string;
  name: string;
  dbType: 'mssql' | 'mysql';
  server: string;
  port: string;
  user: string;
  password?: string;
  database: string;
  instanceName?: string;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SWATCHES = ['#174f49','#2563eb','#059669','#7c3aed','#dc2626','#d97706','#0891b2','#4f46e5','#0d9488','#b45309'];

interface ComponentSlotProps {
  label: string;
  description: string;
  cssVar: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  preview: (color: string) => React.ReactNode;
}

function ComponentSlot({ label, description, value, onChange, readOnly, preview }: ComponentSlotProps) {
  return (
    <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Preview area */}
      <div style={{ padding: '1rem 1.25rem', minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
        {preview(value)}
      </div>

      {/* Controls */}
      <div style={{ padding: '0.9rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.2rem' }}>{label}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{description}</div>
        </div>

        {/* Color picker row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <input
            type="color"
            value={value}
            onChange={e => !readOnly && onChange(e.target.value)}
            disabled={readOnly}
            style={{ width: '38px', height: '38px', borderRadius: '7px', border: '2px solid var(--border-color)', padding: 0, cursor: readOnly ? 'not-allowed' : 'pointer', flexShrink: 0, background: 'none' }}
          />
          <input
            type="text"
            value={value}
            onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
            disabled={readOnly}
            style={{ flex: 1, padding: '0.4rem 0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontFamily: 'monospace', fontSize: '0.82rem' }}
          />
        </div>

        {/* Quick swatches */}
        {!readOnly && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {SWATCHES.map(hex => (
              <button
                key={hex}
                type="button"
                onClick={() => onChange(hex)}
                style={{
                  width: '22px', height: '22px', borderRadius: '5px', background: hex, border: value === hex ? '2px solid #fff' : '1.5px solid transparent',
                  cursor: 'pointer', transition: 'transform 0.12s', padding: 0,
                  transform: value === hex ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'company' | 'ledger' | 'pos' | 'theme' | 'templates'>('company');
  const { refreshSettings, templates, saveTemplate, deleteTemplate, setDefaultTemplate, settings, uiTheme, updateUITheme, resetUITheme } = useSettings();
  const [readOnly, setReadOnly] = useState(false);
  
  // Ledger Settings State
  const [withholdPercent, setWithholdPercent] = useState('2.0');
  const [creditGraceDays, setCreditGraceDays] = useState('30');
  const [cashGraceDays, setCashGraceDays] = useState('3');
  const [expiryNotificationDays, setExpiryNotificationDays] = useState('60');
  const [expiryDisplayType, setExpiryDisplayType] = useState('long');
  const [blockDirectInvoice, setBlockDirectInvoice] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerSubmitting, setLedgerSubmitting] = useState(false);

  // Company Profile State
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [companySubmitting, setCompanySubmitting] = useState(false);

  // Report Appearance State
  const [reportAccentColor, setReportAccentColor] = useState('#174f49');

  // POS Connections List State
  const [connections, setConnections] = useState<POSConnection[]>([]);
  const [posLoading, setPosLoading] = useState(true);

  // POS Connection Form State
  const [profileId, setProfileId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [dbType, setDbType] = useState<'mssql' | 'mysql'>('mssql');
  const [server, setServer] = useState('');
  const [port, setPort] = useState('1433');
  const [databaseName, setDatabaseName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [instanceName, setInstanceName] = useState('');
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const router = useRouter();

  useEffect(() => {
    // Access control: Only manager role can manage system settings
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      const role = parsedUser.role?.toLowerCase();
      if (role !== 'admin' && role !== 'manager') {
        setReadOnly(true);
      }
    } catch (err) {
      router.push('/login');
      return;
    }

    fetchLedgerSettings();
    fetchPOSConnections();
  }, [router]);

  // Update default port based on Database Type selection
  useEffect(() => {
    if (dbType === 'mysql') {
      setPort('3306');
    } else {
      setPort('1433');
    }
  }, [dbType]);

  const fetchLedgerSettings = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/settings');
      if (res.ok) {
        const data = await res.json();
        setWithholdPercent(data.withholdPercent.toString());
        setCreditGraceDays(data.creditGraceDays.toString());
        setCashGraceDays(data.cashGraceDays.toString());
        setExpiryNotificationDays((data.expiryNotificationDays || 60).toString());
        setExpiryDisplayType(data.expiryDisplayType || 'long');
        setBlockDirectInvoice(data.blockDirectInvoice || false);
        setCompanyName(data.companyName || '');
        setCompanyLogo(data.companyLogo || '');
        setCompanyAddress(data.companyAddress || '');
        setCompanyPhone(data.companyPhone || '');
        setRegistrationNumber(data.registrationNumber || '');
        setReportAccentColor(data.reportAccentColor || '#174f49');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to fetch system configurations.');
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchPOSConnections = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/settings/pos-connections');
      if (res.ok) {
        setConnections(await res.json());
      }
    } catch (err) {
      console.error(err);
      showError('Failed to fetch saved POS connection profiles.');
    } finally {
      setPosLoading(false);
    }
  };

  const handleLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLedgerSubmitting(true);

    try {
      const res = await apiFetch('http://localhost:5000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withholdPercent: parseFloat(withholdPercent),
          creditGraceDays: parseInt(creditGraceDays),
          cashGraceDays: parseInt(cashGraceDays),
          expiryNotificationDays: parseInt(expiryNotificationDays),
          expiryDisplayType,
          blockDirectInvoice
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }
      showSuccess('Ledger configurations successfully saved!');
      await refreshSettings();
    } catch (err: any) {
      showError(err.message || 'Failed to update settings');
    } finally {
      setLedgerSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!server || !databaseName || !username || !password) {
      showError('Please fill Server, Database, Username, and Password to test.');
      return;
    }
    setTestingConnection(true);

    try {
      const res = await apiFetch('http://localhost:5000/api/import/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbType,
          server,
          port: parseInt(port),
          user: username,
          password,
          database: databaseName,
          instanceName: dbType === 'mssql' ? instanceName : undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess('Connection tested successfully! Target POS database is active.');
      } else {
        showError(data.error || 'Connection test failed.');
      }
    } catch (err: any) {
      showError(err.message || 'Connection test failed.');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSavePOSProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName || !server || !databaseName || !username) {
      showError('Please fill all mandatory profile connection fields.');
      return;
    }
    setSavingProfile(true);

    try {
      const payload: POSConnection = {
        id: profileId || undefined,
        name: profileName,
        dbType,
        server,
        port,
        user: username,
        password: password || undefined, // Send password only if typed/modified
        database: databaseName,
        instanceName: dbType === 'mssql' ? instanceName : undefined
      };

      const res = await apiFetch('http://localhost:5000/api/settings/pos-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess(profileId ? 'Connection profile successfully updated!' : 'New POS Connection profile successfully added!');
        clearForm();
        fetchPOSConnections();
      } else {
        showError(data.error || 'Failed to save connection profile.');
      }
    } catch (err: any) {
      showError(err.message || 'Saving connection profile failed.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!(await confirmAsync({ title: 'Delete Profile', message: 'Are you sure you want to permanently delete this POS Connection Profile?', variant: 'danger' }))) return;

    try {
      const res = await apiFetch(`http://localhost:5000/api/settings/pos-connections/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showSuccess('Connection profile successfully deleted!');
        fetchPOSConnections();
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to delete connection profile.');
      }
    } catch (err: any) {
      showError(err.message || 'Request failed.');
    }
  };

  const handleEditProfile = (profile: POSConnection) => {
    setProfileId(profile.id || '');
    setProfileName(profile.name);
    setDbType(profile.dbType);
    setServer(profile.server);
    setPort(profile.port);
    setDatabaseName(profile.database);
    setUsername(profile.user);
    setPassword(''); // Leave password empty unless they want to overwrite it
    setInstanceName(profile.instanceName || '');
  };

  const clearForm = () => {
    setProfileId('');
    setProfileName('');
    setDbType('mssql');
    setServer('');
    setPort('1433');
    setDatabaseName('');
    setUsername('');
    setPassword('');
    setInstanceName('');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showError('Logo file must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCompanyLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanySubmitting(true);

    try {
      const res = await apiFetch('http://localhost:5000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          companyLogo,
          companyAddress,
          companyPhone,
          registrationNumber,
          reportAccentColor
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save company profile');
      }
      showSuccess('Company profile saved successfully!');
      await refreshSettings();
    } catch (err: any) {
      showError(err.message || 'Failed to save.');
    } finally {
      setCompanySubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-main)' }}>
      {/* HEADER */}
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
          System Control Center
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.5rem' }}>
          Configure standard ledger parameters and manage connection integrations for external point-of-sale systems.
        </p>
      </header>

      {readOnly && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1.25rem', borderRadius: '10px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span>🔒</span>
          <span>View only — contact an Admin or Manager to change these settings.</span>
        </div>
      )}

      {/* TABS SELECTOR */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveTab('company')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'company' ? '3px solid var(--accent)' : 'none',
            color: activeTab === 'company' ? '#fff' : 'var(--text-muted)',
            padding: '1rem 1.5rem',
            fontSize: '1.05rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🏢 Company Profile
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'ledger' ? '3px solid var(--accent)' : 'none',
            color: activeTab === 'ledger' ? '#fff' : 'var(--text-muted)',
            padding: '1rem 1.5rem',
            fontSize: '1.05rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ⚙️ Ledger Settings
        </button>
        {!readOnly && (
          <button
            onClick={() => setActiveTab('pos')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'pos' ? '3px solid var(--accent)' : 'none',
              color: activeTab === 'pos' ? '#fff' : 'var(--text-muted)',
              padding: '1rem 1.5rem',
              fontSize: '1.05rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🔌 POS Database Connections
          </button>
        )}
        <button
          onClick={() => setActiveTab('theme')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'theme' ? '3px solid var(--accent)' : 'none',
            color: activeTab === 'theme' ? '#fff' : 'var(--text-muted)',
            padding: '1rem 1.5rem',
            fontSize: '1.05rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🎨 System Theme
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '3px solid var(--accent)' : 'none',
            color: activeTab === 'templates' ? '#fff' : 'var(--text-muted)',
            padding: '1rem 1.5rem',
            fontSize: '1.05rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📄 Report Templates
        </button>
      </div>

      {/* TAB 0: COMPANY PROFILE */}
      {activeTab === 'company' && (
        <div className="form-panel glass-panel" style={{ maxWidth: '680px', borderRadius: '16px', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '1.5rem' }}>Company Profile</h2>

          <form onSubmit={handleCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Logo Upload */}
            <div className="form-field">
              <label style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Company Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                {companyLogo ? (
                  <div style={{ width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border-color)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={companyLogo} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div style={{ width: '100px', height: '100px', borderRadius: '12px', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    No Logo
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {!readOnly && (
                    <>
                      <label
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: 'var(--text-main)',
                          textAlign: 'center'
                        }}
                      >
                        Upload Image
                        <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                      </label>
                      {companyLogo && (
                        <button type="button" onClick={() => setCompanyLogo('')} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer' }}>
                          Remove Logo
                        </button>
                      )}
                    </>
                  )}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Max 2MB. PNG, JPG, or SVG.</span>
                </div>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="companyName" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Company Name</label>
              <input
                type="text"
                id="companyName"
                className="form-control"
                placeholder="Enter your company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={companySubmitting || readOnly}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              />
            </div>

            <div className="form-field">
              <label htmlFor="companyAddress" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Company Address</label>
              <textarea
                id="companyAddress"
                className="form-control"
                placeholder="Enter company address"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                disabled={companySubmitting || readOnly}
                rows={3}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-field">
                <label htmlFor="companyPhone" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Phone Number</label>
                <input
                  type="text"
                  id="companyPhone"
                  className="form-control"
                  placeholder="+251 xxx xxx xxx"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  disabled={companySubmitting || readOnly}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                />
              </div>

              <div className="form-field">
                <label htmlFor="registrationNumber" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Registration / TIN Number</label>
                <input
                  type="text"
                  id="registrationNumber"
                  className="form-control"
                  placeholder="Business Registration #"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  disabled={companySubmitting || readOnly}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                />
              </div>
            </div>

            {!readOnly && (
              <button
                type="submit"
                className="btn-primary"
                disabled={companySubmitting}
                style={{ padding: '0.9rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem' }}
              >
                {companySubmitting ? '🔄 Saving...' : 'Save Company Profile ✓'}
              </button>
            )}
          </form>
        </div>
      )}

      {/* TAB: SYSTEM THEME */}
      {activeTab === 'theme' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* ── Header ── */}
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '0.4rem' }}>System Theme</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Set a color for each UI component individually. Changes apply <strong style={{ color: 'var(--text-main)' }}>instantly</strong> — no save button needed. Report export color is separate and saved to the server.
            </p>
          </div>

          {/* ── Reset all strip ── */}
          {!readOnly && (
            <div className="glass-panel" style={{ padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1 }}>
                Apply one color to all UI component slots at once:
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['#174f49','#2563eb','#059669','#7c3aed','#dc2626','#d97706','#0891b2','#4f46e5'].map(hex => (
                  <button
                    key={hex}
                    type="button"
                    title={`Reset all to ${hex}`}
                    onClick={() => resetUITheme(hex)}
                    style={{ width: '30px', height: '30px', borderRadius: '7px', background: hex, border: '2px solid transparent', cursor: 'pointer', transition: 'transform 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.borderColor = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'transparent'; }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Component Slots Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <ComponentSlot
              label="Primary Button"
              description="Main action buttons and stat card accent bars."
              cssVar="primary"
              value={uiTheme.primary}
              onChange={v => updateUITheme({ primary: v })}
              readOnly={readOnly}
              preview={color => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button type="button" style={{ background: color, color: '#fff', border: 'none', padding: '0.5rem 0.85rem', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', cursor: 'default' }}>
                    Save Changes
                  </button>
                  <div style={{ height: '3px', background: color, borderRadius: '2px', width: '60%' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>stat card accent bar</span>
                </div>
              )}
            />

            <ComponentSlot
              label="Secondary Button"
              description="Outline / ghost buttons for secondary actions."
              cssVar="secondary"
              value={uiTheme.secondary}
              onChange={v => updateUITheme({ secondary: v })}
              readOnly={readOnly}
              preview={color => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button type="button" style={{ background: `${color}18`, color: color, border: `1.5px solid ${color}`, padding: '0.5rem 0.85rem', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', cursor: 'default' }}>
                    Cancel
                  </button>
                  <button type="button" style={{ background: 'transparent', color: color, border: `1.5px solid ${color}`, padding: '0.5rem 0.85rem', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', cursor: 'default' }}>
                    Edit
                  </button>
                </div>
              )}
            />

            <ComponentSlot
              label="Navigation Active"
              description="Sidebar active item highlight, indicator bar, and submenu."
              cssVar="nav"
              value={uiTheme.nav}
              onChange={v => updateUITheme({ nav: v })}
              readOnly={readOnly}
              preview={color => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {['Dashboard', 'Invoices', 'Reports'].map((item, i) => (
                    <div key={item} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.35rem 0.65rem', borderRadius: '6px', position: 'relative',
                      background: i === 0 ? `${color}14` : 'transparent',
                      color: i === 0 ? color : 'var(--text-muted)',
                      border: `1px solid ${i === 0 ? `${color}25` : 'transparent'}`,
                      fontWeight: i === 0 ? 700 : 400, fontSize: '0.8rem',
                    }}>
                      {i === 0 && <div style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: '3px', background: color, borderRadius: '0 3px 3px 0' }} />}
                      <span>{i === 0 ? '📊' : i === 1 ? '🧾' : '📈'}</span>
                      {item}
                    </div>
                  ))}
                </div>
              )}
            />

            <ComponentSlot
              label="Badge / Chip"
              description="Status badges, count chips, and notification indicators."
              cssVar="badge"
              value={uiTheme.badge}
              onChange={v => updateUITheme({ badge: v })}
              readOnly={readOnly}
              preview={color => (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ background: color, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>Active</span>
                  <span style={{ background: `${color}22`, color: color, padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>Soft</span>
                  <span style={{ border: `1px solid ${color}`, color: color, padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>Outline</span>
                  <span style={{ background: color, color: '#fff', padding: '0.15rem 0.45rem', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>3</span>
                </div>
              )}
            />

            <ComponentSlot
              label="Tab Indicator"
              description="Active tab underline across all page navigation bars."
              cssVar="tabIndicator"
              value={uiTheme.tabIndicator}
              onChange={v => updateUITheme({ tabIndicator: v })}
              readOnly={readOnly}
              preview={color => (
                <div>
                  <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color)' }}>
                    {['Overview', 'Details', 'History'].map((tab, i) => (
                      <div key={tab} style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: i === 0 ? 700 : 400,
                        color: i === 0 ? '#fff' : 'var(--text-muted)',
                        borderBottom: i === 0 ? `2.5px solid ${color}` : '2.5px solid transparent',
                        marginBottom: '-1px',
                        cursor: 'default',
                      }}>
                        {tab}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            />
          </div>

          {/* ── Report Export Color (server-saved) ── */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: '0 0 0.25rem' }}>Report Export Color</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                  Used in PDF and print headers. Saved to server — click Save to apply.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    type="color"
                    value={reportAccentColor}
                    onChange={(e) => setReportAccentColor(e.target.value)}
                    disabled={readOnly}
                    style={{ width: '44px', height: '44px', borderRadius: '8px', border: '2px solid var(--border-color)', cursor: readOnly ? 'not-allowed' : 'pointer', padding: 0, background: 'none' }}
                  />
                  <input
                    type="text"
                    value={reportAccentColor}
                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setReportAccentColor(e.target.value); }}
                    disabled={readOnly}
                    style={{ width: '110px', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontFamily: 'monospace', fontSize: '0.9rem' }}
                  />
                </div>
                {/* Mini report preview swatch */}
                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', width: '120px' }}>
                  <div style={{ background: reportAccentColor, padding: '0.4rem 0.6rem' }}>
                    <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>Report Header</span>
                  </div>
                  <div style={{ background: '#fff', padding: '0.3rem 0.6rem' }}>
                    <span style={{ color: reportAccentColor, fontSize: '0.75rem', fontWeight: 800 }}>$12,345</span>
                  </div>
                </div>
                {!readOnly && (
                  <form onSubmit={handleCompanySubmit}>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={companySubmitting}
                      style={{ padding: '0.55rem 1.1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', width: 'auto' }}
                    >
                      {companySubmitting ? 'Saving...' : 'Save ✓'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: LEDGER SETTINGS */}
      {activeTab === 'ledger' && (
        <div className="form-panel glass-panel" style={{ maxWidth: '680px', borderRadius: '16px', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '1.5rem' }}>Ledger & Audit Configurations</h2>

          {ledgerLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Loading ledger settings...
            </div>
          ) : (
            <form onSubmit={handleLedgerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-field">
                <label htmlFor="withholdPercent" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Withholding Tax Percentage (%)</label>
                <input
                  type="number"
                  id="withholdPercent"
                  className="form-control"
                  placeholder="2.0"
                  step="0.01"
                  value={withholdPercent}
                  onChange={(e) => setWithholdPercent(e.target.value)}
                  disabled={ledgerSubmitting || readOnly}
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Standard withholding percentage applied automatically to invoice remaining balances.
                </span>
              </div>

              <div className="form-field">
                <label htmlFor="creditGraceDays" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Credit Sales Grace Period (Days)</label>
                <input
                  type="number"
                  id="creditGraceDays"
                  className="form-control"
                  placeholder="30"
                  value={creditGraceDays}
                  onChange={(e) => setCreditGraceDays(e.target.value)}
                  disabled={ledgerSubmitting || readOnly}
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Standard grace period to settle Credit sales invoices (unless overridden on the Customer profile).
                </span>
              </div>

              <div className="form-field">
                <label htmlFor="cashGraceDays" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Cash Sales Grace Period (Days)</label>
                <input
                  type="number"
                  id="cashGraceDays"
                  className="form-control"
                  placeholder="3"
                  value={cashGraceDays}
                  onChange={(e) => setCashGraceDays(e.target.value)}
                  disabled={ledgerSubmitting || readOnly}
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Default collection threshold before Cash sales are flagged as overdue/critical.
                </span>
              </div>

              <div className="form-field">
                <label htmlFor="expiryNotificationDays" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Expiry Notification Threshold (Days)</label>
                <input
                  type="number"
                  id="expiryNotificationDays"
                  className="form-control"
                  placeholder="60"
                  value={expiryNotificationDays}
                  onChange={(e) => setExpiryNotificationDays(e.target.value)}
                  disabled={ledgerSubmitting || readOnly}
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Products with batches expiring within this many days will appear as expiring soon on the store dashboard. Default: 60 days.
                </span>
              </div>

              <div className="form-field">
                <label htmlFor="expiryDisplayType" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Expiry Date Display Format (Price List)</label>
                <select
                  id="expiryDisplayType"
                  value={expiryDisplayType}
                  onChange={(e) => setExpiryDisplayType(e.target.value)}
                  disabled={ledgerSubmitting || readOnly}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.95rem' }}
                >
                  <option value="long">Long Exp — Full date (e.g. December 31, 2026)</option>
                  <option value="short">Short Exp — Abbreviated (e.g. Dec 2026)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Controls how expiry dates appear on the exported Price List. Long shows the full date; Short shows month and year only.
                </span>
              </div>

              <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="blockDirectInvoice"
                  checked={blockDirectInvoice}
                  onChange={(e) => setBlockDirectInvoice(e.target.checked)}
                  disabled={ledgerSubmitting || readOnly}
                  style={{ width: '1.25rem', height: '1.25rem', cursor: readOnly ? 'not-allowed' : 'pointer' }}
                />
                <label htmlFor="blockDirectInvoice" style={{ fontWeight: '600', cursor: readOnly ? 'default' : 'pointer', margin: 0 }}>
                  Block Creating Invoices Directly (Require Order)
                </label>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '-1rem', marginLeft: '2rem' }}>
                If enabled, users must convert an Order to an Invoice, and cannot create Invoices from scratch.
              </span>

              {!readOnly && (
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={ledgerSubmitting}
                  style={{ padding: '0.9rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem' }}
                >
                  {ledgerSubmitting ? '🔄 Saving configurations...' : 'Save System configurations ✓'}
                </button>
              )}
            </form>
          )}
        </div>
      )}

      {/* TAB 2: POS DATABASE CONNECTIONS */}
      {activeTab === 'pos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* PROFILE CREATION FORM */}
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '1.5rem' }}>
              {profileId ? '✏️ Edit Connection Profile' : '🔌 Add Connection Profile'}
            </h2>

            <form onSubmit={handleSavePOSProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Connection Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Main Cafe POS or Branch B POS"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Database Type *</label>
                  <select
                    value={dbType}
                    onChange={(e) => setDbType(e.target.value as 'mssql' | 'mysql')}
                    style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', height: '38px' }}
                  >
                    <option value="mssql">Microsoft SQL Server</option>
                    <option value="mysql">MySQL Database</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Port *</label>
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Host / Server Address *</label>
                <input
                  type="text"
                  placeholder="e.g. localhost or 192.168.1.10"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              {dbType === 'mssql' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>SQL Server Instance Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. SQLEXPRESS"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                    Leave blank to connect using the default instance.
                  </span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Database Name *</label>
                <input
                  type="text"
                  placeholder="e.g. sales_system"
                  value={databaseName}
                  onChange={(e) => setDatabaseName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Username *</label>
                  <input
                    type="text"
                    placeholder="e.g. sa"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Password *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!profileId} // Required only for new connections
                    style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {testingConnection ? '🔄 Testing...' : '⚡ Test connection'}
                </button>

                <button
                  type="submit"
                  disabled={savingProfile}
                  style={{
                    flex: 1.5,
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {savingProfile ? '🔄 Saving...' : profileId ? 'Update Profile ✓' : 'Save Connection Profile ✓'}
                </button>
              </div>

              {profileId && (
                <button
                  type="button"
                  onClick={clearForm}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    marginTop: '0.25rem'
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </form>
          </div>

          {/* LIST OF SAVED CONNECTIONS */}
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '1.5rem' }}>Active Connections Registry</h2>

            {posLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
                Loading profiles...
              </div>
            ) : connections.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '4rem 2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                <span style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'block' }}>🔌</span>
                <p style={{ fontWeight: '600' }}>No POS connection profiles saved.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Configure connection details in the form to register your first POS device connection.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '550px' }}>
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="glass-panel"
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        {conn.name}
                      </h4>
                      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', alignItems: 'center' }}>
                        <span style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '700', textTransform: 'uppercase' }}>
                          {conn.dbType}
                        </span>
                        <span>•</span>
                        <span>Host: {conn.server}</span>
                        {conn.instanceName && (
                          <>
                            <span>•</span>
                            <span style={{ color: 'var(--warning)', fontWeight: '600' }}>Instance: {conn.instanceName}</span>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        <span>Database: {conn.database}</span>
                        <span style={{ marginLeft: '1rem' }}>User: {conn.user}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleEditProfile(conn)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.12)',
                          border: 'none',
                          color: 'var(--accent)',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(conn.id || '')}
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: 'none',
                          color: 'var(--danger)',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* TAB: REPORT TEMPLATES */}
      {activeTab === 'templates' && (
        <TemplateManagementTab
          templates={templates}
          onSave={saveTemplate}
          onDelete={deleteTemplate}
          onSetDefault={setDefaultTemplate}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

// ─── Template Management Panel ───────────────────────────────────────

interface TemplateFormState {
  id: string;
  name: string;
  description: string;
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showTin: boolean;
  orientation: 'portrait' | 'landscape';
  footerText: string;
  isDefault: boolean;
}

function emptyForm(): TemplateFormState {
  return {
    id: '',
    name: '',
    description: '',
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showTin: true,
    orientation: 'portrait',
    footerText: '',
    isDefault: false,
  };
}

function TemplateManagementTab({
  templates,
  onSave,
  onDelete,
  onSetDefault,
  readOnly,
}: {
  templates: DocumentTemplate[];
  onSave: (t: DocumentTemplate) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  readOnly: boolean;
}) {
  const [form, setForm] = useState<TemplateFormState>(() => emptyForm());
  const [showForm, setShowForm] = useState(false);

  function handleEdit(t: DocumentTemplate) {
    setForm({ ...t });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!(await confirmAsync({ title: 'Delete Template', message: 'Delete this report template permanently?', variant: 'danger' }))) return;
    onDelete(id);
    showSuccess('Template deleted.');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { showError('Template name is required.'); return; }
    const isNew = !form.id;
    onSave({ ...form, id: form.id || generateId() });
    showSuccess(isNew ? 'Template created!' : 'Template updated!');
    setForm(emptyForm());
    setShowForm(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px',
    border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)',
    color: '#fff', fontSize: '0.9rem',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: '700',
    color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem',
  };
  const checkRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: readOnly ? 'default' : 'pointer' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 1fr' : '1fr', gap: '2rem' }}>

      {/* ── Template List ── */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0 }}>Report Templates</h2>
          {!readOnly && (
            <button
              onClick={() => { setForm(emptyForm()); setShowForm(true); }}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              + New Template
            </button>
          )}
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Templates control the <strong style={{ color: 'var(--text-main)' }}>structure</strong> of exported reports — which header fields to show, page orientation, and footer text. The accent color comes from <strong style={{ color: 'var(--text-main)' }}>System Theme</strong>. The <strong style={{ color: 'var(--text-main)' }}>default template</strong> is applied automatically to all exports.
        </p>

        {templates.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '3rem 2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📄</span>
            <p style={{ fontWeight: '600' }}>No report templates yet.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Create a template to customize how exports look across all reports.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {templates.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: `1px solid ${t.isDefault ? 'rgba(23,79,73,0.5)' : 'var(--border-color)'}`,
                  background: t.isDefault ? 'rgba(23,79,73,0.06)' : 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>{t.name}</h4>
                    {t.isDefault && (
                      <span style={{ fontSize: '0.65rem', background: 'rgba(23,79,73,0.3)', color: '#5eead4', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '700', textTransform: 'uppercase' }}>
                        Default
                      </span>
                    )}
                  </div>
                  {t.description && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{t.description}</p>}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{t.orientation}</span>
                    {t.showLogo && <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Logo</span>}
                    {t.showAddress && <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Address</span>}
                    {t.showPhone && <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Phone</span>}
                    {t.showTin && <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>TIN</span>}
                    {t.footerText && <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Custom Footer</span>}
                  </div>
                </div>
                {!readOnly && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
                    {!t.isDefault && (
                      <button
                        onClick={() => { onSetDefault(t.id); showSuccess(`"${t.name}" is now the default template.`); }}
                        style={{ background: 'rgba(23,79,73,0.15)', border: 'none', color: '#5eead4', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(t)}
                      style={{ background: 'rgba(99,102,241,0.12)', border: 'none', color: 'var(--accent)', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      style={{ background: 'rgba(239,68,68,0.12)', border: 'none', color: 'var(--danger)', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Template Form ── */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '1.5rem' }}>
            {form.id ? '✏️ Edit Template' : '➕ New Template'}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label style={labelStyle}>Template Name *</label>
              <input
                type="text"
                placeholder="e.g. Standard Invoice Header"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Description (optional)</label>
              <input
                type="text"
                placeholder="Short description of when to use this template"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Page Orientation</label>
              <select
                value={form.orientation}
                onChange={(e) => setForm(f => ({ ...f, orientation: e.target.value as 'portrait' | 'landscape' }))}
                style={{ ...inputStyle, height: '38px' }}
              >
                <option value="portrait">Portrait (A4)</option>
                <option value="landscape">Landscape (A4)</option>
              </select>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                Accent color is inherited from System Theme.
              </span>
            </div>

            <div>
              <label style={labelStyle}>Header Fields</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                {([
                  ['showLogo', 'Company Logo'],
                  ['showAddress', 'Company Address'],
                  ['showPhone', 'Phone Number'],
                  ['showTin', 'TIN / Registration Number'],
                ] as [keyof TemplateFormState, string][]).map(([key, label]) => (
                  <label key={key} style={checkRowStyle}>
                    <input
                      type="checkbox"
                      checked={form[key] as boolean}
                      onChange={(e) => setForm(f => ({ ...f, [key]: e.target.checked }))}
                      style={{ width: '1rem', height: '1rem' }}
                    />
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Custom Footer Text (optional)</label>
              <input
                type="text"
                placeholder="Leave blank to use default: CompanyName — Inventory Management System"
                value={form.footerText}
                onChange={(e) => setForm(f => ({ ...f, footerText: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <label style={{ ...checkRowStyle, marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                style={{ width: '1rem', height: '1rem' }}
              />
              <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>Set as default template for all exports</span>
            </label>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="submit"
                style={{ flex: 1.5, background: 'var(--accent)', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                {form.id ? 'Update Template ✓' : 'Create Template ✓'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(emptyForm()); }}
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.75rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
