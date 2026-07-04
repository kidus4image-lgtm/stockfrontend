'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { apiFetch } from '../lib/api';

interface ChatBlock {
  type: 'text' | 'table' | 'chart';
  content?: string;
  title?: string;
  headers?: string[];
  rows?: string[][];
  chartType?: 'bar' | 'line' | 'pie';
  data?: any[];
  dataKeys?: { x: string; y: string; y2?: string };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  blocks?: ChatBlock[];
  error?: boolean;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const suggestedQuestions = [
  'Show me a summary of all overdue invoices',
  'Which customers have the highest outstanding balance?',
  'Show me a chart of payments by bank',
  'What is the total revenue breakdown by sales type?',
  'List all bounced cheques with details',
  'Show me a trend of invoice amounts this year',
];

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMessage: ChatMessage = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await apiFetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history })
      });

      if (!res.ok) {
        const errData = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: errData.error || 'Something went wrong.', error: true }]);
        return;
      }

      const data = await res.json();
      const blocks: ChatBlock[] = data.response?.blocks || [{ type: 'text', content: data.rawContent || 'No response.' }];
      const summary = blocks.find(b => b.type === 'text')?.content || 'Here are the results.';

      setMessages(prev => [...prev, { role: 'assistant', content: summary, blocks }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to connect to the AI agent. Make sure the backend is running.', error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const renderTextBlock = (content: string) => {
    // Simple bold/italic markdown rendering
    const parts = content.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*'))
        return <em key={i}>{part.slice(1, -1)}</em>;
      return <span key={i}>{part}</span>;
    });
  };

  const renderChart = (block: ChatBlock) => {
    if (!block.data || block.data.length === 0) return null;
    const xKey = block.dataKeys?.x || 'name';
    const yKey = block.dataKeys?.y || 'value';

    if (block.chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={block.data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {block.data.map((_: any, i: number) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val: any) => `$${Number(val).toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (block.chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={block.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey={xKey} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(val: any) => `$${Number(val).toLocaleString()}`} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
            <Line type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
            {block.dataKeys?.y2 && <Line type="monotone" dataKey={block.dataKeys.y2} stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Default: bar chart
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={block.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey={xKey} tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip formatter={(val: any) => `$${Number(val).toLocaleString()}`} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
          <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
            {block.data.map((_: any, i: number) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
          {block.dataKeys?.y2 && <Bar dataKey={block.dataKeys.y2} fill="#10b981" radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderBlock = (block: ChatBlock, idx: number) => {
    switch (block.type) {
      case 'text':
        return (
          <div key={idx} style={{ lineHeight: 1.6, fontSize: '0.9rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
            {renderTextBlock(block.content || '')}
          </div>
        );

      case 'table':
        return (
          <div key={idx} style={{ marginTop: '0.75rem' }}>
            {block.title && <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.5rem' }}>{block.title}</p>}
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    {block.headers?.map((h, i) => (
                      <th key={i} style={{ padding: '0.5rem 0.75rem', background: 'rgba(6,182,212,0.08)', color: '#38bdf8', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows?.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'chart':
        return (
          <div key={idx} style={{ marginTop: '0.75rem' }}>
            {block.title && <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.5rem' }}>{block.title}</p>}
            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '1rem 0.5rem', border: '1px solid rgba(255,255,255,0.04)' }}>
              {renderChart(block)}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="no-print"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          boxShadow: '0 4px 20px rgba(6, 182, 212, 0.3)',
          zIndex: 10000,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(6, 182, 212, 0.5)'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(6, 182, 212, 0.3)'; }}
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            bottom: '6rem',
            right: '2rem',
            width: '480px',
            maxHeight: '70vh',
            background: 'rgba(15, 23, 42, 0.85)',
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
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(2, 132, 199, 0.1))',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🤖</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>RetailFlow AI Analyst</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Powered by Gemini • Ask anything about your retail data</p>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            minHeight: '300px',
            maxHeight: '50vh',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.5 }}>👋 Hi! I&apos;m your AI retail and inventory analyst. Ask me about invoices, payments, customers, or products!</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      style={{
                        background: 'rgba(6, 182, 212, 0.06)',
                        border: '1px solid rgba(6, 182, 212, 0.15)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                        color: '#38bdf8',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s, border-color 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(6, 182, 212, 0.12)';
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(6, 182, 212, 0.06)';
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.15)';
                      }}
                    >
                      💬 {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: msg.role === 'user' ? '80%' : '95%',
                width: msg.role === 'user' ? undefined : '95%',
              }}>
                {msg.role === 'user' ? (
                  <div style={{
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    borderRadius: '12px 12px 4px 12px',
                    padding: '0.65rem 1rem',
                    color: 'white',
                    fontSize: '0.9rem',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.2)',
                  }}>
                    {msg.content}
                  </div>
                ) : (
                  <div style={{
                    background: msg.error ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${msg.error ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: '12px 12px 12px 4px',
                    padding: '0.75rem 1rem',
                  }}>
                    {msg.blocks ? (
                      msg.blocks.map((block, bi) => renderBlock(block, bi))
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.9rem', color: msg.error ? '#f87171' : '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {renderTextBlock(msg.content)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '0.4rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px 12px 12px 4px' }}>
                <span style={{ animation: 'pulse 1.2s infinite', width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }}></span>
                <span style={{ animation: 'pulse 1.2s infinite 0.2s', width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }}></span>
                <span style={{ animation: 'pulse 1.2s infinite 0.4s', width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }}></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: '0.5rem',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about invoices, customers, payments..."
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                color: '#f8fafc',
                fontSize: '0.9rem',
                outline: 'none',
              }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #06b6d4, #0284c7)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'opacity 0.2s',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}} />
    </>
  );
}
