'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { showError, showWarning } from '../../lib/toast';

interface Customer {
  id: number;
  customerName: string;
  tinNumber: string;
}

interface Employee {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
  idNumber: string;
}

interface Department {
  id: number;
  departmentName: string;
}

interface POSConnection {
  id: string;
  name: string;
  dbType: 'mssql' | 'mysql';
  server: string;
  port: string;
  user: string;
  database: string;
  instanceName?: string;
}

interface EnrichedSale {
  SalesId?: number;
  FSInvoiceNumber?: string;
  InvoiceNumber?: string;
  SalesDate: string;
  SalesTotalAmount?: number;
  SalesTotalBeforeTax?: number;
  SalesTotalTax?: number;
  PaymentType?: string;
  BuyerName?: string;
  BuyerTIN?: string;
  WaiterName?: string;
  CashierId?: number;
  WithHoldingTAXAmount?: number;
  
  // Enriched fields from backend
  resolvedCustomer?: { id: number; name: string; tin: string } | null;
  resolvedSalesRep?: { id: number; name: string } | null;
  isAlreadyImported?: boolean;
  
  // Frontend overrides/mappings
  mappedCustomerId?: number;
  mappedCustomerName?: string;
  mappedSalesRepId?: number;
  mappedSalesRepName?: string;
}

