'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

const SYNC_HUB_URL = process.env.NEXT_PUBLIC_SYNC_HUB_URL || 'http://localhost:4010';

interface DashboardStats {
  posStatus: 'connected' | 'disconnected';
  cloudStatus: 'connected' | 'disconnected';
  lastSync: Date | null;
  totalJobs: number;
  successJobs: number;
  failedJobs: number;
}

interface JobRun {
  id: number;
  job_type: string;
  trigger: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  records_total: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  error_message: string | null;
}

interface Failure {
  id: number;
  job_run_id: number;
  error: string;
  details: string | null;
  created_at: string;
}

export default function SyncDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<JobRun[]>([]);
  const [recentFailures, setRecentFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    Promise.all([
      fetch(`${SYNC_HUB_URL}/api/dashboard/overview`).then(r => r.json()),
      fetch(`${SYNC_HUB_URL}/api/dashboard/runs`).then(r => r.json()),
      fetch(`${SYNC_HUB_URL}/api/dashboard/failures`).then(r => r.json()),
    ]).then(([statsData, runsData, failuresData]) => {
      setStats(statsData);
      setRecentRuns(runsData);
      setRecentFailures(failuresData);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async (type: string) => {
    setSyncing(type);
    setMessage(null);
    try {
      const endpoint = type === 'all'
        ? `${SYNC_HUB_URL}/api/sync/all/push`
        : type === 'orders'
          ? `${SYNC_HUB_URL}/api/sync/orders/pull`
          : `${SYNC_HUB_URL}/api/sync/${type}/push`;
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        setMessage({ type: 'success', text: `Sync ${type} started successfully!` });
        await fetchData();
      } else {
        setMessage({ type: 'error', text: `Failed to start sync: ${res.statusText}` });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: `Failed to start sync: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              POS Sync Dashboard
            </h1>
            <p className="text-slate-400 mt-2">Monitor and manage synchronization between your POS system and Nexlify</p>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">POS Connection</p>
                      <div className={`mt-2 text-2xl font-bold ${stats?.posStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                        {stats?.posStatus === 'connected' ? 'Connected' : 'Disconnected'}
                      </div>
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stats?.posStatus === 'connected' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      <span className="text-2xl">💻</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Cloud Connection</p>
                      <div className={`mt-2 text-2xl font-bold ${stats?.cloudStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                        {stats?.cloudStatus === 'connected' ? 'Connected' : 'Disconnected'}
                      </div>
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stats?.cloudStatus === 'connected' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      <span className="text-2xl">☁️</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Total Jobs</p>
                      <p className="mt-2 text-2xl font-bold text-blue-400">{stats?.totalJobs || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-2xl">📊</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Failed Jobs</p>
                      <p className="mt-2 text-2xl font-bold text-red-400">{stats?.failedJobs || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-2xl">⚠️</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
                <h2 className="text-xl font-semibold mb-4">Manual Sync</h2>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => handleSync('all')}
                    disabled={syncing !== null}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg shadow-green-500/20"
                  >
                    {syncing === 'all' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <span>🔄</span>
                    )}
                    Sync All
                  </button>
                  <button
                    onClick={() => handleSync('items')}
                    disabled={syncing !== null}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2 transition-all"
                  >
                    {syncing === 'items' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <span>📦</span>
                    )}
                    Sync Items
                  </button>
                  <button
                    onClick={() => handleSync('customers')}
                    disabled={syncing !== null}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2 transition-all"
                  >
                    {syncing === 'customers' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <span>👥</span>
                    )}
                    Sync Customers
                  </button>
                  <button
                    onClick={() => handleSync('purchases')}
                    disabled={syncing !== null}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2 transition-all"
                  >
                    {syncing === 'purchases' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <span>📥</span>
                    )}
                    Sync Purchases
                  </button>
                  <button
                    onClick={() => handleSync('orders')}
                    disabled={syncing !== null}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2 transition-all"
                  >
                    {syncing === 'orders' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <span>🧾</span>
                    )}
                    Sync Orders
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h2 className="text-xl font-semibold mb-4">Recent Jobs</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-2 text-slate-400">Type</th>
                          <th className="text-left py-3 px-2 text-slate-400">Status</th>
                          <th className="text-left py-3 px-2 text-slate-400">Created</th>
                          <th className="text-left py-3 px-2 text-slate-400">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentRuns.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-500">No jobs yet</td></tr>
                        ) : recentRuns.map((run) => (
                          <tr key={run.id} className="border-b border-slate-700/50">
                            <td className="py-3 px-2 capitalize">{run.job_type}</td>
                            <td className="py-3 px-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${run.status === 'completed' ? 'bg-green-500/20 text-green-400' : run.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {run.status}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-slate-400">{run.records_created}</td>
                            <td className="py-3 px-2 text-slate-400">{run.records_updated}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h2 className="text-xl font-semibold mb-4">Recent Failures</h2>
                  {recentFailures.length === 0 ? (
                    <p className="text-slate-500 py-8 text-center">No recent failures</p>
                  ) : (
                    <div className="space-y-4">
                      {recentFailures.map((failure) => (
                      <div key={failure.id} className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                          <p className="text-red-400 font-medium mb-1">Job Run #{failure.job_run_id}</p>
                          <p className="text-sm text-slate-300 mb-2">{failure.error}</p>
                          {failure.details && (
                            <details className="mt-2">
                              <summary className="text-sm text-slate-400 cursor-pointer">Details</summary>
                              <pre className="mt-2 p-3 bg-slate-900 rounded text-xs text-slate-300 overflow-x-auto">
                                {failure.details}
                              </pre>
                            </details>
                          )}
                          <p className="text-xs text-slate-500 mt-2">
                            {new Date(failure.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
