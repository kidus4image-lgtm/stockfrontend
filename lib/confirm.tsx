'use client';

import React from 'react';
import { createRoot, Root } from 'react-dom/client';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function confirmAsync(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const cleanup = () => {
      root.unmount();
      if (container.parentNode) document.body.removeChild(container);
    };

    const handleConfirm = () => { cleanup(); resolve(true); };
    const handleCancel = () => { cleanup(); resolve(false); };

    root.render(
      <ConfirmDialog {...options} onConfirm={handleConfirm} onCancel={handleCancel} />
    );
  });
}

function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'warning', onConfirm, onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const icon = variant === 'danger' ? '🚨' : variant === 'warning' ? '⚠️' : 'ℹ️';
  const grad = variant === 'danger'
    ? 'rgba(239,68,68,0.2), rgba(220,38,38,0.1)'
    : variant === 'warning'
    ? 'rgba(249,115,22,0.2), rgba(234,88,12,0.1)'
    : 'rgba(59,130,246,0.2), rgba(37,99,235,0.1)';
  const btnGrad = variant === 'danger'
    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
    : variant === 'warning'
    ? 'linear-gradient(135deg, #f97316, #ea580c)'
    : 'linear-gradient(135deg, #3b82f6, #2563eb)';
  const borderColor = variant === 'danger'
    ? 'rgba(239,68,68,0.3)'
    : variant === 'warning'
    ? 'rgba(249,115,22,0.2)'
    : 'rgba(59,130,246,0.2)';
  const titleColor = variant === 'danger' ? '#f87171' : variant === 'warning' ? '#fb923c' : '#60a5fa';

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 100000, padding: '1.5rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '420px', width: '100%', padding: '2.5rem 2rem 2rem',
          borderRadius: '20px', background: 'rgba(17,24,39,0.98)',
          border: `1px solid ${borderColor}`,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          textAlign: 'center', animation: 'slideUp 0.25s ease',
        }}
      >
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: `linear-gradient(135deg, ${grad})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem', border: `2px solid ${borderColor}`,
        }}>
          <span style={{ fontSize: '2rem' }}>{icon}</span>
        </div>
        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: titleColor }}>
          {title}
        </h3>
        <p style={{
          color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6',
          fontSize: '0.9rem', padding: '0 0.5rem',
        }}>
          {message}
        </p>
        <div style={{
          display: 'flex', gap: '0.75rem', justifyContent: 'center',
          borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 600,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px', color: 'var(--text-muted)', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.7rem 1.8rem', fontSize: '0.85rem', fontWeight: 700,
              background: btnGrad, border: 'none', borderRadius: '10px', color: '#fff',
              cursor: 'pointer',
              boxShadow: `0 4px 16px ${variant === 'danger' ? 'rgba(239,68,68,0.35)' : variant === 'warning' ? 'rgba(249,115,22,0.35)' : 'rgba(59,130,246,0.35)'}`,
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
          >
            ✅ {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