export default function POSImportPage() {
  // Profiles State
  const [connections, setConnections] = useState<POSConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [fetchingConnections, setFetchingConnections] = useState(true);

  // Import Progress Modal State
  const [importProgress, setImportProgress] = useState<{
    total: number;
    current: number;
    success: number;
    failed: number;
    active: boolean;
    logs: string[];
  }>({
    total: 0,
    current: 0,
    success: 0,
    failed: 0,
    active: false,
    logs: []
  });
  
  // Date Filters & Fetch State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState('100');
  
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<null | 'success' | 'error'>(null);
  const [connectionError, setConnectionError] = useState('');
  
  // Sales & Selections
  const [sales, setSales] = useState<EnrichedSale[]>([]);
  const [selectedSalesKeys, setSelectedSalesKeys] = useState<Set<string>>(new Set());
  
  // Masters for Mapping
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Mapping Modal State
  const [mappingModal, setMappingModal] = useState<null | {
    type: 'customer' | 'salesRep';
    saleIndex: number;
    record: EnrichedSale;
  }>(null);
  
  const [modalTab, setModalTab] = useState<'match' | 'create'>('match');
  const [mappingSearch, setMappingSearch] = useState('');
  const [isSubmittingMapping, setIsSubmittingMapping] = useState(false);
  const [mappingError, setMappingError] = useState('');
  
  // Form states for creating new entities inside the modal
  const [newCustName, setNewCustName] = useState('');
  const [newCustTin, setNewCustTin] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustContact, setNewCustContact] = useState('');
  const [newCustSalesRepId, setNewCustSalesRepId] = useState('');
  
  const [newEmpFirst, setNewEmpFirst] = useState('');
  const [newEmpMiddle, setNewEmpMiddle] = useState('');
  const [newEmpLast, setNewEmpLast] = useState('');
  const [newEmpIdNum, setNewEmpIdNum] = useState('');
  const [newEmpDeptId, setNewEmpDeptId] = useState('');

  const router = useRouter();

  // Load connection profiles & master data
  useEffect(() => {
    // Access control: Only manager or finance can view or execute imports
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      const roleLower = parsedUser.role?.toLowerCase();
      if (roleLower !== 'admin' && roleLower !== 'manager' && roleLower !== 'finance') {
        showError('Access Denied: Only Admins, Managers, and Finance can access POS imports.');
        router.push('/');
        return;
      }
    } catch (err) {
      router.push('/login');
      return;
    }

    fetchConnections();
    fetchMasters();
  }, [router]);

  const fetchConnections = async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/settings/pos-connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
        if (data.length > 0) {
          // Auto select first connection profile
          setSelectedConnectionId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingConnections(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const custRes = await apiFetch('http://localhost:5000/api/customers');
      if (custRes.ok) setAllCustomers(await custRes.json());
      
      const empRes = await apiFetch('http://localhost:5000/api/employees');
      if (empRes.ok) setAllEmployees(await empRes.json());
      
      const deptRes = await apiFetch('http://localhost:5000/api/departments');
      if (deptRes.ok) setDepartments(await deptRes.json());
    } catch (err) {
      console.error('Failed to fetch master tables', err);
    }
  };

  const selectedProfile = connections.find(c => c.id === selectedConnectionId);

  const handleTestConnection = async () => {
    if (!selectedConnectionId) return;
    setTestingConnection(true);
    setConnectionStatus(null);
    setConnectionError('');
    
    try {
      const res = await apiFetch('http://localhost:5000/api/import/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: selectedConnectionId })
      });
      
      const data = await res.json();
      if (res.ok) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
        setConnectionError(data.error || 'Connection failed');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionError(err.message || 'Connection request failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFetchSales = async () => {
    if (!selectedConnectionId) return;
    setLoading(true);
    setSales([]);
    setSelectedSalesKeys(new Set());
    
    try {
      const res = await apiFetch('http://localhost:5000/api/import/fetch-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          limit: parseInt(limit) || 100
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setSales(data.sales || []);
      } else {
        showError(data.error || 'Failed to fetch sales from selected POS');
      }
    } catch (err: any) {
      showError(err.message || 'Fetch request failed');
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection for a sales record
  const toggleSelectSale = (key: string) => {
    const next = new Set(selectedSalesKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedSalesKeys(next);
  };

  const toggleSelectAll = () => {
    const importableSales = sales.filter(s => !s.isAlreadyImported);
    if (selectedSalesKeys.size === importableSales.length) {
      setSelectedSalesKeys(new Set());
    } else {
      const next = new Set<string>();
      importableSales.forEach(s => {
        const key = s.InvoiceNumber || s.FSInvoiceNumber || '';
        if (key) next.add(key);
      });
      setSelectedSalesKeys(next);
    }
  };

  // Open the unmapped popup
  const openMappingModal = (type: 'customer' | 'salesRep', record: EnrichedSale, index: number) => {
    setMappingModal({ type, saleIndex: index, record });
    setModalTab('match');
    setMappingSearch(type === 'customer' ? record.BuyerName || '' : record.WaiterName || '');
    setMappingError('');
    
    if (type === 'customer') {
      setNewCustName(record.BuyerName || '');
      setNewCustTin(record.BuyerTIN || '');
      setNewCustAddress('');
      setNewCustPhone('');
      setNewCustEmail('');
      setNewCustContact('');
      setNewCustSalesRepId('');
    } else {
      const parts = (record.WaiterName || '').split(' ').filter(Boolean);
      setNewEmpFirst(parts[0] || '');
      setNewEmpMiddle(parts[1] || 'N/A');
      setNewEmpLast(parts.slice(2).join(' ') || 'N/A');
      setNewEmpIdNum(record.CashierId?.toString() || '');
      setNewEmpDeptId('');
    }
  };

  // Perform quick lookup search on masters
  const filteredCustomersLookup = allCustomers.filter(c =>
    c.customerName.toLowerCase().includes(mappingSearch.toLowerCase()) ||
    c.tinNumber.includes(mappingSearch)
  );

  const filteredEmployeesLookup = allEmployees.filter(e =>
    `${e.firstName} ${e.middleName} ${e.lastName}`.toLowerCase().includes(mappingSearch.toLowerCase()) ||
    e.idNumber.includes(mappingSearch)
  );

  // Map to an existing Customer/Employee
  const handleMapExisting = (id: number, name: string) => {
    if (!mappingModal) return;
    
    const updatedSales = [...sales];
    const target = updatedSales[mappingModal.saleIndex];
    
    if (mappingModal.type === 'customer') {
      target.mappedCustomerId = id;
      target.mappedCustomerName = name;
    } else {
      target.mappedSalesRepId = id;
      target.mappedSalesRepName = name;
    }
    
    setSales(updatedSales);
    setMappingModal(null);
  };

  // Create new customer/employee inside mapping popup
  const handleCreateNewEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingModal) return;
    
    setIsSubmittingMapping(true);
    setMappingError('');
    
    try {
      if (mappingModal.type === 'customer') {
        const payload = {
          customerName: newCustName,
          tinNumber: newCustTin,
          address: newCustAddress,
          phoneNumber: newCustPhone,
          emailAddress: newCustEmail,
          contactPerson: newCustContact,
          salesRepId: newCustSalesRepId ? parseInt(newCustSalesRepId) : null,
          waitDays: 30
        };
        
        const res = await apiFetch('http://localhost:5000/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (res.ok) {
          await fetchMasters();
          handleMapExisting(data.id, data.customerName);
        } else {
          setMappingError(data.error || 'Failed to create customer');
        }
      } else {
        const payload = {
          firstName: newEmpFirst,
          middleName: newEmpMiddle,
          lastName: newEmpLast,
          idNumber: newEmpIdNum,
          departmentId: parseInt(newEmpDeptId)
        };
        
        const res = await apiFetch('http://localhost:5000/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (res.ok) {
          await fetchMasters();
          handleMapExisting(data.id, `${data.firstName} ${data.lastName}`);
        } else {
          setMappingError(data.error || 'Failed to create employee');
        }
      }
    } catch (err: any) {
      setMappingError(err.message || 'Creation request failed');
    } finally {
      setIsSubmittingMapping(false);
    }
  };

  // Run Bulk Import Execution
  const handleExecuteImport = async () => {
    if (selectedSalesKeys.size === 0) {
      showWarning('Please select at least one POS sale record to import.');
      return;
    }
    
    const salesToImport = sales.filter(s => {
      const key = s.InvoiceNumber || s.FSInvoiceNumber || '';
      return selectedSalesKeys.has(key);
    });
    
    const unmappedCustomer = salesToImport.find(s => !s.resolvedCustomer && !s.mappedCustomerId && !s.BuyerTIN);
    if (unmappedCustomer) {
      showWarning(`Unable to import. Invoice #${unmappedCustomer.InvoiceNumber || unmappedCustomer.FSInvoiceNumber} has no customer mapping and no Buyer TIN. Please map the customer first.`);
      return;
    }
    
    const payload = salesToImport.map(s => ({
      ...s,
      customerId: s.mappedCustomerId || s.resolvedCustomer?.id,
      salesRepId: s.mappedSalesRepId || s.resolvedSalesRep?.id
    }));
    
    setLoading(true);
    setImportProgress({
      total: payload.length,
      current: 0,
      success: 0,
      failed: 0,
      active: true,
      logs: ['Initializing atomic imports...', `Queueing ${payload.length} invoices for sync...`]
    });
    
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < payload.length; i++) {
      const sale = payload[i];
      const invoiceNum = sale.InvoiceNumber || sale.FSInvoiceNumber || `Record ${i + 1}`;
      
      setImportProgress(prev => ({
        ...prev,
        current: i,
        logs: [...prev.logs, `Syncing invoice #${invoiceNum}...`]
      }));
      
      try {
        const res = await apiFetch('http://localhost:5000/api/import/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sales: [sale] })
        });
        
        const data = await res.json();
        if (res.ok && data.results?.importedCount > 0) {
          successCount++;
          setImportProgress(prev => ({
            ...prev,
            current: i + 1,
            success: successCount,
            logs: [...prev.logs, `✅ Invoice #${invoiceNum} imported successfully.`]
          }));
        } else {
          failedCount++;
          const errorMsg = data.results?.errors?.[0] || data.error || 'Skipped';
          setImportProgress(prev => ({
            ...prev,
            current: i + 1,
            failed: failedCount,
            logs: [...prev.logs, `⚠️ Invoice #${invoiceNum} failed/skipped: ${errorMsg}`]
          }));
        }
      } catch (err: any) {
        failedCount++;
        setImportProgress(prev => ({
          ...prev,
          current: i + 1,
          failed: failedCount,
          logs: [...prev.logs, `❌ Invoice #${invoiceNum} connection error: ${err.message}`]
        }));
      }
    }
    
    setImportProgress(prev => ({
      ...prev,
      current: payload.length,
      logs: [...prev.logs, `🎉 Synchronization complete. Success: ${successCount}, Failed/Skipped: ${failedCount}.`]
    }));
    
    setLoading(false);
    await fetchMasters();
    await handleFetchSales();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', color: 'var(--text-main)' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
            POS Integration Desk
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.5rem' }}>
            Select from saved device profiles to synchronize point-of-sale invoices atomically.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '2rem' }}>
        {/* SIDEBAR CONFIGURATION PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Connection Profile Selection Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔌</span> POS Device Profile
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Connection Profile</label>
                {fetchingConnections ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading saved profiles...</div>
                ) : connections.length === 0 ? (
                  <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: '600', margin: 0 }}>No Profiles Saved</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.5rem 0' }}>Configure connection profiles in System Settings first.</p>
                    <Link
                      href="/settings"
                      style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: '700', textDecoration: 'underline' }}
                    >
                      Go to System Settings →
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedConnectionId}
                    onChange={(e) => {
                      setSelectedConnectionId(e.target.value);
                      setConnectionStatus(null);
                    }}
                    style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', height: '38px' }}
                  >
                    {connections.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.dbType.toUpperCase()})</option>
                    ))}
                  </select>
                )}
              </div>

              {selectedProfile && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Host Address:</span>
                    <span style={{ fontWeight: '600' }}>{selectedProfile.server}</span>
                  </div>
                  {selectedProfile.instanceName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Instance:</span>
                      <span style={{ color: 'var(--warning)', fontWeight: '600' }}>{selectedProfile.instanceName}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Database:</span>
                    <span style={{ fontWeight: '600' }}>{selectedProfile.database}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>DB Type:</span>
                    <span style={{ textTransform: 'uppercase', color: 'var(--accent)', fontWeight: '700' }}>{selectedProfile.dbType}</span>
                  </div>
                </div>
              )}

              {selectedConnectionId && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent)'; }}
                >
                  {testingConnection ? '🔄 Testing...' : '⚡ Test Connection'}
                </button>
              )}

              {connectionStatus === 'success' && (
                <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', textAlign: 'center' }}>
                  ✅ Connection Verified!
                </div>
              )}
              {connectionStatus === 'error' && (
                <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '500' }}>
                  ❌ {connectionError}
                </div>
              )}
            </div>
          </div>

          {/* Date & Filters Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔍</span> Sync Filters
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Sales Date From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Sales Date To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Fetch Limit</label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="50">Last 50 sales</option>
                  <option value="100">Last 100 sales</option>
                  <option value="250">Last 250 sales</option>
                  <option value="500">Last 500 sales</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleFetchSales}
                disabled={loading || !selectedConnectionId}
                style={{
                  background: !selectedConnectionId ? 'rgba(255,255,255,0.05)' : 'var(--accent)',
                  border: 'none',
                  color: !selectedConnectionId ? 'var(--text-muted)' : '#fff',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: !selectedConnectionId ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  marginTop: '0.5rem',
                  boxShadow: selectedConnectionId ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                }}
                onMouseOver={(e) => { if (selectedConnectionId) e.currentTarget.style.background = 'var(--accent-hover)'; }}
                onMouseOut={(e) => { if (selectedConnectionId) e.currentTarget.style.background = 'var(--accent)'; }}
              >
                {loading ? '🔄 Fetching...' : '📥 Fetch POS Sales'}
              </button>
            </div>
          </div>
        </div>

        {/* MAIN DATA PREVIEW SHEET */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>
              Sales Registry Preview ({sales.length} records found)
            </h3>
            
            {sales.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={loading || selectedSalesKeys.size === 0}
                style={{
                  background: 'var(--success)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
              >
                <span>🚀</span> Import Selected ({selectedSalesKeys.size})
              </button>
            )}
          </div>

          {!selectedConnectionId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔌</span>
              <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>No connection profile selected</p>
              <p style={{ fontSize: '0.9rem', width: '380px', textAlign: 'center', marginTop: '0.25rem' }}>
                Please configure and select a device profile on the left sidebar, or create one in the <Link href="/settings" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>System Settings</Link> page.
              </p>
            </div>
          ) : sales.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📥</span>
              <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>No sales fetched yet</p>
              <p style={{ fontSize: '0.9rem', width: '380px', textAlign: 'center', marginTop: '0.25rem' }}>
                Click the <strong>Fetch POS Sales</strong> button on the left to pull latest point-of-sale transactions from the active profile connection.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '700' }}>
                    <th style={{ padding: '1rem', width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={sales.filter(s => !s.isAlreadyImported).length > 0 && selectedSalesKeys.size === sales.filter(s => !s.isAlreadyImported).length}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '1rem' }}>Invoice Details</th>
                    <th style={{ padding: '1rem' }}>POS Customer Info</th>
                    <th style={{ padding: '1rem' }}>SalesRep (POS Waiter)</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, idx) => {
                    const key = sale.InvoiceNumber || sale.FSInvoiceNumber || `pos-sale-${idx}`;
                    const isSelected = selectedSalesKeys.has(key);
                    const isImported = sale.isAlreadyImported;
                    
                    // Customer mapping checks
                    const hasCustMap = !!(sale.resolvedCustomer || sale.mappedCustomerId);
                    const custName = sale.mappedCustomerName || sale.resolvedCustomer?.name || 'Unmapped';
                    const custTin = sale.BuyerTIN || 'N/A';

                    // Sales rep mapping checks
                    const hasRepMap = !!(sale.resolvedSalesRep || sale.mappedSalesRepId);
                    const repName = sale.mappedSalesRepName || sale.resolvedSalesRep?.name || 'Unmapped';
                    const waiterName = sale.WaiterName || 'N/A';
                    
                    const amount = sale.SalesTotalAmount || (sale.SalesTotalBeforeTax || 0) + (sale.SalesTotalTax || 0);

                    return (
                      <tr
                        key={key}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          background: isImported ? 'rgba(255,255,255,0.01)' : isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
                          transition: 'all 0.15s'
                        }}
                      >
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isImported}
                            onChange={() => toggleSelectSale(key)}
                            style={{ cursor: isImported ? 'not-allowed' : 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{sale.InvoiceNumber || sale.FSInvoiceNumber || 'N/A'}</div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            <span>📅 {sale.SalesDate ? new Date(sale.SalesDate).toLocaleDateString() : 'N/A'}</span>
                            <span>•</span>
                            <span style={{
                              color: sale.PaymentType === 'Credit' ? 'var(--warning)' : 'var(--success)',
                              fontWeight: '600'
                            }}>
                              🏷️ {sale.PaymentType || 'Cash'}
                              {sale.PaymentType === 'Credit' && (() => {
                                const saleDate = new Date(sale.SalesDate);
                                const diffMs = Date.now() - saleDate.getTime();
                                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                                if (diffDays > 30) {
                                  return (
                                    <span style={{ color: 'var(--danger)', marginLeft: '0.4rem', fontWeight: '800' }}>
                                      (Overdue - Not Paid)
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {hasCustMap ? (
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)' }}>{custName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                TIN: {custTin} {sale.mappedCustomerId && <span style={{ color: 'var(--accent)', fontWeight: '600' }}>(mapped manually)</span>}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)', fontWeight: '700', fontSize: '0.85rem' }}>
                                ⚠️ Missing Customer
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>POS: {sale.BuyerName || 'Anonymous'} (TIN: {custTin})</div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {hasRepMap ? (
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{repName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                POS: {waiterName} {sale.mappedSalesRepId && <span style={{ color: 'var(--accent)', fontWeight: '600' }}>(mapped)</span>}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--warning)', fontWeight: '700', fontSize: '0.8rem' }}>
                                ⚠️ Unmapped Rep
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>POS Waiter: {waiterName}</div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                          ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {isImported ? (
                            <span style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                              Already Imported
                            </span>
                          ) : hasCustMap ? (
                            <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                              Ready
                            </span>
                          ) : (
                            <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                              Needs Mapping
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {!isImported && (
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => openMappingModal('customer', sale, idx)}
                                style={{
                                  background: 'rgba(99, 102, 241, 0.1)',
                                  border: '1px solid rgba(99, 102, 241, 0.2)',
                                  color: 'var(--accent)',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                              >
                                Map Cust
                              </button>
                              <button
                                type="button"
                                onClick={() => openMappingModal('salesRep', sale, idx)}
                                style={{
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  border: '1px solid rgba(245, 158, 11, 0.2)',
                                  color: 'var(--warning)',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'}
                              >
                                Map Rep
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* POPUP / MODAL FOR MISSING INFO MAPPING */}
      {mappingModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            width: '550px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '2rem',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <button
              onClick={() => setMappingModal(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.25rem',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🛠️</span> Map POS {mappingModal.type === 'customer' ? 'Customer' : 'Sales Representative'}
            </h3>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setModalTab('match')}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'match' ? '2px solid var(--accent)' : 'none',
                  color: modalTab === 'match' ? '#fff' : 'var(--text-muted)',
                  padding: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Match Existing
              </button>
              <button
                type="button"
                onClick={() => setModalTab('create')}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'create' ? '2px solid var(--accent)' : 'none',
                  color: modalTab === 'create' ? '#fff' : 'var(--text-muted)',
                  padding: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Create & Map New
              </button>
            </div>

            {/* ERROR NOTIFICATION */}
            {mappingError && (
              <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: '500' }}>
                ⚠️ {mappingError}
              </div>
            )}

            {/* TAB 1: MATCH EXISTING */}
            {modalTab === 'match' && (
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Select from existing database records to link this POS transaction.
                </p>
                <input
                  type="text"
                  placeholder={`Search by name or code...`}
                  value={mappingSearch}
                  onChange={(e) => setMappingSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: '#fff',
                    marginBottom: '1rem',
                    fontSize: '0.9rem'
                  }}
                />

                <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                  {mappingModal.type === 'customer' ? (
                    filteredCustomersLookup.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No matching customers found</div>
                    ) : (
                      filteredCustomersLookup.map(cust => (
                        <div
                          key={cust.id}
                          onClick={() => handleMapExisting(cust.id, cust.customerName)}
                          style={{
                            padding: '0.6rem 0.8rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        >
                          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{cust.customerName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TIN: {cust.tinNumber}</span>
                        </div>
                      ))
                    )
                  ) : (
                    filteredEmployeesLookup.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No matching sales representatives found</div>
                    ) : (
                      filteredEmployeesLookup.map(emp => (
                        <div
                          key={emp.id}
                          onClick={() => handleMapExisting(emp.id, `${emp.firstName} ${emp.lastName}`)}
                          style={{
                            padding: '0.6rem 0.8rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        >
                          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{emp.firstName} {emp.middleName} {emp.lastName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {emp.idNumber}</span>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CREATE NEW */}
            {modalTab === 'create' && (
              <form onSubmit={handleCreateNewEntity}>
                {mappingModal.type === 'customer' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Customer Name</label>
                      <input
                        type="text"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                      />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>TIN Number</label>
                        <input
                          type="text"
                          value={newCustTin}
                          maxLength={10}
                          onChange={(e) => setNewCustTin(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Phone Number</label>
                        <input
                          type="text"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          placeholder="e.g. +251..."
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Email Address</label>
                      <input
                        type="email"
                        value={newCustEmail}
                        placeholder="e.g. contact@company.com"
                        onChange={(e) => setNewCustEmail(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Address</label>
                      <input
                        type="text"
                        value={newCustAddress}
                        placeholder="e.g. Addis Ababa, Ethiopia"
                        onChange={(e) => setNewCustAddress(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Contact Person</label>
                        <input
                          type="text"
                          value={newCustContact}
                          onChange={(e) => setNewCustContact(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Associated Salesrep</label>
                        <select
                          value={newCustSalesRepId}
                          onChange={(e) => setNewCustSalesRepId(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', height: '36px' }}
                        >
                          <option value="">Select Salesrep</option>
                          {allEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>First Name</label>
                        <input
                          type="text"
                          value={newEmpFirst}
                          onChange={(e) => setNewEmpFirst(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Middle Name</label>
                        <input
                          type="text"
                          value={newEmpMiddle}
                          onChange={(e) => setNewEmpMiddle(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Last Name</label>
                        <input
                          type="text"
                          value={newEmpLast}
                          onChange={(e) => setNewEmpLast(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Employee ID Number</label>
                        <input
                          type="text"
                          value={newEmpIdNum}
                          placeholder="e.g. EMP-001"
                          onChange={(e) => setNewEmpIdNum(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Department</label>
                        <select
                          value={newEmpDeptId}
                          onChange={(e) => setNewEmpDeptId(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', height: '36px' }}
                        >
                          <option value="">Select Department</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.departmentName}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingMapping}
                  style={{
                    width: '100%',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    marginTop: '1.5rem',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent)'}
                >
                  {isSubmittingMapping ? '🔄 Creating & Mapping...' : `✅ Create & Map POS ${mappingModal.type === 'customer' ? 'Customer' : 'Rep'}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      {/* ATOMIC IMPORT PROGRESS MODAL */}
      {importProgress.active && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(10, 10, 18, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100
        }}>
          <div className="glass-panel" style={{
            width: '600px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '2.5rem',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            textAlign: 'center'
          }}>
            <h2 className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0 }}>
              Point of Sale Integration Sync
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Atomically synchronizing POS transactions into Ledger Accounts...
            </p>

            {/* Circular / Linear Progress Bar */}
            <div style={{ margin: '1rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--accent)' }}>
                  Progress: {importProgress.current} / {importProgress.total} Invoices
                </span>
                <span style={{ color: '#fff' }}>
                  {Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%
                </span>
              </div>
              <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div style={{
                  width: `${(importProgress.current / (importProgress.total || 1)) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent) 0%, var(--success) 100%)',
                  borderRadius: '99px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Key KPI Status boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>{importProgress.success}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginTop: '0.2rem' }}>Imported</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.75rem', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--warning)' }}>{importProgress.failed}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginTop: '0.2rem' }}>Failed / Skipped</div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff' }}>{importProgress.total}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginTop: '0.2rem' }}>Total Queue</div>
              </div>
            </div>

            {/* Scrolling Console Output */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Detailed Operation Log</label>
              <div
                style={{
                  height: '180px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '1rem',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: '#34d399',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
                ref={(el) => {
                  if (el) {
                    el.scrollTop = el.scrollHeight;
                  }
                }}
              >
                {importProgress.logs.map((log, lIdx) => (
                  <div key={lIdx} style={{
                    color: log.includes('❌') ? 'var(--danger)' : log.includes('⚠️') ? 'var(--warning)' : log.includes('✅') ? 'var(--success)' : '#34d399'
                  }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Complete / Dismiss Button */}
            <button
              onClick={() => setImportProgress(prev => ({ ...prev, active: false }))}
              disabled={importProgress.current < importProgress.total}
              style={{
                width: '100%',
                background: importProgress.current < importProgress.total ? 'rgba(255,255,255,0.05)' : 'var(--success)',
                color: importProgress.current < importProgress.total ? 'var(--text-muted)' : '#fff',
                border: 'none',
                padding: '0.85rem',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: importProgress.current < importProgress.total ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                marginTop: '0.5rem',
                boxShadow: importProgress.current < importProgress.total ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.3)'
              }}
            >
              {importProgress.current < importProgress.total ? '🔄 Synchronizing Transactions...' : '🎉 Done & Dismiss Sync'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
