'use client';

import React, { useState } from 'react';
import { exportToPDF, printElement, type ExportOptions } from '../lib/exportUtils';
import { useSettings } from '../lib/SettingsContext';

interface ReportExportToolbarProps {
  exportOptions: ExportOptions;
  printElementId?: string;
  variant?: 'full' | 'compact' | 'dropdown';
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function ReportExportToolbar({
  exportOptions,
  printElementId,
  variant = 'full',
  disabled = false,
  style,
}: ReportExportToolbarProps) {
  const [activeExport, setActiveExport] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { settings, getDefaultTemplate } = useSettings();

  function buildEnrichedOptions(): ExportOptions {
    const tpl = getDefaultTemplate();
    const brandOverride = {
      name: settings.companyName,
      address: settings.companyAddress,
      phone: settings.companyPhone,
      tin: settings.registrationNumber,
      colorHex: settings.reportAccentColor,
      showLogo: tpl?.showLogo ?? true,
      showAddress: tpl?.showAddress ?? true,
      showPhone: tpl?.showPhone ?? true,
      showTin: tpl?.showTin ?? true,
      footerText: tpl?.footerText ?? '',
    };
    return {
      ...exportOptions,
      logo: exportOptions.logo !== undefined ? exportOptions.logo : (settings.companyLogo || null),
      brand: { ...brandOverride, ...exportOptions.brand },
    };
  }

  const handleExport = async (format: 'pdf' | 'print') => {
    if (disabled || !exportOptions.data || exportOptions.data.length === 0) return;

    setActiveExport(format);
    try {
      const enriched = buildEnrichedOptions();
      if (format === 'pdf') {
        exportToPDF(enriched);
      } else {
        if (printElementId) {
          printElement(printElementId, enriched.brand);
        } else {
          window.print();
        }
      }
    } catch (err) {
      console.error(`Export to ${format} failed:`, err);
    } finally {
      setActiveExport(null);
      setDropdownOpen(false);
    }
  };

  const isEmpty = !exportOptions.data || exportOptions.data.length === 0;

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.4rem 0.7rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.04)',
    color: disabled || isEmpty ? 'var(--text-muted)' : 'var(--text-main)',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: disabled || isEmpty ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease',
    opacity: disabled || isEmpty ? 0.5 : 1,
    whiteSpace: 'nowrap' as const,
  };

  const btnHoverStyle = (e: React.MouseEvent<HTMLButtonElement>, entering: boolean) => {
    if (disabled || isEmpty) return;
    const btn = e.currentTarget;
    if (entering) {
      btn.style.background = 'rgba(255,255,255,0.08)';
      btn.style.borderColor = 'rgba(255,255,255,0.15)';
    } else {
      btn.style.background = 'rgba(255,255,255,0.04)';
      btn.style.borderColor = 'var(--border-color)';
    }
  };

  const activeStyle: React.CSSProperties = activeExport
    ? { opacity: 0.6, pointerEvents: 'none' as const }
    : {};

  // ── Compact: Single dropdown button ──
  if (variant === 'compact' || variant === 'dropdown') {
    return (
      <div style={{ position: 'relative', ...style }}>
        <button
          onClick={() => !disabled && !isEmpty && setDropdownOpen(!dropdownOpen)}
          style={{ ...btnBase, padding: '0.35rem 0.6rem', fontSize: '0.75rem', ...activeStyle }}
          disabled={disabled || isEmpty}
          title="Export options"
        >
          <span style={{ fontSize: '0.85rem' }}>📥</span>
          <span>Export</span>
          <span style={{ fontSize: '0.6rem', marginLeft: '2px' }}>▼</span>
        </button>

        {dropdownOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              onClick={() => setDropdownOpen(false)}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: 'rgba(17,24,39,0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                zIndex: 1000,
                overflow: 'hidden',
                minWidth: '140px',
              }}
            >
              <DropdownItem
                icon="📄"
                label="Export PDF"
                onClick={() => handleExport('pdf')}
                loading={activeExport === 'pdf'}
              />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <DropdownItem
                icon="🖨️"
                label="Print"
                onClick={() => handleExport('print')}
                loading={activeExport === 'print'}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Full: Individual buttons ──
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', ...style }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>
        Export:
      </span>

      <button
        onClick={() => handleExport('pdf')}
        style={{ ...btnBase, ...activeStyle }}
        disabled={disabled || isEmpty}
        onMouseEnter={(e) => btnHoverStyle(e, true)}
        onMouseLeave={(e) => btnHoverStyle(e, false)}
        title="Download as PDF"
      >
        <span style={{ fontSize: '0.85rem' }}>📄</span>
        PDF
        {activeExport === 'pdf' && <span style={{ fontSize: '0.65rem' }}>...</span>}
      </button>

      <button
        onClick={() => handleExport('print')}
        style={{ ...btnBase, ...activeStyle }}
        disabled={disabled || isEmpty}
        onMouseEnter={(e) => btnHoverStyle(e, true)}
        onMouseLeave={(e) => btnHoverStyle(e, false)}
        title="Print report"
      >
        <span style={{ fontSize: '0.85rem' }}>🖨️</span>
        Print
        {activeExport === 'print' && <span style={{ fontSize: '0.65rem' }}>...</span>}
      </button>
    </div>
  );
}

function DropdownItem({
  icon,
  label,
  onClick,
  loading,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        width: '100%',
        padding: '0.6rem 0.85rem',
        border: 'none',
        background: 'transparent',
        color: '#cbd5e1',
        fontSize: '0.8rem',
        cursor: loading ? 'wait' : 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        opacity: loading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontSize: '0.9rem' }}>{loading ? '⏳' : icon}</span>
      {label}
    </button>
  );
}
