import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  History as HistoryIcon, 
  Settings, 
  Database,
  AlertCircle,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react';
import { getDbConfig, getBorrowRequests } from './services/db';
import { SupabaseConfig, Transaction } from './types';

// Import Views
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import BorrowReturnView from './components/BorrowReturnView';
import HistoryView from './components/HistoryView';
import SupabaseSettingsView from './components/SupabaseSettingsView';
import RequestView from './components/RequestView';
import ApprovalView from './components/ApprovalView';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  // Initialize config SYNCHRONOUSLY so child components never render with
  // useLocalStorage:true (which would flash seed data) before useEffect fires.
  const [dbConfig, setDbConfig] = useState<SupabaseConfig>(() => {
    const saved = localStorage.getItem('item_inventory_supabase_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, useLocalStorage: false };
      } catch { /* fall through */ }
    }
    const metaEnv = (import.meta as any).env || {};
    return {
      supabaseUrl: (metaEnv.VITE_SUPABASE_URL as string) || '',
      supabaseKey: (metaEnv.VITE_SUPABASE_ANON_KEY as string) || '',
      useLocalStorage: false
    };
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

  // Pending approval count for badge
  const [pendingCount, setPendingCount] = useState(0);

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

    // Load pending approval count for badge
    const loadPending = async () => {
      if (config.supabaseUrl && config.supabaseKey) {
        try {
          const { getBorrowRequests: fetchReqs } = await import('./services/db');
          const reqs = await fetchReqs(config);
          setPendingCount(reqs.filter(r => r.status === 'pending_approval').length);
        } catch {}
      }
    };
    loadPending();
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
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans flex flex-col justify-between" id="app-wrapper">
      
      {/* Upper Navigation Header bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#E8E8ED]/80 py-3 px-6 md:px-12 sticky top-0 z-40 text-left" id="main-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3.5" id="brand-logo">
            {customLogo ? (
              <div className="w-12 h-12 rounded-xl bg-white border border-[#E8E8ED] shadow-xs flex items-center justify-center p-1 shrink-0 select-none overflow-hidden">
                <img src={customLogo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            ) : (
              /* NT Cyfence high-fidelity CSS logo from attached image */
              <div className="w-12 h-12 bg-[#FCCC04] rounded-xl flex flex-col items-center justify-center p-1.5 shadow-xs shrink-0 select-none border border-yellow-500/10">
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
              <h1 className="text-md font-extrabold tracking-tight font-sans text-[#1D1D1F] flex items-center gap-2">
                {systemTitle} <span className="text-[#0071E3] font-bold font-sans text-[10px] bg-[#E8F2FF] px-2 py-0.5 rounded-full">{systemVersion}</span>
              </h1>
              <p className="text-[9px] text-[#86868B] font-medium leading-normal">{systemDesc}</p>
            </div>
          </div>

          {/* Database Mode status pill indicator */}
          <div className="flex items-center space-x-2 shrink-0 select-none">
            {(!dbConfig.supabaseUrl || !dbConfig.supabaseKey) ? (
              <div className="badge-apple badge-apple-red cursor-pointer animate-pulse" onClick={() => setActiveTab('settings')}>
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>ยังไม่ได้ตั้งค่าเชื่อมต่อ Supabase</span>
              </div>
            ) : (
              <div className="badge-apple badge-apple-green">
                <Database className="h-3.5 w-3.5 shrink-0" />
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
          <nav className="lg:col-span-3 bg-white/80 backdrop-blur-md border border-[#E8E8ED] rounded-2xl p-4 h-fit space-y-4" id="sidebar-navigation">

            {/* ── Section 1: สำหรับบริษัทผู้ขอเบิก ── */}
            <div>
              <h4 className="text-[10px] font-sans text-[#0071E3] uppercase tracking-wider font-extrabold mb-2 px-3 text-left flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" />
                <span className="hidden lg:inline">สำหรับบริษัทผู้ขอเบิก</span>
              </h4>
              <div className="flex flex-col gap-1">
                {[
                  { id: 'requests', name: 'ยื่นคำขอเบิกพัสดุ', icon: ClipboardList },
                ].map(tab => {
                  const IconComp = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); handleRefresh(); }}
                      className={`relative flex items-center space-x-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#E8F2FF] text-[#0071E3]'
                          : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                      }`}
                    >
                      <IconComp className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#0071E3]' : 'text-[#86868B]'}`} />
                      <span className="truncate">{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-[#E8E8ED]" />

            {/* ── Section 2: เมนูบริหารคลัง (Admin) ── */}
            <div>
              <h4 className="text-[10px] font-sans text-[#86868B] uppercase tracking-wider font-extrabold mb-2 px-3 text-left flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                <span className="hidden lg:inline">เมนูบริหารคลัง</span>
              </h4>
              <div className="flex flex-col gap-1">
                {[
                  { id: 'dashboard', name: 'รายงานสรุปภาพรวม', icon: LayoutDashboard },
                  { id: 'inventory', name: 'รายการอุปกรณ์', icon: Package },
                  { id: 'borrow', name: 'ระบบเบิก-คืนพัสดุ', icon: ArrowLeftRight },
                  { id: 'approval', name: 'อนุมัติคำขอ', icon: ShieldCheck, badge: pendingCount },
                  { id: 'history', name: 'ประวัติเบิกจ่าย', icon: HistoryIcon },
                  { id: 'settings', name: 'ตั้งค่าระบบ', icon: Settings },
                ].map(tab => {
                  const IconComp = tab.icon;
                  const isActive = activeTab === tab.id;
                  const badge = (tab as any).badge as number | undefined;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); handleRefresh(); }}
                      className={`relative flex items-center space-x-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#E8F2FF] text-[#0071E3]'
                          : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                      }`}
                    >
                      <IconComp className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#0071E3]' : 'text-[#86868B]'}`} />
                      <span className="truncate">{tab.name}</span>
                      {badge != null && badge > 0 && (
                        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center leading-none">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
            
            {activeTab === 'requests' && (
              <RequestView
                config={dbConfig}
                refreshTrigger={refreshTrigger}
              />
            )}

            {activeTab === 'approval' && (
              <ApprovalView
                config={dbConfig}
                refreshTrigger={refreshTrigger}
                onRefresh={handleRefresh}
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
      <footer className="py-6 px-6 shrink-0 mt-12 text-center text-[10px] font-sans font-medium text-[#86868B] select-none" id="main-footer">
        <p>Powered by Warapon Wichitpan © 2026 · NT Cyfence</p>
      </footer>
    </div>
  );
}
