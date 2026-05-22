import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  History as HistoryIcon, 
  Settings, 
  Database,
  Layers,
  AlertCircle
} from 'lucide-react';
import { getDbConfig } from './services/db';
import { SupabaseConfig, Transaction } from './types';

// Import Views
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import BorrowReturnView from './components/BorrowReturnView';
import HistoryView from './components/HistoryView';
import SupabaseSettingsView from './components/SupabaseSettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [dbConfig, setDbConfig] = useState<SupabaseConfig>({
    supabaseUrl: '',
    supabaseKey: '',
    useLocalStorage: true
  });
  
  // Custom system profile states loaded locally
  const [systemTitle, setSystemTitle] = useState(() => localStorage.getItem('system_title') || 'NT Cyfence Inventory');
  const [systemDesc, setSystemDesc] = useState(() => localStorage.getItem('system_desc') || 'ระบบจัดการและเบิก-คืนคลังอุปกรณ์อัจฉริยะ');
  const [systemVersion, setSystemVersion] = useState(() => localStorage.getItem('system_version') || 'v1.0');
  const [customLogo, setCustomLogo] = useState(() => localStorage.getItem('system_custom_logo') || '');

  // Refresh Trigger to force children reload data
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  
  // Handle action link from dashboard to return modal directly
  const [quickReturnTx, setQuickReturnTx] = useState<Transaction | null>(null);

  // Load config and global system settings on mount / refresh
  useEffect(() => {
    const config = getDbConfig();
    setDbConfig(config);
    
    const fetchGlobalSettings = async () => {
      if (config.supabaseUrl && config.supabaseKey) {
        try {
          const { getSystemSettings } = await import('./services/db');
          const settings = await getSystemSettings(config);
          if (settings) {
            if (settings.title) {
              setSystemTitle(settings.title);
              localStorage.setItem('system_title', settings.title);
            }
            if (settings.description) {
              setSystemDesc(settings.description);
              localStorage.setItem('system_desc', settings.description);
            }
            if (settings.version) {
              setSystemVersion(settings.version);
              localStorage.setItem('system_version', settings.version);
            }
            if (settings.custom_logo !== undefined) {
              setCustomLogo(settings.custom_logo);
              if (settings.custom_logo) {
                localStorage.setItem('system_custom_logo', settings.custom_logo);
              } else {
                localStorage.removeItem('system_custom_logo');
              }
            }
          }
        } catch (e) {
          console.warn('Failed to load global system settings:', e);
        }
      }
    };
    
    fetchGlobalSettings();
  }, [refreshTrigger]);

  const handleConfigChange = (newConfig: SupabaseConfig) => {
    setDbConfig(newConfig);
    handleRefresh();
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleQuickReturn = (tx: Transaction) => {
    setQuickReturnTx(tx);
    setActiveTab('borrow');
  };

  const handleClearQuickReturn = () => {
    setQuickReturnTx(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F7] text-[#1E293B] font-sans flex flex-col justify-between" id="app-wrapper">
      
      {/* Upper Navigation Header bar */}
      <header className="bg-white border-b border-slate-200 py-3.5 px-6 md:px-12 sticky top-0 z-40 shadow-xs text-left" id="main-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3.5" id="brand-logo">
            {customLogo ? (
              <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center p-1 shrink-0 select-none overflow-hidden">
                <img src={customLogo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            ) : (
              /* NT Cyfence high-fidelity CSS logo from attached image */
              <div className="w-12 h-12 bg-[#FCCC04] rounded-lg flex flex-col items-center justify-center p-1.5 shadow-sm shrink-0 select-none border border-yellow-500/20">
                {/* Upper graphic group: connection bars + lowercase 'nt' */}
                <div className="flex items-center space-x-1">
                  {/* Channel bars and dots */}
                  <div className="flex items-center space-x-[2px] h-5">
                    <div className="w-[3px] h-[10px] bg-black rounded-full" />
                    <div className="w-[3px] h-[3px] bg-black rounded-full self-center" />
                    <div className="w-[3px] h-[16px] bg-black rounded-full" />
                    <div className="w-[3px] h-[3px] bg-black rounded-full self-start mt-[1px]" />
                    <div className="w-[3px] h-[8px] bg-black rounded-full self-end" />
                  </div>
                  {/* Helvetica/Inter styled lowercase brand name 'nt' */}
                  <span className="text-[17px] font-sans font-black tracking-tighter text-black leading-none -mt-[3px]">nt</span>
                </div>
                {/* Bottom text: CYFENCE */}
                <span className="text-[6.5px] font-sans font-black tracking-[0.05em] text-black leading-none mt-0.5">CYFENCE</span>
              </div>
            )}
            <div>
              <h1 className="text-md font-extrabold tracking-tight font-sans text-slate-800 flex items-center gap-1.5">
                {systemTitle} <span className="text-blue-600 font-semibold font-sans text-[10px] bg-blue-50 px-2 py-0.5 rounded-sm">{systemVersion}</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-mono text-left leading-normal">{systemDesc}</p>
            </div>
          </div>

          {/* Database Mode status pill indicator */}
          <div className="flex items-center space-x-2 shrink-0 select-none">
            {(!dbConfig.supabaseUrl || !dbConfig.supabaseKey) ? (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold font-sans px-3 py-1.5 rounded shadow-3xs cursor-pointer animate-pulse" onClick={() => setActiveTab('settings')}>
                <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span>ยังไม่ได้ตั้งค่าเชื่อมต่อ Supabase (คลิกเพื่อตั้งค่า)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold font-sans px-3 py-1.5 rounded shadow-3xs">
                <Database className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>เชื่อมต่อระบบ Supabase DB เรียบร้อย</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Work Area */}
      <main className="max-w-7xl w-full mx-auto px-4 md:px-8 py-6 grow" id="app-main-content">
        
        {/* Core Screen Layout Option Switches */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="layout-view-grid">
          
          {/* Main Left-side Sidebar Menu Nav (Desktop) / Top nav (Mobile) */}
          <nav className="lg:col-span-3 bg-[#1A1C21] text-white border border-slate-800 rounded p-4 h-fit shadow-xs" id="sidebar-navigation">
            <h4 className="hidden lg:block text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold mb-4 px-3 text-left">
              เมนูบริหารคลัง
            </h4>

            {/* Desktop and Mobile responsive grid/flex layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-2 pb-1 lg:pb-0" id="nav-pills-holder">
              {[
                { id: 'dashboard', name: 'รายงานสรุปภาพรวม', icon: LayoutDashboard },
                { id: 'inventory', name: 'รายการอุปกรณ์', icon: Package },
                { id: 'borrow', name: 'ระบบเบิก-คืนพัสดุ', icon: ArrowLeftRight },
                { id: 'history', name: 'ประวัติเบิกจ่าย', icon: HistoryIcon },
                { id: 'settings', name: 'ตั้งค่าระบบ', icon: Settings },
              ].map(tab => {
                const IconComp = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); handleRefresh(); }}
                    className={`flex items-center space-x-2 px-3.5 py-3 lg:py-2.5 rounded text-xs font-semibold font-sans transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-blue-600 text-white lg:bg-blue-600/20 lg:text-blue-400 lg:border-l-4 lg:border-blue-500' 
                        : 'text-slate-350 bg-slate-800/40 lg:bg-transparent hover:bg-slate-800 hover:text-white'
                    } ${tab.id === 'settings' ? 'col-span-2 sm:col-span-1' : ''}`}
                  >
                    <IconComp className="h-4 w-4 shrink-0 text-current" />
                    <span className="truncate">{tab.name}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Active Screen Frame Area (Right-side Panel view) */}
          <div className="lg:col-span-9" id="active-screen-frame">
            {activeTab === 'dashboard' && (
              <DashboardView 
                config={dbConfig} 
                onNavigate={setActiveTab} 
                onQuickReturn={handleQuickReturn}
                refreshTrigger={refreshTrigger} 
              />
            )}
            
            {activeTab === 'inventory' && (
              <InventoryView 
                config={dbConfig} 
                refreshTrigger={refreshTrigger}
                onRefresh={handleRefresh}
              />
            )}
            
            {activeTab === 'borrow' && (
              <BorrowReturnView 
                config={dbConfig} 
                refreshTrigger={refreshTrigger}
                onRefresh={handleRefresh}
                quickReturnTx={quickReturnTx}
                onClearQuickReturn={handleClearQuickReturn}
              />
            )}
            
            {activeTab === 'history' && (
              <HistoryView 
                config={dbConfig} 
                refreshTrigger={refreshTrigger} 
              />
            )}
            
            {activeTab === 'settings' && (
              <SupabaseSettingsView 
                onConfigChange={handleConfigChange}
                onRefreshAll={handleRefresh}
                systemTitle={systemTitle}
                systemDesc={systemDesc}
                systemVersion={systemVersion}
                customLogo={customLogo}
                onSystemTitleChange={setSystemTitle}
                onSystemDescChange={setSystemDesc}
                onSystemVersionChange={setSystemVersion}
                onCustomLogoChange={setCustomLogo}
              />
            )}
          </div>
        </div>
      </main>

      {/* Humble Footer info */}
      <footer className="bg-white border-t border-gray-150 py-5 px-6 shrink-0 mt-12 text-center text-4xs font-mono text-gray-400 select-none" id="main-footer">
        <p>powered by Warapon Wichitpan © 2026</p>
      </footer>
    </div>
  );
}
