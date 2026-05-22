/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Database, 
  Terminal, 
  Copy, 
  Check, 
  Play, 
  AlertCircle, 
  CheckCircle, 
  Server, 
  HardDrive,
  Cpu,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Upload,
  Image as ImageIcon,
  Trash2,
  Settings as Settings2
} from 'lucide-react';
import { SupabaseConfig } from '../types';
import { 
  testDbConnection, 
  SUPABASE_SQL_SCHEMA, 
  SUPABASE_MIGRATION_SQL, 
  getDbConfig, 
  saveDbConfig,
  getEquipments,
  getTransactions
} from '../services/db';

interface SupabaseSettingsViewProps {
  onConfigChange: (newConfig: SupabaseConfig) => void;
  onRefreshAll: () => void;
  systemTitle: string;
  systemDesc: string;
  systemVersion: string;
  customLogo: string;
  onSystemTitleChange: (val: string) => void;
  onSystemDescChange: (val: string) => void;
  onSystemVersionChange: (val: string) => void;
  onCustomLogoChange: (val: string) => void;
}

export default function SupabaseSettingsView({ 
  onConfigChange, 
  onRefreshAll,
  systemTitle,
  systemDesc,
  systemVersion,
  customLogo,
  onSystemTitleChange,
  onSystemDescChange,
  onSystemVersionChange,
  onCustomLogoChange
}: SupabaseSettingsViewProps) {
  const currentConfig = getDbConfig();
  
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.supabaseUrl);
  const [supabaseKey, setSupabaseKey] = useState(currentConfig.supabaseKey);
  
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'create' | 'migration'>('create');
  
  // Local states for custom system profile
  const [localTitle, setLocalTitle] = useState(systemTitle);
  const [localDesc, setLocalDesc] = useState(systemDesc);
  const [localVersion, setLocalVersion] = useState(systemVersion);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  useEffect(() => {
    setLocalTitle(systemTitle);
  }, [systemTitle]);

  useEffect(() => {
    setLocalDesc(systemDesc);
  }, [systemDesc]);

  useEffect(() => {
    setLocalVersion(systemVersion);
  }, [systemVersion]);
  

  
  // PIN Gate State
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem('supabase_settings_unlocked') === 'true';
  });

  const handleKeyPress = (num: string) => {
    setPinError(false);
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      
      if (nextPin === '8888') {
        setTimeout(() => {
          sessionStorage.setItem('supabase_settings_unlocked', 'true');
          setIsUnlocked(true);
        }, 200);
      } else if (nextPin.length === 4) {
        setTimeout(() => {
          setPinError(true);
          setTimeout(() => {
            setPin('');
          }, 600);
        }, 150);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setPinError(false);
  };

  const handleClear = () => {
    setPin('');
    setPinError(false);
  };

  useEffect(() => {
    if (isUnlocked) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pin, isUnlocked]);


  const [diagStatus, setDiagStatus] = useState<{
    loading: boolean;
    success: boolean;
    message: string;
    itemCount: number;
    rxCount: number;
    tested: boolean;
  }>({
    loading: true,
    success: false,
    message: '',
    itemCount: 0,
    rxCount: 0,
    tested: false
  });

  const runDiagnostics = async () => {
    setDiagStatus(prev => ({ ...prev, loading: true }));
    try {
      const configObj = { useLocalStorage: false, supabaseUrl, supabaseKey };
      
      if (!supabaseUrl || !supabaseKey) {
        setDiagStatus({
          loading: false,
          success: false,
          message: 'ยังไม่ได้ระบุตำแหน่ง API หรือคีย์ของ Supabase',
          itemCount: 0,
          rxCount: 0,
          tested: true
        });
        return;
      }

      const test = await testDbConnection(configObj);
      if (test.success) {
        let itemsCount = 0;
        let transCount = 0;
        try {
          const items = await getEquipments(configObj);
          itemsCount = items.length;
          const rx = await getTransactions(configObj);
          transCount = rx.length;
        } catch (fetchErr: any) {
          console.warn('Silent info: Error reading database totals during settings diagnostics', fetchErr);
        }
        setDiagStatus({
          loading: false,
          success: true,
          message: 'เชื่อมต่อฐานข้อมูลจริง Live Connected และตรวจสอบตาราง เรียบร้อยแล้ว!',
          itemCount: itemsCount,
          rxCount: transCount,
          tested: true
        });
      } else {
        setDiagStatus({
          loading: false,
          success: false,
          message: test.message || 'โครงสร้างตารางหลักยังไม่ได้เริ่มจัดตั้ง หรือฐานข้อมูลถูกรีเซ็ต',
          itemCount: 0,
          rxCount: 0,
          tested: true
        });
      }
    } catch (err: any) {
      setDiagStatus({
        loading: false,
        success: false,
        message: err?.message || 'การติดต่อกับเครือข่ายฐานข้อมูลหรือคำขอถูกปฏิเสธ',
        itemCount: 0,
        rxCount: 0,
        tested: true
      });
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, [supabaseUrl, supabaseKey]);

  const handleCopySql = () => {
    const textToCopy = activeCodeTab === 'create' ? SUPABASE_SQL_SCHEMA : SUPABASE_MIGRATION_SQL;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testDbConnection({
        supabaseUrl,
        supabaseKey,
        useLocalStorage: false
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: `เกิดข้อผิดพลาดขัดข้อง: ${err?.message || 'โปรดตรวจเช็กอินเตอร์เน็ต'}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = () => {
    const newConfig: SupabaseConfig = {
      supabaseUrl,
      supabaseKey,
      useLocalStorage: false
    };
    saveDbConfig(newConfig);
    onConfigChange(newConfig);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
    onRefreshAll();
    runDiagnostics();
  };





  const handleResetLocalStorage = () => {
    if (window.confirm('คำเตือน! คุณต้องการล้างข้อมูลการจำลองและประวัติเบิกยืมทั้งหมดในเครื่องเบราว์เซอร์ เพื่อรีเซ็ตกลับสู่ค่าเริ่มต้นจากโรงงานใช่หรือไม่?')) {
      localStorage.removeItem('item_inventory_equipment_data');
      localStorage.removeItem('item_inventory_transactions_data');
      onRefreshAll();
      alert('ทำการประมวลรีเซ็ตฐานข้อมูลจำลองเบราว์เซอร์กลับสู่ค่าเริ่มต้นเรียบร้อยแล้ว');
    }
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl border border-gray-200 shadow-xl text-center space-y-6" id="settings-lock-screen">
        <div className="flex justify-center">
          <div className={`p-4 rounded-full ${pinError ? 'bg-rose-50 text-rose-605 animate-bounce' : 'bg-indigo-50 text-indigo-600'}`}>
            <Lock className="h-8 w-8" />
          </div>
        </div>

        <div className="space-y-1.5 leading-snug">
          <h3 className="text-sm font-bold font-sans text-slate-800">ยืนยัน PIN ผู้ดูแลระบบ</h3>
          <p className="text-3xs text-slate-450 leading-relaxed max-w-xs mx-auto">
            กรุณากรอกรหัส PIN 4 หลัก เพื่อปลดล็อกเข้าสู่หน้าตั้งค่าระบบ (โปรไฟล์โปรแกรมและฐานข้อมูล)
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center items-center gap-4 py-2">
          {[0, 1, 2, 3].map((index) => {
            const hasValue = pin.length > index;
            return (
              <div 
                key={index} 
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  pinError 
                    ? 'border-rose-500 bg-rose-505 scale-110 shadow-xs' 
                    : hasValue 
                      ? 'border-indigo-600 bg-indigo-600 scale-110 shadow-3xs' 
                      : 'border-slate-350 bg-transparent'
                }`}
              />
            );
          })}
        </div>

        {pinError && (
          <p className="text-3xs text-rose-650 font-sans font-bold flex items-center justify-center gap-1 animate-pulse">
            ❌ รหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง!
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto pt-2" id="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="w-14 h-14 bg-slate-50 hover:bg-indigo-550/10 hover:text-indigo-600 active:bg-indigo-100 rounded-full flex items-center justify-center text-sm font-black shadow-3xs border border-slate-100 font-mono transition-all duration-150 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="w-14 h-14 text-slate-450 hover:text-rose-600 active:scale-95 flex items-center justify-center text-3xs font-bold font-sans transition-all cursor-pointer"
          >
            ล้างรหัส
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="w-14 h-14 bg-slate-50 hover:bg-indigo-550/10 hover:text-indigo-600 active:bg-indigo-100 rounded-full flex items-center justify-center text-sm font-black shadow-3xs border border-slate-100 font-mono transition-all duration-150 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="w-14 h-14 text-slate-450 hover:text-indigo-600 active:scale-95 flex items-center justify-center text-3xs font-bold font-sans transition-all cursor-pointer"
          >
            ลบ
          </button>
        </div>

        {/* Assistance Note */}
        <div className="text-[10px] text-slate-400 font-sans border-t border-slate-100 pt-3 flex items-center justify-center gap-1 select-none">
          <span>ความช่วยเหลือ: ลีนุกส์พร้อมเคียงข้างคุณเสมอค่ะ 👓</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left" id="settings-root-grid">
      {/* Configure Settings (Left-side) */}
      <div className="lg:col-span-6 space-y-6" id="settings-form-col">

        {/* System Customization Panel */}
        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-2xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3 mb-6 flex items-center gap-2">
            <Settings2 className="h-4.5 w-4.5 text-indigo-500" /> ตั้งค่าระบบและโปรไฟล์โปรแกรม
          </h3>

          <div className="space-y-5">
            {/* Logo Customization */}
            <div>
              <label className="block text-2xs font-sans font-bold text-gray-500 uppercase tracking-wider mb-2">ตราสัญลักษณ์ระบบ (System Logo)</label>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-150">
                {/* Logo Preview */}
                <div className="w-16 h-16 shrink-0 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center p-1.5 bg-white overflow-hidden shadow-3xs">
                  {customLogo ? (
                    <img src={customLogo} alt="Custom Logo Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <ImageIcon className="h-5 w-5 text-slate-400" />
                      <span className="text-[8px] text-slate-400 mt-1 leading-none">โลโก้เริ่มต้น</span>
                    </div>
                  )}
                </div>

                {/* Upload & Reset operations */}
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {/* Trigger File Input */}
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold font-sans cursor-pointer shadow-3xs transition">
                      <Upload className="h-3.5 w-3.5" />
                      <span>อัปโหลดภาพ</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              onCustomLogoChange(base64);
                              localStorage.setItem('system_custom_logo', base64);
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>

                    {customLogo && (
                      <button
                        type="button"
                        onClick={() => {
                          onCustomLogoChange('');
                          localStorage.removeItem('system_custom_logo');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold font-sans transition border border-rose-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>กลับไปใช้ค่าเริ่มต้น</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    รองรับไฟล์ภาพ JPEG, PNG, WEBP หรือ SVG แปลงเป็น Base64 อัตโนมัติค่ะ
                  </p>
                </div>
              </div>
            </div>

            {/* Title & Version Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <label className="block text-2xs font-sans font-bold text-gray-500 uppercase tracking-wider mb-1.5">ชื่อโปรแกรมระบบ (System Title)</label>
                <input
                  type="text"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="NT Cyfence Inventory"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-2xs font-sans font-bold text-gray-500 uppercase tracking-wider mb-1.5">เวอร์ชั่นโปรแกรม</label>
                <input
                  type="text"
                  value={localVersion}
                  onChange={(e) => setLocalVersion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="v1.0"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-2xs font-sans font-bold text-gray-500 uppercase tracking-wider mb-1.5">คำอธิบายระบบ (System Description)</label>
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 h-16 resize-none"
                placeholder="ระบบจัดการและเบิก-คืนคลังอุปกรณ์อัจฉริยะ"
              />
            </div>

            {/* Save Profile Button */}
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  onSystemTitleChange(localTitle);
                  onSystemDescChange(localDesc);
                  onSystemVersionChange(localVersion);
                  localStorage.setItem('system_title', localTitle);
                  localStorage.setItem('system_desc', localDesc);
                  localStorage.setItem('system_version', localVersion);
                  setProfileSaveSuccess(true);
                  setTimeout(() => setProfileSaveSuccess(false), 2500);
                }}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition cursor-pointer"
              >
                {profileSaveSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span>อัปเดตโปรไฟล์เรียบร้อยแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Settings2 className="h-3.5 w-3.5" />
                    <span>บันทึกข้อมูลโปรแกรม</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Connection Setup Container */}
        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-2xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3 mb-6 flex items-center gap-2">
            <Server className="h-4.5 w-4.5 text-indigo-500" /> การตั้งค่าฐานข้อมูลเซิร์ฟเวอร์ Supabase
          </h3>

          <div className="space-y-6">
            <div className="space-y-4">
              {/* Supabase API URL input */}
              <div>
                <label className="block text-2xs font-mono text-gray-400 uppercase tracking-wider mb-1.5">Supabase Project URL *</label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="https://your-project-id.supabase.co"
                  required
                />
                <p className="text-4xs text-gray-400 mt-1">คัดลอกได้จากเมนู Settings &rarr; API &rarr; Project URL ของสตรีม Supabase</p>
              </div>

              {/* Supabase Anon Key input */}
              <div>
                <label className="block text-2xs font-mono text-gray-400 uppercase tracking-wider mb-1.5">Supabase Anon Key (API Key) *</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-4xs text-gray-400 mt-1">คัดลอกได้จากเมนู Settings &rarr; API &rarr; Service keys / anon public ของ Supabase</p>
              </div>
            </div>

            {/* Display Test Results */}
            {testResult && (
              <div className={`p-4 rounded-xl border text-xs flex items-start gap-2 font-sans ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-150 text-emerald-800' 
                  : 'bg-red-50 border-red-150 text-red-800'
              }`}>
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="text-left">
                  <h5 className="font-bold">{testResult.success ? 'ตรวจสอบสำเร็จ!' : 'พบขัดข้อง'}</h5>
                  <p className="text-3xs text-slate-650 leading-relaxed mt-0.5">{testResult.message}</p>
                </div>
              </div>
            )}

            {/* Configuration operation buttons */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                disabled={testing || !supabaseUrl || !supabaseKey}
                onClick={handleTestConnection}
                className="flex items-center space-x-1.5 px-3 py-1.5 border border-indigo-200 hover:bg-indigo-50 text-indigo-700 rounded-xl font-sans font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 fill-indigo-700" />
                )}
                <span>{testing ? 'กำลังตรวจสอบ...' : 'ทดสอบสัญญาณเชื่อม'}</span>
              </button>

              {/* Save settings */}
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs py-2 px-4 rounded-xl shadow-xs cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> <span>บันทึกตั้งค่าแล้ว!</span>
                  </>
                ) : (
                  <span>บันทึกและเชื่อมฐานข้อมูล</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Guide Setup / SQL Copy instructions (Right-side) */}
      <div className="lg:col-span-6 space-y-6" id="settings-guide-col">
        <div className="bg-[#12101a] text-slate-300 p-6 rounded-2xl relative shadow-md overflow-hidden border border-slate-800">
          {/* Header Row: Flex container for branding title and operation tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <Terminal className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
              <div>
                <h4 className="text-xs font-sans font-black text-white uppercase tracking-wider leading-none">
                  คำสั่งตั้งตารางคลัง SQL Editor
                </h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-none font-sans">จัดการสคีมาฐานข้อมูลและตรวจสุขภาพหลักสำเร็จรูป</p>
              </div>
            </div>
            
            {/* Toggle tabs for Clean Install vs Alter Columns */}
            <div className="flex bg-[#0a0810] rounded-xl p-1 border border-slate-800 self-start sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setActiveCodeTab('create')}
                className={`px-3 py-1.5 text-[10px] font-sans font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeCodeTab === 'create' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                สร้างใหม่ (Clean Install)
              </button>
              <button
                type="button"
                onClick={() => setActiveCodeTab('migration')}
                className={`px-3 py-1.5 text-[10px] font-sans font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeCodeTab === 'migration' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                อัปเกรดตารางพัสดุ (ALTER)
              </button>
            </div>
          </div>

          {/* Connected Health & Diagnostics Panel - Now placed beautifully below the header border line */}
          <div className="bg-[#111827] text-white p-4 rounded-xl border border-slate-800/85 text-left mb-5 relative overflow-hidden" id="supabase-admin-diagnostics">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-550/5 rounded-full -mr-4 -mt-4" />
            
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full animate-pulse ${
                  diagStatus.success 
                    ? 'bg-emerald-400' 
                    : 'bg-rose-500'
                }`} />
                <span className="text-[9px] font-sans font-extrabold tracking-wider uppercase text-indigo-300">
                  Live DB Diagnostics (ตรวจประเมินผลระบบพัสดุ)
                </span>
              </div>

              {diagStatus.loading ? (
                <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[8px] font-extrabold border border-indigo-500/20 flex items-center gap-1">
                  <RefreshCw className="h-2 w-2 animate-spin" /> ค้นหา...
                </span>
              ) : diagStatus.success ? (
                <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[8px] font-extrabold border border-emerald-500/20 font-sans">
                  สัญญาณดีเยี่ยม
                </span>
              ) : (
                <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded text-[8px] font-extrabold border border-rose-500/20 font-sans">
                  เกิดข้อขัดข้อง
                </span>
              )}
            </div>

            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5 font-sans">
              <Database className="h-3.5 w-3.5 text-indigo-400 font-bold" /> สถานะการเชื่อมต่อโครงการ Supabase
            </h3>

            {diagStatus.loading ? (
              <div className="py-3 flex flex-col items-center justify-center space-y-1.5 text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                <span className="text-[9px] font-sans">กำลังประสานงานและดึงข้อมูลรายงานการเชื่อมฝั่งเซิร์ฟเวอร์แบบเรียลไทม์...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {diagStatus.success ? (
                  <>
                    <p className="text-[10px] text-emerald-300 leading-normal font-sans font-semibold">
                      ✓ เชื่อมโยงสัญญาณแม่นยำ ตารางหลักทั้งหมดพูนประสิทธิผลความหน่วงต่ำ
                    </p>
                    <div className="text-[9.5px] font-mono text-emerald-400 bg-[#0a1512] border border-emerald-950/40 p-2.5 rounded-lg space-y-1 text-left select-none">
                      <div className="truncate">🏢 Project Host: <span className="text-stone-300 font-sans">{supabaseUrl.replace('https://', '')}</span></div>
                      <div className="flex items-center justify-between border-t border-emerald-900/10 pt-1.5 mt-1.5 text-stone-300">
                        <span>📦 รายงานจำนวนพัสดุในระบบจริง (Live Items):</span>
                        <span className="text-white font-extrabold">{diagStatus.itemCount} ชิ้น</span>
                      </div>
                      <div className="flex items-center justify-between text-stone-300">
                        <span>📊 จำนวนประวัติธุรกรรมเบิกรับจ่าย (Transactions):</span>
                        <span className="text-white font-extrabold">{diagStatus.rxCount} รายการ</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-rose-300 leading-normal font-sans">
                      ✗ ไม่สามารถจับคู่โครงสร้างตารางหลักคลังพัสดุกับ Supabase ปัจจุบันได้ครบ
                    </p>
                    <div className="text-[9.5px] font-mono text-rose-400 bg-[#1b0d0f] border border-rose-950/40 p-2.5 rounded-lg text-left leading-relaxed">
                      คำชี้แจง: {diagStatus.message}
                    </div>
                    <div className="p-2.5 bg-[#150d18] border border-indigo-950/30 rounded-lg text-[9px] text-indigo-200 leading-relaxed font-sans">
                      💡 <strong>แนวทางแก้ไข:</strong> คัดลอกสคริปต์ SQL ด้านล่าง ไปรันตรวจสอบในแถบ SQL Editor จากคอนโซล Supabase ของท่าน เมื่อจัดสรรตารางเสร็จสิ้นระบบจะประสานและทำงานอัตโนมัติทันทีค่ะ!
                    </div>
                  </>
                )}
              </div>
            )}
            
            <button
              type="button"
              onClick={runDiagnostics}
              disabled={diagStatus.loading}
              className="w-full mt-2.5 bg-[#0d111b] hover:bg-slate-800 border border-slate-800 text-[9px] font-sans font-bold tracking-wider text-indigo-300 hover:text-white py-1.5 rounded-lg select-none cursor-pointer flex items-center justify-center gap-1.5 transition-all outline-hidden"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${diagStatus.loading ? 'animate-spin' : ''}`} />
              <span>รีเฟรชประมวลผลการเชื่อมโครงตาเหล็ก</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 font-sans mb-4 leading-relaxed">
            {activeCodeTab === 'create' ? (
              <span>
                คัดลอกรหัสคำสั่ง SQL เหล่านี้ไปดำเนินงานผ่าน <span className="text-white font-semibold">SQL Editor &rarr; Create a New Query</span> บนแดชบอร์ดจัดการ Supabase เพื่อสร้างฐานเก็บข้อมูลครบถ้วนสำหรับระบบคุณ
              </span>
            ) : (
              <span className="text-indigo-300">
                ⭐ <span className="font-bold text-white">แก้ไขปัญหายอดจำนวนอุปกรณ์ไม่สมส่วน!</span> พิมพ์คำสั่งด้านล่างนี้ในช่องรันคำสั่งเพื่อแก้ไขคอลัมน์ <code className="bg-slate-900 border border-slate-800 px-1 py-[1px] rounded font-mono text-[9.5px]">available_qty</code> ฯลฯ ลงตารางหลักให้สมบูรณ์ โดยไม่สูญหายข้อมูลประวัติเดิม
              </span>
            )}
          </p>

          <div className="relative">
            <div className="bg-[#0b0911] p-4 rounded-xl border border-slate-850 h-72 overflow-y-auto">
              <pre className="font-mono text-[10px] text-emerald-400 leading-relaxed break-all text-left whitespace-pre-wrap">
                {activeCodeTab === 'create' ? SUPABASE_SQL_SCHEMA : SUPABASE_MIGRATION_SQL}
              </pre>
            </div>
            
            {/* Float Copy Button */}
            <button
              onClick={handleCopySql}
              className="absolute bottom-3 right-3 flex items-center space-x-1 text-[10px] font-sans font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg shadow-md transition cursor-pointer select-none"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" /> <span className="text-emerald-200">คัดลอกเรียบร้อย!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> <span>คัดลอกสคริปต์ {activeCodeTab === 'create' ? 'สร้างใหม่' : 'ตัวปรับปรุงตาราง'}</span>
                </>
              )}
            </button>
          </div>
        </div>


      </div>
    </div>
  );
}
