/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';

/** Custom hook: measure a container's real pixel size via ResizeObserver.
 *  Only updates state when BOTH width and height are > 0, so charts
 *  never receive the Recharts sentinel value of -1. */
function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const measure = useCallback(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    if (width > 0 && height > 0) {
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    }
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, size };
}
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
  // Container size hooks for the two chart areas
  const { ref: pieContainerRef, size: pieSize } = useContainerSize();
  const { ref: barContainerRef, size: barSize } = useContainerSize();

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



  // Calculate Category Data for Chart (Sum of available/remaining quantities in stock)
  const categoryCounts: Record<string, number> = {};
  equipments.forEach(item => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + (item.available_qty || 0);
  });
  const categoryChartData = Object.entries(categoryCounts).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

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
    '#0071E3', // Apple Blue
    '#34C759', // Apple Green
    '#FF9500', // Apple Orange
    '#AF52DE', // Apple Purple
    '#FF3B30', // Apple Red
    '#5AC8FA', // Apple Light Blue
    '#FF2D55', // Apple Pink
    '#86868B', // Apple Gray
  ];

  return (
    <div className="space-y-4 relative min-h-[400px]" id="dashboard-view-wrapper">
      {/* Global premium loading overlay to prevent Cumulative Layout Shift (CLS) and ensure dimensions are calculated beforehand */}
      {loading && (
        <div className="absolute inset-0 bg-[#F5F5F7]/60 backdrop-blur-xs flex flex-col items-center justify-center z-50 rounded-2xl transition-all duration-300" id="dashboard-loading-overlay">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0071E3] mb-3"></div>
          <p className="text-xs text-[#86868B] font-sans font-semibold">กำลังดึงข้อมูลแดชบอร์ด...</p>
        </div>
      )}

      {/* If connected to live Supabase but empty database, show a nice welcoming helper banner */}
      {!loading && !config.useLocalStorage && equipments.length === 0 && (
        <div className="bg-[#E8F2FF] border border-[#0071E3]/20 rounded-2xl p-5 text-[#1D1D1F] text-left shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0071E3]/5 rounded-full -mr-10 -mt-10" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <span className="bg-[#0071E3] text-white text-[9px] font-sans font-black tracking-widest px-2.5 py-0.5 rounded-full uppercase">
                Supabase LIVE (เชื่อมสำเร็จ)
              </span>
              <h3 className="text-xs font-sans font-extrabold text-[#1D1D1F] mt-1.5">
                🎉 เชื่อมต่อระบบเรียลไทม์สำเร็จแล้ว แต่ยังตรวจไม่พบข้อมูลพัสดุในระบบ!
              </h3>
              <p className="text-[#86868B] text-[11px] leading-relaxed max-w-2xl">
                เนื่องจากเป็นฐานข้อมูลใหม่ที่ว่างเปล่า จึงยังไม่พบข้อมูลอุปกรณ์และกราฟแสดงผลผลลัพธ์ ท่านสามารถกดยืนยันการนำเข้าข้อมูลชุดตัวอย่างเริ่มต้น (กล้องวงจรปิด, สายสัญญาณ, อะแดปเตอร์สลับ PoE) ได้ฟรีในพริบตาผ่านปุ่มเติมชุดข้อมูลตัวอย่างที่หน้าตั้งค่า!
              </p>
            </div>
            
            <button
              onClick={() => onNavigate('settings')}
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-sans font-extrabold text-xs py-2 px-4 rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
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
          className="bg-white border border-[#E8E8ED] p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden transition-all duration-300 cursor-pointer group hover:border-[#0071E3] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5"
          id="kpi-total-items"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#E8F2FF] rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500" />
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="p-3 bg-[#E8F2FF] text-[#0071E3] rounded-2xl group-hover:bg-[#0071E3] group-hover:text-white transition-all duration-300">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-[#86868B] uppercase font-sans font-bold tracking-wider">อุปกรณ์ทั้งหมด</p>
              <h3 className="text-2xl font-sans font-extrabold text-[#1D1D1F] mt-0.5">{stats?.totalItems || 0} ชิ้น</h3>
            </div>
          </div>
          <p className="text-[11px] text-[#0071E3] font-bold mt-4 flex items-center group-hover:translate-x-1 transition-transform duration-300">
            ดูรายการอุปกรณ์ทั้งหมด &rarr;
          </p>
        </div>

        {/* Card 2: Active / Overdue Borrows */}
        <div 
          onClick={() => onNavigate('borrow')}
          className="bg-white border border-[#E8E8ED] p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden transition-all duration-300 cursor-pointer group hover:border-[#0071E3] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5"
          id="kpi-borrowed-items"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#FFF2E0] rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500" />
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="p-3 bg-[#FFF2E0] text-[#FF9500] rounded-2xl group-hover:bg-[#FF9500] group-hover:text-white transition-all duration-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-[#86868B] uppercase font-sans font-bold tracking-wider">ถูกเบิกยืมขณะนี้</p>
              <h3 className="text-2xl font-sans font-extrabold text-[#1D1D1F] mt-0.5">
                {stats?.activeBorrows || 0} รายการ
              </h3>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] text-[#0071E3] font-bold">
            <span className="group-hover:translate-x-1 transition-transform duration-300">ทำรายการเพิ่มหรือส่งคืน &rarr;</span>
            {stats && stats.overdueBorrows > 0 && (
              <span className="bg-[#FFEBEA] text-[#FF3B30] font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-[#FF3B30]/10 animate-pulse flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> เกินกำหนด {stats.overdueBorrows} ชิ้น
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Ready / Maintenance */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="bg-white border border-[#E8E8ED] p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden transition-all duration-300 cursor-pointer group hover:border-[#0071E3] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5"
          id="kpi-available-items"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#EAF9EE] rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500" />
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="p-3 bg-[#EAF9EE] text-[#34C759] rounded-2xl group-hover:bg-[#34C759] group-hover:text-white transition-all duration-300">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-[#86868B] uppercase font-sans font-bold tracking-wider">พร้อมใช้งานทันที</p>
              <h3 className="text-2xl font-sans font-extrabold text-[#34C759] mt-0.5">{stats?.availableItems || 0} ชิ้น</h3>
            </div>
          </div>
          <p className="text-[11px] text-[#34C759] font-bold mt-4 group-hover:translate-x-1 transition-transform duration-300">
            คิดเป็น {stats && stats.totalItems ? Math.round((stats.availableItems / stats.totalItems) * 100) : 0}% ของคลัง &rarr;
          </p>
        </div>

        {/* Card 4: Critical Maintain Items */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="bg-white border border-[#E8E8ED] p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden transition-all duration-300 cursor-pointer group hover:border-[#0071E3] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5"
          id="kpi-maintenance-items"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#FFEBEA] rounded-full -mr-6 -mt-6 transition-transform group-hover:scale-110 duration-500" />
          <div className="flex items-center space-x-3.5 relative z-10">
            <div className="p-3 bg-[#FFEBEA] text-[#FF3B30] rounded-2xl group-hover:bg-[#FF3B30] group-hover:text-white transition-all duration-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-[#86868B] uppercase font-sans font-bold tracking-wider">ซ่อมบำรุง / ชำรุด</p>
              <h3 className="text-2xl font-sans font-extrabold text-[#FF3B30] mt-0.5">
                {(stats?.maintenanceItems || 0) + (stats?.brokenItems || 0)} ชิ้น
              </h3>
            </div>
          </div>
          <p className="text-[11px] text-[#FF3B30] font-bold mt-4 group-hover:translate-x-1 transition-transform duration-300">
            ซ่อมบำรุง {stats?.maintenanceItems || 0} · ชำรุด {stats?.brokenItems || 0} ชิ้น &rarr;
          </p>
        </div>
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="dashboard-charts-section">
        {/* Status Distribution (Pie Chart) */}
        <div className="lg:col-span-5 bg-white p-5 border border-[#E8E8ED] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col" id="chart-pie">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#0071E3]" /> สัดส่วนพัสดุที่ถูกยืมแยกตามหน่วยงาน/บริษัท
            </h4>
          </div>
          <div className="flex-1 flex flex-col justify-center min-h-[220px]">
            {departmentChartData.length === 0 ? (
              <div className="text-center py-8 px-4 flex flex-col items-center justify-center space-y-2">
                <div className="p-4 bg-[#F5F5F7] text-[#86868B] rounded-2xl">
                  <Package className="h-6 w-6 stroke-1.5" />
                </div>
                <p className="text-xs font-sans font-extrabold text-[#1D1D1F]">ไม่มีข้อมูลพัสดุที่กำลังถูกยืมขณะนี้</p>
                <p className="text-[11px] text-[#86868B] text-center font-sans max-w-[240px]">เมื่อมีการทำรายการเบิกยืมพัสดุ สถานะของบริษัทหรือหน่วยงานที่เบิกจะมาปรากฏสัดส่วนขึ้นบนกราฟรูปวงกลมนี้ทันทีค่ะ</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div ref={pieContainerRef} className="sm:col-span-7 h-44 relative flex items-center justify-center">
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-sans font-extrabold text-[#1D1D1F] leading-none">{totalActiveBorrowedItems}</span>
                    <span className="text-[9px] text-[#86868B] font-sans mt-0.5 font-bold uppercase tracking-wider">พัสดุถูกยืม</span>
                  </div>
                  {pieSize && (
                    <PieChart width={pieSize.width} height={pieSize.height}>
                      <Pie
                        data={departmentChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {departmentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          fontFamily: 'var(--font-sans)', 
                          borderRadius: '12px', 
                          border: '1px solid #E8E8ED', 
                          boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
                          fontSize: '11px'
                        }}
                        formatter={(value: any, name: any) => [`${value} ชิ้น`, name]}
                      />
                    </PieChart>
                  )}
                </div>
                <div className="sm:col-span-5 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {departmentChartData.map((item, index) => {
                    const color = DEPT_COLORS[index % DEPT_COLORS.length];
                    const percent = totalActiveBorrowedItems > 0 ? Math.round((item.value / totalActiveBorrowedItems) * 100) : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-[11px] font-sans">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                          <span className="text-[#1D1D1F] font-bold truncate" title={item.name}>{item.name}</span>
                        </div>
                        <span className="font-sans text-[#86868B] shrink-0 font-bold pl-2">
                          {item.value} ชิ้น <span className="text-[#86868B]/60 text-[10px] font-medium">({percent}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category breakdown (Horizontal Bar Chart) */}
        <div className="lg:col-span-7 bg-white p-5 border border-[#E8E8ED] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)]" id="chart-bar">
          <h4 className="text-xs font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-[#0071E3]" /> ปริมาณอุปกรณ์คงเหลือแยกตามหมวดหมู่
          </h4>
          <div ref={barContainerRef} className="h-56">
            {categoryChartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-xs font-sans font-bold text-[#86868B]">ไม่มีข้อมูลอุปกรณ์เพื่อแสดงสถิติ</p>
              </div>
            ) : barSize ? (
              <BarChart 
                width={barSize.width}
                height={barSize.height}
                layout="vertical" 
                data={categoryChartData} 
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <XAxis type="number" stroke="#86868B" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#1D1D1F" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  width={140}
                />
                <Tooltip 
                  cursor={{ fill: '#F5F5F7' }}
                  contentStyle={{ 
                    fontFamily: 'var(--font-sans)', 
                    borderRadius: '12px', 
                    border: '1px solid #E8E8ED', 
                    boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
                    fontSize: '11px'
                  }}
                  formatter={(value: any) => [`${value} ชิ้น`, 'คงเหลือในคลัง']}
                />
                <Bar dataKey="value" fill="#0071E3" radius={[0, 8, 8, 0]} barSize={12} name="จำนวนคงเหลือ" />
              </BarChart>
            ) : null}
          </div>
        </div>
      </div>

      {/* Grid: Recent Borrow Activity & Urgency Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="recent-activities-row">
        {/* Recent Transactions list */}
        <div className="lg:col-span-8 bg-white p-5 border border-[#E8E8ED] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col" id="recent-transactions">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-[#86868B] uppercase tracking-wider flex items-center gap-2">
              <History className="h-4 w-4 text-[#0071E3]" /> รายการเดินคลังล่าสุด (เบิก-คืน)
            </h4>
            <button 
              onClick={() => onNavigate('history')}
              className="text-xs text-[#0071E3] hover:text-[#0077ED] font-bold transition-all"
            >
              ดูประวัติทั้งหมด &rarr;
            </button>
          </div>

          <div className="flow-root flex-1">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-12 text-[#86868B] font-sans text-xs">
                ไม่มีประวัติการเบิกคืนบันทึกในระบบในขณะนี้
              </div>
            ) : (
              <ul className="-my-4 divide-y divide-[#E8E8ED]">
                {recentTransactions.map((tx) => (
                  <li key={tx.id} className="py-3.5">
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1 min-w-0 flex items-start space-x-3.5">
                        <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                          tx.status === 'returned' 
                            ? 'bg-[#EAF9EE] text-[#34C759]'
                            : tx.status === 'overdue'
                              ? 'bg-[#FFEBEA] text-[#FF3B30]'
                              : 'bg-[#E8F2FF] text-[#0071E3]'
                        }`}>
                          {tx.status === 'returned' ? (
                            <ArrowDownLeft className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-extrabold text-[#1D1D1F] truncate">
                            {tx.equipment_name}
                          </p>
                          <p className="text-[11px] text-[#86868B] font-sans mt-0.5">
                            ผู้เบิก: <span className="font-semibold text-[#1D1D1F]">{tx.borrower_name}</span> ({tx.borrower_department})
                          </p>
                          <p className="text-[10px] text-[#86868B]/80 font-sans mt-0.5 flex items-center gap-2">
                            <span><Calendar className="h-3 w-3 inline mr-0.5 text-[#86868B]" /> {new Date(tx.borrow_date).toLocaleDateString('th-TH')}</span>
                            {tx.return_date && (
                              <span className="text-[#34C759] font-bold">คืนเมื่อ: {new Date(tx.return_date).toLocaleDateString('th-TH')}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2 shrink-0">
                        <span className={`badge-apple ${
                          tx.status === 'returned'
                            ? 'badge-apple-green'
                            : tx.status === 'overdue'
                              ? 'badge-apple-red'
                              : 'badge-apple-blue'
                        }`}>
                          {tx.status === 'returned' ? 'คืนเรียบร้อย' : tx.status === 'overdue' ? 'เลยกำหนดส่งคืน' : 'กำลังเบิกยืม'}
                        </span>
                        
                        {tx.status !== 'returned' && (
                          <button
                            onClick={() => onQuickReturn(tx)}
                            className="text-[10px] bg-[#F5F5F7] text-[#1D1D1F] border border-[#E8E8ED] hover:bg-[#E8F2FF] hover:text-[#0071E3] hover:border-transparent font-extrabold px-3 py-1.5 rounded-full transition-all cursor-pointer"
                          >
                            ทำรายการคืน
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
          <div className="bg-white p-5 border border-[#E8E8ED] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-left" id="overdue-alerts">
            <h4 className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider mb-4">
              การแจ้งเตือนพัสดุเร่งด่วน
            </h4>
            <div className="space-y-3">
              {stats && stats.overdueBorrows > 0 ? (
                <div className="bg-[#FFEBEA] border border-[#FF3B30]/10 rounded-2xl p-4 flex items-start space-x-3">
                  <XOctagon className="h-5 w-5 text-[#FF3B30] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-sans font-extrabold text-[#FF3B30]">มีพัสดุเลยอายุคืน!</h5>
                    <p className="text-[10px] text-[#FF3B30]/80 mt-1 leading-relaxed">
                      พบอุปกรณ์จำนวน <span className="font-bold">{stats.overdueBorrows} ชิ้น</span> เลยกำหนดวันคืนที่ผู้เบิกระบุไว้ กรุณาตามตัวผู้เบิกเพื่อส่งมอบคืนคลัง
                    </p>
                    <button
                      onClick={() => onNavigate('borrow')}
                      className="text-[10px] font-extrabold text-[#FF3B30] hover:text-[#FF453A] underline mt-2 inline-block"
                    >
                      ตรวจสอบรายการเลยกำหนด &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#EAF9EE] border border-[#34C759]/10 rounded-2xl p-4 flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-[#34C759] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-sans font-extrabold text-[#2F9E44]">พัสดุเป็นระเบียบเรียบร้อย</h5>
                    <p className="text-[10px] text-[#2F9E44]/90 mt-1 leading-relaxed">
                      ยินดีด้วย! ปัจจุบันไม่มีอุปกรณ์ชิ้นใดเลยกำหนดส่งคืน ถือว่าระบบยืมคืนพัสดุทำงานได้อย่างมีประสิทธิภาพ
                    </p>
                  </div>
                </div>
              )}
              
              <div className="bg-[#F5F5F7] border border-[#E8E8ED] rounded-2xl p-4 flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-[#FF9500] shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-sans font-extrabold text-[#1D1D1F]">อุปกรณ์กำลังซ่อมบำรุง</h5>
                  <p className="text-[10px] text-[#86868B] mt-1 leading-relaxed">
                    มีอุปกรณ์ <span className="font-bold text-[#FF9500]">{stats?.maintenanceItems || 0} ชิ้น</span> อยู่ระหว่างส่งตรวจสภาพ และ <span className="font-bold text-[#FF3B30]">{stats?.brokenItems || 0} ชิ้น</span> เสียหายห้ามนำออกเบิก
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
