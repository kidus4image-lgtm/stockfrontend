'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Legend, Tooltip as RechartsTooltip } from 'recharts';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { showError } from '../../lib/toast';
import ReportExportToolbar from '../../components/ReportExportToolbar';
import ChequeCollectionReports from '../../components/ChequeCollectionReports';
import { type ExportOptions } from '../../lib/exportUtils';

function formatDate(d: string | Date | null): string {
  if (!d) return 'N/A';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface CustomerBreakdown {
  id: number;
  customerName: string;
  tinNumber: string | null;
  totalRemaining: number;
  totalAmount: number;
  invoiceCount: number;
}

interface EmployeeBreakdown {
  id: number;
  employeeName: string;
  idNumber: string;
  totalRemaining: number;
  totalAmount: number;
  invoiceCount: number;
}

interface BankBreakdown {
  bankName: string;
  totalCollected: number;
  totalUncollected: number;
  paymentCount: number;
}

interface Payment {
  id: number;
  amount: number;
  paymentMethod: string;
  bank: string | null;
  chequeNumber: string | null;
  slipNumber: string | null;
  status: string;
  dueDate: string | null;
  receivedDate: string | null;
  createdAt: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  paymentDate: string;
  amount: number;
  remainingPayment: number;
  totalPayed: number;
  uncollectedPayment: number;
  status: string;
  withhold: number | null;
  includeWithhold: boolean | null;
  customer: {
    id: number;
    customerName: string;
    tinNumber: string | null;
  };
  salesRep: {
    id: number;
    firstName: string;
    lastName: string;
    idNumber: string;
  } | null;
  payments: Payment[];
  daysToSettle: number | null;
  daysElapsed: number | null;
  daysOverdue: number | null;
}

interface Summary {
  totalAmount: number;
  totalRemaining: number;
  totalPaid: number;
  totalUncollected: number;
  overdueCount: number;
  invoiceCount: number;
}

interface CollectionPerformance {
  summary: {
    totalSales: number;
    totalCollected: number;
    overallCEI: number;
    avgDaysToCollect: number;
  };
  monthlyData: Array<{
    month: string;
    sales: number;
    collected: number;
    outstanding: number;
    cei: number;
    avgDaysToCollect: number;
    invoiceCount: number;
  }>;
}

interface CustomerAging {
  agingBuckets: Array<{ label: string; total: number; count: number }>;
  customers: any[];
}

interface CommissionData {
  rate: number;
  totalEstimatedCommission: number;
  commissions: any[];
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ marginRight: '1rem' }}>⌛</div>
        Loading Reports Library...
      </div>
    }>
      <ReportsConsole />
    </Suspense>
  );
}

function ReportsConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryType = searchParams.get('type');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  
  // High-level Report Selection
  const [reportType, setReportType] = useState('dashboard');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (queryType) {
      setReportType(queryType);
    }
  }, [queryType]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collectionPerformance, setCollectionPerformance] = useState<CollectionPerformance | null>(null);
  const [customerAging, setCustomerAging] = useState<CustomerAging | null>(null);
  const [commissionData, setCommissionData] = useState<CommissionData | null>(null);

  // Group breakdown active tab for the Executive Dashboard
  const [activeTab, setActiveTab] = useState<'customers' | 'employees' | 'banks'>('customers');

  // Loaded Report Data
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<CustomerBreakdown[]>([]);
  const [employees, setEmployees] = useState<EmployeeBreakdown[]>([]);
  const [banks, setBanks] = useState<BankBreakdown[]>([]);
  const [corporateBanks, setCorporateBanks] = useState<{ id: number; bankName: string }[]>([]);
  
  // Extended Data sets
  const [fullCustomers, setFullCustomers] = useState<any[]>([]);

  // Inventory Report Data
  const [stockOnHand, setStockOnHand] = useState<any[]>([]);
  const [stockOnHandSummary, setStockOnHandSummary] = useState<any>(null);
  const [inventoryMovements, setInventoryMovements] = useState<any[]>([]);
  const [inventoryMovementSummary, setInventoryMovementSummary] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [lowStockSummary, setLowStockSummary] = useState<any>(null);
  const [outOfStock, setOutOfStock] = useState<any[]>([]);
  const [outOfStockSummary, setOutOfStockSummary] = useState<any>(null);
  const [reservedStock, setReservedStock] = useState<any[]>([]);
  const [reservedStockSummary, setReservedStockSummary] = useState<any>(null);
  const [grnData, setGrnData] = useState<any[]>([]);
  const [grnSummary, setGrnSummary] = useState<any>(null);
  const [adjustmentData, setAdjustmentData] = useState<any[]>([]);
  const [adjustmentSummary, setAdjustmentSummary] = useState<any>(null);
  const [expiryReportData, setExpiryReportData] = useState<{ expired: any[], expiringSoon: any[], valid: any[], noExpiry: any[] }>({ expired: [], expiringSoon: [], valid: [], noExpiry: [] });
  const [expirySummary, setExpirySummary] = useState<any>(null);
  const [dailyStockData, setDailyStockData] = useState<any[]>([]);
  const [dailyStockSummary, setDailyStockSummary] = useState<any>(null);


  // Report Accent Color
  const [reportAccentColor, setReportAccentColor] = useState('#174f49');
  const [overdueChequeCount, setOverdueChequeCount] = useState(0);

  // Cheque Collection Report Data
  const [chequesDueToday, setChequesDueToday] = useState<any[]>([]);
  const [chequesDueTodaySummary, setChequesDueTodaySummary] = useState<any>(null);
  const [overdueForDeposit, setOverdueForDeposit] = useState<any[]>([]);
  const [overdueForDepositSummary, setOverdueForDepositSummary] = useState<any>(null);
  const [upcomingMaturity, setUpcomingMaturity] = useState<any[]>([]);
  const [upcomingMaturitySummary, setUpcomingMaturitySummary] = useState<any>(null);
  const [pendingClearance, setPendingClearance] = useState<any[]>([]);
  const [pendingClearanceSummary, setPendingClearanceSummary] = useState<any>(null);
  const [bouncedCheques, setBouncedCheques] = useState<any[]>([]);
  const [bouncedChequesSummary, setBouncedChequesSummary] = useState<any>(null);
  const [collectedThisPeriod, setCollectedThisPeriod] = useState<any[]>([]);
  const [collectedThisPeriodSummary, setCollectedThisPeriodSummary] = useState<any>(null);
  const [cashVsChequeSummary, setCashVsChequeSummary] = useState<any>(null);
  const [cashVsChequeMonthly, setCashVsChequeMonthly] = useState<any[]>([]);
  const [chequeAgingBuckets, setChequeAgingBuckets] = useState<any[]>([]);
  const [chequeAgingSummary, setChequeAgingSummary] = useState<any>(null);
  const [depositBankData, setDepositBankData] = useState<any[]>([]);
  const [bulkPaymentBatches, setBulkPaymentBatches] = useState<any[]>([]);

  // Order Report Data
  const [orderReportData, setOrderReportData] = useState<any[]>([]);
  const [orderReportSummary, setOrderReportSummary] = useState<any>(null);

  // Procurement Report Data
  const [procurementPos, setProcurementPos] = useState<any[]>([]);
  const [procurementSuppliers, setProcurementSuppliers] = useState<any[]>([]);
  const [procurementVariance, setProcurementVariance] = useState<any[]>([]);
  const [procurementPriceHistory, setProcurementPriceHistory] = useState<any[]>([]);
  const [procurementLoading, setProcurementLoading] = useState(false);
  const [selectedPriceProductId, setSelectedPriceProductId] = useState<number | null>(null);

  // Customer Statement / Ledger Data
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerLedgerEntries, setCustomerLedgerEntries] = useState<any[]>([]);
  const [customerLedgerLoading, setCustomerLedgerLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');


  
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Universal search + filter state (cleared on report change)
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  useEffect(() => {
    // Access control: Only manager or finance can view reports
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setCurrentUser(parsedUser);
      const roleLower = parsedUser.role?.toLowerCase();
      if (roleLower !== 'admin' && roleLower !== 'manager' && roleLower !== 'finance' && roleLower !== 'sales_user' && roleLower !== 'store_user') {
        showError('Access Denied: You do not have permission to view reports.');
        router.push('/');
        return;
      }

      // Default the selected report to a matching role-appropriate one on first load
      if (roleLower === 'sales_user') {
        setReportType(prev => (prev === 'executive_dashboard' || prev === 'dashboard') ? 'dashboard' : prev);
      } else if (roleLower === 'finance') {
        setReportType(prev => (prev === 'executive_dashboard' || prev === 'dashboard') ? 'dashboard' : prev);
      }
    } catch (err) {
      router.push('/login');
      return;
    }

    fetchReportData();
  }, [startDate, endDate, overdueOnly, router]);

  // Fetch full customer registry if credit limit / statement / ledger report is selected
  useEffect(() => {
    const needsCustomers = ['credit_limit', 'customer_statement', 'customer_ledger'].includes(reportType);
    if (needsCustomers && fullCustomers.length === 0) {
      apiFetch('http://localhost:5000/api/customers')
        .then(res => res.json())
        .then(data => setFullCustomers(data))
        .catch(console.error);
    }
  }, [reportType, fullCustomers.length]);

  // Fetch customer ledger when a customer is selected
  useEffect(() => {
    if (!selectedCustomerId) return;
    if (reportType !== 'customer_statement' && reportType !== 'customer_ledger') return;
    setCustomerLedgerLoading(true);
    apiFetch(`http://localhost:5000/api/customers/${selectedCustomerId}/ledger`)
      .then(res => res.json())
      .then(data => setCustomerLedgerEntries(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setCustomerLedgerLoading(false));
  }, [selectedCustomerId, reportType]);

  // Fetch reminders if collector reminders report is selected
  useEffect(() => {
    if (reportType === 'collector_reminders') {
      apiFetch('http://localhost:5000/api/reminders')
        .then(res => res.json())
        .then(data => setReminders(data))
        .catch(console.error);
    }
  }, [reportType]);

  // Fetch inventory report data based on report type
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const headers = { 'Authorization': `Bearer ${token}` };
    const params = new URLSearchParams();
    if (startDate) params.append('dateFrom', startDate);
    if (endDate) params.append('dateTo', endDate);

    const inventoryReportTypes = ['stock_on_hand', 'inventory_movement', 'low_stock', 'out_of_stock', 'reserved_stock', 'grn_report', 'inventory_adjustment_report', 'expiry_report', 'daily_stock_in_out'];
    if (!inventoryReportTypes.includes(reportType)) return;

    setLoading(true);
    const baseUrl = 'http://localhost:5000/api/reports';

    const fetchMap: Record<string, string> = {
      stock_on_hand: `${baseUrl}/stock-on-hand`,
      inventory_movement: `${baseUrl}/inventory-movement?${params.toString()}`,
      low_stock: `${baseUrl}/low-stock`,
      out_of_stock: `${baseUrl}/out-of-stock`,
      reserved_stock: `${baseUrl}/reserved-stock`,
      grn_report: `${baseUrl}/grn?${params.toString()}`,
      inventory_adjustment_report: `${baseUrl}/inventory-adjustment?${params.toString()}`,
      expiry_report: `${baseUrl}/expiry`,
      daily_stock_in_out: `${baseUrl}/daily-stock?${params.toString()}`
    };

    apiFetch(fetchMap[reportType])
      .then(res => res.json())
      .then(data => {
        if (reportType === 'stock_on_hand') {
          setStockOnHand(data.stockOnHand || []);
          setStockOnHandSummary(data.summary || null);
        } else if (reportType === 'inventory_movement') {
          setInventoryMovements(data.movements || []);
          setInventoryMovementSummary(data.summary || null);
        } else if (reportType === 'low_stock') {
          setLowStock(data.lowStock || []);
          setLowStockSummary(data.summary || null);
        } else if (reportType === 'out_of_stock') {
          setOutOfStock(data.outOfStock || []);
          setOutOfStockSummary(data.summary || null);
        } else if (reportType === 'reserved_stock') {
          setReservedStock(data.reservedStock || []);
          setReservedStockSummary(data.summary || null);
        } else if (reportType === 'grn_report') {
          setGrnData(data.grnData || []);
          setGrnSummary(data.summary || null);
        } else if (reportType === 'inventory_adjustment_report') {
          setAdjustmentData(data.adjustmentData || []);
          setAdjustmentSummary(data.summary || null);
        } else if (reportType === 'expiry_report') {
          setExpiryReportData({ expired: data.expired || [], expiringSoon: data.expiringSoon || [], valid: data.valid || [], noExpiry: data.noExpiry || [] });
          setExpirySummary(data.summary || null);
        } else if (reportType === 'daily_stock_in_out') {
          setDailyStockData(data.dailyData || []);
          setDailyStockSummary(data.summary || null);
        }
      })
      .catch(err => console.error('Failed to fetch inventory report:', err))
      .finally(() => setLoading(false));
  }, [reportType, startDate, endDate]);

  // Fetch seller report data
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const sellerTypes = ['collection_performance', 'customer_aging', 'commission_estimate'];
    if (!sellerTypes.includes(reportType)) return;
    setLoading(true);
    const baseUrl = 'http://localhost:5000/api/reports/seller';
    const fetchMap: Record<string, string> = {
      collection_performance: `${baseUrl}/collection-performance`,
      customer_aging: `${baseUrl}/customer-aging`,
      commission_estimate: `${baseUrl}/commission-estimate`,
    };
    apiFetch(fetchMap[reportType])
      .then(res => res.json())
      .then(data => {
        if (reportType === 'collection_performance') setCollectionPerformance(data);
        else if (reportType === 'customer_aging') setCustomerAging(data);
        else if (reportType === 'commission_estimate') setCommissionData(data);
      })
      .catch(err => console.error('Failed to fetch seller report:', err))
      .finally(() => setLoading(false));
  }, [reportType]);

  // Fetch cheque collection report data
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const chequeTypes = ['cheques_due_today', 'overdue_for_deposit', 'upcoming_maturity', 'pending_clearance', 'bounced_cheques', 'collected_this_period', 'cash_vs_cheque', 'cheque_aging', 'deposit_bank_breakdown', 'bulk_payment_tracker'];
    if (!chequeTypes.includes(reportType)) return;
    setLoading(true);
    const baseUrl = 'http://localhost:5000/api/reports';
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const fetchMap: Record<string, string> = {
      cheques_due_today: `${baseUrl}/cheques-due-today`,
      overdue_for_deposit: `${baseUrl}/overdue-for-deposit`,
      upcoming_maturity: `${baseUrl}/upcoming-maturity?days=7`,
      pending_clearance: `${baseUrl}/pending-clearance`,
      bounced_cheques: `${baseUrl}/bounced-cheques?${params.toString()}`,
      collected_this_period: `${baseUrl}/collected-this-period?${params.toString()}`,
      cash_vs_cheque: `${baseUrl}/cash-vs-cheque-summary?${params.toString()}`,
      cheque_aging: `${baseUrl}/cheque-aging`,
      deposit_bank_breakdown: `${baseUrl}/deposit-bank-breakdown`,
      bulk_payment_tracker: `${baseUrl}/bulk-payment-tracker`,
    };

    apiFetch(fetchMap[reportType])
      .then(res => res.json())
      .then(data => {
        switch (reportType) {
          case 'cheques_due_today': setChequesDueToday(data.cheques || []); setChequesDueTodaySummary(data.summary || null); break;
          case 'overdue_for_deposit': setOverdueForDeposit(data.cheques || []); setOverdueForDepositSummary(data.summary || null); break;
          case 'upcoming_maturity': setUpcomingMaturity(data.cheques || []); setUpcomingMaturitySummary(data.summary || null); break;
          case 'pending_clearance': setPendingClearance(data.cheques || []); setPendingClearanceSummary(data.summary || null); break;
          case 'bounced_cheques': setBouncedCheques(data.cheques || []); setBouncedChequesSummary(data.summary || null); break;
          case 'collected_this_period': setCollectedThisPeriod(data.cheques || []); setCollectedThisPeriodSummary(data.summary || null); break;
          case 'cash_vs_cheque': setCashVsChequeSummary(data.summary || null); setCashVsChequeMonthly(data.monthly || []); break;
          case 'cheque_aging': setChequeAgingBuckets(data.buckets || []); setChequeAgingSummary(data.summary || null); break;
          case 'deposit_bank_breakdown': setDepositBankData(data.banks || []); break;
          case 'bulk_payment_tracker': setBulkPaymentBatches(data.batches || []); break;
        }
      })
      .catch(err => console.error('Failed to fetch cheque report:', err))
      .finally(() => setLoading(false));
  }, [reportType, startDate, endDate]);

  // Fetch order report data
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const orderReportTypes = ['order_status_breakdown', 'sales_by_customer', 'sales_by_product', 'order_history'];
    if (!orderReportTypes.includes(reportType)) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    apiFetch(`http://localhost:5000/api/reports/orders?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setOrderReportData(data.orders || []);
        setOrderReportSummary(data.summary || null);
      })
      .catch(err => console.error('Failed to fetch order report:', err))
      .finally(() => setLoading(false));
  }, [reportType, startDate, endDate]);

  // Fetch procurement report data
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const procTypes = ['po_status_report', 'supplier_performance', 'grn_po_variance', 'pending_deliveries', 'purchase_price_history'];
    if (!procTypes.includes(reportType)) return;
    setProcurementLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    apiFetch(`http://localhost:5000/api/reports/procurement?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setProcurementPos(data.purchaseOrders || []);
        setProcurementSuppliers(data.supplierPerformance || []);
        setProcurementVariance(data.grnVariance || []);
        setProcurementPriceHistory(data.priceHistory || []);
      })
      .catch(err => console.error('Failed to fetch procurement report:', err))
      .finally(() => setProcurementLoading(false));
  }, [reportType, startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);

    try {
      let url = `http://localhost:5000/api/reports?overdueOnly=${overdueOnly}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await apiFetch(url);
      if (!res.ok) {
        throw new Error('Failed to load requested report data.');
      }

      const data = await res.json();
      setSummary(data.summary);
      setInvoices(data.invoices);
      setCustomers(data.customers);
      setEmployees(data.employees);
      setBanks(data.banks);

      const cbRes = await apiFetch('http://localhost:5000/api/banks');
      if (cbRes.ok) {
        setCorporateBanks(await cbRes.json());
      }
    } catch (err: any) {
      console.error(err);
      showError(err.message || 'Connection failure pulling reports.');
    } finally {
      setLoading(false);
    }
  };

  // --- REPORT DATA TRANSFORMATIONS ---

  // Standard Table Reports
  const filteredInvoices = useMemo(() => {
    let list = [...invoices];
    if (reportType === 'outstanding_invoice') {
      return list.filter(i => i.remainingPayment > 0);
    }
    if (reportType === 'paid_invoice') {
      return list.filter(i => i.status === 'Paid');
    }
    if (reportType === 'overdue_invoice') {
      return list.filter(i => i.remainingPayment > 0 && new Date(i.paymentDate) < new Date());
    }
    if (reportType === 'invoice_due_date') {
      return list.sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
    }
    if (reportType === 'partial_payment') {
      return list.filter(i => i.totalPayed > 0 && i.remainingPayment > 0);
    }
    if (reportType === 'late_analysis') {
      return list.filter(i => i.daysOverdue !== null && i.daysOverdue > 0).sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
    }
    return list;
  }, [invoices, reportType]);

  // Flattened Payments
  const flatPayments = useMemo(() => {
    return invoices.flatMap(inv => 
      (inv.payments || []).map(p => ({
        ...p,
        invoiceNumber: inv.invoiceNumber,
        invoiceId: inv.id,
        customerName: inv.customer.customerName,
        customerId: inv.customer.id,
        salesRep: inv.salesRep
      }))
    ).sort((a, b) => {
      const d1 = new Date(b.receivedDate || b.createdAt).getTime();
      const d2 = new Date(a.receivedDate || a.createdAt).getTime();
      return d1 - d2;
    });
  }, [invoices]);

  // Daily Collection Data
  const dailyCollections = useMemo(() => {
    const map = new Map<string, number>();
    flatPayments.forEach(p => {
      const dateStr = p.receivedDate ? new Date(p.receivedDate).toISOString().split('T')[0] : 'Unknown Date';
      map.set(dateStr, (map.get(dateStr) || 0) + p.amount);
    });
    return Array.from(map.entries()).sort((a,b) => b[0].localeCompare(a[0]));
  }, [flatPayments]);

  // Monthly Collection Data
  const monthlyCollections = useMemo(() => {
    const map = new Map<string, number>();
    flatPayments.forEach(p => {
      const dateStr = p.receivedDate ? new Date(p.receivedDate).toISOString().slice(0, 7) : 'Unknown Month';
      map.set(dateStr, (map.get(dateStr) || 0) + p.amount);
    });
    return Array.from(map.entries()).sort((a,b) => b[0].localeCompare(a[0]));
  }, [flatPayments]);

  // Payment Method Data
  const paymentMethodData = useMemo(() => {
    const map = new Map<string, { count: number, total: number }>();
    flatPayments.forEach(p => {
      const entry = map.get(p.paymentMethod) || { count: 0, total: 0 };
      entry.count++;
      entry.total += p.amount;
      map.set(p.paymentMethod, entry);
    });
    return Array.from(map.entries());
  }, [flatPayments]);

  // Salesperson Collection Performance
  const salespersonPerformance = useMemo(() => {
    const map = new Map<number, { name: string, totalCollected: number, totalInvoiced: number }>();
    invoices.forEach(inv => {
      if (!inv.salesRep) return;
      const id = inv.salesRep.id;
      const entry = map.get(id) || { name: `${inv.salesRep.firstName} ${inv.salesRep.lastName}`, totalCollected: 0, totalInvoiced: 0 };
      entry.totalInvoiced += inv.amount;
      map.set(id, entry);
    });
    flatPayments.forEach(p => {
      if (!p.salesRep || p.status === 'Bounced' || p.status === 'Void') return;
      const id = p.salesRep.id;
      if (map.has(id)) {
        map.get(id)!.totalCollected += p.amount;
      }
    });
    return Array.from(map.values()).sort((a,b) => b.totalCollected - a.totalCollected);
  }, [invoices, flatPayments]);

  // Customer / Salesperson Aging Report Data
  const computeAging = (groupingType: 'customer' | 'salesRep') => {
    const now = new Date().getTime();
    const map = new Map<number, any>();
    
    invoices.forEach(inv => {
      if (inv.remainingPayment <= 0) return;
      
      const targetEntity = groupingType === 'customer' ? inv.customer : inv.salesRep;
      if (!targetEntity && groupingType === 'salesRep') return;
      
      const cId = targetEntity!.id;
      if (!map.has(cId)) {
        map.set(cId, {
          entityName: groupingType === 'customer' ? (targetEntity as any).customerName : `${(targetEntity as any).firstName} ${(targetEntity as any).lastName}`,
          identifier: groupingType === 'customer' ? (targetEntity as any).tinNumber : (targetEntity as any).idNumber,
          current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0
        });
      }
      
      const entry = map.get(cId);
      const payDate = new Date(inv.paymentDate).getTime();
      const diffDays = Math.floor((now - payDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) entry.current += inv.remainingPayment;
      else if (diffDays <= 30) entry.days1_30 += inv.remainingPayment;
      else if (diffDays <= 60) entry.days31_60 += inv.remainingPayment;
      else if (diffDays <= 90) entry.days61_90 += inv.remainingPayment;
      else entry.days90Plus += inv.remainingPayment;
      
      entry.total += inv.remainingPayment;
    });
    
    return Array.from(map.values()).sort((a,b) => b.total - a.total);
  };

  const customerAgingData = useMemo(() => computeAging('customer'), [invoices]);
  const salespersonAgingData = useMemo(() => computeAging('salesRep'), [invoices]);

  // High Risk Customers (60+ days overdue)
  const highRiskCustomers = useMemo(() => {
    return customerAgingData.filter(c => (c.days61_90 + c.days90Plus) > 0).sort((a,b) => (b.days61_90 + b.days90Plus) - (a.days61_90 + a.days90Plus));
  }, [customerAgingData]);

  // Top Debtors (Top 20 by outstanding balance)
  const topDebtors = useMemo(() => {
    return [...customers].sort((a,b) => b.totalRemaining - a.totalRemaining).slice(0, 20);
  }, [customers]);

  // Cash Flow Forecast (Active invoices grouped by future due dates)
  const cashFlowForecast = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    invoices.forEach(inv => {
      if (inv.remainingPayment > 0 && inv.paymentDate) {
        const pDate = new Date(inv.paymentDate);
        if (pDate >= now) {
          const month = pDate.toISOString().slice(0, 7);
          map.set(month, (map.get(month) || 0) + inv.remainingPayment);
        }
      }
    });
    return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]));
  }, [invoices]);

  // Revenue vs Collection
  const revVsCollection = useMemo(() => {
    const map = new Map<string, { revenue: number, collection: number }>();
    invoices.forEach(inv => {
      const m = new Date(inv.invoiceDate).toISOString().slice(0, 7);
      const entry = map.get(m) || { revenue: 0, collection: 0 };
      entry.revenue += inv.amount;
      map.set(m, entry);
    });
    flatPayments.forEach(p => {
      if (p.status !== 'Bounced' && p.status !== 'Void') {
        const m = p.receivedDate ? new Date(p.receivedDate).toISOString().slice(0, 7) : 'Unknown';
        const entry = map.get(m) || { revenue: 0, collection: 0 };
        entry.collection += p.amount;
        map.set(m, entry);
      }
    });
    return Array.from(map.entries()).sort((a,b) => b[0].localeCompare(a[0]));
  }, [invoices, flatPayments]);

  // Customer Payment Behavior
  const paymentBehavior = useMemo(() => {
    const map = new Map<number, { name: string, onTime: number, late: number, active: number }>();
    invoices.forEach(inv => {
      const cId = inv.customer.id;
      const entry = map.get(cId) || { name: inv.customer.customerName, onTime: 0, late: 0, active: 0 };
      if (inv.status === 'Paid') {
        if (inv.daysToSettle !== null && inv.daysToSettle <= 0) entry.onTime++;
        else entry.late++;
      } else {
        entry.active++;
      }
      map.set(cId, entry);
    });
    return Array.from(map.values()).sort((a,b) => (b.late) - (a.late));
  }, [invoices]);

  // Days Sales Outstanding (DSO)
  const dsoData = useMemo(() => {
    const map = new Map<number, { name: string, totalDays: number, count: number }>();
    invoices.forEach(inv => {
      if (inv.status === 'Paid' && inv.daysToSettle !== null) {
        const cId = inv.customer.id;
        const entry = map.get(cId) || { name: inv.customer.customerName, totalDays: 0, count: 0 };
        entry.totalDays += inv.daysToSettle;
        entry.count++;
        map.set(cId, entry);
      }
    });
    return Array.from(map.values()).filter(x => x.count > 0).map(x => ({ ...x, avgDSO: Math.round(x.totalDays / x.count) })).sort((a,b) => b.avgDSO - a.avgDSO);
  }, [invoices]);


  // Invoice Status Summary Data
  const statusSummary = useMemo(() => {
    const stats: Record<string, { count: number, totalAmount: number, totalRemaining: number }> = {
      'Active': { count: 0, totalAmount: 0, totalRemaining: 0 },
      'Overdue': { count: 0, totalAmount: 0, totalRemaining: 0 },
      'Paid': { count: 0, totalAmount: 0, totalRemaining: 0 },
      'Void': { count: 0, totalAmount: 0, totalRemaining: 0 }
    };
    
    invoices.forEach(inv => {
      let bucket = inv.status;
      if (inv.status === 'Active' && inv.remainingPayment > 0 && new Date(inv.paymentDate) < new Date()) {
        bucket = 'Overdue';
      }
      if (!stats[bucket]) stats[bucket] = { count: 0, totalAmount: 0, totalRemaining: 0 };
      
      stats[bucket].count += 1;
      stats[bucket].totalAmount += inv.amount;
      stats[bucket].totalRemaining += inv.remainingPayment;
    });
    
    return Object.entries(stats).map(([status, data]) => ({ status, ...data })).filter(d => d.count > 0);
  }, [invoices]);


  // Order Status Breakdown
  const orderStatusBreakdown = useMemo(() => {
    if (!orderReportSummary?.byStatus) return [];
    return Object.entries(orderReportSummary.byStatus as Record<string, { count: number; total: number }>)
      .map(([status, d]) => ({ status, count: d.count, total: d.total }))
      .sort((a, b) => b.total - a.total);
  }, [orderReportSummary]);

  // Sales by Customer (from order data)
  const salesByCustomer = useMemo(() => {
    const map = new Map<number, { customerName: string; orderCount: number; totalAmount: number; completedAmount: number }>();
    orderReportData.forEach(order => {
      const cId = order.customerId;
      const entry = map.get(cId) || { customerName: order.customerName || order.customer?.customerName || '', orderCount: 0, totalAmount: 0, completedAmount: 0 };
      entry.orderCount++;
      entry.totalAmount += order.totalAmount || 0;
      if (order.status === 'Completed') entry.completedAmount += order.totalAmount || 0;
      map.set(cId, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [orderReportData]);

  // Sales by Product (from order items)
  const salesByProduct = useMemo(() => {
    const map = new Map<number, { productName: string; sku: string; totalQty: number; totalRevenue: number; orderCount: number }>();
    orderReportData.forEach(order => {
      (order.items || []).forEach((item: any) => {
        const pId = item.productId;
        const entry = map.get(pId) || {
          productName: item.product?.productName || item.product?.name || `Product #${pId}`,
          sku: item.product?.sku || '',
          totalQty: 0, totalRevenue: 0, orderCount: 0
        };
        entry.totalQty += item.quantity || 0;
        entry.totalRevenue += (item.quantity || 0) * (item.price || 0);
        entry.orderCount++;
        map.set(pId, entry);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [orderReportData]);

  // WHT (Withholding Tax) Report from invoices
  const whtReportData = useMemo(() => {
    return invoices
      .filter(inv => inv.withhold && inv.withhold > 0)
      .map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        customerName: inv.customer.customerName,
        tinNumber: inv.customer.tinNumber,
        invoiceAmount: inv.amount,
        whtAmount: inv.withhold || 0,
        salesRep: inv.salesRep ? `${inv.salesRep.firstName} ${inv.salesRep.lastName}` : 'N/A',
        status: inv.status,
      }))
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }, [invoices]);

  const whtTotal = useMemo(() => whtReportData.reduce((s, r) => s + r.whtAmount, 0), [whtReportData]);

  // --- SIDEBAR DEFINITION (DYNAMIC BY ROLE) ---
  const reportCategories = useMemo(() => {
    const roleLower = currentUser?.role?.toLowerCase() || 'sales_user';

    if (roleLower === 'sales_user') {
      return [
        {
          category: '📋 Sales Reports',
          reports: [
            { id: 'salesperson_performance', label: '👤 My Performance', desc: 'Personal sales performance metrics' },
            { id: 'order_history', label: '📋 Order History', desc: 'My customer order history' },
            { id: 'collection_performance', label: '💰 Collection Report', desc: 'Monthly collection rates and CEI' },
            { id: 'customer_aging', label: '⏳ Customer Aging', desc: 'Receivables by age bucket' },
            { id: 'commission_estimate', label: '🏆 Commission Estimate', desc: 'Estimated commission on collected amounts' },
            { id: 'outstanding_invoice', label: '⚠️ Outstanding Invoices', desc: 'Active unpaid invoices' },
            { id: 'customer_balance', label: '👥 Customer Balance Summary', desc: 'Total balances by customer' }
          ]
        }
      ];
    }

    if (roleLower === 'store_user') {
      return [
        {
          category: '📦 Store & Inventory Reports',
          reports: [
            { id: 'stock_on_hand', label: '📊 Stock On Hand Report', desc: 'Current stock quantities and values by product' },
            { id: 'inventory_movement', label: '🔄 Inventory Movement Report', desc: 'Stock in, out, and adjustment history' },
            { id: 'low_stock', label: '⚠️ Low Stock Report', desc: 'Products below minimum stock level' },
            { id: 'out_of_stock', label: '🚫 Out of Stock Report', desc: 'Products with zero quantity' },
            { id: 'reserved_stock', label: '🔒 Reserved Stock Report', desc: 'Stock allocated to pending orders' },
            { id: 'grn_report', label: '📥 Goods Receipt (GRN) Report', desc: 'Goods received note history' },
            { id: 'inventory_adjustment_report', label: '🔧 Inventory Adjustment Report', desc: 'All stock adjustments with reasons' },
            { id: 'expiry_report', label: '⏰ Expiry Report', desc: 'Expired and expiring stock by batch' },
            { id: 'daily_stock_in_out', label: '📊 Daily Stock In / Out', desc: 'Daily stock receipts and issues by product' }
          ]
        },
        {
          category: '🏭 Procurement & Supplier Reports',
          reports: [
            { id: 'po_status_report', label: '📋 PO Status Report', desc: 'Purchase orders grouped by status with fulfillment %' },
            { id: 'supplier_performance', label: '🏆 Supplier Performance', desc: 'On-time delivery rate and order value per supplier' },
            { id: 'grn_po_variance', label: '⚖️ GRN vs PO Variance', desc: 'Ordered vs received quantity per product per PO' },
            { id: 'pending_deliveries', label: '🚚 Pending Deliveries', desc: 'Open POs awaiting full receipt' },
            { id: 'purchase_price_history', label: '📈 Purchase Price History', desc: 'Product purchase price over time by supplier' },
          ]
        }
      ];
    }

    if (roleLower === 'finance') {
      return [
        {
          category: '👥 Customer & Ledger Reports',
          reports: [
            { id: 'customer_balance', label: '👥 Customer Balance Summary', desc: 'Total balances by customer' },
            { id: 'customer_aging', label: '⏳ Customer Aging Report', desc: 'Receivables by age bucket' },
            { id: 'customer_statement', label: '📋 Customer Statement', desc: 'Full transaction history with running balance per customer' },
            { id: 'customer_ledger', label: '📓 Customer Ledger Report', desc: 'Double-entry debit/credit ledger with net position per customer' },
          ]
        },
        {
          category: '📄 Invoice Ledger Reports',
          reports: [
            { id: 'invoice_register', label: '🧾 Invoice Register Report', desc: 'All generated invoices' },
            { id: 'ar_detail', label: '📑 AR Detail Report', desc: 'Detailed active receivables' },
            { id: 'outstanding_invoice', label: '⚠️ Outstanding Invoices', desc: 'Unpaid active balances' },
            { id: 'paid_invoice', label: '✅ Paid Invoices', desc: 'Settled accounts' },
            { id: 'overdue_invoice', label: '🚨 Overdue Invoices', desc: 'Past due payments' },
            { id: 'partial_payment', label: '⏱️ Partial Payment Report', desc: 'Partially settled invoices' },
            { id: 'invoice_due_date', label: '📅 Invoice Due Date Report', desc: 'Sorted by deadline' },
          ]
        },
        {
          category: '🏦 Bank Deposit & Recon',
          reports: [
            { id: 'payment_register', label: '💵 Payment Register Report', desc: 'All received payments' },
            { id: 'daily_collection', label: '📆 Daily Collection Report', desc: 'Collections by day' },
            { id: 'monthly_collection', label: '📅 Monthly Collection Report', desc: 'Monthly collection totals' },
            { id: 'payment_method', label: '💳 Payment Method Analytics', desc: 'Distribution by instrument' },
            { id: 'returned_cheque', label: '🔙 Returned Cheque Report', desc: 'Bounced cheque alerts' },
            { id: 'deposit_summary', label: '🏦 Deposit Summary', desc: 'Bank deposit records' },
            { id: 'withholding_tax_recon', label: '📄 Withholding Tax Reconciliation', desc: 'Tax withholding records' },
            { id: 'wht_report', label: '🧾 WHT Report', desc: 'Withholding tax collected per invoice' },
            { id: 'bank_collection', label: '🏦 Bank Collection Report', desc: 'Cleared collections and deposits by bank' },
            { id: 'bank_reconciliation', label: '⚖️ Bank Reconciliation', desc: 'Cleared vs uncleared cheques per bank' },
          ]
        },
        {
          category: '🏦 Cheque Collection & Banking',
          reports: [
            { id: 'cheques_due_today', label: '⏰ Cheques Due Today', desc: 'Cheques maturing today requiring action' },
            { id: 'overdue_for_deposit', label: overdueChequeCount > 0 ? `🔴 Overdue for Deposit (${overdueChequeCount})` : '🚨 Overdue for Deposit', desc: 'Past-due cheques not yet deposited' },
            { id: 'upcoming_maturity', label: '📅 Upcoming Maturity', desc: 'Cheques due within 7/14/30 days' },
            { id: 'pending_clearance', label: '🏛️ Pending Clearance', desc: 'Deposited cheques awaiting bank clearance' },
            { id: 'bounced_cheques', label: '❌ Bounced Cheques', desc: 'Returned cheques with reasons' },
            { id: 'collected_this_period', label: '✅ Collected This Period', desc: 'Successfully cleared cheques' },
            { id: 'cash_vs_cheque', label: '💰 Cash vs Cheque Summary', desc: 'Payment method breakdown' },
            { id: 'cheque_aging', label: '📊 Cheque Aging Report', desc: 'Uncollected cheques by age bucket' },
            { id: 'deposit_bank_breakdown', label: '🏦 Deposit Bank Breakdown', desc: 'Cheques grouped by deposit bank' },
            { id: 'bulk_payment_tracker', label: '📦 Bulk Payment Tracker', desc: 'Batch cheque payment status' },
          ]
        }
      ];
    }

    // Default: admin / manager - full access
    return [
      {
        category: '🛒 Order & Sales Reports',
        reports: [
          { id: 'order_status_breakdown', label: '📊 Order Status Breakdown', desc: 'Orders grouped by status with counts and amounts' },
          { id: 'sales_by_customer', label: '👥 Sales by Customer', desc: 'Total order revenue per customer' },
          { id: 'sales_by_product', label: '📦 Sales by Product/SKU', desc: 'Top selling products by quantity and revenue' },
          { id: 'order_history', label: '📋 Order History', desc: 'Full order history with details' },
        ]
      },
      {
        category: '📊 Executive Dashboards',
        reports: [
          { id: 'executive_dashboard', label: '📊 Executive Dashboard', desc: 'High-level summary of all key metrics' },
          { id: 'cash_forecast', label: '💰 Cash Flow Forecast', desc: 'Expected future cash inflows' },
          { id: 'monthly_trend', label: '📈 Monthly Trend Analysis', desc: 'Revenue trends over time' },
          { id: 'revenue_vs_collection', label: '📊 Revenue vs Collection', desc: 'Comparison of invoiced vs collected' },
          { id: 'dso_report', label: '📅 DSO Report', desc: 'Days Sales Outstanding analysis' },
          { id: 'payment_behavior', label: '💳 Payment Behavior Analysis', desc: 'Customer payment patterns' },
          { id: 'cei_analysis', label: '📊 CEI Analysis', desc: 'Collection Effectiveness Index' },
        ]
      },
      {
        category: '⚠️ Exposure & Debt Control',
        reports: [
          { id: 'high_risk_customer', label: '⚠️ High Risk Customers', desc: 'Customers 60+ days overdue' },
          { id: 'top_debtors', label: '🏆 Top Debtors', desc: 'Largest outstanding balances' },
          { id: 'ar_summary', label: '📊 AR Summary', desc: 'Accounts receivable overview' },
          { id: 'credit_limit', label: '💳 Credit Limit Report', desc: 'Credit limit vs balance exposure' },
        ]
      },
      {
        category: '👥 Representatives & Ledgers',
        reports: [
          { id: 'salesperson_performance', label: '👤 Salesperson Performance', desc: 'Individual collection metrics' },
          { id: 'salesperson_aging', label: '⏳ Salesperson Aging', desc: 'Aging by salesperson' },
          { id: 'salesperson_outstanding', label: '⚠️ Salesperson Outstanding', desc: 'Unpaid by salesperson' },
          { id: 'salesperson_commission', label: '💰 Salesperson Commission', desc: 'Commission calculations' },
          { id: 'customer_balance', label: '👥 Customer Balance Summary', desc: 'Total balances by customer' },
          { id: 'customer_aging', label: '⏳ Customer Aging Report', desc: 'Receivables by age bucket' },
          { id: 'customer_statement', label: '📋 Customer Statement', desc: 'Full transaction history with running balance per customer' },
          { id: 'customer_ledger', label: '📓 Customer Ledger Report', desc: 'Double-entry debit/credit ledger with net position per customer' },
          { id: 'invoice_register', label: '🧾 Invoice Register Report', desc: 'All generated invoices' },
          { id: 'payment_register', label: '💵 Payment Register Report', desc: 'All received payments' },
          { id: 'wht_report', label: '🧾 WHT Report', desc: 'Withholding tax collected per invoice' },
          { id: 'bank_collection', label: '🏦 Bank Collection Report', desc: 'Cleared collections and deposits by bank' },
          { id: 'bank_reconciliation', label: '⚖️ Bank Reconciliation', desc: 'Cleared vs uncleared cheques per bank' },
        ]
      },
      {
        category: '📦 Store & Inventory Reports',
        reports: [
          { id: 'stock_on_hand', label: '📊 Stock On Hand Report', desc: 'Current stock quantities and values by product' },
          { id: 'inventory_movement', label: '🔄 Inventory Movement Report', desc: 'Stock in, out, and adjustment history' },
          { id: 'low_stock', label: '⚠️ Low Stock Report', desc: 'Products below minimum stock level' },
          { id: 'out_of_stock', label: '🚫 Out of Stock Report', desc: 'Products with zero quantity' },
          { id: 'reserved_stock', label: '🔒 Reserved Stock Report', desc: 'Stock allocated to pending orders' },
          { id: 'grn_report', label: '📥 Goods Receipt (GRN) Report', desc: 'Goods received note history' },
          { id: 'inventory_adjustment_report', label: '🔧 Inventory Adjustment Report', desc: 'All stock adjustments with reasons' },
          { id: 'expiry_report', label: '⏰ Expiry Report', desc: 'Expired and expiring stock by batch' },
          { id: 'daily_stock_in_out', label: '📊 Daily Stock In / Out', desc: 'Daily stock receipts and issues by product' },
        ]
      },
      {
        category: '🏭 Procurement & Supplier Reports',
        reports: [
          { id: 'po_status_report', label: '📋 PO Status Report', desc: 'Purchase orders grouped by status with fulfillment %' },
          { id: 'supplier_performance', label: '🏆 Supplier Performance', desc: 'On-time delivery rate and order value per supplier' },
          { id: 'grn_po_variance', label: '⚖️ GRN vs PO Variance', desc: 'Ordered vs received quantity per product per PO' },
          { id: 'pending_deliveries', label: '🚚 Pending Deliveries', desc: 'Open POs awaiting full receipt' },
          { id: 'purchase_price_history', label: '📈 Purchase Price History', desc: 'Product purchase price over time by supplier' },
        ]
      },
      {
        category: '🏦 Cheque Collection & Banking',
        reports: [
          { id: 'cheques_due_today', label: '⏰ Cheques Due Today', desc: 'Cheques maturing today requiring action' },
          { id: 'overdue_for_deposit', label: overdueChequeCount > 0 ? `🔴 Overdue for Deposit (${overdueChequeCount})` : '🚨 Overdue for Deposit', desc: 'Past-due cheques not yet deposited' },
          { id: 'upcoming_maturity', label: '📅 Upcoming Maturity', desc: 'Cheques due within 7/14/30 days' },
          { id: 'pending_clearance', label: '🏛️ Pending Clearance', desc: 'Deposited cheques awaiting bank clearance' },
          { id: 'bounced_cheques', label: '❌ Bounced Cheques', desc: 'Returned cheques with reasons' },
          { id: 'collected_this_period', label: '✅ Collected This Period', desc: 'Successfully cleared cheques' },
          { id: 'cash_vs_cheque', label: '💰 Cash vs Cheque Summary', desc: 'Payment method breakdown' },
          { id: 'cheque_aging', label: '📊 Cheque Aging Report', desc: 'Uncollected cheques by age bucket' },
          { id: 'deposit_bank_breakdown', label: '🏦 Deposit Bank Breakdown', desc: 'Cheques grouped by deposit bank' },
          { id: 'bulk_payment_tracker', label: '📦 Bulk Payment Tracker', desc: 'Batch cheque payment status' },
        ]
      },
    ];
  }, [currentUser, overdueChequeCount]);

  // Auto-expand sidebar category when navigating via URL query param
  useEffect(() => {
    if (queryType && reportCategories.length > 0) {
      const cat = reportCategories.find(c => c.reports.some(r => r.id === queryType))?.category || '';
      if (cat) setExpandedCategories(prev => new Set([...prev, cat]));
    }
  }, [queryType, reportCategories]);


  // --- RENDER HELPERS ---
  const renderPagination = (totalItems: number) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
        <button className="btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Prev</button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Page {currentPage} of {totalPages}</span>
        <button className="btn-secondary" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Next</button>
      </div>
    );
  };

  const renderSearchBar = (
    placeholder: string,
    extras?: React.ReactNode
  ) => {
    const hasSearch = tableSearch.length > 0 || statusFilter || paymentMethodFilter || supplierFilter;
    return (
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '380px' }}>
          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            className="form-control"
            placeholder={placeholder}
            value={tableSearch}
            onChange={e => { setTableSearch(e.target.value); setCurrentPage(1); }}
            style={{ paddingLeft: '2.2rem', paddingRight: tableSearch ? '2rem' : undefined }}
          />
          {tableSearch && (
            <button
              onClick={() => { setTableSearch(''); setCurrentPage(1); }}
              style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1 }}
              title="Clear search"
            >×</button>
          )}
        </div>
        {extras}
        {hasSearch && (
          <button
            onClick={() => { setTableSearch(''); setStatusFilter(''); setPaymentMethodFilter(''); setSupplierFilter(''); setCurrentPage(1); }}
            style={{ padding: '0.45rem 0.8rem', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '6px', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}
          >✕ Clear filters</button>
        )}
      </div>
    );
  };

  const renderInvoiceTable = (invList: Invoice[], title: string, description: string) => {
    const q = tableSearch.toLowerCase();
    const sf = statusFilter;
    const displayed = invList.filter(inv => {
      if (sf && inv.status !== sf) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.customer?.customerName?.toLowerCase().includes(q) ||
        inv.customer?.tinNumber?.toLowerCase().includes(q) ||
        inv.salesRep?.firstName?.toLowerCase().includes(q) ||
        inv.salesRep?.lastName?.toLowerCase().includes(q) ||
        String(inv.amount || '').includes(q)
      );
    });
    const paginatedInvoices = displayed.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const invoiceStatuses = [...new Set(invList.map(i => i.status).filter(Boolean))];
    return (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>{title}</h3>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {tableSearch || statusFilter ? `${displayed.length} of ${invList.length} results` : `${invList.length} records`}
        </span>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{description}</p>

      {displayed.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', padding: '3rem' }}>
          {tableSearch || statusFilter ? 'No invoices match your search.' : 'No invoices found matching this report criteria.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Invoice No</th>
                <th style={{ padding: '1rem 0.75rem' }}>Customer</th>
                <th style={{ padding: '1rem 0.75rem' }}>Due Date</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Remaining</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Days to Pay/Age</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.map((inv) => {
                const isOverdue = inv.remainingPayment > 0 && new Date(inv.paymentDate) < new Date();
                return (
                  <tr key={inv.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>
                      <Link href={`/invoices/${inv.id}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      <div>
                        <strong>{inv.customer.customerName}</strong>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>TIN: {inv.customer.tinNumber || 'N/A'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 0.75rem', color: isOverdue ? '#f87171' : 'var(--text-main)' }}>
                      {formatDate(inv.paymentDate)}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                      ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700', color: inv.remainingPayment > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      ${inv.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>
                      {inv.status === 'Paid' ? (
                        <span style={{ color: '#34d399' }}>✨ {inv.daysToSettle !== null ? `${inv.daysToSettle} days` : '0 days'}</span>
                      ) : (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>⏳ {inv.daysElapsed !== null ? `${inv.daysElapsed} days` : '0 days'}</span>
                          {inv.daysOverdue !== null && <span style={{ display: 'block', color: '#f87171', fontSize: '0.75rem' }}>🚨 {inv.daysOverdue} days</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                      <span style={{
                        background: inv.status === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: inv.status === 'Paid' ? 'var(--success)' : 'var(--warning)',
                        padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600'
                      }}>{inv.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {displayed.length > rowsPerPage && renderPagination(displayed.length)}
    </div>
  )};

  const renderPaymentTable = (paymentList: any[], title: string, description: string) => {
    const q = tableSearch.toLowerCase();
    const pmf = paymentMethodFilter;
    const displayed = paymentList.filter(pmt => {
      if (pmf && pmt.paymentMethod !== pmf) return false;
      if (!q) return true;
      return (
        pmt.invoiceNumber?.toLowerCase().includes(q) ||
        pmt.customerName?.toLowerCase().includes(q) ||
        pmt.paymentMethod?.toLowerCase().includes(q) ||
        pmt.bank?.toLowerCase().includes(q) ||
        pmt.chequeNumber?.toLowerCase().includes(q) ||
        pmt.slipNumber?.toLowerCase().includes(q) ||
        String(pmt.amount || '').includes(q)
      );
    });
    const paginatedPayments = displayed.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const paymentMethods = [...new Set(paymentList.map(p => p.paymentMethod).filter(Boolean))];
    return (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>{title}</h3>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {tableSearch || paymentMethodFilter ? `${displayed.length} of ${paymentList.length} results` : `${paymentList.length} records`}
        </span>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{description}</p>

      {displayed.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', padding: '3rem' }}>
          {tableSearch || paymentMethodFilter ? 'No payments match your search.' : 'No payments found matching this report criteria.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Date</th>
                <th style={{ padding: '1rem 0.75rem' }}>Invoice No</th>
                <th style={{ padding: '1rem 0.75rem' }}>Customer</th>
                <th style={{ padding: '1rem 0.75rem' }}>Method</th>
                <th style={{ padding: '1rem 0.75rem' }}>Bank / Reference</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayments.map((pmt, idx) => (
                <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '1rem 0.75rem' }}>
                    {formatDate(pmt.receivedDate)}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>
                    <Link href={`/invoices/${pmt.invoiceId}`} style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>
                      {pmt.invoiceNumber}
                    </Link>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>
                    {pmt.customerName}
                  </td>
                  <td style={{ padding: '1rem 0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.75rem' }}>
                      {pmt.paymentMethod}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 600 }}>{pmt.bank || 'Cash'}</div>
                    {(pmt.chequeNumber || pmt.slipNumber) && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Ref: {pmt.chequeNumber || pmt.slipNumber}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700', color: pmt.status === 'Bounced' ? 'var(--danger)' : 'var(--success)' }}>
                    ${pmt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                    <span style={{
                      background: pmt.status === 'Collected' ? 'rgba(16, 185, 129, 0.15)' : pmt.status === 'Bounced' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: pmt.status === 'Collected' ? 'var(--success)' : pmt.status === 'Bounced' ? 'var(--danger)' : 'var(--warning)',
                      padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600'
                    }}>{pmt.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {displayed.length > rowsPerPage && renderPagination(displayed.length)}
    </div>
  )};

  // --- INVENTORY REPORT RENDER FUNCTIONS ---

  const filteredStockOnHand = useMemo(() => {
    if (!tableSearch) return stockOnHand;
    const search = tableSearch.toLowerCase();
    return stockOnHand.filter((p: any) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search));
  }, [stockOnHand, tableSearch]);

  const filteredInventoryMovements = useMemo(() => {
    if (!tableSearch) return inventoryMovements;
    const search = tableSearch.toLowerCase();
    return inventoryMovements.filter((m: any) => m.productName.toLowerCase().includes(search) || m.sku.toLowerCase().includes(search));
  }, [inventoryMovements, tableSearch]);

  const filteredLowStock = useMemo(() => {
    if (!tableSearch) return lowStock;
    const search = tableSearch.toLowerCase();
    return lowStock.filter((p: any) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search));
  }, [lowStock, tableSearch]);

  const filteredOutOfStock = useMemo(() => {
    if (!tableSearch) return outOfStock;
    const search = tableSearch.toLowerCase();
    return outOfStock.filter((p: any) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search));
  }, [outOfStock, tableSearch]);

  const filteredReservedStock = useMemo(() => {
    if (!tableSearch) return reservedStock;
    const search = tableSearch.toLowerCase();
    return reservedStock.filter((r: any) => r.productName.toLowerCase().includes(search) || r.sku.toLowerCase().includes(search));
  }, [reservedStock, tableSearch]);

  const filteredGrnData = useMemo(() => {
    if (!tableSearch) return grnData;
    const search = tableSearch.toLowerCase();
    return grnData.filter((g: any) => g.productName.toLowerCase().includes(search) || g.sku.toLowerCase().includes(search));
  }, [grnData, tableSearch]);

  const filteredAdjustmentData = useMemo(() => {
    if (!tableSearch) return adjustmentData;
    const search = tableSearch.toLowerCase();
    return adjustmentData.filter((a: any) => a.productName.toLowerCase().includes(search) || a.sku.toLowerCase().includes(search));
  }, [adjustmentData, tableSearch]);

  const filteredExpiryData = useMemo(() => {
    if (!tableSearch) return expiryReportData;
    const search = tableSearch.toLowerCase();

    const filterList = (list: any[]) => list.filter((item: any) =>
      item.productName?.toLowerCase().includes(search) || item.sku?.toLowerCase().includes(search)
    );

    return {
      expired: filterList(expiryReportData.expired),
      expiringSoon: filterList(expiryReportData.expiringSoon),
      valid: filterList(expiryReportData.valid),
      noExpiry: filterList(expiryReportData.noExpiry)
    };
  }, [expiryReportData, tableSearch]);

  const filteredDailyStock = useMemo(() => {
    if (!tableSearch) return dailyStockData;
    const search = tableSearch.toLowerCase();
    return dailyStockData.filter((d: any) => d.productName.toLowerCase().includes(search) || d.sku.toLowerCase().includes(search));
  }, [dailyStockData, tableSearch]);

  const renderInventorySearch = () => renderSearchBar('Search by product name or SKU…');

  const renderStockOnHand = () => (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Stock On Hand Report</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Current stock quantities and values by product</p>

      {stockOnHandSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--accent-color)' }}>
            <div className="stat-title">Total Products</div>
            <div className="stat-value">{stockOnHandSummary.totalProducts}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
            <div className="stat-title">Total Units</div>
            <div className="stat-value">{stockOnHandSummary.totalUnits.toLocaleString()}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
            <div className="stat-title">Total Value</div>
            <div className="stat-value">${stockOnHandSummary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: stockOnHandSummary.lowStockCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            <div className="stat-title">Low Stock Alerts</div>
            <div className="stat-value">{stockOnHandSummary.lowStockCount}</div>
          </div>
        </div>
      )}


      {filteredStockOnHand.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No stock data found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Product</th>
                <th style={{ padding: '1rem 0.75rem' }}>SKU</th>
                <th style={{ padding: '1rem 0.75rem' }}>Min Stock</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Total Qty</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Avg Cost</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Total Value</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStockOnHand.map((item: any) => {
                const isLow = item.totalQuantity <= item.minStock && item.minStock > 0;
                const isOut = item.totalQuantity === 0;
                return (
                  <tr key={item.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{item.name}</td>
                    <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.sku}</td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>{item.minStock}</td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{item.totalQuantity}</td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>${item.avgCost.toFixed(2)}</td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                      <span style={{
                        background: isOut ? 'rgba(244, 63, 94, 0.15)' : isLow ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)',
                        padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600'
                      }}>{isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filteredStockOnHand.length > 0 && renderPagination(filteredStockOnHand.length)}
    </div>
  );

  const renderInventoryMovement = () => (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Inventory Movement Report</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Stock in, out, and adjustment history</p>

      {inventoryMovementSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--accent-color)' }}>
            <div className="stat-title">Total Movements</div>
            <div className="stat-value">{inventoryMovementSummary.totalMovements}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
            <div className="stat-title">Stock In</div>
            <div className="stat-value">{inventoryMovementSummary.stockInCount}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--danger)' }}>
            <div className="stat-title">Stock Out</div>
            <div className="stat-value">{inventoryMovementSummary.stockOutCount}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
            <div className="stat-title">Adjustments</div>
            <div className="stat-value">{inventoryMovementSummary.adjustmentCount}</div>
          </div>
        </div>
      )}


      {filteredInventoryMovements.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No movement data found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Date</th>
                <th style={{ padding: '1rem 0.75rem' }}>Product</th>
                <th style={{ padding: '1rem 0.75rem' }}>Type</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Qty</th>
                <th style={{ padding: '1rem 0.75rem' }}>Reference</th>
                <th style={{ padding: '1rem 0.75rem' }}>Batch</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventoryMovements.map((m: any, idx: number) => (
                <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '1rem 0.75rem' }}>{formatDate(m.date)}</td>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{m.productName}</td>
                  <td style={{ padding: '1rem 0.75rem' }}>
                    <span style={{
                      background: m.type === 'Stock In' ? 'rgba(16, 185, 129, 0.15)' : m.type === 'Stock Out' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: m.type === 'Stock In' ? 'var(--success)' : m.type === 'Stock Out' ? 'var(--danger)' : 'var(--warning)',
                      padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600'
                    }}>{m.type}</span>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700', color: m.quantity > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{m.reference}</td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{m.batchNumber}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>{m.runningBalance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filteredInventoryMovements.length > 0 && renderPagination(filteredInventoryMovements.length)}
    </div>
  );

  const renderLowStock = () => (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Low Stock Report</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Products below minimum stock level</p>

      {lowStockSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
            <div className="stat-title">Total Low Stock</div>
            <div className="stat-value">{lowStockSummary.totalLowStock}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--danger)' }}>
            <div className="stat-title">Out of Stock</div>
            <div className="stat-value">{lowStockSummary.outOfStockCount}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
            <div className="stat-title">Low Stock</div>
            <div className="stat-value">{lowStockSummary.lowStockCount}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
            <div className="stat-title">Total Deficit</div>
            <div className="stat-value">{lowStockSummary.totalDeficit}</div>
          </div>
        </div>
      )}


      {filteredLowStock.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>All products are adequately stocked.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Product</th>
                <th style={{ padding: '1rem 0.75rem' }}>SKU</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Current Qty</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Min Stock</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Deficit</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLowStock.map((item: any) => (
                <tr key={item.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{item.name}</td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.sku}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700', color: item.currentQuantity === 0 ? 'var(--danger)' : 'var(--warning)' }}>{item.currentQuantity}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>{item.minStock}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--danger)' }}>{item.deficit}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                    <span style={{
                      background: item.status === 'Out of Stock' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: item.status === 'Out of Stock' ? 'var(--danger)' : 'var(--warning)',
                      padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600'
                    }}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filteredLowStock.length > 0 && renderPagination(filteredLowStock.length)}
    </div>
  );

  const renderOutOfStock = () => (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Out of Stock Report</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Products with zero quantity</p>

      {outOfStockSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--danger)' }}>
            <div className="stat-title">Total Out of Stock</div>
            <div className="stat-value">{outOfStockSummary.totalOutOfStock}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
            <div className="stat-title">Products Affected</div>
            <div className="stat-value">{outOfStockSummary.totalOutOfStock}</div>
          </div>
        </div>
      )}


      {filteredOutOfStock.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>All products are in stock.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Product</th>
                <th style={{ padding: '1rem 0.75rem' }}>SKU</th>
                <th style={{ padding: '1rem 0.75rem' }}>Last Received</th>
                <th style={{ padding: '1rem 0.75rem' }}>Last Batch</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutOfStock.map((item: any) => (
                <tr key={item.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{item.name}</td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.sku}</td>
                  <td style={{ padding: '1rem 0.75rem' }}>{item.lastReceivedDate ? formatDate(item.lastReceivedDate) : 'Never'}</td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.lastBatchNumber || 'N/A'}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                    <span style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--danger)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>Out of Stock</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filteredOutOfStock.length > 0 && renderPagination(filteredOutOfStock.length)}
    </div>
  );

  const renderReservedStock = () => (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Reserved Stock Report</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Stock allocated to pending orders</p>

      {reservedStockSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--accent-color)' }}>
            <div className="stat-title">Reserved Items</div>
            <div className="stat-value">{reservedStockSummary.totalReservedItems}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
            <div className="stat-title">Total Reserved Qty</div>
            <div className="stat-value">{reservedStockSummary.totalReservedQty}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
            <div className="stat-title">Reserved Value</div>
            <div className="stat-value">${reservedStockSummary.totalReservedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
            <div className="stat-title">Pending Orders</div>
            <div className="stat-value">{reservedStockSummary.pendingOrders}</div>
          </div>
        </div>
      )}


      {filteredReservedStock.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No reserved stock found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Product</th>
                <th style={{ padding: '1rem 0.75rem' }}>SKU</th>
                <th style={{ padding: '1rem 0.75rem' }}>Batch</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Allocated Qty</th>
                <th style={{ padding: '1rem 0.75rem' }}>Order #</th>
                <th style={{ padding: '1rem 0.75rem' }}>Customer</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservedStock.map((item: any) => (
                <tr key={item.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{item.productName}</td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.sku}</td>
                  <td style={{ padding: '1rem 0.75rem' }}>{item.batchNumber}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{item.allocatedQty}</td>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600', color: 'var(--accent-hover)' }}>{item.orderNumber}</td>
                  <td style={{ padding: '1rem 0.75rem' }}>{item.customerName}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                    <span style={{
                      background: item.orderStatus === 'Pending' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: item.orderStatus === 'Pending' ? 'var(--warning)' : '#3b82f6',
                      padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600'
                    }}>{item.orderStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filteredReservedStock.length > 0 && renderPagination(filteredReservedStock.length)}
    </div>
  );

  const renderGRNReport = () => (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Goods Receipt (GRN) Report</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Goods received note history</p>

      {grnSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--accent-color)' }}>
            <div className="stat-title">Total GRNs</div>
            <div className="stat-value">{grnSummary.totalGRNs}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
            <div className="stat-title">Total Qty Received</div>
            <div className="stat-value">{grnSummary.totalQuantityReceived.toLocaleString()}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
            <div className="stat-title">Total Cost</div>
            <div className="stat-value">${grnSummary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
            <div className="stat-title">Unique Products</div>
            <div className="stat-value">{grnSummary.uniqueProducts}</div>
          </div>
        </div>
      )}


      {filteredGrnData.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No GRN data found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>GRN #</th>
                <th style={{ padding: '1rem 0.75rem' }}>Date</th>
                <th style={{ padding: '1rem 0.75rem' }}>Product</th>
                <th style={{ padding: '1rem 0.75rem' }}>Batch #</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Qty Received</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Unit Cost</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {filteredGrnData.map((item: any, idx: number) => (
                <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600', color: 'var(--accent-hover)' }}>{item.grnNumber}</td>
                  <td style={{ padding: '1rem 0.75rem' }}>{formatDate(item.date)}</td>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{item.productName}</td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.batchNumber}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{item.quantityReceived}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>${item.purchasePrice.toFixed(2)}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>${item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filteredGrnData.length > 0 && renderPagination(filteredGrnData.length)}
    </div>
  );

  const renderExpiryReport = () => {
    const allData = [
      ...filteredExpiryData.expired.map((i: any) => ({ ...i, expiryStatus: 'Expired' })),
      ...filteredExpiryData.expiringSoon.map((i: any) => ({ ...i, expiryStatus: 'Expiring Soon' })),
      ...filteredExpiryData.valid.map((i: any) => ({ ...i, expiryStatus: 'Valid' })),
      ...filteredExpiryData.noExpiry.map((i: any) => ({ ...i, expiryStatus: 'No Expiry' }))
    ];
    const paginated = allData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    return (
      <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Expiry Report</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Batch expiry status tracking — expired, expiring soon, and valid stock</p>

        {expirySummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="stat-card" style={{ borderLeftColor: 'var(--danger)' }}>
              <div className="stat-title">Expired Batches</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{expirySummary.expiredCount}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Value: ${expirySummary.expiredValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
              <div className="stat-title">Expiring Soon (30d)</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{expirySummary.expiringSoonCount}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Value: ${expirySummary.expiringSoonValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
              <div className="stat-title">Valid Batches</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{expirySummary.validCount}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
              <div className="stat-title">No Expiry Date</div>
              <div className="stat-value">{expirySummary.noExpiryCount}</div>
            </div>
          </div>
        )}

  
        {allData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No batch expiry data found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '1rem 0.75rem' }}>Product</th>
                  <th style={{ padding: '1rem 0.75rem' }}>SKU</th>
                  <th style={{ padding: '1rem 0.75rem' }}>Batch #</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '1rem 0.75rem' }}>Expiry Date</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Days Left</th>
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item: any) => {
                  const statusColor = item.expiryStatus === 'Expired' ? 'var(--danger)' : item.expiryStatus === 'Expiring Soon' ? 'var(--warning)' : item.expiryStatus === 'Valid' ? 'var(--success)' : 'var(--text-muted)';
                  const statusBg = item.expiryStatus === 'Expired' ? 'rgba(244, 63, 94, 0.15)' : item.expiryStatus === 'Expiring Soon' ? 'rgba(245, 158, 11, 0.15)' : item.expiryStatus === 'Valid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)';
                  const days = item.daysUntilExpiry;
                  const daysDisplay = days !== null ? (days < 0 ? `${Math.abs(days)} days ago` : `${days} days`) : '—';
                  return (
                    <tr key={item.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{item.productName}</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.sku}</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.batchNumber}</td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{item.quantity}</td>
                      <td style={{ padding: '1rem 0.75rem' }}>{item.expiryDate ? formatDate(item.expiryDate) : '—'}</td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '600', color: days !== null && days < 0 ? 'var(--danger)' : days !== null && days <= 30 ? 'var(--warning)' : 'var(--text-muted)' }}>{daysDisplay}</td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ background: statusBg, color: statusColor, padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>{item.expiryStatus}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {allData.length > 0 && renderPagination(allData.length)}
      </div>
    );
  };

  const renderInventoryAdjustmentReport = () => (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Inventory Adjustment Report</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>All stock adjustments with reasons</p>

      {adjustmentSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--accent-color)' }}>
            <div className="stat-title">Total Adjustments</div>
            <div className="stat-value">{adjustmentSummary.totalAdjustments}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
            <div className="stat-title">Additions</div>
            <div className="stat-value">{adjustmentSummary.additionsCount}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--danger)' }}>
            <div className="stat-title">Reductions</div>
            <div className="stat-value">{adjustmentSummary.reductionsCount}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
            <div className="stat-title">Qty Added / Reduced</div>
            <div className="stat-value">+{adjustmentSummary.totalQuantityAdded} / -{adjustmentSummary.totalQuantityReduced}</div>
          </div>
        </div>
      )}


      {filteredAdjustmentData.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No adjustment data found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Date</th>
                <th style={{ padding: '1rem 0.75rem' }}>Product</th>
                <th style={{ padding: '1rem 0.75rem' }}>Batch</th>
                <th style={{ padding: '1rem 0.75rem' }}>Type</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Qty Changed</th>
                <th style={{ padding: '1rem 0.75rem' }}>Reason</th>
                <th style={{ padding: '1rem 0.75rem' }}>Adjusted By</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdjustmentData.map((item: any) => (
                <tr key={item.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '1rem 0.75rem' }}>{formatDate(item.date)}</td>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{item.productName}</td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.batchNumber}</td>
                  <td style={{ padding: '1rem 0.75rem' }}>
                    <span style={{
                      background: item.adjustmentType === 'Addition' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      color: item.adjustmentType === 'Addition' ? 'var(--success)' : 'var(--danger)',
                      padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600'
                    }}>{item.adjustmentType}</span>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700', color: item.adjustmentType === 'Addition' ? 'var(--success)' : 'var(--danger)' }}>
                    {item.adjustmentType === 'Addition' ? '+' : '-'}{item.quantityChanged}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.reason}</td>
                  <td style={{ padding: '1rem 0.75rem' }}>{item.adjustedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filteredAdjustmentData.length > 0 && renderPagination(filteredAdjustmentData.length)}
    </div>
  );

  const renderDailyStockInOut = () => (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Daily Stock In / Out Report</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Daily stock receipts and issues by product. Use the date range filter above to select a period.</p>

      {dailyStockSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--accent-color)' }}>
            <div className="stat-title">Active Days</div>
            <div className="stat-value">{dailyStockSummary.totalDays}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
            <div className="stat-title">Total Stock In</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{dailyStockSummary.totalIn}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--danger)' }}>
            <div className="stat-title">Total Stock Out</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{dailyStockSummary.totalOut}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: dailyStockSummary.netChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            <div className="stat-title">Net Change</div>
            <div className="stat-value" style={{ color: dailyStockSummary.netChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {dailyStockSummary.netChange >= 0 ? '+' : ''}{dailyStockSummary.netChange}
            </div>
          </div>
        </div>
      )}


      {filteredDailyStock.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No stock movements found for this period.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Date</th>
                <th style={{ padding: '1rem 0.75rem' }}>Product</th>
                <th style={{ padding: '1rem 0.75rem' }}>SKU</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--success)' }}>Stock In</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--danger)' }}>Stock Out</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Net Change</th>
              </tr>
            </thead>
            <tbody>
              {filteredDailyStock.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((item: any, idx: number) => {
                const net = item.qtyIn - item.qtyOut;
                return (
                  <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '1rem 0.75rem' }}>{item.date}</td>
                    <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{item.productName}</td>
                    <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{item.sku}</td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>{item.qtyIn || '-'}</td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700', color: 'var(--danger)' }}>{item.qtyOut || '-'}</td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '700', color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {net >= 0 ? '+' : ''}{net}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filteredDailyStock.length > 0 && renderPagination(filteredDailyStock.length)}
    </div>
  );

  // ─── Export Configuration per Report Type ────────────────────────
  const getReportExportConfig = useMemo((): ExportOptions | null => {
    const reportLabel = reportCategories.flatMap(c => c.reports).find(r => r.id === reportType)?.label?.replace(/^[^\s]+\s/, '') || 'Report';

    const activeFilters: { label: string; value: string }[] = [];
    if (startDate) activeFilters.push({ label: 'From', value: startDate });
    if (endDate) activeFilters.push({ label: 'To', value: endDate });
    if (overdueOnly) activeFilters.push({ label: 'Filter', value: 'Overdue Invoices Only' });
    if (tableSearch) activeFilters.push({ label: 'Search', value: tableSearch });
    if (statusFilter) activeFilters.push({ label: 'Status', value: statusFilter.replace(/_/g, ' ') });
    if (paymentMethodFilter) activeFilters.push({ label: 'Method', value: paymentMethodFilter });
    if (supplierFilter) activeFilters.push({ label: 'Supplier', value: supplierFilter });

    const base = {
      title: reportLabel,
      filename: `${reportType}_${new Date().toISOString().slice(0, 10)}`,
      filters: activeFilters.length > 0 ? activeFilters : undefined,
    };

    // ── Filter helpers — mirror the inline render logic exactly ──
    const q = tableSearch.toLowerCase();
    const sf = statusFilter;
    const pmf = paymentMethodFilter;

    const applyInvoiceFilter = (list: any[]) => list.filter((inv: any) => {
      if (sf && inv.status !== sf) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.customer?.customerName?.toLowerCase().includes(q) ||
        inv.customer?.tinNumber?.toLowerCase().includes(q) ||
        inv.salesRep?.firstName?.toLowerCase().includes(q) ||
        inv.salesRep?.lastName?.toLowerCase().includes(q) ||
        String(inv.amount || '').includes(q)
      );
    });

    const applyPaymentFilter = (list: any[]) => list.filter((pmt: any) => {
      if (pmf && pmt.paymentMethod !== pmf) return false;
      if (!q) return true;
      return (
        pmt.invoiceNumber?.toLowerCase().includes(q) ||
        pmt.customerName?.toLowerCase().includes(q) ||
        pmt.paymentMethod?.toLowerCase().includes(q) ||
        pmt.bank?.toLowerCase().includes(q) ||
        pmt.chequeNumber?.toLowerCase().includes(q) ||
        pmt.slipNumber?.toLowerCase().includes(q) ||
        String(pmt.amount || '').includes(q)
      );
    });

    const applySearch = (list: any[], ...fields: string[]) => {
      if (!q) return list;
      return list.filter((item: any) => fields.some(f => String(item[f] ?? '').toLowerCase().includes(q)));
    };

    const applyOrderFilter = (list: any[]) => list.filter((o: any) => {
      if (sf && o.status !== sf) return false;
      if (!q) return true;
      return (
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        `${o.salesRep?.firstName || ''} ${o.salesRep?.lastName || ''}`.toLowerCase().includes(q)
      );
    });

    switch (reportType) {
      case 'executive_dashboard':
        return {
          ...base,
          columns: [
            { key: 'label', label: 'Metric' },
            { key: 'value', label: 'Value', align: 'right' },
          ],
          data: summary ? [
            { label: 'Total Invoiced', value: `$${summary.totalAmount.toLocaleString()}` },
            { label: 'Outstanding', value: `$${summary.totalRemaining.toLocaleString()}` },
            { label: 'Settled', value: `$${summary.totalPaid.toLocaleString()}` },
            { label: 'Uncollected', value: `$${summary.totalUncollected.toLocaleString()}` },
          ] : [],
          summary: summary ? [
            { label: 'Total Invoiced', value: `$${summary.totalAmount.toLocaleString()}` },
            { label: 'Outstanding', value: `$${summary.totalRemaining.toLocaleString()}` },
          ] : undefined,
        };
      case 'outstanding_invoice':
      case 'paid_invoice':
      case 'overdue_invoice':
      case 'partial_payment':
      case 'invoice_due_date':
      case 'invoice_register':
      case 'ar_detail':
      case 'late_analysis':
        return {
          ...base,
          columns: [
            { key: 'invoiceNumber', label: 'Invoice #' },
            { key: 'customerName', label: 'Customer' },
            { key: 'invoiceDate', label: 'Date', format: (v) => formatDate(v) },
            { key: 'amount', label: 'Amount', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'totalPayed', label: 'Paid', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'remainingPayment', label: 'Remaining', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'status', label: 'Status' },
            { key: 'salesType', label: 'Type' },
          ],
          data: (() => { const d = applyInvoiceFilter(filteredInvoices); return d; })(),
          summary: (() => { const d = applyInvoiceFilter(filteredInvoices); return [
            { label: 'Total Invoices', value: d.length },
            { label: 'Total Amount', value: `$${d.reduce((s: number, i: any) => s + (i.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { label: 'Total Remaining', value: `$${d.reduce((s: number, i: any) => s + (i.remainingPayment || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ]; })(),
        };
      case 'customer_balance':
        return {
          ...base,
          columns: [
            { key: 'customerName', label: 'Customer' },
            { key: 'tinNumber', label: 'TIN' },
            { key: 'totalAmount', label: 'Total Invoiced', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'totalRemaining', label: 'Balance Due', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'invoiceCount', label: 'Invoices', align: 'center' },
          ],
          data: applySearch(customers, 'customerName', 'tinNumber'),
        };
      case 'payment_register':
      case 'deposit_summary':
      case 'returned_cheque':
        return {
          ...base,
          columns: [
            { key: 'invoiceNumber', label: 'Invoice #' },
            { key: 'customerName', label: 'Customer' },
            { key: 'amount', label: 'Amount', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'paymentMethod', label: 'Method' },
            { key: 'bank', label: 'Bank' },
            { key: 'status', label: 'Status' },
            { key: 'receivedDate', label: 'Received', format: (v) => formatDate(v) },
          ],
          data: applyPaymentFilter(
            reportType === 'deposit_summary' ? flatPayments.filter((p: any) => p.bank) :
            reportType === 'returned_cheque' ? flatPayments.filter((p: any) => p.status === 'Bounced') :
            flatPayments
          ),
        };
      case 'salesperson_performance':
        return {
          ...base,
          columns: [
            { key: 'employeeName', label: 'Salesperson' },
            { key: 'idNumber', label: 'ID' },
            { key: 'totalAmount', label: 'Total Invoiced', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'totalRemaining', label: 'Outstanding', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'invoiceCount', label: 'Invoices', align: 'center' },
          ],
          data: applySearch(salespersonPerformance, 'employeeName', 'idNumber'),
        };
      case 'order_history':
        return {
          ...base,
          columns: [
            { key: 'orderNumber', label: 'Order #' },
            { key: 'customerName', label: 'Customer' },
            { key: 'status', label: 'Status' },
            { key: 'totalAmount', label: 'Amount', align: 'right', format: (v: number) => `${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'salesType', label: 'Type' },
            { key: 'createdAt', label: 'Date', format: (v: string) => formatDate(v) },
          ],
          data: applyOrderFilter(orderReportData),
        };
      case 'order_status_breakdown':
        return {
          ...base,
          columns: [
            { key: 'status', label: 'Status' },
            { key: 'count', label: 'Orders', align: 'center' },
            { key: 'total', label: 'Total Amount', align: 'right', format: (v: number) => `${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ],
          data: orderStatusBreakdown,
          summary: orderReportSummary ? [
            { label: 'Total Orders', value: orderReportSummary.totalOrders || 0 },
            { label: 'Total Value', value: `${(orderReportSummary.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { label: 'Completed Value', value: `${(orderReportSummary.completedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ] : undefined,
        };
      case 'sales_by_customer':
        return {
          ...base,
          columns: [
            { key: 'customerName', label: 'Customer' },
            { key: 'orderCount', label: 'Orders', align: 'center' },
            { key: 'totalAmount', label: 'Total Ordered', align: 'right', format: (v: number) => `${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'completedAmount', label: 'Completed', align: 'right', format: (v: number) => `${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ],
          data: applySearch(salesByCustomer, 'customerName'),
        };
      case 'sales_by_product':
        return {
          ...base,
          columns: [
            { key: 'productName', label: 'Product' },
            { key: 'sku', label: 'SKU' },
            { key: 'totalQty', label: 'Qty Sold', align: 'right' },
            { key: 'orderCount', label: 'Order Lines', align: 'center' },
            { key: 'totalRevenue', label: 'Total Revenue', align: 'right', format: (v: number) => `${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ],
          data: applySearch(salesByProduct, 'productName', 'sku'),
        };
      case 'wht_report':
        return {
          ...base,
          columns: [
            { key: 'invoiceNumber', label: 'Invoice #' },
            { key: 'invoiceDate', label: 'Date', format: (v: string) => formatDate(v) },
            { key: 'customerName', label: 'Customer' },
            { key: 'tinNumber', label: 'TIN' },
            { key: 'invoiceAmount', label: 'Invoice Amount', align: 'right', format: (v: number) => `${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'whtAmount', label: 'WHT Amount', align: 'right', format: (v: number) => `${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'salesRep', label: 'Sales Rep' },
            { key: 'status', label: 'Status' },
          ],
          data: (() => { const d = applySearch(whtReportData, 'invoiceNumber', 'customerName', 'tinNumber', 'salesRep'); return d; })(),
          summary: (() => { const d = applySearch(whtReportData, 'invoiceNumber', 'customerName', 'tinNumber', 'salesRep'); return [
            { label: 'WHT Invoices', value: d.length },
            { label: 'Total WHT', value: `${d.reduce((s: number, r: any) => s + (r.whtAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ]; })(),
        };
      // ── Inventory Reports ──
      case 'stock_on_hand':
        return {
          ...base,
          columns: [
            { key: 'productName', label: 'Product' },
            { key: 'sku', label: 'SKU' },
            { key: 'batchNumber', label: 'Batch #' },
            { key: 'quantity', label: 'Qty', align: 'right' },
            { key: 'initialQuantity', label: 'Initial', align: 'right' },
            { key: 'purchasePrice', label: 'Unit Cost', align: 'right', format: (v) => `$${(v || 0).toFixed(2)}` },
            { key: 'totalValue', label: 'Total Value', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ],
          data: applySearch(stockOnHand, 'productName', 'sku', 'batchNumber'),
          summary: stockOnHandSummary ? [
            { label: 'Total Products', value: stockOnHandSummary.totalProducts || 0 },
            { label: 'Total Value', value: `$${(stockOnHandSummary.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ] : undefined,
        };
      case 'low_stock':
        return {
          ...base,
          columns: [
            { key: 'productName', label: 'Product' },
            { key: 'sku', label: 'SKU' },
            { key: 'currentQty', label: 'Current Qty', align: 'right' },
            { key: 'minStock', label: 'Min Stock', align: 'right' },
          ],
          data: applySearch(lowStock, 'productName', 'sku'),
        };
      case 'out_of_stock':
        return {
          ...base,
          columns: [
            { key: 'productName', label: 'Product' },
            { key: 'sku', label: 'SKU' },
          ],
          data: applySearch(outOfStock, 'productName', 'sku'),
        };
      case 'expiry_report':
        return {
          ...base,
          columns: [
            { key: 'productName', label: 'Product' },
            { key: 'batchNumber', label: 'Batch #' },
            { key: 'quantity', label: 'Qty', align: 'right' },
            { key: 'expiryDate', label: 'Expiry', format: (v) => formatDate(v) },
            { key: 'status', label: 'Status' },
          ],
          data: applySearch([
            ...expiryReportData.expired.map((e: any) => ({ ...e, status: 'Expired' })),
            ...expiryReportData.expiringSoon.map((e: any) => ({ ...e, status: 'Expiring Soon' })),
            ...expiryReportData.valid.map((e: any) => ({ ...e, status: 'Valid' })),
            ...expiryReportData.noExpiry.map((e: any) => ({ ...e, status: 'No Expiry' })),
          ], 'productName', 'batchNumber', 'status'),
        };
      case 'inventory_movement':
        return {
          ...base,
          columns: [
            { key: 'date', label: 'Date', format: (v) => formatDate(v) },
            { key: 'productName', label: 'Product' },
            { key: 'type', label: 'Type' },
            { key: 'quantity', label: 'Qty', align: 'right' },
            { key: 'reference', label: 'Reference' },
          ],
          data: applySearch(inventoryMovements, 'productName', 'type', 'reference'),
        };
      case 'grn_report':
        return {
          ...base,
          columns: [
            { key: 'grnNumber', label: 'GRN #' },
            { key: 'date', label: 'Date', format: (v) => formatDate(v) },
            { key: 'productName', label: 'Product' },
            { key: 'batchNumber', label: 'Batch #' },
            { key: 'quantityReceived', label: 'Qty Received', align: 'right' },
            { key: 'unitCost', label: 'Unit Cost', align: 'right', format: (v) => `$${(v || 0).toFixed(2)}` },
          ],
          data: applySearch(grnData, 'productName', 'grnNumber', 'batchNumber'),
        };
      case 'inventory_adjustment_report':
        return {
          ...base,
          columns: [
            { key: 'date', label: 'Date', format: (v) => formatDate(v) },
            { key: 'productName', label: 'Product' },
            { key: 'batchNumber', label: 'Batch #' },
            { key: 'adjustmentType', label: 'Type' },
            { key: 'quantityChanged', label: 'Qty Changed', align: 'right' },
            { key: 'reason', label: 'Reason' },
            { key: 'adjustedBy', label: 'Adjusted By' },
          ],
          data: applySearch(adjustmentData, 'productName', 'batchNumber', 'reason', 'adjustedBy'),
        };
      case 'daily_stock_in_out':
        return {
          ...base,
          columns: [
            { key: 'date', label: 'Date', format: (v) => formatDate(v) },
            { key: 'productName', label: 'Product' },
            { key: 'received', label: 'Received', align: 'right' },
            { key: 'issued', label: 'Issued', align: 'right' },
            { key: 'balance', label: 'Balance', align: 'right' },
          ],
          data: applySearch(dailyStockData, 'productName'),
        };
      case 'monthly_trend':
      case 'daily_collection':
      case 'monthly_collection':
        return {
          ...base,
          columns: [
            { key: 'month', label: 'Month' },
            { key: 'revenue', label: 'Revenue', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'collected', label: 'Collected', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ],
          data: reportType === 'monthly_trend' ? monthlyCollections : reportType === 'daily_collection' ? dailyCollections : monthlyCollections,
        };
      case 'collection_performance':
        return {
          ...base,
          columns: [
            { key: 'month', label: 'Month' },
            { key: 'invoiced', label: 'Invoiced', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'collected', label: 'Collected', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'rate', label: 'CEI %', align: 'right' },
          ],
          data: collectionPerformance?.monthlyData || [],
        };
      case 'commission_estimate':
        return {
          ...base,
          columns: [
            { key: 'month', label: 'Month' },
            { key: 'collected', label: 'Collected', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            { key: 'commission', label: 'Commission (2%)', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ],
          data: commissionData?.commissions || [],
        };
      case 'customer_aging':
        return {
          ...base,
          columns: [
            { key: 'bucket', label: 'Aging Bucket' },
            { key: 'count', label: 'Invoice Count', align: 'center' },
            { key: 'totalAmount', label: 'Total Amount', align: 'right', format: (v) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ],
          data: customerAgingData,
        };
      default:
        return {
          ...base,
          columns: [{ key: 'label', label: 'Data' }, { key: 'value', label: 'Value' }],
          data: [],
        };
    }
  }, [reportType, startDate, endDate, overdueOnly, tableSearch, statusFilter, paymentMethodFilter, supplierFilter, summary, invoices, filteredInvoices, customers, flatPayments, salespersonPerformance, stockOnHand, stockOnHandSummary, lowStock, outOfStock, expiryReportData, inventoryMovements, grnData, adjustmentData, dailyStockData, monthlyCollections, dailyCollections, collectionPerformance, commissionData, customerAgingData, reportCategories, orderReportData, orderReportSummary, orderStatusBreakdown, salesByCustomer, salesByProduct, whtReportData, whtTotal]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const navigateTo = (id: string) => {
    setReportType(id);
    setCurrentPage(1);
    setTableSearch('');
    setStatusFilter('');
    setPaymentMethodFilter('');
    setSupplierFilter('');
    const cat = reportCategories.find(c => c.reports.some(r => r.id === id))?.category || '';
    setExpandedCategories(prev => new Set([...prev, cat]));
  };

  const currentReport = reportCategories.flatMap(c => c.reports).find(r => r.id === reportType);

  return (
    <div style={{ display: 'flex', margin: '-1.25rem -1rem', minHeight: 'calc(100vh - 60px)', overflow: 'hidden', background: 'var(--bg-dark)' }}>

      {/* ── LEFT SIDEBAR ── */}
      <aside className="scrollbar-hide" style={{
        width: '264px', flexShrink: 0, overflowY: 'auto', overflowX: 'hidden',
        borderRight: '1px solid var(--border-color)',
        background: 'rgba(0,0,0,0.3)',
        padding: '0.75rem 0',
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
        position: 'sticky', top: 0, maxHeight: '100vh',
      }}>
        {/* Home / Dashboard link */}
        <button
          onClick={() => setReportType('dashboard')}
          style={{
            width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
            background: reportType === 'dashboard' ? 'rgba(20,184,166,0.18)' : 'transparent',
            border: 'none', borderLeft: reportType === 'dashboard' ? '3px solid var(--accent-color)' : '3px solid transparent',
            color: reportType === 'dashboard' ? 'var(--accent-color)' : 'var(--text-main)',
            cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            transition: 'all 0.15s ease', borderRadius: '0 6px 6px 0',
          }}
          className="sidebar-item-hover"
        >
          <span style={{ fontSize: '1.1rem' }}>🏠</span> Report Hub
        </button>

        <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0.75rem' }} />

        {reportCategories.map(cat => {
          const isExpanded = expandedCategories.has(cat.category);
          const hasActive = cat.reports.some(r => r.id === reportType);
          return (
            <div key={cat.category}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat.category)}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.55rem 1rem',
                  background: hasActive ? 'rgba(20,184,166,0.08)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  color: hasActive ? 'var(--accent-color)' : 'var(--text-muted)',
                  fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'uppercase', transition: 'all 0.15s ease',
                }}
                className="sidebar-item-hover"
              >
                <span>{cat.category}</span>
                <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
              </button>
              {/* Report links */}
              {isExpanded && cat.reports.map(rep => (
                <button
                  key={rep.id}
                  onClick={() => navigateTo(rep.id)}
                  title={rep.desc}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.45rem 1rem 0.45rem 1.75rem',
                    background: reportType === rep.id ? 'rgba(20,184,166,0.18)' : 'transparent',
                    border: 'none', borderLeft: reportType === rep.id ? '3px solid var(--accent-color)' : '3px solid transparent',
                    color: reportType === rep.id ? 'var(--accent-color)' : 'var(--text-main)',
                    cursor: 'pointer', fontSize: '0.82rem', fontWeight: reportType === rep.id ? 600 : 400,
                    lineHeight: 1.4, transition: 'all 0.12s ease', borderRadius: '0 4px 4px 0',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                  className="sidebar-item-hover"
                >
                  {rep.label}
                </button>
              ))}
            </div>
          );
        })}
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 2rem' }}>

        {/* DASHBOARD HUB */}
        {reportType === 'dashboard' && (
          <div style={{ animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ marginBottom: '2rem' }}>
              <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>Reports Hub</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>All analytics and reports in one place. Click any report to open it.</p>
            </div>

            {/* Key Metrics Row */}
            {summary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                {[
                  { label: 'Invoiced', value: summary.totalAmount, color: 'var(--accent-color)', prefix: '' },
                  { label: 'Outstanding', value: summary.totalRemaining, color: 'var(--warning)', prefix: '' },
                  { label: 'Collected', value: summary.totalPaid, color: 'var(--success)', prefix: '' },
                  { label: 'Overdue', value: summary.overdueCount, color: 'var(--danger)', prefix: '', isCount: true },
                  { label: 'Invoices', value: summary.invoiceCount, color: 'var(--info)', prefix: '', isCount: true },
                ].map(m => (
                  <div key={m.label} className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', borderTop: `3px solid ${m.color}` }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: m.color }}>
                      {m.isCount ? m.value.toLocaleString() : m.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Category Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {reportCategories.map((cat, ci) => {
                const catColors = [
                  '#3b82f6','#14b8a6','#f97316','#8b5cf6','#22c55e','#f59e0b','#ec4899','#0ea5e9'
                ];
                const color = catColors[ci % catColors.length];
                const catEmoji = cat.category.split(' ')[0];
                const catName = cat.category.substring(cat.category.indexOf(' ') + 1);
                return (
                  <div key={cat.category} className="glass-panel" style={{
                    padding: '1.5rem', borderTop: `3px solid ${color}`,
                    display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1.4rem' }}>{catEmoji}</span>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>{catName}</h3>
                      </div>
                      <span style={{ fontSize: '0.75rem', color, background: `${color}22`, padding: '0.2rem 0.55rem', borderRadius: '20px', fontWeight: 600 }}>
                        {cat.reports.length} reports
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {cat.reports.slice(0, 5).map(rep => (
                        <button
                          key={rep.id}
                          onClick={() => navigateTo(rep.id)}
                          style={{
                            textAlign: 'left', padding: '0.45rem 0.6rem',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '6px', cursor: 'pointer',
                            color: 'var(--text-main)', fontSize: '0.83rem',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            transition: 'all 0.15s ease',
                          }}
                          className="report-hub-item"
                          title={rep.desc}
                        >
                          <span style={{ fontSize: '0.95rem', minWidth: '1.2rem' }}>{rep.label.split(' ')[0]}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rep.label.substring(rep.label.indexOf(' ') + 1)}</span>
                          <span style={{ color, fontSize: '0.7rem', flexShrink: 0 }}>→</span>
                        </button>
                      ))}
                      {cat.reports.length > 5 && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.25rem 0.6rem' }}>
                          +{cat.reports.length - 5} more
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { toggleCategory(cat.category); navigateTo(cat.reports[0].id); }}
                      style={{
                        marginTop: 'auto', padding: '0.5rem', background: `${color}18`,
                        border: `1px solid ${color}44`, borderRadius: '6px',
                        color, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Open {catName.split(' ')[0]} Reports →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INDIVIDUAL REPORT VIEW */}
        {reportType !== 'dashboard' && (
          <>
            {/* Breadcrumb + Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem' }}>
              <div>
                <button
                  onClick={() => setReportType('dashboard')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  ← Back to Report Hub
                </button>
                <h1 className="text-gradient" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
                  {currentReport?.label?.substring(currentReport.label.indexOf(' ') + 1) || 'Report'}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {currentReport?.desc || 'Real-time analytics based on current ledger records.'}
                </p>
              </div>
            </div>

        {/* GLOBAL FILTER PANEL */}
        {(() => {
          const isInvoiceReport = ['outstanding_invoice', 'paid_invoice', 'overdue_invoice', 'invoice_due_date', 'partial_payment', 'late_analysis', 'withholding_tax_report', 'wht_report', 'withholding_tax_recon'].includes(reportType);
          const isPaymentReport = ['payment_register', 'deposit_summary', 'returned_cheque'].includes(reportType);
          const isPoReport = reportType === 'po_status_report';
          const isOrderReport = ['order_status_breakdown', 'sales_by_customer', 'sales_by_product', 'order_history'].includes(reportType);
          const showFilters = reportType !== 'dashboard';
          const searchPlaceholder =
            isInvoiceReport ? 'Search invoice #, customer, sales rep…' :
            isPaymentReport ? 'Search invoice #, customer, bank, reference…' :
            isPoReport || ['supplier_performance', 'grn_po_variance', 'pending_deliveries', 'purchase_price_history'].includes(reportType) ? 'Search by PO #, supplier, or product…' :
            isOrderReport ? 'Search by order #, customer, or sales rep…' :
            ['stock_on_hand', 'inventory_movement', 'low_stock', 'out_of_stock', 'reserved_stock', 'grn_report', 'inventory_adjustment_report', 'expiry_report', 'daily_stock_in_out'].includes(reportType) ? 'Search by product name or SKU…' :
            ['salesperson_commission', 'salesperson_performance', 'salesperson_outstanding'].includes(reportType) ? 'Search by salesperson name…' :
            ['customer_balance', 'top_debtors', 'credit_limit', 'customer_statement', 'customer_ledger', 'customer_aging', 'salesperson_aging', 'high_risk_customer'].includes(reportType) ? 'Search by customer name or TIN…' :
            ['cheques_due_today', 'overdue_for_deposit', 'upcoming_maturity', 'pending_clearance', 'bounced_cheques', 'collected_this_period', 'bulk_payment_tracker'].includes(reportType) ? 'Search by cheque #, customer, or bank…' :
            'Search…';
          const statusOpts: string[] = isInvoiceReport ? ['Active', 'Paid', 'Void'] :
            isPoReport ? ['Draft', 'Submitted', 'Manager_Approved', 'Sent', 'Partial_Received', 'Received', 'Cancelled', 'Rejected'] :
            isOrderReport ? ['Pending', 'Customer_Confirmed', 'Finance_Approved', 'Manager_Approved', 'Store_Confirmed', 'Completed', 'Rejected'] : [];
          const hasActiveFilters = tableSearch.length > 0 || !!statusFilter || !!paymentMethodFilter || !!supplierFilter;
          return (
            <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: showFilters ? '1rem' : 0 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, alignSelf: 'center', whiteSpace: 'nowrap' }}>Date Range:</span>
                <div className="form-field" style={{ margin: 0, flex: '1 1 140px', minWidth: 0 }}>
                  <label htmlFor="startDate" style={{ fontSize: '0.78rem', marginBottom: '0.3rem', display: 'block' }}>From</label>
                  <input type="date" id="startDate" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ fontSize: '0.875rem' }} />
                </div>
                <div className="form-field" style={{ margin: 0, flex: '1 1 140px', minWidth: 0 }}>
                  <label htmlFor="endDate" style={{ fontSize: '0.78rem', marginBottom: '0.3rem', display: 'block' }}>To</label>
                  <input type="date" id="endDate" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ fontSize: '0.875rem' }} />
                </div>
                {(startDate || endDate) && (
                  <button type="button" onClick={() => { setStartDate(''); setEndDate(''); }}
                    style={{ padding: '0.45rem 0.8rem', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '6px', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
                    ✕ Clear dates
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', alignSelf: 'center' }}>
                  <input type="checkbox" id="overdueOnly" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }} />
                  <label htmlFor="overdueOnly" style={{ fontSize: '0.9rem', fontWeight: 600, color: overdueOnly ? 'var(--danger)' : 'var(--text-main)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Overdue Invoices Only
                  </label>
                </div>
              </div>
              {showFilters && (
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                  <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '420px' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem', pointerEvents: 'none' }}>🔍</span>
                    <input type="text" className="form-control" placeholder={searchPlaceholder} value={tableSearch}
                      onChange={e => { setTableSearch(e.target.value); setCurrentPage(1); }}
                      style={{ paddingLeft: '2.2rem', paddingRight: tableSearch ? '2rem' : undefined }} />
                    {tableSearch && (
                      <button onClick={() => { setTableSearch(''); setCurrentPage(1); }}
                        style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1 }}
                        title="Clear">×</button>
                    )}
                  </div>
                  {statusOpts.length > 0 && (
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                      className="form-control" style={{ flex: '0 0 auto', width: 'auto', minWidth: '150px', fontSize: '0.85rem' }}>
                      <option value="">All Statuses</option>
                      {statusOpts.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  )}
                  {isPaymentReport && (
                    <select value={paymentMethodFilter} onChange={e => { setPaymentMethodFilter(e.target.value); setCurrentPage(1); }}
                      className="form-control" style={{ flex: '0 0 auto', width: 'auto', minWidth: '130px', fontSize: '0.85rem' }}>
                      <option value="">All Methods</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  )}
                  {hasActiveFilters && (
                    <button onClick={() => { setTableSearch(''); setStatusFilter(''); setPaymentMethodFilter(''); setSupplierFilter(''); setCurrentPage(1); }}
                      style={{ padding: '0.45rem 0.8rem', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '6px', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      ✕ Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* EXPORT TOOLBAR */}
        {getReportExportConfig && (
          <div className="no-print" style={{ marginBottom: '1.5rem' }}>
            <ReportExportToolbar
              exportOptions={getReportExportConfig}
              variant="full"
              disabled={loading}
            />
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ marginBottom: '1rem' }}>⌛</div>
            Generating requested report matrices...
          </div>
        ) : (
          <>
            {/* EXECUTIVE DASHBOARD VIEW */}
            {reportType === 'executive_dashboard' && (
              <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  <div className="glass-panel stat-card" style={{ padding: '1.75rem', borderLeft: '4px solid var(--success)' }}>
                    <span className="stat-label">Total Invoiced Volume</span>
                    <h2 className="stat-value" style={{ color: '#10b981' }}>${summary?.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                  </div>
                  <div className="glass-panel stat-card" style={{ padding: '1.75rem', borderLeft: '4px solid var(--warning)' }}>
                    <span className="stat-label">Outstanding Payables</span>
                    <h2 className="stat-value" style={{ color: '#f59e0b' }}>${summary?.totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                  </div>
                  <div className="glass-panel stat-card" style={{ padding: '1.75rem', borderLeft: '4px solid #34d399' }}>
                    <span className="stat-label">Settled Cash Receipts</span>
                    <h2 className="stat-value" style={{ color: '#34d399' }}>${summary?.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                  </div>
                  <div className="glass-panel stat-card" style={{ padding: '1.75rem', borderLeft: '4px solid #f43f5e' }}>
                    <span className="stat-label">Uncollected Cheques</span>
                    <h2 className="stat-value" style={{ color: '#ef4444' }}>${summary?.totalUncollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                  </div>
                </div>
              </div>
            )}
            
            {/* AR SUMMARY DASHBOARD */}
            {reportType === 'ar_summary' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--accent-hover)' }}>Accounts Receivable Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '4px solid var(--accent-hover)' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total AR Balance</span>
                    <h2 style={{ fontSize: '2.5rem', color: '#fff', marginTop: '0.5rem' }}>${summary?.totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                  </div>
                  <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '4px solid var(--warning)' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Current (Not Due) AR</span>
                    <h2 style={{ fontSize: '2.5rem', color: 'var(--warning)', marginTop: '0.5rem' }}>${(summary!.totalRemaining - invoices.filter(i => i.daysOverdue !== null && i.daysOverdue > 0).reduce((sum, i) => sum + i.remainingPayment, 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                  </div>
                  <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '4px solid var(--danger)' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Overdue AR</span>
                    <h2 style={{ fontSize: '2.5rem', color: 'var(--danger)', marginTop: '0.5rem' }}>${invoices.filter(i => i.daysOverdue !== null && i.daysOverdue > 0).reduce((sum, i) => sum + i.remainingPayment, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                  </div>
                </div>
              </div>
            )}

            {/* BALANCE SUMMARIES (CUSTOMER / SALESPERSON / TOP DEBTORS) */}
            {(reportType === 'customer_balance' || reportType === 'salesperson_outstanding' || reportType === 'top_debtors') && (() => {
              const rawList = reportType === 'salesperson_outstanding' ? employees : (reportType === 'top_debtors' ? topDebtors : customers);
              const q = tableSearch.toLowerCase();
              const displayed = q ? rawList.filter((c: any) => (c.customerName || c.employeeName || '').toLowerCase().includes(q) || (c.tinNumber || c.idNumber || '').toLowerCase().includes(q)) : rawList;
              const paginatedList = displayed.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return (
                <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>Balance Summary Report</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q ? `${displayed.length} of ${rawList.length} results` : `${rawList.length} records`}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Total summaries of outstanding balances mapped by entity.</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <th style={{ padding: '1rem 0.75rem' }}>Entity Name</th>
                        <th style={{ padding: '1rem 0.75rem' }}>Identifier</th>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Invoice Count</th>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Total Invoiced</th>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Outstanding Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No results match your search.</td></tr>
                      ) : paginatedList.map((c: any) => (
                        <tr key={c.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => router.push(reportType === 'salesperson_outstanding' ? `/employees?id=${c.id}` : `/customers/${c.id}`)}>
                          <td style={{ padding: '1rem 0.75rem', fontWeight: 600, color: 'var(--accent-hover)' }}>{c.customerName || c.employeeName}</td>
                          <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{c.tinNumber || c.idNumber || 'N/A'}</td>
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>{c.invoiceCount}</td>
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>{c.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--warning)' }}>{c.totalRemaining.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {displayed.length > rowsPerPage && renderPagination(displayed.length)}
                </div>
              );
            })()}

            {/* AGING REPORTS (CUSTOMER / SALESPERSON / HIGH RISK) */}
            {(reportType === 'customer_aging' || reportType === 'salesperson_aging' || reportType === 'high_risk_customer') && (() => {
              const rawList = reportType === 'customer_aging' ? customerAgingData : (reportType === 'high_risk_customer' ? highRiskCustomers : salespersonAgingData);
              const q = tableSearch.toLowerCase();
              const displayed = q ? rawList.filter((r: any) => r.entityName?.toLowerCase().includes(q)) : rawList;
              const paginatedList = displayed.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return (
                <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>Aging Summary Matrix</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q ? `${displayed.length} of ${rawList.length} results` : `${rawList.length} records`}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Receivables grouped by their active days overdue limit.</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <th style={{ padding: '1rem 0.75rem' }}>Entity Name</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Current</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>1-30 Days</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>31-60 Days</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>61-90 Days</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>90+ Days</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--accent-hover)' }}>Total Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayed.length === 0 ? (
                          <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No results match your search.</td></tr>
                        ) : paginatedList.map((row: any, idx: number) => (
                          <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{row.entityName}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{row.current.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: '#fcd34d' }}>{row.days1_30.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: '#fb923c' }}>{row.days31_60.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: '#f87171' }}>{row.days61_90.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{row.days90Plus.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--warning)' }}>{row.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {displayed.length > rowsPerPage && renderPagination(displayed.length)}
                </div>
              );
            })()}
            
            {/* CASH FLOW FORECAST */}
            {reportType === 'cash_forecast' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Cash Flow Forecast</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Expected future cash inflows based on the due dates of active accounts receivable.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {cashFlowForecast.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No future cash inflows currently scheduled.</p>
                  ) : cashFlowForecast.map(([month, total]) => (
                    <div key={month} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid #34d399' }}>
                      <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>{month}</h4>
                      <h2 style={{ fontSize: '2rem', color: '#34d399' }}>${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Projected Inflow</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* REVENUE VS COLLECTION */}
            {reportType === 'revenue_vs_collection' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Revenue vs Collection Analysis</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>A month-over-month comparison of billed revenue versus actual cleared cash collected.</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '1rem 0.75rem' }}>Month</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--accent-hover)' }}>Billed Revenue ($)</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--success)' }}>Collected Cash ($)</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Collection Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const paginatedRev = revVsCollection.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                      return paginatedRev.map(([month, data]) => {
                        const ratio = data.revenue > 0 ? ((data.collection / data.revenue) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={month} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{month}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--accent-hover)' }}>${data.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>${data.collection.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 700, color: Number(ratio) >= 80 ? 'var(--success)' : 'var(--warning)' }}>{ratio}%</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
                {revVsCollection.length > 0 && renderPagination(revVsCollection.length)}
              </div>
            )}
            
            {/* PAYMENT BEHAVIOR */}
            {reportType === 'payment_behavior' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Customer Payment Behavior</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Tracks customer reliability by calculating the ratio of on-time versus late settled invoices.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {paymentBehavior.filter(b => b.onTime + b.late > 0).map((b, idx) => {
                    const total = b.onTime + b.late;
                    const onTimePct = Math.round((b.onTime / total) * 100);
                    return (
                      <div key={idx} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                        <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '1rem' }}>{b.name}</strong>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--success)' }}>{b.onTime} On-Time</span>
                          <span style={{ color: 'var(--danger)' }}>{b.late} Late Payments</span>
                        </div>
                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '8px', background: 'var(--danger)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${onTimePct}%`, height: '100%', background: 'var(--success)' }}></div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.75rem', marginTop: '0.5rem', color: onTimePct > 70 ? 'var(--success)' : 'var(--danger)' }}>
                          {onTimePct}% Reliability
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* DAYS SALES OUTSTANDING */}
            {reportType === 'dso_report' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Days Sales Outstanding (DSO) averages</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Calculates the exact average number of days it takes for each customer to settle an invoice.</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '1rem 0.75rem' }}>Customer Name</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Total Settled Invoices</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Average DSO (Days)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const paginatedDso = dsoData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                      return paginatedDso.map((d, idx) => (
                        <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{d.name}</td>
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>{d.count}</td>
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 700, color: d.avgDSO > 30 ? 'var(--danger)' : 'var(--success)' }}>{d.avgDSO} days</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
                {dsoData.length > 0 && renderPagination(dsoData.length)}
              </div>
            )}

            {/* UNALLOCATED PAYMENTS REDIRECT */}
            {reportType === 'unallocated_payment' && (
              <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❓</div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Unallocated Payment Verification</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
                  Unallocated payments (Extra Payed balances) represent customer overpayments and require full registry synchronization. To view detailed unallocated funds, you must visit the master Customer Registry list.
                </p>
                <button className="btn-primary" onClick={() => router.push('/customers')} style={{ padding: '0.85rem 2rem' }}>
                  Go to Master Customer Registry
                </button>
              </div>
            )}
            
            {/* CREDIT LIMIT UTILIZATION REPORT */}
            {reportType === 'credit_limit' && (() => {
              const q = tableSearch.toLowerCase();
              const base = fullCustomers.filter((c: any) => c.creditLimit > 0).sort((a: any, b: any) => (b.balance / b.creditLimit) - (a.balance / a.creditLimit));
              const displayed = q ? base.filter((c: any) => c.customerName?.toLowerCase().includes(q) || c.tinNumber?.toLowerCase().includes(q)) : base;
              const paginated = displayed.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return (
                <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>Credit Limit Utilization</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q ? `${displayed.length} of ${base.length} results` : `${base.length} customers`}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Monitors exposure by comparing active customer balances against their hard credit limits.</p>
                  {fullCustomers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading live credit registry data...</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <th style={{ padding: '1rem 0.75rem' }}>Customer Name</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Credit Limit</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Current Balance</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Utilization</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayed.length === 0 ? (
                          <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No customers match your search.</td></tr>
                        ) : paginated.map((c: any) => {
                          const utilization = Math.round((c.balance / c.creditLimit) * 100);
                          return (
                            <tr key={c.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{c.customerName}</td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--accent-hover)' }}>{c.creditLimit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--warning)' }}>{c.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 700, color: utilization > 90 ? 'var(--danger)' : utilization > 60 ? 'var(--warning)' : 'var(--success)' }}>{utilization}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {displayed.length > rowsPerPage && renderPagination(displayed.length)}
                </div>
              );
            })()}

            {/* CUSTOMER STATEMENT */}
            {reportType === 'customer_statement' && (() => {
              const selectedCust = fullCustomers.find((c: any) => c.id === selectedCustomerId);
              const filtered = fullCustomers.filter((c: any) =>
                c.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                c.tinNumber?.toLowerCase().includes(customerSearch.toLowerCase())
              );

              // Compute running balance from ledger entries (oldest first)
              const sorted = [...customerLedgerEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              let balance = 0;
              const withBalance = sorted.map(e => {
                balance += (e.debit || 0) - (e.credit || 0);
                return { ...e, runningBalance: balance };
              }).reverse();

              return (
                <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Customer Selector */}
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-hover)' }}>📋 Customer Statement — Select Customer</h3>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search by name or TIN..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      style={{ marginBottom: '1rem', maxWidth: '400px' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {filtered.slice(0, 40).map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCustomerId(c.id); setCurrentPage(1); }}
                          style={{
                            padding: '0.4rem 0.9rem', fontSize: '0.83rem', borderRadius: '6px', cursor: 'pointer',
                            background: selectedCustomerId === c.id ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                            color: selectedCustomerId === c.id ? '#fff' : 'var(--text-main)',
                            border: selectedCustomerId === c.id ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                            fontWeight: selectedCustomerId === c.id ? 600 : 400,
                          }}
                        >
                          {c.customerName}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Statement Body */}
                  {selectedCust && (
                    <div className="glass-panel" style={{ padding: '2rem' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>{selectedCust.customerName}</h2>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            {selectedCust.tinNumber && <span>TIN: {selectedCust.tinNumber}</span>}
                            {selectedCust.address && <span>Address: {selectedCust.address}</span>}
                            {selectedCust.phoneNumber && <span>Phone: {selectedCust.phoneNumber}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Current Balance</div>
                          <div style={{ fontSize: '2rem', fontWeight: 700, color: (selectedCust.balance || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {(selectedCust.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Summary Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        {[
                          { label: 'Total Purchase', value: selectedCust.totalPurchase || 0, color: 'var(--accent-color)' },
                          { label: 'Total Paid', value: selectedCust.totalPayed || 0, color: 'var(--success)' },
                          { label: 'Outstanding', value: selectedCust.balance || 0, color: 'var(--danger)' },
                          { label: 'Uncollected Chq', value: selectedCust.uncollectedCheque || 0, color: 'var(--warning)' },
                          { label: 'Bounced Chqs', value: selectedCust.bouncedCheques || 0, color: 'var(--danger)', isCount: true },
                          { label: 'Extra Paid', value: selectedCust.extraPayed || 0, color: 'var(--info)' },
                        ].map(m => (
                          <div key={m.label} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderTop: `2px solid ${m.color}` }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.3rem', textTransform: 'uppercase' }}>{m.label}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: m.color }}>
                              {m.isCount ? m.value : m.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Ledger Entries */}
                      {customerLedgerLoading ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading transactions...</p>
                      ) : withBalance.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No ledger entries found for this customer.</p>
                      ) : (
                        <>
                          <h4 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction History</h4>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  <th style={{ padding: '0.75rem' }}>Date</th>
                                  <th style={{ padding: '0.75rem' }}>Type</th>
                                  <th style={{ padding: '0.75rem' }}>Description</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--danger)' }}>Debit</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>Credit</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {withBalance.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((e: any, i: number) => (
                                  <tr key={i} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.88rem' }}>
                                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(e.date)}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                      <span style={{
                                        background: e.type === 'Invoice' ? 'rgba(244,63,94,0.12)' : e.type === 'Payment' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                                        color: e.type === 'Invoice' ? 'var(--danger)' : e.type === 'Payment' ? 'var(--success)' : 'var(--text-muted)',
                                        padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600
                                      }}>{e.type}</span>
                                    </td>
                                    <td style={{ padding: '0.75rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--danger)', fontWeight: e.debit > 0 ? 600 : 400 }}>
                                      {e.debit > 0 ? e.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)', fontWeight: e.credit > 0 ? 600 : 400 }}>
                                      {e.credit > 0 ? e.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: e.runningBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                      {e.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {withBalance.length > rowsPerPage && renderPagination(withBalance.length)}
                        </>
                      )}
                    </div>
                  )}
                  {!selectedCust && !selectedCustomerId && (
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Select a customer above to view their statement.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* CUSTOMER LEDGER */}
            {reportType === 'customer_ledger' && (() => {
              const selectedCust = fullCustomers.find((c: any) => c.id === selectedCustomerId);
              const filtered = fullCustomers.filter((c: any) =>
                c.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                c.tinNumber?.toLowerCase().includes(customerSearch.toLowerCase())
              );
              const sorted = [...customerLedgerEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              let runBal = 0;
              const withBalance = sorted.map(e => {
                runBal += (e.debit || 0) - (e.credit || 0);
                return { ...e, runningBalance: runBal };
              }).reverse();

              const totalDebit = customerLedgerEntries.reduce((s, e) => s + (e.debit || 0), 0);
              const totalCredit = customerLedgerEntries.reduce((s, e) => s + (e.credit || 0), 0);

              return (
                <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Customer Selector */}
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-hover)' }}>📓 Customer Ledger — Select Account</h3>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search by name or TIN..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      style={{ marginBottom: '1rem', maxWidth: '400px' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {filtered.slice(0, 40).map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCustomerId(c.id); setCurrentPage(1); }}
                          style={{
                            padding: '0.4rem 0.9rem', fontSize: '0.83rem', borderRadius: '6px', cursor: 'pointer',
                            background: selectedCustomerId === c.id ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                            color: selectedCustomerId === c.id ? '#fff' : 'var(--text-main)',
                            border: selectedCustomerId === c.id ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                            fontWeight: selectedCustomerId === c.id ? 600 : 400,
                          }}
                        >
                          {c.customerName}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ledger Body */}
                  {selectedCust && (
                    <div className="glass-panel" style={{ padding: '2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedCust.customerName} — General Ledger</h2>
                          {selectedCust.tinNumber && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>TIN: {selectedCust.tinNumber}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right' }}>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Total Debit</div>
                            <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '1.1rem' }}>{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Total Credit</div>
                            <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.1rem' }}>{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Net Balance</div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: (totalDebit - totalCredit) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                              {(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {customerLedgerLoading ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading ledger...</p>
                      ) : withBalance.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No ledger entries found.</p>
                      ) : (
                        <>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px', fontFamily: 'monospace' }}>
                              <thead>
                                <tr style={{ background: 'rgba(20,184,166,0.1)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  <th style={{ padding: '0.75rem 0.6rem' }}>Date</th>
                                  <th style={{ padding: '0.75rem 0.6rem' }}>Ref</th>
                                  <th style={{ padding: '0.75rem 0.6rem' }}>Type</th>
                                  <th style={{ padding: '0.75rem 0.6rem', maxWidth: '200px' }}>Description</th>
                                  <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>Debit (Dr)</th>
                                  <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>Credit (Cr)</th>
                                  <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {withBalance.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((e: any, i: number) => (
                                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.83rem' }}>
                                    <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(e.date)}</td>
                                    <td style={{ padding: '0.65rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                      {e.invoiceId ? `INV-${e.invoiceId}` : e.paymentId ? `PAY-${e.paymentId}` : '—'}
                                    </td>
                                    <td style={{ padding: '0.65rem 0.6rem' }}>
                                      <span style={{
                                        background: e.type === 'Invoice' ? 'rgba(244,63,94,0.12)' : 'rgba(16,185,129,0.12)',
                                        color: e.type === 'Invoice' ? 'var(--danger)' : 'var(--success)',
                                        padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.72rem', fontWeight: 600
                                      }}>{e.type}</span>
                                    </td>
                                    <td style={{ padding: '0.65rem 0.6rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'sans-serif', fontSize: '0.83rem' }}>{e.description}</td>
                                    <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: e.debit > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: e.debit > 0 ? 600 : 400 }}>
                                      {e.debit > 0 ? e.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                                    </td>
                                    <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: e.credit > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: e.credit > 0 ? 600 : 400 }}>
                                      {e.credit > 0 ? e.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                                    </td>
                                    <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontWeight: 700, color: e.runningBalance > 0 ? 'var(--danger)' : 'var(--success)', borderLeft: '1px solid var(--border-color)' }}>
                                      {e.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                                {/* Totals row */}
                                <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(255,255,255,0.03)', fontWeight: 700, fontSize: '0.85rem' }}>
                                  <td colSpan={4} style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)' }}>TOTALS</td>
                                  <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right', color: 'var(--danger)' }}>{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right', color: 'var(--success)' }}>{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right', color: (totalDebit - totalCredit) > 0 ? 'var(--danger)' : 'var(--success)', borderLeft: '1px solid var(--border-color)' }}>
                                    {(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          {withBalance.length > rowsPerPage && renderPagination(withBalance.length)}
                        </>
                      )}
                    </div>
                  )}
                  {!selectedCust && (
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Select a customer above to view their general ledger.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* INVOICE STATUS SUMMARY */}
            {reportType === 'invoice_status' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--accent-hover)' }}>Invoice Status Matrix</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {statusSummary.map(s => (
                    <div key={s.status} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <span style={{ 
                        display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem',
                        background: s.status === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : s.status === 'Overdue' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: s.status === 'Paid' ? 'var(--success)' : s.status === 'Overdue' ? 'var(--danger)' : 'var(--accent)'
                      }}>{s.status}</span>
                      <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{s.count}</h2>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <div>Total: ${s.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        {s.totalRemaining > 0 && <div style={{ color: 'var(--warning)', marginTop: '0.25rem' }}>Unpaid: ${s.totalRemaining.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SALESPERSON COMMISSION REPORT */}
            {reportType === 'salesperson_commission' && (() => {
              const q = tableSearch.toLowerCase();
              const displayed = q ? salespersonPerformance.filter(r => r.name?.toLowerCase().includes(q)) : salespersonPerformance;
              const paginated = displayed.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return (
                <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>Salesperson Commission & Performance</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q ? `${displayed.length} of ${salespersonPerformance.length}` : `${salespersonPerformance.length} reps`}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Commission metrics are based entirely on successfully collected revenue (cash or cleared cheques).</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <th style={{ padding: '1rem 0.75rem' }}>Salesperson Name</th>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Total Invoiced</th>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--success)' }}>Total Collected</th>
                        <th style={{ padding: '1rem 0.75rem', textAlign: 'right', color: '#fbbf24' }}>Commission (5%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No results match your search.</td></tr>
                      ) : paginated.map((rep, idx) => (
                        <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{rep.name}</td>
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{rep.totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{rep.totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>{(rep.totalCollected * 0.05).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {displayed.length > rowsPerPage && renderPagination(displayed.length)}
                </div>
              );
            })()}

            {/* SALESPERSON PERFORMANCE REPORT */}
            {reportType === 'salesperson_performance' && (() => {
              const q = tableSearch.toLowerCase();
              const displayed = q ? salespersonPerformance.filter(r => r.name?.toLowerCase().includes(q)) : salespersonPerformance;
              return (
                <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>Collection Performance Analytics</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q ? `${displayed.length} of ${salespersonPerformance.length}` : `${salespersonPerformance.length} reps`}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Evaluates a representative's ability to successfully collect on generated invoices.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {displayed.length === 0 ? <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1' }}>No results match your search.</p> : displayed.map((rep, idx) => {
                    const ratio = rep.totalInvoiced > 0 ? Math.round((rep.totalCollected / rep.totalInvoiced) * 100) : 0;
                    return (
                      <div key={idx} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                        <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '1rem' }}>{rep.name}</strong>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Collected: {rep.totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          <span style={{ color: 'var(--text-muted)' }}>Invoiced: {rep.totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${ratio}%`, height: '100%', background: ratio > 80 ? 'var(--success)' : ratio > 40 ? 'var(--warning)' : 'var(--danger)', transition: 'width 1s ease-in-out' }}></div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.75rem', marginTop: '0.5rem', color: ratio > 80 ? 'var(--success)' : ratio > 40 ? 'var(--warning)' : 'var(--danger)' }}>
                          {ratio}% Recovery Rate
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              );
            })()}

            {/* COLLECTION PERFORMANCE REPORT (Seller) */}
            {reportType === 'collection_performance' && collectionPerformance && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Collection Performance Report</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Monthly collection rates, CEI trends, and average days to collect.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <div className="stat-title">Total Sales</div>
                    <div className="stat-value" style={{ color: '#3b82f6', fontSize: '1.2rem' }}>
                      ${collectionPerformance.summary.totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>
                  </div>
                  <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
                    <div className="stat-title">Total Collected</div>
                    <div className="stat-value" style={{ color: '#10b981', fontSize: '1.2rem' }}>
                      ${collectionPerformance.summary.totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>
                  </div>
                  <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #8b5cf6' }}>
                    <div className="stat-title">Overall CEI</div>
                    <div className="stat-value" style={{ color: '#8b5cf6', fontSize: '1.2rem' }}>
                      {collectionPerformance.summary.overallCEI}%
                    </div>
                  </div>
                  <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div className="stat-title">Avg Days to Collect</div>
                    <div className="stat-value" style={{ color: '#f59e0b', fontSize: '1.2rem' }}>
                      {collectionPerformance.summary.avgDaysToCollect}d
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={collectionPerformance.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cei" name="CEI %" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="avgDaysToCollect" name="Avg Days" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Sales</th>
                        <th>Collected</th>
                        <th>Outstanding</th>
                        <th>CEI</th>
                        <th>Avg Days</th>
                        <th>Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionPerformance.monthlyData.map((m: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{m.month}</td>
                          <td>${m.sales.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ color: '#10b981' }}>${m.collected.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ color: m.outstanding > 0 ? '#f59e0b' : '#10b981' }}>${m.outstanding.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td><span style={{ color: m.cei > 80 ? '#10b981' : m.cei > 40 ? '#f59e0b' : '#f43f5e', fontWeight: 600 }}>{m.cei}%</span></td>
                          <td>{m.avgDaysToCollect}d</td>
                          <td>{m.invoiceCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CUSTOMER AGING REPORT (Seller) */}
            {reportType === 'customer_aging' && customerAging && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Customer Aging Report</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Receivables distributed by aging buckets.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  {customerAging.agingBuckets.map((b: any, i: number) => (
                    <div key={i} className="stat-card glass-panel" style={{ borderLeft: `4px solid ${['#10b981','#f59e0b','#f97316','#f43f5e'][i]}` }}>
                      <div className="stat-title">{b.label}</div>
                      <div className="stat-value" style={{ color: ['#10b981','#f59e0b','#f97316','#f43f5e'][i], fontSize: '1.2rem' }}>
                        ${b.total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.count} invoices</div>
                    </div>
                  ))}
                </div>
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Current</th>
                        <th>31-60 Days</th>
                        <th>61-90 Days</th>
                        <th>90+ Days</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerAging.customers.map((c: any) => (
                        <tr key={c.id} className="hover-row">
                          <td style={{ fontWeight: 600, color: 'var(--accent-hover)' }}>{c.name}</td>
                          <td style={{ color: c.current > 0 ? '#10b981' : 'var(--text-muted)' }}>${c.current.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ color: c.days31_60 > 0 ? '#f59e0b' : 'var(--text-muted)' }}>${c.days31_60.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ color: c.days61_90 > 0 ? '#f97316' : 'var(--text-muted)' }}>${c.days61_90.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ color: c.days90Plus > 0 ? '#f43f5e' : 'var(--text-muted)' }}>${c.days90Plus.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ fontWeight: 600 }}>${c.totalOutstanding.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {customerAging.customers.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No outstanding invoices — great job!</p>
                )}
              </div>
            )}

            {/* COMMISSION ESTIMATE REPORT (Seller) */}
            {reportType === 'commission_estimate' && commissionData && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Commission Estimate</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                  Estimated commission at {commissionData.rate * 100}% rate on collected amounts. Total estimated: <strong style={{ color: '#10b981' }}>${commissionData.totalEstimatedCommission.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>
                </p>
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Collected</th>
                        <th>Outstanding</th>
                        <th>Est. Commission</th>
                        <th>Potential</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionData.commissions.map((c: any) => (
                        <tr key={c.invoiceId} className="hover-row">
                          <td style={{ fontWeight: 600 }}>{c.invoiceNumber}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{c.customerName}</td>
                          <td>${c.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ color: '#10b981' }}>${c.collected.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ color: c.outstanding > 0 ? '#f59e0b' : 'var(--text-muted)' }}>${c.outstanding.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ color: '#10b981', fontWeight: 600 }}>${c.collectedCommission.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td style={{ color: '#94a3b8' }}>${c.potentialCommission.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td><span style={{ color: c.status === 'Paid' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{c.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DAILY / MONTHLY TREND COLLECTIONS */}
            {(reportType === 'daily_collection' || reportType === 'monthly_collection' || reportType === 'monthly_trend') && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>{reportType === 'monthly_trend' ? 'Monthly Collection Trend Analysis' : 'Chronological Collections'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>{reportType === 'monthly_trend' ? 'Month over month trend lines indicating revenue growth or decline.' : 'Total collection sums grouped by chronological periods.'}</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '1rem 0.75rem' }}>{reportType === 'daily_collection' ? 'Date' : 'Month'}</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Total Revenue Collected</th>
                      {reportType === 'monthly_trend' && <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>MoM Growth Trend</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const dataList = reportType === 'daily_collection' ? dailyCollections : monthlyCollections;
                      const paginatedList = dataList.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                      return paginatedList.map(([date, total], idx, arr) => {
                        let trend = null;
                        if (reportType === 'monthly_trend' && idx < arr.length - 1) {
                          const prevTotal = arr[idx + 1][1];
                          if (prevTotal > 0) trend = ((total - prevTotal) / prevTotal) * 100;
                        }
                        return (
                          <tr key={date} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{date}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            {reportType === 'monthly_trend' && (
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>
                                {trend === null ? <span style={{ color: 'var(--text-muted)' }}>-</span> : (
                                  <span style={{ color: trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {trend > 0 ? '↗ ' : '↘ '}{Math.abs(trend).toFixed(1)}%
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
                {(() => {
                  const dataList = reportType === 'daily_collection' ? dailyCollections : monthlyCollections;
                  return dataList.length > 0 && renderPagination(dataList.length);
                })()}
              </div>
            )}

            {/* PAYMENT METHOD REPORT */}
            {reportType === 'payment_method' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>Payment Method Analytics</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Distribution of received funds across payment instruments.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {paymentMethodData.map(([method, data]) => (
                    <div key={method} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center' }}>
                      <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{method}</h4>
                      <h2 style={{ fontSize: '2rem', color: 'var(--accent-hover)', marginBottom: '0.5rem' }}>${data.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{data.count} processed transactions</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BANK COLLECTION REPORT */}
            {reportType === 'bank_collection' && (() => {
              const totalCollected = banks.reduce((s, b) => s + b.totalCollected, 0);
              const totalUncollected = banks.reduce((s, b) => s + b.totalUncollected, 0);
              const totalPayments = banks.reduce((s, b) => s + b.paymentCount, 0);
              const paginatedBanks = banks.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return (
                <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                    {[
                      { label: 'Total Banks', value: banks.length, color: 'var(--accent-color)', isCount: true },
                      { label: 'Total Transactions', value: totalPayments, color: 'var(--info)', isCount: true },
                      { label: 'Cleared (Collected)', value: totalCollected, color: 'var(--success)' },
                      { label: 'Pending Cheques', value: totalUncollected, color: '#fbbf24' },
                      { label: 'Total Deposited', value: totalCollected + totalUncollected, color: 'var(--accent-hover)' },
                    ].map(m => (
                      <div key={m.label} className="glass-panel" style={{ padding: '1.2rem', borderTop: `3px solid ${m.color}` }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>{m.label}</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: m.color }}>
                          {m.isCount ? m.value : m.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--accent-hover)' }}>🏦 Bank Collection Report</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                      Breakdown of cheque and cash deposits collected per banking institution.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '0.75rem' }}>Bank</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Txn Count</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>Cleared</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', color: '#fbbf24' }}>Pending Cheques</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Cleared %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBanks.map((b, idx) => {
                            const total = b.totalCollected + b.totalUncollected;
                            const pct = total > 0 ? (b.totalCollected / total * 100) : 0;
                            return (
                              <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.88rem' }}>
                                <td style={{ padding: '0.9rem 0.75rem', fontWeight: 700 }}>{b.bankName}</td>
                                <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>{b.paymentCount}</td>
                                <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{b.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>{b.totalUncollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ width: `${pct}%`, height: '100%', background: pct > 70 ? 'var(--success)' : pct > 40 ? '#fbbf24' : 'var(--danger)', borderRadius: '3px' }} />
                                    </div>
                                    <span style={{ color: pct > 70 ? 'var(--success)' : pct > 40 ? '#fbbf24' : 'var(--danger)', fontWeight: 600, fontSize: '0.82rem' }}>{pct.toFixed(1)}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontWeight: 700, fontSize: '0.85rem' }}>
                            <td style={{ padding: '0.75rem' }}>TOTAL</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalPayments}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#fbbf24' }}>{totalUncollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{(totalCollected + totalUncollected).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '0.75rem' }} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {banks.length > rowsPerPage && renderPagination(banks.length)}
                  </div>
                </div>
              );
            })()}

            {/* BANK RECONCILIATION REPORT */}
            {reportType === 'bank_reconciliation' && (() => {
              const totalCollected = banks.reduce((s, b) => s + b.totalCollected, 0);
              const totalUncollected = banks.reduce((s, b) => s + b.totalUncollected, 0);
              const netBalance = totalCollected - totalUncollected;
              const paginatedBanks = banks.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return (
                <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Reconciliation Summary */}
                  <div className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid var(--accent-color)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.2rem', color: 'var(--accent-hover)' }}>⚖️ Bank Reconciliation Statement</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Book Balance (Cleared)</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--success)' }}>{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Outstanding Cheques</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fbbf24' }}>({totalUncollected.toLocaleString(undefined, { minimumFractionDigits: 2 })})</div>
                      </div>
                      <div style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Reconciled Net Position</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: netBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.3rem', color: netBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {netBalance >= 0 ? 'Surplus — deposits exceed outstanding' : 'Deficit — review outstanding cheques'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Per-bank reconciliation table */}
                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h4 style={{ fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Per-Bank Reconciliation</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                      Compares cleared collections against uncleared cheque liabilities for each bank account.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '650px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '0.75rem' }}>Bank Account</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>Cleared Balance</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', color: '#fbbf24' }}>Outstanding Cheques</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Net Position</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBanks.map((b, idx) => {
                            const net = b.totalCollected - b.totalUncollected;
                            const status = b.totalUncollected === 0 ? 'Reconciled' : b.totalUncollected > b.totalCollected ? 'Review' : 'Partial';
                            const statusColor = status === 'Reconciled' ? 'var(--success)' : status === 'Review' ? 'var(--danger)' : '#fbbf24';
                            return (
                              <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.88rem' }}>
                                <td style={{ padding: '0.9rem 0.75rem', fontWeight: 700 }}>{b.bankName}</td>
                                <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{b.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>
                                  {b.totalUncollected > 0 ? `(${b.totalUncollected.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : '—'}
                                </td>
                                <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', fontWeight: 700, color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  {net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>
                                  <span style={{ background: statusColor + '22', color: statusColor, padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                    {status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontWeight: 700 }}>
                            <td style={{ padding: '0.75rem' }}>TOTAL</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#fbbf24' }}>({totalUncollected.toLocaleString(undefined, { minimumFractionDigits: 2 })})</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: netBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>{netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {banks.length > rowsPerPage && renderPagination(banks.length)}
                  </div>
                </div>
              );
            })()}

            {/* PAYMENT TABLE VIEWS */}
            {reportType === 'payment_register' && renderPaymentTable(flatPayments, 'Payment Register', 'Chronological log of all recorded transaction receipts.')}
            {reportType === 'deposit_summary' && renderPaymentTable(flatPayments.filter(p => p.bank), 'Deposit Summary', 'Detailed list of payments mapped to specific banking institutions.')}
            {reportType === 'returned_cheque' && renderPaymentTable(flatPayments.filter(p => p.status === 'Bounced'), 'Returned Cheque Alert Log', 'High-risk registry of bounced/rejected cheque transactions.')}

            {/* STANDARD INVOICE TABLE VIEWS */}
            {['invoice_register', 'outstanding_invoice', 'paid_invoice', 'overdue_invoice', 'invoice_due_date', 'partial_payment', 'ar_detail', 'late_analysis'].includes(reportType) && (
              renderInvoiceTable(filteredInvoices, reportCategories.flatMap(c => c.reports).find(r => r.id === reportType)?.label?.substring(3) || 'Invoice Ledger', 'Detailed record of invoices matching your requested criteria.')
            )}

            {/* INVENTORY REPORTS */}
            {reportType === 'stock_on_hand' && renderStockOnHand()}
            {reportType === 'inventory_movement' && renderInventoryMovement()}
            {reportType === 'low_stock' && renderLowStock()}
            {reportType === 'out_of_stock' && renderOutOfStock()}
            {reportType === 'reserved_stock' && renderReservedStock()}
            {reportType === 'grn_report' && renderGRNReport()}
            {reportType === 'inventory_adjustment_report' && renderInventoryAdjustmentReport()}
            {reportType === 'expiry_report' && renderExpiryReport()}
            {reportType === 'daily_stock_in_out' && renderDailyStockInOut()}

            {/* PROCUREMENT REPORTS */}
            {['po_status_report','supplier_performance','grn_po_variance','pending_deliveries','purchase_price_history'].includes(reportType) && (
              <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {procurementLoading && (
                  <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading procurement data...</div>
                )}

                {/* PO STATUS REPORT */}
                {reportType === 'po_status_report' && !procurementLoading && (() => {
                  const byStatus: Record<string, { count: number; total: number; received: number }> = {};
                  procurementPos.forEach(po => {
                    if (!byStatus[po.status]) byStatus[po.status] = { count: 0, total: 0, received: 0 };
                    byStatus[po.status].count++;
                    byStatus[po.status].total += po.totalAmount || 0;
                    byStatus[po.status].received += po.receivedValue || 0;
                  });
                  const statuses = Object.entries(byStatus);
                  const statusColors: Record<string, string> = {
                    'Received': 'var(--success)', 'Partial_Received': '#fbbf24',
                    'Sent': 'var(--info)', 'Draft': 'var(--text-muted)', 'Cancelled': 'var(--danger)',
                  };
                  const q = tableSearch.toLowerCase();
                  const sf = statusFilter;
                  const filteredPos = procurementPos.filter((po: any) => {
                    if (sf && po.status !== sf) return false;
                    if (!q) return true;
                    return po.poNumber?.toLowerCase().includes(q) || po.supplierName?.toLowerCase().includes(q);
                  });
                  const paginatedPos = filteredPos.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                  return (
                    <>
                      {/* Status summary cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        {statuses.map(([status, data]) => (
                          <div key={status} className="glass-panel" style={{ padding: '1.2rem', borderTop: `3px solid ${statusColors[status] || 'var(--border-color)'}` }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>{status.replace('_', ' ')}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: statusColors[status] || 'var(--text-main)' }}>{data.count}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{data.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} ordered</div>
                          </div>
                        ))}
                      </div>
                      <div className="glass-panel" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-hover)', margin: 0 }}>📋 Purchase Order Status Breakdown</h3>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q || sf ? `${filteredPos.length} of ${procurementPos.length}` : `${procurementPos.length} POs`}</span>
                        </div>
                        {procurementPos.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No purchase orders found for the selected period.</p>
                        ) : (
                          <>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
                                <thead>
                                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '0.75rem' }}>PO Number</th>
                                    <th style={{ padding: '0.75rem' }}>Supplier</th>
                                    <th style={{ padding: '0.75rem' }}>Order Date</th>
                                    <th style={{ padding: '0.75rem' }}>Expected</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ordered</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Received</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Fulfilment</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedPos.map((po: any, i: number) => {
                                    const pct = po.fulfilmentPct || 0;
                                    const sColor = statusColors[po.status] || 'var(--text-muted)';
                                    return (
                                      <tr key={i} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.87rem' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>{po.poNumber}</td>
                                        <td style={{ padding: '0.75rem' }}>{po.supplierName}</td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(po.orderDate)}</td>
                                        <td style={{ padding: '0.75rem', color: po.expectedDate && new Date(po.expectedDate) < new Date() && po.status !== 'Received' ? 'var(--danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                          {po.expectedDate ? formatDate(po.expectedDate) : '—'}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>{(po.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>{(po.receivedValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                                            <div style={{ width: '55px', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 100 ? 'var(--success)' : pct > 50 ? '#fbbf24' : 'var(--danger)', borderRadius: '3px' }} />
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pct.toFixed(0)}%</span>
                                          </div>
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                          <span style={{ background: sColor + '22', color: sColor, padding: '0.15rem 0.55rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                            {po.status.replace('_', ' ')}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {filteredPos.length > rowsPerPage && renderPagination(filteredPos.length)}
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* SUPPLIER PERFORMANCE */}
                {reportType === 'supplier_performance' && !procurementLoading && (() => {
                  const q = tableSearch.toLowerCase();
                  const sorted = [...procurementSuppliers].sort((a, b) => b.totalOrdered - a.totalOrdered);
                  const filteredSupp = q ? sorted.filter((s: any) => s.supplierName?.toLowerCase().includes(q) || s.tinNumber?.toLowerCase().includes(q)) : sorted;
                  const paginatedSupp = filteredSupp.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                  return (
                    <div className="glass-panel" style={{ padding: '2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-hover)', margin: 0 }}>🏆 Supplier Performance Report</h3>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q ? `${filteredSupp.length} of ${sorted.length}` : `${sorted.length} suppliers`}</span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>On-time delivery rate, total ordered vs received, and open POs per supplier.</p>
                      {sorted.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No supplier data found.</p>
                      ) : (
                        <>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '720px' }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                                  <th style={{ padding: '0.75rem' }}>Supplier</th>
                                  <th style={{ padding: '0.75rem' }}>TIN</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Total POs</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ordered Value</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Received Value</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>On-Time</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pending</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Rating</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedSupp.map((s: any, i: number) => {
                                  const completedPOs = s.onTimeCount + s.lateCount;
                                  const onTimePct = completedPOs > 0 ? (s.onTimeCount / completedPOs * 100) : 0;
                                  const rating = onTimePct >= 90 ? { label: 'Excellent', color: 'var(--success)' }
                                    : onTimePct >= 70 ? { label: 'Good', color: '#fbbf24' }
                                    : onTimePct >= 50 ? { label: 'Fair', color: 'var(--warning)' }
                                    : completedPOs === 0 ? { label: 'No Data', color: 'var(--text-muted)' }
                                    : { label: 'Poor', color: 'var(--danger)' };
                                  return (
                                    <tr key={i} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.87rem' }}>
                                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>{s.supplierName}</td>
                                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{s.tinNumber || '—'}</td>
                                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{s.poCount}</td>
                                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>{s.totalOrdered.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                      <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>{s.totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                        {completedPOs > 0 ? (
                                          <span style={{ color: onTimePct >= 80 ? 'var(--success)' : 'var(--danger)' }}>{s.onTimeCount}/{completedPOs} ({onTimePct.toFixed(0)}%)</span>
                                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                      </td>
                                      <td style={{ padding: '0.75rem', textAlign: 'center', color: s.pendingCount > 0 ? '#fbbf24' : 'var(--text-muted)' }}>{s.pendingCount}</td>
                                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                        <span style={{ background: rating.color + '22', color: rating.color, padding: '0.15rem 0.55rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>{rating.label}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {filteredSupp.length > rowsPerPage && renderPagination(filteredSupp.length)}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* GRN vs PO VARIANCE */}
                {reportType === 'grn_po_variance' && !procurementLoading && (() => {
                  // Flatten to per-item rows for display
                  const q = tableSearch.toLowerCase();
                  const allRows: any[] = [];
                  procurementVariance.forEach(po => {
                    po.items.forEach((item: any) => {
                      allRows.push({ ...item, poNumber: po.poNumber, supplierName: po.supplierName, orderDate: po.orderDate, poStatus: po.status });
                    });
                  });
                  const rows = q ? allRows.filter(r => r.poNumber?.toLowerCase().includes(q) || r.supplierName?.toLowerCase().includes(q) || r.productName?.toLowerCase().includes(q) || r.sku?.toLowerCase().includes(q)) : allRows;
                  const withVariance = allRows.filter(r => r.variance !== 0);
                  const paginatedRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                  const totalOrdered = rows.reduce((s, r) => s + r.orderedValue, 0);
                  const totalReceived = rows.reduce((s, r) => s + r.receivedValue, 0);
                  return (
                    <div className="glass-panel" style={{ padding: '2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-hover)', marginBottom: '0.3rem' }}>⚖️ GRN vs PO Variance</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Ordered quantity vs received quantity per product per PO. Items with variance highlighted.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                          {[
                            { label: 'Total Ordered', value: totalOrdered, color: 'var(--accent-color)' },
                            { label: 'Total Received', value: totalReceived, color: 'var(--success)' },
                            { label: 'Gap', value: totalOrdered - totalReceived, color: 'var(--danger)' },
                          ].map(m => (
                            <div key={m.label} style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.label}</div>
                              <div style={{ fontWeight: 700, color: m.color, fontSize: '1rem' }}>{m.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {rows.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>{q ? 'No items match your search.' : 'No PO line items found.'}</p>
                      ) : (
                        <>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '820px' }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                  <th style={{ padding: '0.65rem' }}>PO #</th>
                                  <th style={{ padding: '0.65rem' }}>Supplier</th>
                                  <th style={{ padding: '0.65rem' }}>Product</th>
                                  <th style={{ padding: '0.65rem' }}>SKU</th>
                                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Ordered Qty</th>
                                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Received Qty</th>
                                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Variance</th>
                                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Value Gap</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedRows.map((row: any, i: number) => {
                                  const hasGap = row.variance < 0;
                                  const hasExcess = row.variance > 0;
                                  return (
                                    <tr key={i} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.86rem', background: hasGap ? 'rgba(244,63,94,0.04)' : hasExcess ? 'rgba(16,185,129,0.04)' : 'transparent' }}>
                                      <td style={{ padding: '0.65rem', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}>{row.poNumber}</td>
                                      <td style={{ padding: '0.65rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.supplierName}</td>
                                      <td style={{ padding: '0.65rem', fontWeight: 600 }}>{row.productName}</td>
                                      <td style={{ padding: '0.65rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{row.sku || '—'}</td>
                                      <td style={{ padding: '0.65rem', textAlign: 'right' }}>{row.orderedQty}</td>
                                      <td style={{ padding: '0.65rem', textAlign: 'right', color: 'var(--success)' }}>{row.receivedQty}</td>
                                      <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700, color: row.variance === 0 ? 'var(--success)' : row.variance > 0 ? 'var(--info)' : 'var(--danger)' }}>
                                        {row.variance > 0 ? '+' : ''}{row.variance}
                                      </td>
                                      <td style={{ padding: '0.65rem', textAlign: 'right', color: (row.orderedValue - row.receivedValue) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                                        {(row.orderedValue - row.receivedValue) !== 0 ? (row.orderedValue - row.receivedValue).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {withVariance.length > 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{withVariance.length} line items have a quantity variance.</p>}
                          {rows.length > rowsPerPage && renderPagination(rows.length)}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* PENDING DELIVERIES */}
                {reportType === 'pending_deliveries' && !procurementLoading && (() => {
                  const pending = procurementVariance.filter(po => ['Draft', 'Sent', 'Partial_Received'].includes(po.status))
                    .sort((a, b) => {
                      if (!a.expectedDate) return 1;
                      if (!b.expectedDate) return -1;
                      return new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime();
                    });
                  const overdue = pending.filter(po => po.expectedDate && new Date(po.expectedDate) < new Date());
                  const paginatedPending = pending.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                        {[
                          { label: 'Open POs', value: pending.length, color: 'var(--accent-color)', isCount: true },
                          { label: 'Overdue', value: overdue.length, color: 'var(--danger)', isCount: true },
                          { label: 'Partial', value: pending.filter(p => p.status === 'Partial_Received').length, color: '#fbbf24', isCount: true },
                          { label: 'Total Pending Value', value: pending.reduce((s: number, p: any) => s + p.items.reduce((si: number, i: any) => si + (i.orderedValue - i.receivedValue), 0), 0), color: 'var(--warning)' },
                        ].map(m => (
                          <div key={m.label} className="glass-panel" style={{ padding: '1.2rem', borderTop: `3px solid ${m.color}` }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>{m.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: m.color }}>
                              {m.isCount ? m.value : (m.value as number).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="glass-panel" style={{ padding: '2rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--accent-hover)' }}>🚚 Pending Deliveries</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>Purchase orders not yet fully received, sorted by expected delivery date.</p>
                        {pending.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>All purchase orders have been fully received. No pending deliveries.</p>
                        ) : (
                          <>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
                                <thead>
                                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '0.75rem' }}>PO #</th>
                                    <th style={{ padding: '0.75rem' }}>Supplier</th>
                                    <th style={{ padding: '0.75rem' }}>Status</th>
                                    <th style={{ padding: '0.75rem' }}>Order Date</th>
                                    <th style={{ padding: '0.75rem' }}>Expected By</th>
                                    <th style={{ padding: '0.75rem' }}>Products</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Remaining Value</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedPending.map((po: any, i: number) => {
                                    const remainingValue = po.items.reduce((s: number, item: any) => s + (item.orderedValue - item.receivedValue), 0);
                                    const isLate = po.expectedDate && new Date(po.expectedDate) < new Date();
                                    const statusColors: Record<string, string> = { 'Partial_Received': '#fbbf24', 'Sent': 'var(--info)', 'Draft': 'var(--text-muted)' };
                                    return (
                                      <tr key={i} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.87rem', background: isLate ? 'rgba(244,63,94,0.04)' : 'transparent' }}>
                                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>{po.poNumber}</td>
                                        <td style={{ padding: '0.75rem' }}>{po.supplierName}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                          <span style={{ background: (statusColors[po.status] || 'var(--text-muted)') + '22', color: statusColors[po.status] || 'var(--text-muted)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                            {po.status.replace('_', ' ')}
                                          </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(po.orderDate)}</td>
                                        <td style={{ padding: '0.75rem', color: isLate ? 'var(--danger)' : 'var(--text-muted)', fontWeight: isLate ? 700 : 400, whiteSpace: 'nowrap' }}>
                                          {po.expectedDate ? formatDate(po.expectedDate) : '—'} {isLate ? '⚠️' : ''}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{po.items.length} item{po.items.length !== 1 ? 's' : ''}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                                          {remainingValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {pending.length > rowsPerPage && renderPagination(pending.length)}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* PURCHASE PRICE HISTORY */}
                {reportType === 'purchase_price_history' && !procurementLoading && (() => {
                  const selectedProduct = procurementPriceHistory.find(p => p.productId === selectedPriceProductId);
                  const historyRows = selectedProduct ? selectedProduct.history : [];

                  // Price trend: detect increases
                  const priceChanges = historyRows.map((h: any, i: number) => {
                    const prev = i > 0 ? historyRows[i - 1].price : h.price;
                    return { ...h, prevPrice: prev, change: h.price - prev, changePct: prev > 0 ? ((h.price - prev) / prev * 100) : 0 };
                  });

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Product selector */}
                      <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-hover)' }}>📈 Purchase Price History — Select Product</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
                          {procurementPriceHistory.map((p: any) => (
                            <button
                              key={p.productId}
                              onClick={() => setSelectedPriceProductId(p.productId)}
                              style={{
                                padding: '0.4rem 0.9rem', fontSize: '0.83rem', borderRadius: '6px', cursor: 'pointer',
                                background: selectedPriceProductId === p.productId ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                                color: selectedPriceProductId === p.productId ? '#fff' : 'var(--text-main)',
                                border: selectedPriceProductId === p.productId ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                fontWeight: selectedPriceProductId === p.productId ? 600 : 400,
                              }}
                            >
                              {p.productName} {p.sku ? `(${p.sku})` : ''}
                            </button>
                          ))}
                        </div>
                        {procurementPriceHistory.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No purchase receipt data found for this period.</p>}
                      </div>

                      {selectedProduct && (
                        <div className="glass-panel" style={{ padding: '2rem' }}>
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedProduct.productName}</h3>
                            {selectedProduct.sku && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>SKU: {selectedProduct.sku}</div>}
                          </div>
                          {/* Price trend summary */}
                          {historyRows.length >= 2 && (() => {
                            const first = historyRows[0].price;
                            const last = historyRows[historyRows.length - 1].price;
                            const totalChange = last - first;
                            const totalPct = first > 0 ? (totalChange / first * 100) : 0;
                            return (
                              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', flexWrap: 'wrap' }}>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>First Price</div><div style={{ fontWeight: 700 }}>{first.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Latest Price</div><div style={{ fontWeight: 700 }}>{last.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
                                <div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Change</div>
                                  <div style={{ fontWeight: 700, color: totalChange > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                    {totalChange > 0 ? '+' : ''}{totalChange.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({totalPct > 0 ? '+' : ''}{totalPct.toFixed(1)}%)
                                  </div>
                                </div>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Receipts</div><div style={{ fontWeight: 700 }}>{historyRows.length}</div></div>
                              </div>
                            );
                          })()}
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '580px' }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                  <th style={{ padding: '0.65rem' }}>Date</th>
                                  <th style={{ padding: '0.65rem' }}>Supplier</th>
                                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Qty Received</th>
                                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Unit Price</th>
                                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>vs Previous</th>
                                </tr>
                              </thead>
                              <tbody>
                                {priceChanges.map((h: any, i: number) => (
                                  <tr key={i} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.87rem' }}>
                                    <td style={{ padding: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(h.date)}</td>
                                    <td style={{ padding: '0.65rem' }}>{h.supplierName}</td>
                                    <td style={{ padding: '0.65rem', textAlign: 'right' }}>{h.qty}</td>
                                    <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700 }}>{h.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '0.65rem', textAlign: 'right', color: i === 0 ? 'var(--text-muted)' : h.change > 0 ? 'var(--danger)' : h.change < 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: h.change !== 0 ? 600 : 400 }}>
                                      {i === 0 ? '—' : `${h.change > 0 ? '+' : ''}${h.change.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${h.changePct > 0 ? '+' : ''}${h.changePct.toFixed(1)}%)`}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {!selectedProduct && procurementPriceHistory.length > 0 && (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Select a product above to view its purchase price history.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* COLLECTOR REMINDERS FOLLOW-UP */}
            {reportType === 'collector_reminders' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>🔔 Collector Reminders Follow-up</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Active tracking of unresolved customer collection reminders and alerts.</p>
                
                {reminders.filter(r => !r.isResolved).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', padding: '3rem' }}>
                    No active reminders found. Excellent collection standing!
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <th style={{ padding: '1rem 0.75rem' }}>Customer Name</th>
                          <th style={{ padding: '1rem 0.75rem' }}>Reminder Notice / Alert Detail</th>
                          <th style={{ padding: '1rem 0.75rem' }}>Triggered Date</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reminders.filter(r => !r.isResolved).map((r: any) => (
                          <tr key={r.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                            <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{r.customer?.customerName || 'N/A'}</td>
                            <td style={{ padding: '1rem 0.75rem', color: 'var(--text-main)' }}>{r.message}</td>
                            <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>{formatDate(r.createdAt)}</td>
                            <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                              <button 
                                className="btn-primary" 
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: 'var(--success)' }}
                                onClick={async () => {
                                  try {
                                    const res = await apiFetch(`http://localhost:5000/api/reminders/${r.id}/resolve`, { method: 'POST' });
                                    if (res.ok) {
                                      setReminders(prev => prev.map(item => item.id === r.id ? { ...item, isResolved: true } : item));
                                    }
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                              >
                                Resolve
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* WITHHOLDING TAX RECONCILIATION */}
            {reportType === 'withholding_tax_recon' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>🧾 Withholding Tax Reconciliation</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Audit and reconcile 2% withholding tax entries on invoiced sales.</p>
                
                {invoices.filter(i => i.includeWithhold === true || (i.withhold !== null && i.withhold > 0)).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', padding: '3rem' }}>
                    No withholding tax invoice entries recorded.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <th style={{ padding: '1rem 0.75rem' }}>Invoice No</th>
                          <th style={{ padding: '1rem 0.75rem' }}>Customer</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Invoice Amount</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--warning)' }}>Withholding Tax</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--success)' }}>Remaining Balance</th>
                          <th style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>Tax Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.filter(i => i.includeWithhold === true || (i.withhold !== null && i.withhold > 0)).map((inv: any) => {
                          const estWithhold = inv.withhold || (inv.amount * 0.02);
                          return (
                            <tr key={inv.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                              <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                              <td style={{ padding: '1rem 0.75rem' }}>{inv.customer?.customerName}</td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>${inv.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--warning)', fontWeight: 600 }}>${estWithhold.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--success)' }}>${inv.remainingPayment.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                                <span style={{
                                  background: inv.status === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: inv.status === 'Paid' ? 'var(--success)' : 'var(--warning)',
                                  padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600'
                                }}>{inv.status}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ORDER STATUS BREAKDOWN */}
            {reportType === 'order_status_breakdown' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>📊 Order Status Breakdown</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Orders grouped by current status — count, total value, and percentage of total.</p>
                {orderReportSummary && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="stat-card" style={{ borderLeftColor: 'var(--accent-color)' }}>
                      <div className="stat-title">Total Orders</div>
                      <div className="stat-value">{orderReportSummary.totalOrders}</div>
                    </div>
                    <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
                      <div className="stat-title">Total Value</div>
                      <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1.1rem' }}>{(orderReportSummary.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="stat-card" style={{ borderLeftColor: 'var(--info)' }}>
                      <div className="stat-title">Completed Value</div>
                      <div className="stat-value" style={{ color: 'var(--info)', fontSize: '1.1rem' }}>{(orderReportSummary.completedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                )}
                {orderStatusBreakdown.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No orders found for this period.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Status</th>
                          <th style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>Orders</th>
                          <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Total Amount</th>
                          <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderStatusBreakdown.map((row, idx) => {
                          const pct = orderReportSummary?.totalAmount > 0 ? ((row.total / orderReportSummary.totalAmount) * 100).toFixed(1) : '0.0';
                          const statusColors: Record<string, string> = { Completed: 'var(--success)', Rejected: 'var(--danger)', Pending: 'var(--warning)', Finance_Approved: 'var(--info)', Manager_Approved: '#8b5cf6', Store_Confirmed: '#0ea5e9', Customer_Confirmed: '#f59e0b' };
                          const color = statusColors[row.status] || 'var(--text-muted)';
                          return (
                            <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                              <td style={{ padding: '0.9rem 0.75rem' }}>
                                <span style={{ background: `${color}22`, color, padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                                  {row.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>{row.count}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SALES BY CUSTOMER */}
            {reportType === 'sales_by_customer' && (() => {
              const q = tableSearch.toLowerCase();
              const displayed = q ? salesByCustomer.filter((r: any) => r.customerName?.toLowerCase().includes(q)) : salesByCustomer;
              const paginated = displayed.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return (
                <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>👥 Sales by Customer</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q ? `${displayed.length} of ${salesByCustomer.length}` : `${salesByCustomer.length} customers`}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Total order value per customer, ranked by revenue.</p>
                  {displayed.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>{q ? 'No customers match your search.' : 'No orders found for this period.'}</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            <th style={{ padding: '0.9rem 0.75rem' }}>#</th>
                            <th style={{ padding: '0.9rem 0.75rem' }}>Customer</th>
                            <th style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>Orders</th>
                            <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Total Ordered</th>
                            <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Completed</th>
                            <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Avg Order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.map((row: any, idx: number) => (
                            <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                              <td style={{ padding: '0.9rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                              <td style={{ padding: '0.9rem 0.75rem', fontWeight: 600 }}>{row.customerName}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>{row.orderCount}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{row.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--success)' }}>{row.completedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{(row.totalAmount / row.orderCount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {displayed.length > rowsPerPage && renderPagination(displayed.length)}
                </div>
              );
            })()}

            {/* SALES BY PRODUCT */}
            {reportType === 'sales_by_product' && (() => {
              const q = tableSearch.toLowerCase();
              const displayed = q ? salesByProduct.filter((r: any) => r.productName?.toLowerCase().includes(q) || r.sku?.toLowerCase().includes(q)) : salesByProduct;
              const paginated = displayed.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return (
                <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>📦 Sales by Product / SKU</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q ? `${displayed.length} of ${salesByProduct.length}` : `${salesByProduct.length} products`}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Top selling products ranked by total revenue from all orders.</p>
                  {displayed.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>{q ? 'No products match your search.' : 'No product order data found for this period.'}</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            <th style={{ padding: '0.9rem 0.75rem' }}>#</th>
                            <th style={{ padding: '0.9rem 0.75rem' }}>Product</th>
                            <th style={{ padding: '0.9rem 0.75rem' }}>SKU</th>
                            <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Qty Sold</th>
                            <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Order Lines</th>
                            <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Total Revenue</th>
                            <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Avg Unit Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.map((row: any, idx: number) => (
                            <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                              <td style={{ padding: '0.9rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                              <td style={{ padding: '0.9rem 0.75rem', fontWeight: 600 }}>{row.productName}</td>
                              <td style={{ padding: '0.9rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{row.sku || '—'}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{row.totalQty.toLocaleString()}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{row.orderCount}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{row.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{row.totalQty > 0 ? (row.totalRevenue / row.totalQty).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                  {displayed.length > rowsPerPage && renderPagination(displayed.length)}
                </div>
              );
            })()}

            {/* WHT REPORT */}
            {reportType === 'wht_report' && (() => {
              const q = tableSearch.toLowerCase();
              const displayed = q ? whtReportData.filter((r: any) => r.invoiceNumber?.toLowerCase().includes(q) || r.customerName?.toLowerCase().includes(q) || r.tinNumber?.toLowerCase().includes(q) || r.salesRepName?.toLowerCase().includes(q)) : whtReportData;
              const paginated = displayed.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              const filteredTotal = displayed.reduce((s: number, r: any) => s + r.whtAmount, 0);
              return (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>🧾 Withholding Tax (WHT) Report</h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q ? `${displayed.length} of ${whtReportData.length}` : `${whtReportData.length} invoices`}</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Detailed breakdown of withholding tax applied per invoice.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
                    <div className="stat-title">WHT Invoices</div>
                    <div className="stat-value">{whtReportData.length}</div>
                  </div>
                  <div className="stat-card" style={{ borderLeftColor: 'var(--danger)' }}>
                    <div className="stat-title">Total WHT Collected</div>
                    <div className="stat-value" style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>{whtTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="stat-card" style={{ borderLeftColor: 'var(--accent-color)' }}>
                    <div className="stat-title">Invoice Total (WHT incl.)</div>
                    <div className="stat-value" style={{ fontSize: '1.1rem' }}>{displayed.reduce((s: number, r: any) => s + r.invoiceAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
                {displayed.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>{q ? 'No results match your search.' : 'No withholding tax invoices found.'}</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Invoice #</th>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Date</th>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Customer</th>
                          <th style={{ padding: '0.9rem 0.75rem' }}>TIN</th>
                          <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Invoice Amt</th>
                          <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--warning)' }}>WHT Amt</th>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Sales Rep</th>
                          <th style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((row: any, idx: number) => (
                          <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                            <td style={{ padding: '0.9rem 0.75rem', fontWeight: 600 }}>{row.invoiceNumber}</td>
                            <td style={{ padding: '0.9rem 0.75rem', color: 'var(--text-muted)' }}>{formatDate(row.invoiceDate)}</td>
                            <td style={{ padding: '0.9rem 0.75rem' }}>{row.customerName}</td>
                            <td style={{ padding: '0.9rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{row.tinNumber || '—'}</td>
                            <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>{row.invoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', color: 'var(--warning)', fontWeight: 600 }}>{row.whtAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '0.9rem 0.75rem', color: 'var(--text-muted)' }}>{row.salesRep}</td>
                            <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>
                              <span style={{ background: row.status === 'Paid' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: row.status === 'Paid' ? 'var(--success)' : 'var(--warning)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{row.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {displayed.length > rowsPerPage && renderPagination(displayed.length)}
              </div>
              );
            })()}

            {/* ORDER HISTORY */}
            {reportType === 'order_history' && (() => {
              const q = tableSearch.toLowerCase();
              const sf = statusFilter;
              const displayedOrders = orderReportData.filter((o: any) => {
                if (sf && o.status !== sf) return false;
                if (!q) return true;
                return o.orderNumber?.toLowerCase().includes(q) || o.customerName?.toLowerCase().includes(q) || (o.salesRep?.firstName + ' ' + o.salesRep?.lastName).toLowerCase().includes(q);
              });
              const orderStatuses = [...new Set(orderReportData.map((o: any) => o.status).filter(Boolean))];
              const paginatedOrders = displayedOrders.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
              return (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-hover)', margin: 0 }}>📋 Order History</h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{q || sf ? `${displayedOrders.length} of ${orderReportData.length}` : `${orderReportData.length} orders`}</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Full order history with customer, status, and value details.</p>
                {orderReportSummary && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="stat-card" style={{ borderLeftColor: 'var(--accent-color)' }}>
                      <div className="stat-title">Total Orders</div>
                      <div className="stat-value">{orderReportSummary.totalOrders}</div>
                    </div>
                    <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
                      <div className="stat-title">Total Value</div>
                      <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1.1rem' }}>{(orderReportSummary.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                )}
                {displayedOrders.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>{q || sf ? 'No orders match your search.' : 'No orders found for this period.'}</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Order #</th>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Customer</th>
                          <th style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Type</th>
                          <th style={{ padding: '0.9rem 0.75rem', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Created</th>
                          <th style={{ padding: '0.9rem 0.75rem' }}>Sales Rep</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedOrders.map((order: any, idx: number) => {
                          const statusColors: Record<string, string> = { Completed: 'var(--success)', Rejected: 'var(--danger)', Pending: 'var(--warning)', Finance_Approved: 'var(--info)', Manager_Approved: '#8b5cf6', Store_Confirmed: '#0ea5e9', Customer_Confirmed: '#f59e0b' };
                          const color = statusColors[order.status] || 'var(--text-muted)';
                          const rep = order.salesRep ? `${order.salesRep.firstName} ${order.salesRep.lastName}` : (order.createdBy || '—');
                          return (
                            <tr key={order.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                              <td style={{ padding: '0.9rem 0.75rem', fontWeight: 600 }}>
                                <a href={`/orders/${order.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{order.orderNumber}</a>
                              </td>
                              <td style={{ padding: '0.9rem 0.75rem' }}>{order.customerName}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>
                                <span style={{ background: `${color}22`, color, padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                                  {order.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '0.9rem 0.75rem', color: 'var(--text-muted)' }}>{order.salesType}</td>
                              <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '0.9rem 0.75rem', color: 'var(--text-muted)' }}>{formatDate(order.createdAt)}</td>
                              <td style={{ padding: '0.9rem 0.75rem', color: 'var(--text-muted)' }}>{rep}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {displayedOrders.length > rowsPerPage && renderPagination(displayedOrders.length)}
              </div>
              );
            })()}

            {/* CEI ANALYSIS */}
            {reportType === 'cei_analysis' && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-hover)' }}>🏆 Collection Efficiency Index (CEI)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Collection Efficiency Index measures the percentage of accounts receivable cleared relative to total available credit.</p>
                
                {(() => {
                  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
                  const totalCollected = flatPayments.filter(p => p.status === 'Collected').reduce((sum, p) => sum + p.amount, 0);
                  const overallCEI = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;
                  
                  return (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                        <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid var(--accent)' }}>
                          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Sales (Invoiced)</h4>
                          <h2 style={{ fontSize: '2.25rem', fontWeight: 700 }}>${totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                        </div>
                        <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid var(--success)' }}>
                          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Cleared Collections</h4>
                          <h2 style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--success)' }}>${totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                        </div>
                        <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center', borderTop: `4px solid ${overallCEI > 80 ? 'var(--success)' : 'var(--warning)'}` }}>
                          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Collection Efficiency Index (CEI)</h4>
                          <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: overallCEI > 80 ? 'var(--success)' : 'var(--warning)' }}>{overallCEI}%</h2>
                        </div>
                      </div>

                      <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff' }}>Collection Efficiency by Salesperson</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            <th style={{ padding: '1rem 0.75rem' }}>Salesperson</th>
                            <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Target / Invoiced</th>
                            <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Collected</th>
                            <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Efficiency Index</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salespersonPerformance.map((rep, idx) => {
                            const repCEI = rep.totalInvoiced > 0 ? Math.round((rep.totalCollected / rep.totalInvoiced) * 100) : 0;
                            return (
                              <tr key={idx} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                                <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{rep.name}</td>
                                <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>${rep.totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td style={{ padding: '1rem 0.75rem', textAlign: 'right', color: 'var(--success)' }}>${rep.totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: 700, color: repCEI > 80 ? 'var(--success)' : repCEI > 50 ? 'var(--warning)' : 'var(--danger)' }}>
                                  {repCEI}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* CHEQUE COLLECTION REPORTS */}
            {['cheques_due_today', 'overdue_for_deposit', 'upcoming_maturity', 'pending_clearance', 'bounced_cheques', 'collected_this_period', 'cash_vs_cheque', 'cheque_aging', 'deposit_bank_breakdown', 'bulk_payment_tracker'].includes(reportType) && (
              <div className="glass-panel" style={{ padding: '2rem', animation: 'slideUp 0.3s ease-out' }}>
                {(() => {
                  const headerLabel = reportCategories.flatMap(c => c.reports).find(r => r.id === reportType)?.label?.replace(/^[^\s]+\s/, '').replace(/\([^)]*\)/, '').trim() || 'Cheque Report';
                  return (
                    <>
                      <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem', color: reportAccentColor, fontWeight: 700 }}>
                        {'🏦'} {headerLabel}
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                        {reportCategories.flatMap(c => c.reports).find(r => r.id === reportType)?.desc || 'Cheque collection report'}
                      </p>
                      <ChequeCollectionReports
                        reportType={reportType}
                        data={{
                          chequesDueToday, chequesDueTodaySummary,
                          overdueForDeposit, overdueForDepositSummary,
                          upcomingMaturity, upcomingMaturitySummary,
                          pendingClearance, pendingClearanceSummary,
                          bouncedCheques, bouncedChequesSummary,
                          collectedThisPeriod, collectedThisPeriodSummary,
                          cashVsChequeSummary, cashVsChequeMonthly,
                          chequeAgingBuckets, chequeAgingSummary,
                          depositBankData, bulkPaymentBatches,
                        }}
                        accentColor={reportAccentColor}
                        loading={loading}
                      />
                    </>
                  );
                })()}
              </div>
            )}

          </>
        )}
          </>
        )}
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .sidebar-item-hover:hover { background: rgba(255,255,255,0.06) !important; }
        .report-hub-item:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.14) !important; transform: translateX(2px); }
      `}} />
    </div>
  );
}
