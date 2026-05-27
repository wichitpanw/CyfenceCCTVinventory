import { useState, useEffect } from 'react';
import { 
  Check, 
  Play, 
  AlertCircle, 
  CheckCircle, 
  Server, 
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
  getDbConfig, 
  saveDbConfig,
  saveSystemSettings
} from '../services/db';

interface SupabaseSettingsViewProps {
  config: SupabaseConfig;
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
  config,
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
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

  // Local state for custom Admin 6-digit PIN
  const [adminPinInput, setAdminPinInput] = useState(() => localStorage.getItem('system_admin_sidebar_pin') || '888888');
  const [pinSaveSuccess, setPinSaveSuccess] = useState(false);

  // Telegram Notifications States
  const [telegramToken, setTelegramToken] = useState(() => localStorage.getItem('system_telegram_bot_token') || '');
  const [telegramChatId, setTelegramChatId] = useState(() => localStorage.getItem('system_telegram_chat_id') || '');
  const [telegramTestStatus, setTelegramTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramSaveSuccess, setTelegramSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchTelegramSettings = async () => {
      try {
        const { getSystemSettings } = await import('../services/db');
        const settings = await getSystemSettings(config);
        if (settings) {
          if (settings.telegram_bot_token) {
            setTelegramToken(settings.telegram_bot_token);
            localStorage.setItem('system_telegram_bot_token', settings.telegram_bot_token);
          }
          if (settings.telegram_chat_id) {
            setTelegramChatId(settings.telegram_chat_id);
            localStorage.setItem('system_telegram_chat_id', settings.telegram_chat_id);
          }
        }
      } catch (e) {
        console.warn('Failed to load settings in SupabaseSettingsView:', e);
      }
    };
    fetchTelegramSettings();
  }, [config]);

  const handleKeyPress = (num: string) => {
    setPinError(false);
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      
      if (nextPin === '8888') {
        sessionStorage.setItem('supabase_settings_unlocked', 'true');
        setIsUnlocked(true);
      } else if (nextPin.length === 4) {
        setTimeout(() => {
          setPinError(true);
          setTimeout(() => {
            setPin('');
          }, 400);
        }, 50);
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
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-3xl border border-[#E8E8ED] shadow-apple-card text-center space-y-6" id="settings-lock-screen">
        <div className="flex justify-center">
          <div className={`p-4.5 rounded-full transition-all duration-300 ${pinError ? 'bg-rose-50 text-rose-600 animate-bounce' : 'bg-blue-50/50 text-apple-primary'}`}>
            <Lock className="h-7 w-7" />
          </div>
        </div>

        <div className="space-y-1.5 leading-snug">
          <h3 className="text-sm font-bold font-sans text-slate-800 uppercase tracking-wider">ยืนยัน PIN ผู้ดูแลระบบ</h3>
          <p className="text-xs text-slate-450 leading-relaxed max-w-xs mx-auto">
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
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                  pinError 
                    ? 'border-rose-500 bg-rose-500 scale-110 shadow-xs' 
                    : hasValue 
                      ? 'border-apple-primary bg-apple-primary scale-110 shadow-xs' 
                      : 'border-slate-300 bg-transparent'
                }`}
              />
            );
          })}
        </div>

        {pinError && (
          <p className="text-xs text-rose-600 font-sans font-bold flex items-center justify-center gap-1 animate-pulse">
            รหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง!
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-4 max-w-[240px] mx-auto pt-2" id="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="w-14 h-14 bg-[#F5F5F7] hover:bg-[#E8E8ED] hover:text-slate-900 active:scale-95 rounded-full flex items-center justify-center text-sm font-black border border-transparent font-mono transition-all duration-150 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="w-14 h-14 text-slate-450 hover:text-rose-605 active:scale-95 flex items-center justify-center text-xs font-bold font-sans transition-all cursor-pointer"
          >
            ล้างรหัส
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="w-14 h-14 bg-[#F5F5F7] hover:bg-[#E8E8ED] hover:text-slate-900 active:scale-95 rounded-full flex items-center justify-center text-sm font-black border border-transparent font-mono transition-all duration-150 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="w-14 h-14 text-slate-450 hover:text-apple-primary active:scale-95 flex items-center justify-center text-xs font-bold font-sans transition-all cursor-pointer"
          >
            ลบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-left w-full animate-fade-in" id="settings-root-container">
      
      {/* System Customization Panel */}
      <div className="bg-white p-6 rounded-2xl border border-[#E8E8ED] shadow-apple-card space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 border-b border-[#E8E8ED] pb-3 flex items-center gap-2">
            <Settings2 className="h-4.5 w-4.5 text-apple-primary" /> ตั้งค่าระบบและโปรไฟล์โปรแกรม
          </h3>
        </div>

        <div className="space-y-5">
          {/* 6-Digit Admin Sidebar PIN Customizer */}
          <div className="p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                🔒 รหัส PIN 6 หลัก ปลดล็อก Sidebar เมนูบริหารคลัง
              </h4>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                กรุณาระบุเลขรหัสผ่าน 6 หลักเพื่อใช้ควบคุมสิทธิ์การเข้าถึงข้อมูลและการอนุมัติคลังแอดมิน (ค่าเริ่มต้น: 888888)
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="text"
                maxLength={6}
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-24 px-3.5 py-1.5 border border-[#E8E8ED] rounded-xl text-center text-xs font-bold font-sans focus:outline-hidden focus:border-apple-primary bg-white transition-all"
                placeholder="888888"
              />
              <button
                type="button"
                onClick={() => {
                  if (adminPinInput.length !== 6) {
                    alert('รหัสผ่านผู้ดูแลระบบจำเป็นต้องมีความยาวครบ 6 หลักถ้วนค่ะ');
                    return;
                  }
                  
                  // Save locally first
                  localStorage.setItem('system_admin_sidebar_pin', adminPinInput);
                  
                  // Save and Sync globally to Supabase!
                  const savePinToSupabase = async () => {
                    try {
                      const { saveSystemSettings } = await import('../services/db');
                      await saveSystemSettings(config, {
                        title: systemTitle,
                        description: systemDesc,
                        version: systemVersion,
                        custom_logo: customLogo,
                        custom_pin: adminPinInput
                      });
                      
                      setPinSaveSuccess(true);
                      setTimeout(() => setPinSaveSuccess(false), 2000);
                      onRefreshAll();
                    } catch (syncErr: any) {
                      console.error('Failed to sync PIN to Supabase:', syncErr);
                      alert(
                        `⚠️ บันทึกในบราวเซอร์เครื่องนี้สำเร็จ! แต่ไม่สามารถซิงค์ไปยัง Supabase Cloud ได้ค่ะ\n\n` +
                        `สาเหตุ: ตาราง system_settings บน Supabase ของคุณยังไม่มีคอลัมน์ 'custom_pin' เพื่อเก็บรหัสผ่าน\n\n` +
                        `💡 วิธีแก้ปัญหาใน 10 วินาที:\n` +
                        `1. เข้าไปที่หน้าเว็บ Supabase Dashboard ของคุณ\n` +
                        `2. ไปที่เมนู "SQL Editor" ทางด้านซ้าย\n` +
                        `3. วางคำสั่ง SQL ต่อไปนี้ลงไปแล้วกด "Run" เพื่ออัปเกรดตารางค่ะ:\n\n` +
                        `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS custom_pin text;\n` +
                        `NOTIFY pgrst, 'reload schema';`
                      );
                    }
                  };
                  savePinToSupabase();
                }}
                className="px-4 py-1.5 bg-[#000000] hover:bg-[#1D1D1F] text-white font-sans font-semibold text-xs rounded-xl shadow-md shadow-apple-primary/10 transition-all cursor-pointer"
              >
                {pinSaveSuccess ? 'บันทึกแล้ว ✓' : 'บันทึก PIN'}
              </button>
            </div>
          </div>

          {/* Telegram Notification Settings Card */}
          <div className="p-5 bg-blue-50/20 rounded-2xl border border-blue-100/50 space-y-4 text-left">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                🔔 ตั้งค่าการแจ้งเตือน Telegram (Telegram Notification)
              </h4>
              <p className="text-[10px] text-slate-400 leading-relaxed font-sans font-semibold">
                ระบุ Token และ Chat ID ของบอท Telegram เพื่อแจ้งเตือนแอดมินแบบเรียลไทม์ทันทีที่มีรายการขอยื่นเบิกใหม่เข้ามาในระบบค่ะ
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-sans font-bold text-slate-500 uppercase tracking-wider mb-1.5">Telegram Bot Token *</label>
                <input
                  type="password"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value.trim())}
                  className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-mono focus:outline-hidden focus:border-apple-primary bg-white transition-all text-slate-850"
                  placeholder="เช่น 123456789:ABCdefGhI..."
                />
              </div>

              <div>
                <label className="block text-[9px] font-sans font-bold text-slate-500 uppercase tracking-wider mb-1.5">Telegram Chat ID / Group ID *</label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value.trim())}
                  className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-mono focus:outline-hidden focus:border-apple-primary bg-white transition-all text-slate-850"
                  placeholder="เช่น -100123456789 หรือ 98765432"
                />
              </div>
            </div>

            {telegramTestStatus && (
              <div className={`p-3.5 rounded-xl border text-[10.5px] leading-relaxed font-sans ${
                telegramTestStatus.success ? 'bg-emerald-50 border-emerald-150 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                {telegramTestStatus.message}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E8E8ED]/60 justify-end">
              <button
                type="button"
                disabled={telegramTesting || !telegramToken || !telegramChatId}
                onClick={async () => {
                  setTelegramTesting(true);
                  setTelegramTestStatus(null);
                  try {
                    const { sendTelegramNotification } = await import('../services/db');
                    const message = `<b>🔔 ทดสอบการแจ้งเตือนระบบคลังพัสดุสำเร็จ!</b>\n\nการเชื่อมโยงระบบบอท Telegram กับ <b>${systemTitle}</b> ทำงานได้สมบูรณ์แบบเรียบร้อยแล้วค่ะ 🕶️💙`;
                    const ok = await sendTelegramNotification(telegramToken, telegramChatId, message);
                    if (ok) {
                      setTelegramTestStatus({ success: true, message: '✅ ส่งข้อความทดสอบไปยัง Telegram สำเร็จแล้ว! กรุณาตรวจสอบในห้องแชทของท่านค่ะ' });
                    } else {
                      setTelegramTestStatus({ success: false, message: '❌ ไม่สามารถส่งข้อความได้ กรุณาตรวจสอบความถูกต้องของ Bot Token และ Chat ID หรือความพร้อมใช้งานของบอท (ต้องแอดบอทเข้าห้องแชทและกด /start ก่อนนะคะ)' });
                    }
                  } catch (e: any) {
                    setTelegramTestStatus({ success: false, message: `เกิดข้อผิดพลาด: ${e?.message || 'ระบบขัดข้อง'}` });
                  } finally {
                    setTelegramTesting(false);
                  }
                }}
                className="px-4 py-1.5 border border-[#E8E8ED] bg-[#F5F5F7] hover:bg-[#E8E8ED] text-slate-700 font-sans font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {telegramTesting ? 'กำลังทดสอบ...' : '⚡ ทดสอบส่งข้อความ'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  // Save locally
                  localStorage.setItem('system_telegram_bot_token', telegramToken);
                  localStorage.setItem('system_telegram_chat_id', telegramChatId);

                  // Sync to Supabase!
                  try {
                    const { saveSystemSettings } = await import('../services/db');
                    await saveSystemSettings(config, {
                      title: systemTitle,
                      description: systemDesc,
                      version: systemVersion,
                      custom_logo: customLogo,
                      custom_pin: localStorage.getItem('system_admin_sidebar_pin') || undefined,
                      telegram_bot_token: telegramToken || undefined,
                      telegram_chat_id: telegramChatId || undefined
                    });
                    setTelegramSaveSuccess(true);
                    setTimeout(() => setTelegramSaveSuccess(false), 2000);
                    onRefreshAll();
                  } catch (e: any) {
                    console.error('Failed to sync Telegram settings to Supabase:', e);
                    alert(`บันทึกในบราวเซอร์สำเร็จ แต่ไม่สามารถซิงค์ไปยัง Supabase ได้ค่ะ: ${e?.message}`);
                  }
                }}
                className="px-4 py-1.5 bg-[#000000] hover:bg-[#1D1D1F] text-white font-sans font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                {telegramSaveSuccess ? 'บันทึกแล้ว ✓' : '💾 บันทึกตั้งค่า Telegram'}
              </button>
            </div>
          </div>

          {/* Logo Customization */}
          <div>
            <label className="block text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider mb-2">ตราสัญลักษณ์ระบบ (System Logo)</label>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-[#F5F5F7]/50 rounded-2xl border border-[#E8E8ED]">
              {/* Logo Preview */}
              <div className="w-16 h-16 shrink-0 rounded-2xl border-2 border-dashed border-[#E8E8ED] flex items-center justify-center p-1.5 bg-white overflow-hidden shadow-3xs">
                {customLogo ? (
                  <img src={customLogo} alt="Custom Logo Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center">
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                    <span className="text-[8px] text-slate-450 mt-1 leading-none font-sans font-semibold">โลโก้เริ่มต้น</span>
                  </div>
                )}
              </div>

              {/* Upload & Reset operations */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  {/* Trigger File Input */}
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-apple-primary hover:bg-[#1D1D1F] text-white rounded-xl text-xs font-semibold font-sans cursor-pointer shadow-md shadow-apple-primary/10 hover:shadow-lg hover:shadow-apple-primary/20 transition active:scale-98">
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
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold font-sans transition border border-rose-200 active:scale-98 cursor-pointer"
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
              <label className="block text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider mb-1.5">ชื่อโปรแกรมระบบ (System Title)</label>
              <input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-semibold text-slate-800 font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-[#F5F5F7]/50 focus:bg-white transition-all"
                placeholder="NT Cyfence Inventory"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider mb-1.5">เวอร์ชั่นโปรแกรม</label>
              <input
                type="text"
                value={localVersion}
                onChange={(e) => setLocalVersion(e.target.value)}
                className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-semibold text-slate-800 font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-[#F5F5F7]/50 focus:bg-white transition-all"
                placeholder="v1.0"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider mb-1.5">คำอธิบายระบบ (System Description)</label>
            <textarea
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-semibold text-slate-800 font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-[#F5F5F7]/50 focus:bg-white transition-all h-16 resize-none"
              placeholder="ระบบจัดการและเบิก-คืนคลังอุปกรณ์อัจฉริยะ"
            />
          </div>

          {/* Save Profile Button */}
          <div className="flex justify-end pt-3.5 border-t border-[#E8E8ED]">
            <button
              type="button"
              onClick={async () => {
                onSystemTitleChange(localTitle);
                onSystemDescChange(localDesc);
                onSystemVersionChange(localVersion);
                localStorage.setItem('system_title', localTitle);
                localStorage.setItem('system_desc', localDesc);
                localStorage.setItem('system_version', localVersion);
                
                // Save to Supabase DB as well
                try {
                  const config = getDbConfig();
                  if (config.supabaseUrl && config.supabaseKey) {
                    await saveSystemSettings(config, {
                      title: localTitle,
                      description: localDesc,
                      version: localVersion,
                      custom_logo: customLogo
                    });
                  }
                } catch (e) {
                  console.error('Failed to save settings to Supabase:', e);
                }
                
                setProfileSaveSuccess(true);
                setTimeout(() => setProfileSaveSuccess(false), 2500);
              }}
              className="flex items-center space-x-1.5 bg-apple-primary hover:bg-[#1D1D1F] text-white font-sans font-bold text-xs py-2 px-4 rounded-xl shadow-md shadow-apple-primary/10 hover:shadow-lg hover:shadow-apple-primary/20 transition active:scale-98 cursor-pointer"
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
      <div className="bg-white p-6 rounded-2xl border border-[#E8E8ED] shadow-apple-card">
        <h3 className="text-sm font-bold text-slate-900 border-b border-[#E8E8ED] pb-3 mb-6 flex items-center gap-2">
          <Server className="h-4.5 w-4.5 text-apple-primary" /> การตั้งค่าฐานข้อมูลเซิร์ฟเวอร์ Supabase
        </h3>

        <div className="space-y-6">
          <div className="space-y-4">
            {/* Supabase API URL input */}
            <div>
              <label className="block text-[11px] font-mono text-slate-450 uppercase tracking-wider mb-1.5">Supabase Project URL *</label>
              <input
                type="url"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-semibold text-slate-800 font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-[#F5F5F7]/50 focus:bg-white transition-all"
                placeholder="https://your-project-id.supabase.co"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1 font-sans">คัดลอกได้จากเมนู Settings &rarr; API &rarr; Project URL ของสตรีม Supabase</p>
            </div>

            {/* Supabase Anon Key input */}
            <div>
              <label className="block text-[11px] font-mono text-slate-450 uppercase tracking-wider mb-1.5">Supabase Anon Key (API Key) *</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2 border border-[#E8E8ED] rounded-xl text-xs font-semibold text-slate-800 font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-[#F5F5F7]/50 focus:bg-white transition-all font-mono"
                  placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-650 p-1"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-sans">คัดลอกได้จากเมนู Settings &rarr; API &rarr; Service keys / anon public ของ Supabase</p>
            </div>
          </div>

          {/* Display Test Results */}
          {testResult && (
            <div className={`p-4 rounded-2xl border text-xs flex items-start gap-2.5 font-sans ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-150 text-emerald-800' 
                : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}>
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-[#34C759] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="text-left">
                <h5 className="font-bold">{testResult.success ? 'ตรวจสอบสำเร็จ!' : 'พบข้อขัดข้อง'}</h5>
                <p className="text-[10.5px] text-slate-550 leading-relaxed mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Configuration operation buttons */}
          <div className="pt-3.5 border-t border-[#E8E8ED] flex items-center justify-between">
            <button
              type="button"
              disabled={testing || !supabaseUrl || !supabaseKey}
              onClick={handleTestConnection}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-[#E8E8ED] hover:bg-slate-50 text-slate-700 rounded-xl font-sans font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition active:scale-98"
            >
              {testing ? (
                <RefreshCw className="h-3 w-3 animate-spin text-slate-500" />
              ) : (
                <Play className="h-3 w-3 fill-slate-700 text-slate-700" />
              )}
              <span>{testing ? 'กำลังตรวจสอบ...' : 'ทดสอบสัญญาณเชื่อม'}</span>
            </button>

            {/* Save settings */}
            <button
              type="button"
              onClick={handleSaveSettings}
              className="flex items-center space-x-1 bg-apple-primary hover:bg-[#1D1D1F] text-white font-sans font-bold text-xs py-2 px-4 rounded-xl shadow-md shadow-apple-primary/10 hover:shadow-lg hover:shadow-apple-primary/20 transition active:scale-98 cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" /> <span>บันทึกตั้งค่าแล้ว!</span>
                </>
              ) : (
                <span>บันทึกและเชื่อมฐานข้อมูล</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
