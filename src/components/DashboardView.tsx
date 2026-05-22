/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  Package, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  XOctagon,
  ArrowUpRight, 
  ArrowDownLeft, 
  History,
  Calendar,
  Layers,
  Database
} from 'lucide-react';
import { Equipment, Transaction, SupabaseConfig, DashboardStats } from '../types';
import { getDashboardStats, getEquipments, getTransactions } from '../services/db';

interface DashboardViewProps {
  config: SupabaseConfig;
  onNavigate: (tab: string) => void;
  onQuickReturn: (tx: Transaction) => void;
  refreshTrigger: number;
}

export default function DashboardView({ config, onNavigate, onQuickReturn, refreshTrigger }: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      setDbError(null);
      try {
        const [fetchedStats, fetchedEquip, fetchedTxs] = await Promise.all([
          getDashboardStats(config),
          getEquipments(config),
          getTransactions(config)
        ]);
        setStats(fetchedStats);
        setEquipments(fetchedEquip);
        setAllTransactions(fetchedTxs);
        // Take top 5 recent transactions
        setRecentTransactions(fetchedTxs.slice(0, 5));
      } catch (err: any) {
        console.error('Failed to load dashboard data', err);
        setDbError(err?.message || 'ไม่สามารถดึงข้อมูลแดชบอร์ดได้');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [config, refreshTrigger]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20" id="dashboard-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-sans">กำลังดึงข้อมูลแดชบอร์ด...</p>
      </div>
    );
  }

  // Calculate Category Data for Chart
  const categoryCounts: Record<string, number> = {};
  equipments.forEach(item => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });
  const categoryChartData = Object.entries(categoryCounts).map(([name, value]) => ({
    name,
    value
  }));

  // Calculate Department Borrowing Data for Pie Chart (Active Borrows Only)
  const activeTransactions = allTransactions.filter(
    tx => tx.status === 'borrowing' || tx.status === 'overdue'
  );

  const departmentActiveCounts: Record<string, number> = {};
  activeTransactions.forEach(tx => {
    const dept = tx.borrower_department || 'ไม่ระบุหน่วยงาน/บริษัท';
    const qty = tx.borrow_qty || 1;
    departmentActiveCounts[dept] = (departmentActiveCounts[dept] || 0) + qty;
  });

  const departmentChartData = Object.entries(departmentActiveCounts).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  const totalActiveBorrowedItems = departmentChartData.reduce((sum, item) => sum + item.value, 0);

  const DEPT_COLORS = [
    '#3B82F6', // Blue 500
    '#8B5CF6', // Violet 500
    '#10B981', // Emerald 500
    '#F59E0B', // Amber 500
    '#EF4444', // Red 500
    '#06B6D4', // Cyan 500
    '#EC4899', // Pink 500
    '#14B8A6', // Teal 500
  ];

  return (
    <div className="space-y-4" id="dashboard-view-wrapper">
      {/* If connected to live Supabase but empty database, show a nice welcoming helper banner */}
      {!config.useLocalStorage && equipments.length === 0 && (
        <div className="bg-[#1e1a2f] border border-indigo-500/80 rounded-2xl p-5 text-white text-left shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full -mr-10 -mt-10" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <span className="bg-indigo-600 text-white text-[9px] font-mono font-black tracking-widest px-2.5 py-0.5 rounded uppercase">
                Supabase LIVE (เชื่อมสำเร็จ)
              </span>
              <h3 className="text-xs font-sans font-black text-white mt-1.5">
                🎉 เชื่อมต่อระบบเรียลไทม์สำเร็จแล้ว แต่ยังตรวจไม่พบข้อมูลพัสดุในระบบ!
              </h3>
              <p className="text-slate-300 text-[11px] leading-relaxed max-w-2xl">
                เนื่องจากเป็นฐานข้อมูลใหม่ที่ว่างเปล่า จึงยังไม่พบข้อมูลอุปกรณ์และกราฟแสดงผลผลลัพธ์ ท่านสามารถกดยืนยันการนำเข้าข้อมูลชุดตัวอย่างเริ่มต้น (กล้องวงจรปิด, สายสัญญาณ, อะแดปเตอร์สลับ PoE) ได้ฟรีในพริบตาผ่านปุ่มเติมชุดข้อมูลตัวอย่างที่หน้าตั้งค่า!
              </p>
            </div>
            
            <button
              onClick={() => onNavigate('settings')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-extrabold text-xs py-2 px-4 rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
            >
              <Database className="h-4 w-4" />
              <span>ก้าวไปหน้าเติมข้อมูลเริ่มต้น ➔</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-grid">
        {/* Card 1: Total Items */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="bg-white border border-slate-250 p-4 rounded flex flex-col justify-center relative overflow-hidden transition-all duration-300 cursor-pointer group hover:border-blue-500 hover:shadow-xs"
          id="kpi-total-items"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500" />
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-sm group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-sans font-bold tracking-wider">อุปกรณ์ทั้งหมด</p>
              <h3 className="text-2xl font-mono font-bold text-slate-900 mt-0.5">{stats?.totalItems || 0} ชิ้น</h3>
            </div>
          </div>
          <p className="text-[11px] text-blue-600 font-bold mt-4 flex items-center group-hover:translate-x-1 transition-transform duration-300">
            ดูรายการอุปกรณ์ทั้งหมด &rarr;
          </p>
        </div>

        {/* Card 2: Active / Overdue Borrows */}
        <div 
          onClick={() => onNavigate('borrow')}
          className="bg-white border border-slate-250 p-4 rounded flex flex-col justify-center relative overflow-hidden transition-all duration-300 cursor-pointer group hover:border-blue-500 hover:shadow-xs"
          id="kpi-borrowed-items"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500" />
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-sm group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-sans font-bold tracking-wider">ถูกเบิกยืมขณะนี้</p>
              <h3 className="text-2xl font-mono font-bold text-slate-900 mt-0.5">
                {stats?.activeBorrows || 0} รายการ
              </h3>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] text-blue-600 font-bold">
            <span className="group-hover:translate-x-1 transition-transform duration-300">ทำรายการเพิ่มหรือส่งคืน &rarr;</span>
            {stats && stats.overdueBorrows > 0 && (
              <span className="bg-red-50 text-red-650 font-bold px-2 py-0.5 rounded text-[10px] border border-red-100 animate-pulse flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> เกินกำหนด {stats.overdueBorrows} ชิ้น
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Ready / Maintenance */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="bg-white border border-slate-250 p-4 rounded flex flex-col justify-center relative overflow-hidden transition-all duration-300 cursor-pointer group hover:border-blue-500 hover:shadow-xs"
          id="kpi-available-items"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500" />
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-sm group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-sans font-bold tracking-wider">พร้อมใช้งานทันที</p>
              <h3 className="text-2xl font-mono font-bold text-emerald-600 mt-0.5">{stats?.availableItems || 0} ชิ้น</h3>
            </div>
          </div>
          <p className="text-[11px] text-emerald-650 font-bold mt-4 group-hover:translate-x-1 transition-transform duration-300">
            คิดเป็น {stats && stats.totalItems ? Math.round((stats.availableItems / stats.totalItems) * 100) : 0}% ของคลัง &rarr;
          </p>
        </div>

        {/* Card 4: Critical Maintain Items */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="bg-white border border-slate-250 p-4 rounded flex flex-col justify-center relative overflow-hidden transition-all duration-300 cursor-pointer group hover:border-blue-500 hover:shadow-xs"
          id="kpi-maintenance-items"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500" />
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-sm group-hover:bg-rose-600 group-hover:text-white transition-all duration-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-sans font-bold tracking-wider">ซ่อมบำรุง / ชำรุด</p>
              <h3 className="text-2xl font-mono font-bold text-rose-655 mt-0.5">
                {(stats?.maintenanceItems || 0) + (stats?.brokenItems || 0)} ชิ้น
              </h3>
            </div>
          </div>
          <p className="text-[11px] text-rose-650 font-bold mt-4 group-hover:translate-x-1 transition-transform duration-300">
            ซ่อมบำรุง {stats?.maintenanceItems || 0} · ชำรุด {stats?.brokenItems || 0} ชิ้น &rarr;
          </p>
        </div>
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="dashboard-charts-section">
        {/* Status Distribution (Pie Chart) */}
        <div className="lg:col-span-5 bg-white p-4 border border-slate-250 rounded shadow-3xs flex flex-col" id="chart-pie">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" /> สัดส่วนพัสดุที่ถูกยืมแยกตามหน่วยงาน/บริษัท
            </h4>
          </div>
          <div className="flex-1 flex flex-col justify-center min-h-[220px]">
            {departmentChartData.length === 0 ? (
              <div className="text-center py-8 px-4 flex flex-col items-center justify-center space-y-2">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-full">
                  <Package className="h-6 w-6 stroke-1" />
                </div>
                <p className="text-xs font-sans font-bold text-slate-700">ไม่มีข้อมูลพัสดุที่กำลังถูกยืมขณะนี้</p>
                <p className="text-[11px] text-slate-400 text-center font-sans max-w-[240px]">เมื่อมีการทำรายการเบิกยืมพัสดุ สถานะของบริษัทหรือหน่วยงานที่เบิกจะมาปรากฏสัดส่วนขึ้นบนกราฟรูปวงกลมนี้ทันทีค่ะ</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-7 h-44 relative flex items-center justify-center">
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-mono font-black text-slate-800 leading-none">{totalActiveBorrowedItems}</span>
                    <span className="text-[9px] text-slate-400 font-sans mt-0.5 font-bold uppercase tracking-wider">พัสดุถูกยืม</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {departmentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          fontFamily: 'Inter, sans-serif', 
                          borderRadius: '8px', 
                          border: '1px solid #E2E8F0', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                          fontSize: '11px'
                        }}
                        formatter={(value: any, name: any) => [`${value} ชิ้น`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="sm:col-span-5 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {departmentChartData.map((item, index) => {
                    const color = DEPT_COLORS[index % DEPT_COLORS.length];
                    const percent = totalActiveBorrowedItems > 0 ? Math.round((item.value / totalActiveBorrowedItems) * 100) : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-[11px] font-sans">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                          <span className="text-slate-700 font-bold truncate" title={item.name}>{item.name}</span>
                        </div>
                        <span className="font-mono text-slate-500 shrink-0 font-bold pl-2">
                          {item.value} ชิ้น <span className="text-slate-350 text-[10px] font-medium">({percent}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category breakdown (Bar Chart) */}
        <div className="lg:col-span-7 bg-white p-4 border border-slate-250 rounded shadow-3xs" id="chart-bar">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-blue-600" /> จำนวนแยกตามหมวดหมู่ประเภท
          </h4>
          <div className="h-56">
            {categoryChartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-xs font-mono text-gray-400">ไม่มีข้อมูลอุปกรณ์เพื่อแสดงสถิติ</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 15 }}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748B" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis stroke="#9CA3AF" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ fontFamily: 'Inter, sans-serif', borderRadius: '4px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="value" fill="#3B82F6" radius={[2, 2, 0, 0]} barSize={24} name="จำนวนอุปกรณ์" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Recent Borrow Activity & Urgency Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="recent-activities-row">
        {/* Recent Transactions list */}
        <div className="lg:col-span-8 bg-white p-4 border border-slate-250 rounded shadow-3xs flex flex-col" id="recent-transactions">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" /> รายการเดินคลังล่าสุด (เบิก-คืน)
            </h4>
            <button 
              onClick={() => onNavigate('history')}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline transition-all"
            >
              ดูประวัติทั้งหมด &rarr;
            </button>
          </div>

          <div className="flow-root flex-1">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-sans text-xs">
                ไม่มีประวัติการเบิกคืนบันทึกในระบบในขณะนี้
              </div>
            ) : (
              <ul className="-my-4 divide-y divide-slate-100">
                {recentTransactions.map((tx) => (
                  <li key={tx.id} className="py-3">
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1 min-w-0 flex items-start space-x-3">
                        <div className={`mt-0.5 p-1.5 rounded-sm shrink-0 ${
                          tx.status === 'returned' 
                            ? 'bg-emerald-50 text-emerald-600'
                            : tx.status === 'overdue'
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-blue-50 text-blue-600'
                        }`}>
                          {tx.status === 'returned' ? (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {tx.equipment_name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                            ผู้เบิก: <span className="font-semibold text-slate-700">{tx.borrower_name}</span> ({tx.borrower_department})
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span><Calendar className="h-3 w-3 inline mr-0.5" /> {new Date(tx.borrow_date).toLocaleDateString('th-TH')}</span>
                            {tx.return_date && (
                              <span className="text-emerald-700 font-bold">คืนเมื่อ: {new Date(tx.return_date).toLocaleDateString('th-TH')}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-1.5 shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold font-sans uppercase border ${
                          tx.status === 'returned'
                            ? 'bg-emerald-50 text-emerald-750 border-emerald-100'
                            : tx.status === 'overdue'
                              ? 'bg-rose-50 text-rose-750 border-rose-100'
                              : 'bg-blue-50 text-blue-750 border-blue-105'
                        }`}>
                          {tx.status === 'returned' ? 'คืนเรียบร้อย' : tx.status === 'overdue' ? 'เลยกำหนดส่งคืน' : 'กำลังเบิกยืม'}
                        </span>
                        
                        {tx.status !== 'returned' && (
                          <button
                            onClick={() => onQuickReturn(tx)}
                            className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold px-2 py-1 rounded transition-all cursor-pointer"
                          >
                            ทำรายการคืนด่วน
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Quick Tips / Connection Info Box */}
        <div className="lg:col-span-4 flex flex-col space-y-4" id="dashboard-right-rail">
          <div className="bg-white p-4 border border-slate-250 rounded shadow-3xs text-left" id="overdue-alerts">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              การแจ้งเตือนพัสดุเร่งด่วน
            </h4>
            <div className="space-y-3">
              {stats && stats.overdueBorrows > 0 ? (
                <div className="bg-red-50 border border-red-105 rounded p-3 flex items-start space-x-2.5">
                  <XOctagon className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-red-800">มีพัสดุเลยอายุคืน!</h5>
                    <p className="text-[10px] text-red-700 mt-1 leading-relaxed">
                      พบอุปกรณ์จำนวน <span className="font-bold">{stats.overdueBorrows} ชิ้น</span> เลยกำหนดวันคืนที่ผู้เบิกระบุไว้ กรุณาตามตัวผู้เบิกเพื่อส่งมอบคืนคลัง
                    </p>
                    <button
                      onClick={() => onNavigate('borrow')}
                      className="text-[10px] font-bold text-red-800 hover:text-red-900 underline mt-1.5 inline-block"
                    >
                      ตรวจสอบรายการเลยกำหนด &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 rounded p-3 flex items-start space-x-2.5">
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-800">พัสดุเป็นระเบียบเรียบร้อย</h5>
                    <p className="text-[10px] text-emerald-700 mt-1 leading-relaxed">
                      ยินดีด้วย! ปัจจุบันไม่มีอุปกรณ์ชิ้นใดเลยกำหนดส่งคืน ถือว่าระบบยืมคืนพัสดุทำงานได้อย่างมีประสิทธิภาพ
                    </p>
                  </div>
                </div>
              )}
              
              <div className="bg-slate-50 border border-slate-100 rounded p-3 flex items-start space-x-2.5">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800">อุปกรณ์กำลังซ่อมบำรุง</h5>
                  <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                    มีอุปกรณ์ <span className="font-bold text-amber-600">{stats?.maintenanceItems || 0} ชิ้น</span> อยู่ระหว่างส่งตรวจสภาพ และ <span className="font-bold text-red-650">{stats?.brokenItems || 0} ชิ้น</span> เสียหายห้ามนำออกเบิก
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
