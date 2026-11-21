import React, { useState } from 'react';
import { getSupabaseConfig, saveSupabaseConfig, clearCustomSupabaseConfig, supabase } from '../../lib/supabase';
import { 
  Settings, 
  Database, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  X, 
  Code2,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const SettingsModal = ({ isOpen, onClose }) => {
  const currentConfig = getSupabaseConfig();

  const [activeTab, setActiveTab] = useState('supabase');
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(currentConfig.anonKey);
  const [testResult, setTestResult] = useState({ status: 'idle' });
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleSaveConfig = (e) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
  };

  const handleTestConnection = async () => {
    setTestResult({ status: 'testing' });
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        setTestResult({ 
          status: 'error', 
          message: `Connection failed: ${error.message} (Code: ${error.code})` 
        });
      } else {
        setTestResult({ 
          status: 'success', 
          message: 'Connection Successful! Supabase database and RLS policies are reachable.' 
        });
      }
    } catch (err) {
      setTestResult({ 
        status: 'error', 
        message: err.message || 'Network error connecting to Supabase.' 
      });
    }
  };

  const handleCopySchemaPath = () => {
    navigator.clipboard.writeText('supabase/schema.sql');
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-850 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-200">
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Application Settings & Setup
              </h2>
              <p className="text-xs text-slate-400">Database Connection, Android APK Build & RLS</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-900/60 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'supabase'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Supabase Database</span>
          </button>

          <button
            onClick={() => setActiveTab('android')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'android'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android APK Build Guide</span>
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'schema'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>SQL Schema & RLS</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* TAB 1: Supabase Configuration */}
          {activeTab === 'supabase' && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-slate-200 font-semibold flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-1 text-emerald-400" />
                  Shared Data Across Web & Android
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Both your desktop web application and the Android APK point to this single Supabase database instance. Any movement logged at the gate syncs in real-time to all devices.
                </p>
                <p className="text-amber-400 font-semibold pt-1">
                  Security note: Use only the public Anon Key. Never expose the service role key!
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Supabase Anon (Public) Key
                </label>
                <textarea
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {testResult.status === 'success' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{testResult.message}</span>
                </div>
              )}

              {testResult.status === 'error' && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testResult.status === 'testing'}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 flex items-center space-x-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testResult.status === 'testing' ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>{testResult.status === 'testing' ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={clearCustomSupabaseConfig}
                    className="px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    Reset to Demo Mode
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold shadow-lg transition"
                  >
                    Save & Connect
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: Android APK Build Guide */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <span className="text-slate-200 font-bold flex items-center text-sm">
                  <Smartphone className="w-4 h-4 mr-2 text-sky-400" />
                  Distributable Android APK Instructions (No Play Store required)
                </span>
                <p className="text-slate-400 leading-relaxed">
                  FLEET GATE is configured with Capacitor 7. Follow these 4 quick commands to build your distributable Android APK file (.apk) to install directly on staff Android phones.
                </p>
              </div>

              <div className="space-y-3 font-mono">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-1">Step 1: Build the Web App</span>
                  <div className="text-slate-300 select-all bg-slate-900 p-2 rounded border border-slate-800/80">
                    npm run build
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-1">Step 2: Add Android Platform (first time only)</span>
                  <div className="text-slate-300 select-all bg-slate-900 p-2 rounded border border-slate-800/80">
                    npx cap add android
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-1">Step 3: Sync Assets to Android</span>
                  <div className="text-slate-300 select-all bg-slate-900 p-2 rounded border border-slate-800/80">
                    npx cap sync android
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-1">Step 4: Generate APK</span>
                  <p className="text-slate-400 font-sans text-xs mb-1">Option A: Build directly via command line (Gradle):</p>
                  <div className="text-slate-300 select-all bg-slate-900 p-2 rounded border border-slate-800/80 mb-2">
                    cd android && ./gradlew assembleDebug
                  </div>
                  <p className="text-slate-500 font-sans text-[11px]">
                    Output APK location: <code className="text-sky-300">android/app/build/outputs/apk/debug/app-debug.apk</code>
                  </p>
                  
                  <p className="text-slate-400 font-sans text-xs mt-3 mb-1">Option B: Open in Android Studio:</p>
                  <div className="text-slate-300 select-all bg-slate-900 p-2 rounded border border-slate-800/80">
                    npx cap open android
                  </div>
                  <p className="text-slate-500 font-sans text-[11px] mt-1">
                    Click <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SQL Schema */}
          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-200">Supabase SQL Migration File</h4>
                  <p className="text-slate-400">Located at <code className="text-emerald-400">supabase/schema.sql</code></p>
                </div>
                <button
                  onClick={handleCopySchemaPath}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copySuccess ? 'Copied!' : 'Copy Path'}</span>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 leading-relaxed text-slate-300">
                <p>
                  The schema contains everything needed for production:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">public.profiles</strong>: Auth integration with roles (Admin / Staff) and active flags.</li>
                  <li><strong className="text-slate-200">public.lorries</strong>: Vehicle fleet registry with lifetime visit counter.</li>
                  <li><strong className="text-slate-200">public.lorry_movements</strong>: IN/OUT movements with unique partial index:
                    <br />
                    <code className="text-emerald-300 text-[11px] bg-slate-900 px-1 py-0.5 rounded">
                      UNIQUE (lorry_id) WHERE (is_active_inside = TRUE)
                    </code> (prevents duplicate active IN records at DB engine level).
                  </li>
                  <li><strong className="text-slate-200">Stored Procedures</strong>: <code className="text-sky-300">record_lorry_entry</code> and <code className="text-sky-300">record_lorry_exit</code> with row locks.</li>
                  <li><strong className="text-slate-200">Realtime Publication</strong>: Enabled for instant sync across Web and Android devices.</li>
                </ul>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
