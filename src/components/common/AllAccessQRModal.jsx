import React, { useState, useEffect } from 'react';
import { QRCodeView } from './QRCodeView';
import { TipperTruckIcon } from './TipperTruckIcon';
import { 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Printer, 
  Smartphone, 
  Wifi, 
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export const AllAccessQRModal = ({ isOpen, onClose }) => {
  // Cloudflare Global Edge URL (Works on ANY Wi-Fi, ANY Device, 4G/5G, Zero Router Restrictions)
  const cloudflareUrl = 'https://port-awarded-rebound-director.trycloudflare.com';
  const localWifiUrl = 'http://192.168.1.55:5173';

  const [networkMode, setNetworkMode] = useState('cloud'); // 'cloud' | 'local'
  const [accessUrl, setAccessUrl] = useState(cloudflareUrl);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'admin'

  const handleSwitchMode = (mode) => {
    setNetworkMode(mode);
    setAccessUrl(mode === 'cloud' ? cloudflareUrl : localWifiUrl);
  };

  if (!isOpen) return null;

  const finalUrl = activeTab === 'admin' 
    ? `${accessUrl.replace(/\/$/, '')}/?mode=admin`
    : accessUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(finalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      
      {/* Printable Poster Area (styled specifically for print) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-qr-poster, #printable-qr-poster * {
            visibility: visible !important;
          }
          #printable-qr-poster {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: white !important;
            color: black !important;
            padding: 40px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-850 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center">
                FLEET <span className="text-emerald-400 ml-1">GATE</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  Mobile Access QR
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct Wi-Fi / Local Network Access for All Devices
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Access Role Tabs */}
        <div className="px-6 pt-4 flex space-x-2 border-b border-slate-800/80 bg-slate-900/60">
          <button
            onClick={() => setActiveTab('staff')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'staff'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Staff Gate Screen (Direct Access)</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'admin'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Console</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
            <div className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              <QRCodeView
                value={finalUrl}
                size={230}
                fgColor="#020617"
                bgColor="#ffffff"
                centerLogo={
                  <div className="w-7 h-7 flex items-center justify-center text-emerald-600">
                    <TipperTruckIcon className="w-5 h-5" />
                  </div>
                }
              />
            </div>

            {/* Instruction Callout */}
            <div className="mt-4 text-center space-y-1">
              <p className="text-sm font-bold text-slate-200 flex items-center justify-center">
                <Smartphone className="w-4 h-4 mr-1.5 text-emerald-400" />
                Scan with any Smartphone Camera
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Point your phone camera (Google Lens or iOS Camera) at this QR code to open Fleet Gate immediately.
              </p>
            </div>
          </div>

          {/* Connection Mode Selector */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-300 font-semibold flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
              Network Access:
            </span>
            <div className="flex space-x-1.5">
              <button
                onClick={() => handleSwitchMode('cloud')}
                className={`px-3 py-1 rounded-lg font-bold transition text-xs flex items-center space-x-1 ${
                  networkMode === 'cloud'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>🌐 Any Wi-Fi & 4G/5G</span>
              </button>
              <button
                onClick={() => handleSwitchMode('local')}
                className={`px-3 py-1 rounded-lg font-bold transition text-xs flex items-center space-x-1 ${
                  networkMode === 'local'
                    ? 'bg-sky-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>📶 Local Wi-Fi</span>
              </button>
            </div>
          </div>

          {/* Direct URL Box & Copy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold flex items-center">
                <Wifi className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                {networkMode === 'cloud' ? 'Cloudflare Global Edge URL (Recommended):' : 'Local Wi-Fi IP:'}
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                {networkMode === 'cloud' ? 'SSL Active' : 'Port 5173'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={finalUrl}
                readOnly
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 select-all"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Direct Mobile Connection Instructions */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
            <div className="font-bold text-slate-200 flex items-center">
              <HelpCircle className="w-4 h-4 mr-1.5 text-emerald-400 flex-shrink-0" />
              Universal Device Compatibility (Any Wi-Fi / Any Mobile):
            </div>
            
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Powered by Cloudflare's secure edge network with enterprise SSL (HTTPS). 
              Works across <strong>all Android phones, iPhones, iPads, tablets</strong> on <strong>ANY Wi-Fi</strong>, <strong>Jio/Airtel 5G/4G data</strong>, with zero router isolation issues or connection retries.
            </p>
          </div>

          {/* Action Buttons: Print Gate Poster & Open in New Tab */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <button
              onClick={handlePrint}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center space-x-2 border border-slate-700 transition shadow"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Print Gate QR Poster</span>
            </button>

            <a
              href={finalUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50 transition"
            >
              <span>Open in New Tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>

        {/* Hidden Printable Gate Poster Section for Browser Print (A4 size) */}
        <div id="printable-qr-poster" className="hidden">
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '48px', height: '48px', background: '#020617', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <TipperTruckIcon className="w-8 h-8" />
              </div>
              <h1 style={{ fontSize: '36px', fontWeight: '900', margin: 0, letterSpacing: '2px', color: '#0f172a' }}>
                FLEET <span style={{ color: '#059669' }}>GATE</span>
              </h1>
            </div>

            <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '24px' }}>
              Gate Movement & Security Check-In / Check-Out
            </p>

            <div style={{ display: 'inline-block', padding: '24px', background: 'white', borderRadius: '24px', border: '3px solid #0f172a', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
              <QRCodeView
                value={finalUrl}
                size={340}
                fgColor="#020617"
                bgColor="#ffffff"
              />
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 8px 0', color: '#0f172a' }}>
              SCAN TO OPEN GATE SCREEN
            </h2>
            <p style={{ fontSize: '15px', color: '#334155', maxWidth: '440px', margin: '0 auto 16px auto', lineHeight: '1.4' }}>
              Open your smartphone camera and scan the QR code above. Works on all Android & iPhone devices.
            </p>

            <div style={{ display: 'inline-block', padding: '10px 24px', background: '#f1f5f9', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>
              Direct URL: {finalUrl}
            </div>

            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '30px' }}>
              * Connected via Official Security Gate Wi-Fi Network.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
