'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../lib/api';
import { showWarning, showError, showSuccess } from '../../lib/toast';
import { exportToPDF, ExportColumn } from '../../lib/exportUtils';

interface Batch {
  id: number;
  batchNumber: string;
  quantity: number;
  reservedQuantity: number;
  expiryDate: string | null;
  receivedDate: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  minStock: number;
  purchaseUnit: string;
  sellingUnit: string;
  conversionFactor: number;
  showOnPriceList?: boolean;
  batches: Batch[];
}

interface CompanySettings {
  id: number;
  companyName: string | null;
  companyLogo: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  registrationNumber: string | null;
  expiryDisplayType?: string;
  reportAccentColor?: string;
}

export default function PriceListPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const accentColor = settings?.reportAccentColor || '#174f49';

  useEffect(() => {
    fetchData();
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const role = parsed.role?.toLowerCase();
        setIsAdmin(role === 'admin' || role === 'manager');
      }
    } catch {}
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const settingsRes = await apiFetch('http://localhost:5000/api/settings');
      const settingsData = await settingsRes.json();
      setSettings(settingsData);

      const productsRes = await apiFetch('http://localhost:5000/api/inventory/products');
      const productsData = await productsRes.json();
      const activeProducts = productsData
        .filter((p: any) => p.showOnPriceList !== false)
        .map((p: any) => ({
          ...p,
          batches: p.batches || []
        }));
      setProducts(activeProducts);
    } catch (error) {
      console.error('Failed to fetch price list data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableQuantity = (product: Product): number => {
    return (product.batches || []).reduce((sum, b) => sum + Math.max(0, b.quantity - (b.reservedQuantity || 0)), 0);
  };

  const getExpiryBatches = (product: Product): Batch[] => {
    return (product.batches || []).filter(b => (b.quantity - (b.reservedQuantity || 0)) > 0 && b.expiryDate && !isNaN(new Date(b.expiryDate).getTime()));
  };

  const formatExpiryDate = (product: Product): string => {
    const displayType = settings?.expiryDisplayType || 'long';
    const matchingBatches = getExpiryBatches(product);

    if (matchingBatches.length === 0) return 'N/A';

    const earliest = matchingBatches.reduce((min, b) => {
      const d = new Date(b.expiryDate!);
      return d < min ? d : min;
    }, new Date(matchingBatches[0].expiryDate!));

    if (displayType === 'short') {
      return earliest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return earliest.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const visibleProducts = products.filter(p => getAvailableQuantity(p) > 0);

  const handleExportPDF = async () => {
    if (visibleProducts.length === 0) {
      showWarning('No products available on the price list to export.');
      return;
    }

    try {
      setExporting(true);
      setShowExportModal(false);

      const columns: ExportColumn[] = [
        { key: 'no',     label: '#',            align: 'center', width: 10 },
        { key: 'sku',    label: 'SKU',                           width: 25 },
        { key: 'name',   label: 'Product Name' },
        { key: 'unit',   label: 'Unit',                          width: 22 },
        { key: 'expiry', label: 'Expiry Date',  align: 'center', width: 32 },
        { key: 'price',  label: 'Price (ETB)',  align: 'right',  width: 30 },
      ];

      const data = visibleProducts.map((p, idx) => ({
        no:     String(idx + 1),
        sku:    p.sku,
        name:   p.name,
        unit:   p.sellingUnit || 'Unit',
        expiry: formatExpiryDate(p),
        price:  `${p.price.toFixed(2)} ETB`,
      }));

      const slug = (settings?.companyName || 'price_list')
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
      const filename = `${slug}_price_list_${new Date().toISOString().slice(0, 10)}`;

      exportToPDF({
        title:    'Official Product Price List',
        subtitle: `${visibleProducts.length} products · As of ${new Date().toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        columns,
        data,
        filename,
        logo:          settings?.companyLogo   || null,
        companyName:   settings?.companyName   || undefined,
        companyAddress: settings?.companyAddress || undefined,
        companyPhone:  settings?.companyPhone  || undefined,
        companyTin:    settings?.registrationNumber || undefined,
        brand: { colorHex: accentColor },
      });

      showSuccess('PDF exported successfully.');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      showError('Error generating price list PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (visibleProducts.length === 0) {
      showWarning('No products available on the price list to export.');
      return;
    }

    try {
      setExporting(true);
      setShowExportModal(false);

      const wb = XLSX.utils.book_new();

      const headerRows: any[][] = [];
      if (settings?.companyName) headerRows.push([settings.companyName]);
      if (settings?.companyAddress) headerRows.push([`Address: ${settings.companyAddress}`]);
      if (settings?.companyPhone) headerRows.push([`Phone: ${settings.companyPhone}`]);
      if (settings?.registrationNumber) headerRows.push([`TIN/Registration: ${settings.registrationNumber}`]);
      headerRows.push([]);
      headerRows.push(['OFFICIAL PRODUCT PRICE LIST']);
      headerRows.push([`Generated Date: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`]);
      headerRows.push([]);

      const tableHeader = ['#', 'SKU', 'Product Name', 'Unit', 'Expiry Date', 'Price (ETB)'];
      const tableRows = visibleProducts.map((p, idx) => [
        idx + 1,
        p.sku,
        p.name,
        p.sellingUnit || 'Unit',
        formatExpiryDate(p),
        p.price
      ]);

      const allRows = [...headerRows, tableHeader, ...tableRows];
      allRows.push([]);
      allRows.push(['Developed by ESTAI']);

      const ws = XLSX.utils.aoa_to_sheet(allRows);

      ws['!cols'] = [
        { wch: 5 },
        { wch: 18 },
        { wch: 45 },
        { wch: 12 },
        { wch: 22 },
        { wch: 15 }
      ];

      const headerMergeRows = headerRows.length;
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: headerMergeRows + 1, c: 0 }, e: { r: headerMergeRows + 1, c: 5 } }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Price List');
      const xlsxSlug = (settings?.companyName || 'price_list')
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '');
      XLSX.writeFile(wb, `${xlsxSlug}_price_list_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showSuccess('Excel file exported successfully.');
    } catch (err) {
      console.error('Failed to generate Excel:', err);
      showError('Error generating Excel file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {showExportModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowExportModal(false)}>
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', minWidth: '380px', maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: '#fff' }}>Choose Export Format</h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Select a format to export {visibleProducts.length} products from the price list.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.08)', cursor: exporting ? 'not-allowed' : 'pointer', transition: 'all 0.2s', color: '#fff', fontSize: '0.95rem', textAlign: 'left' }}
                onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = 'rgba(244,63,94,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}>
                <span style={{ fontSize: '1.8rem' }}>📄</span>
                <div>
                  <div style={{ fontWeight: 700 }}>Export as PDF</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Branded PDF with logo, header, and formatted table</div>
                </div>
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exporting}
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', cursor: exporting ? 'not-allowed' : 'pointer', transition: 'all 0.2s', color: '#fff', fontSize: '0.95rem', textAlign: 'left' }}
                onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; }}>
                <span style={{ fontSize: '1.8rem' }}>📊</span>
                <div>
                  <div style={{ fontWeight: 700 }}>Export as Excel</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Spreadsheet with company header, editable data rows</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowExportModal(false)}
              style={{ marginTop: '1.25rem', width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{
        background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}11 50%, transparent 100%)`,
        border: `1px solid ${accentColor}33`,
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-10px', fontSize: '8rem', opacity: 0.06, pointerEvents: 'none', transform: 'rotate(15deg)' }}>💊</div>
        <div style={{ position: 'absolute', bottom: '-10px', left: '30%', fontSize: '5rem', opacity: 0.04, pointerEvents: 'none', transform: 'rotate(-10deg)' }}>⚕️</div>
        <div style={{ position: 'absolute', top: '10px', right: '30%', fontSize: '3.5rem', opacity: 0.04, pointerEvents: 'none' }}>🏥</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2rem' }}>📋</span>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: '#fff' }}>Price List Generator</h1>
            </div>
            <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>
              Generate and export branded catalogs of active products. Customize show/hide states on the Products page.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1 }}>
            <button
              className="btn-secondary"
              onClick={() => router.push('/inventory?tab=products')}
              style={{ padding: '0.75rem 1.25rem' }}
            >
              📦 Products Catalog
            </button>

            <button
              className="btn-primary"
              onClick={() => setShowExportModal(true)}
              disabled={exporting || loading || visibleProducts.length === 0}
              style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}
            >
              {exporting ? 'Exporting...' : '📥 Export Price List'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', borderRadius: '16px', border: `1px solid ${accentColor}22` }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>💊</span>
            <p style={{ color: accentColor, fontWeight: 600 }}>Loading active price list records...</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '2rem' }}>

          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px', height: 'fit-content', border: `1px solid ${accentColor}33`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-15px', right: '-15px', fontSize: '5rem', opacity: 0.04, pointerEvents: 'none', transform: 'rotate(20deg)' }}>💊</div>
            <h3 style={{ fontSize: '1.15rem', color: '#fff', margin: '0 0 1rem 0', paddingBottom: '0.75rem', borderBottom: `2px solid ${accentColor}55` }}>
              🏢 Branded Template
            </h3>

            {settings?.companyLogo ? (
              <div style={{ textAlign: 'center', padding: '1rem', background: `${accentColor}11`, border: `1px solid ${accentColor}33`, borderRadius: '12px', marginBottom: '1.25rem' }}>
                <img
                  src={settings.companyLogo.startsWith('data:image') ? settings.companyLogo : `data:image/png;base64,${settings.companyLogo}`}
                  alt="Company Logo Preview"
                  style={{ maxHeight: '90px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }}
                />
                <span style={{ fontSize: '0.7rem', color: accentColor, display: 'block', marginTop: '0.5rem', fontWeight: 600 }}>Active Logo Loaded</span>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', background: `rgba(255,255,255,0.02)`, border: `1px dashed ${accentColor}55`, borderRadius: '12px', marginBottom: '1.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                🏢 No Company Logo Uploaded
                {isAdmin && (
                  <button
                    onClick={() => router.push('/settings?tab=company')}
                    style={{ display: 'block', margin: '0.5rem auto 0 auto', background: 'none', border: 'none', color: accentColor, fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Configure Logo
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ borderLeft: `2px solid ${accentColor}55`, paddingLeft: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>COMPANY NAME</span>
                <span style={{ color: '#fff', fontWeight: 500 }}>{settings?.companyName || 'Nexlify'}</span>
              </div>
              <div style={{ borderLeft: `2px solid ${accentColor}55`, paddingLeft: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>ADDRESS</span>
                <span style={{ color: '#fff' }}>{settings?.companyAddress || 'Not Configured'}</span>
              </div>
              <div style={{ borderLeft: `2px solid ${accentColor}55`, paddingLeft: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>PHONE NUMBER</span>
                <span style={{ color: '#fff' }}>{settings?.companyPhone || 'Not Configured'}</span>
              </div>
              <div style={{ borderLeft: `2px solid ${accentColor}55`, paddingLeft: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>TIN / REGISTRATION</span>
                <span style={{ color: '#fff' }}>{settings?.registrationNumber || 'Not Configured'}</span>
              </div>
              <div style={{ borderLeft: `2px solid ${accentColor}55`, paddingLeft: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>EXPIRY DISPLAY</span>
                <span style={{ color: accentColor, fontWeight: 500 }}>{settings?.expiryDisplayType === 'short' ? 'Short Exp (Mon YYYY)' : 'Long Exp (Month DD, YYYY)'}</span>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', padding: '0.6rem 0.75rem', background: `${accentColor}11`, borderRadius: '8px', border: `1px solid ${accentColor}22` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Products on list</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>{visibleProducts.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Report color</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: accentColor }}></span>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.7rem' }}>{accentColor.toUpperCase()}</span>
                </span>
              </div>
            </div>

            {isAdmin && (
              <button
                className="btn-secondary"
                onClick={() => router.push('/settings?tab=appearance')}
                style={{ width: '100%', marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.8rem', border: `1px solid ${accentColor}44`, color: accentColor }}
              >
                🎨 Customize Colors
              </button>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', border: `1px solid ${accentColor}22`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: '-20px', right: '-10px', fontSize: '7rem', opacity: 0.03, pointerEvents: 'none', transform: 'rotate(-15deg)' }}>💊</div>
            <div style={{ position: 'absolute', top: '50%', left: '-20px', fontSize: '4rem', opacity: 0.03, pointerEvents: 'none', transform: 'rotate(-25deg)' }}>⚕️</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', color: '#fff', margin: 0 }}>📋 Catalog Live Preview</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Showing {visibleProducts.length} products with available stock.</span>
              </div>

              <span style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44`, padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                📋 Live Template
              </span>
            </div>

            {visibleProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: `1px dashed ${accentColor}44` }}>
                <span style={{ fontSize: '2.5rem' }}>📭</span>
                <h4 style={{ color: '#fff', marginTop: '1rem', marginBottom: '0.5rem' }}>No Products With Available Stock</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
                  Only products with available stock (quantity minus reserved) are shown. Ensure products have batches with stock greater than zero.
                </p>
                <button
                  className="btn-primary"
                  onClick={() => router.push('/inventory?tab=products')}
                  style={{ marginTop: '1.25rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}
                >
                  Manage Products
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${accentColor}55`, color: accentColor, fontSize: '0.8rem' }}>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '40px', background: `${accentColor}11` }}>#</th>
                      <th style={{ padding: '0.75rem 0.5rem', background: `${accentColor}11` }}>SKU</th>
                      <th style={{ padding: '0.75rem 0.5rem', background: `${accentColor}11` }}>PRODUCT NAME</th>
                      <th style={{ padding: '0.75rem 0.5rem', background: `${accentColor}11` }}>SELLING UNIT</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', background: `${accentColor}11` }}>EXPIRY DATE</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', background: `${accentColor}11` }}>PRICE (ETB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((p, idx) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.85rem', transition: 'background 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}08` }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '1rem 0.5rem' }}>
                          <span style={{ color: accentColor, background: `${accentColor}15`, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {p.sku}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.5rem', color: '#fff', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '1rem 0.5rem' }}>
                          <span style={{ background: `${accentColor}18`, color: accentColor, padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {p.sellingUnit || 'Unit'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center', fontSize: '0.8rem', color: formatExpiryDate(p) === 'N/A' ? 'var(--text-muted)' : accentColor }}>
                          {formatExpiryDate(p)}
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                          <span style={{ color: accentColor }}>{p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> ETB
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
