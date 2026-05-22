/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle, 
  Calendar, 
  Briefcase,
  AlertTriangle,
  Info,
  Filter,
  User,
  ChevronDown,
  ChevronUp,
  Camera,
  Eye,
  FileText,
  Package,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { Transaction, SupabaseConfig } from '../types';
import { getTransactions } from '../services/db';

interface TransactionGroupItem {
  transaction_id: string;
  equipment_id: string;
  equipment_code: string;
  equipment_name: string;
  borrow_qty: number;
  status: 'borrowing' | 'returned' | 'overdue';
  return_date: string | null;
  condition_on_return?: string;
}

interface TransactionGroup {
  id: string;
  borrower_name: string;
  borrower_department: string;
  borrow_date: string;
  due_date: string;
  purpose: string;
  evidence_image_url?: string;
  status: 'borrowing' | 'returned' | 'overdue';
  created_at: string;
  items: TransactionGroupItem[];
}

function groupTransactions(transactions: Transaction[]): TransactionGroup[] {
  // Sort by created_at or borrow_date desc
  const sorted = [...transactions].sort((a, b) => {
    const timeA = new Date(a.created_at || a.borrow_date || 0).getTime();
    const timeB = new Date(b.created_at || b.borrow_date || 0).getTime();
    return timeB - timeA;
  });
  
  const groups: TransactionGroup[] = [];

  for (const tx of sorted) {
    const txTime = new Date(tx.created_at || tx.borrow_date).getTime();
    
    // Find a group with matching borrower, department, purpose, and timeline within 25 seconds margin
    const matchedGroup = groups.find(g => {
      const gTime = new Date(g.created_at || g.borrow_date).getTime();
      const timeDiff = Math.abs(gTime - txTime);
      
      return (
        g.borrower_name === tx.borrower_name &&
        g.borrower_department === tx.borrower_department &&
        g.purpose === tx.purpose &&
        timeDiff <= 25000 // 25 seconds sequential api speed limit
      );
    });

    const itemDetail: TransactionGroupItem = {
      transaction_id: tx.id,
      equipment_id: tx.equipment_id,
      equipment_code: tx.equipment_code,
      equipment_name: tx.equipment_name,
      borrow_qty: tx.borrow_qty ?? 1,
      status: tx.status,
      return_date: tx.return_date,
      condition_on_return: tx.condition_on_return,
    };

    if (matchedGroup) {
      matchedGroup.items.push(itemDetail);
      // Recalculate group overall status
      const hasOverdue = matchedGroup.items.some(i => i.status === 'overdue');
      const hasBorrowing = matchedGroup.items.some(i => i.status === 'borrowing');
      if (hasOverdue) {
        matchedGroup.status = 'overdue';
      } else if (hasBorrowing) {
        matchedGroup.status = 'borrowing';
      } else {
        matchedGroup.status = 'returned';
      }
      
      if (tx.evidence_image_url && !matchedGroup.evidence_image_url) {
        matchedGroup.evidence_image_url = tx.evidence_image_url;
      }
    } else {
      groups.push({
        id: `group-${tx.id}`,
        borrower_name: tx.borrower_name,
        borrower_department: tx.borrower_department,
        borrow_date: tx.borrow_date,
        due_date: tx.due_date,
        purpose: tx.purpose,
        evidence_image_url: tx.evidence_image_url,
        status: tx.status,
        created_at: tx.created_at || tx.borrow_date,
        items: [itemDetail]
      });
    }
  }

  return groups;
}

interface HistoryViewProps {
  config: SupabaseConfig;
  refreshTrigger: number;
}

export default function HistoryView({ config, refreshTrigger }: HistoryViewProps) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadTransactions() {
      setLoading(true);
      try {
        const fetched = await getTransactions(config);
        setTxs(fetched);
      } catch (err) {
        console.error('Failed to load transaction history', err);
      } finally {
        setLoading(false);
      }
    }
    loadTransactions();
  }, [config, refreshTrigger]);

  const toggleGroup = (groupId: string) => {
    if (expandedGroupIds.includes(groupId)) {
      setExpandedGroupIds(expandedGroupIds.filter(id => id !== groupId));
    } else {
      setExpandedGroupIds([...expandedGroupIds, groupId]);
    }
  };

  // Convert raw transactions to beautiful logical groups
  const groups = groupTransactions(txs);

  const filteredGroups = groups.filter(group => {
    const matchesSearch = 
      group.borrower_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      group.borrower_department.toLowerCase().includes(searchTerm.toLowerCase()) || 
      group.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.items.some(item => 
        item.equipment_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.equipment_code.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'borrowing' && (group.status === 'borrowing' || group.status === 'overdue')) || // active
      (statusFilter === 'overdue' && group.status === 'overdue') || 
      (statusFilter === 'returned' && group.status === 'returned');
      
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 text-left" id="history-view-wrapper">
      {/* View Title */}
      <div>
        <h2 className="text-sm font-bold font-sans text-slate-900 uppercase tracking-wider">ประวัติการเบิก-คืนคลังทั้งหมด</h2>
        <p className="text-xs text-slate-500 font-sans mt-0.5">หน้าสถิติและประวัติการทำรายการเบิก-คืนอุปกรณ์</p>
      </div>

      {/* Filter and Search inside History */}
      <div className="bg-white p-3 rounded-2xl border border-[#E8E8ED] shadow-apple-card flex items-center gap-2" id="history-controls">
        {/* Search */}
        <div className="relative flex-1" id="history-search-box">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#86868B]" />
          <input
            placeholder="ค้นหาข้อมูลประวัติด้วย ชื่อผู้เบิก, ฝ่าย, หรือชื่อ/รหัสพัสดุอุปกรณ์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F5F5F7] border border-transparent rounded-xl text-xs font-sans focus:outline-hidden focus:bg-white focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10 transition-all font-semibold text-[#1D1D1F] placeholder:text-[#86868B]"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative shrink-0" id="history-filter-box">
          <div 
            className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-200 cursor-pointer ${
              statusFilter !== 'all'
                ? 'bg-[#E8F2FF] border-[#0071E3] text-[#0071E3]'
                : 'bg-[#F5F5F7] border-[#E8E8ED] text-[#86868B] hover:bg-[#E8E8ED] hover:text-[#1D1D1F]'
            }`}
            title={`กรองสถานะ: ${
              statusFilter === 'all' ? 'ทั้งหมด' :
              statusFilter === 'borrowing' ? 'กำลังยืมอยู่' :
              statusFilter === 'overdue' ? 'เลยกำหนดส่งคืน' : 'คืนแล้ว'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            <option value="all">สถานะประวัติ: ทั้งหมด</option>
            <option value="borrowing">กำลังยืมอยู่ (Active)</option>
            <option value="overdue">เลยกำหนดส่งคืน (Overdue)</option>
            <option value="returned">ทำรายการคืนสำเร็จแล้ว (Returned)</option>
          </select>
        </div>
      </div>

      {/* History table or list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#E8E8ED] rounded-2xl shadow-apple-card" id="history-loading">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-apple-primary mb-4"></div>
          <p className="text-slate-500 font-sans text-xs font-semibold">กำลังโหลดข้อมูลประวัติการเบิก-คืน...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-[#E8E8ED] shadow-apple-card" id="history-empty">
          <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold font-sans text-slate-800">ไม่พบรายการประวัติการเบิก-คืนอุปกรณ์</h4>
          <p className="text-xs text-slate-450 font-sans mt-1">หากมีข้อสงสัยหรือพบปัญหา ติดต่อเจ้าหน้าที่ดูแลคลังอุปกรณ์เพื่อขอความช่วยเหลือ</p>
        </div>
      ) : (
        /* Responsive Desktop Table & Mobile Cards */
        <div className="bg-white rounded-2xl border border-[#E8E8ED] shadow-apple-card overflow-hidden" id="history-data-view">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto text-left">
            <table className="min-w-full divide-y divide-[#E8E8ED] table-auto">
              <thead className="bg-[#F5F5F7]">
                <tr>
                  <th scope="col" className="px-4 xl:px-6 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap">สถานะใบเบิก</th>
                  <th scope="col" className="px-4 xl:px-6 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap">สรุปรายการพัสดุ</th>
                  <th scope="col" className="px-4 xl:px-6 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap">ผู้เบิกยืมและสังกัด</th>
                  <th scope="col" className="px-4 xl:px-6 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap">วันที่เบิก / กำหนดคืน</th>
                  <th scope="col" className="px-4 xl:px-6 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap">วัตถุประสงค์</th>
                  <th scope="col" className="px-4 xl:px-6 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center font-sans whitespace-nowrap">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#E8E8ED]">
                {filteredGroups.map((group) => {
                  const isExpanded = expandedGroupIds.includes(group.id);
                  const totalItemsCount = group.items.length;
                  const totalQty = group.items.reduce((sum, item) => sum + item.borrow_qty, 0);

                  return (
                    <React.Fragment key={group.id}>
                      {/* Master Row */}
                      <tr 
                        onClick={() => toggleGroup(group.id)} 
                        className={`hover:bg-[#F5F5F7]/40 transition-all duration-200 cursor-pointer select-none ${isExpanded ? 'bg-[#F5F5F7]/30' : ''}`}
                      >
                        {/* Overall Group Status */}
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold font-sans ${
                            group.status === 'returned'
                              ? 'bg-[#EAF9EE] text-[#1D8F3D]'
                              : group.status === 'overdue'
                                ? 'bg-rose-50 text-rose-700 border border-rose-100/50'
                                : 'bg-blue-50/50 text-blue-700 border border-blue-100/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                              group.status === 'returned' ? 'bg-[#34C759]' :
                              group.status === 'overdue' ? 'bg-rose-500' : 'bg-apple-primary'
                            }`}></span>
                            {group.status === 'returned' ? 'คืนครบถ้วน' : group.status === 'overdue' ? 'เลยกำหนดส่ง' : 'กำลังเบิกใช้'}
                          </span>
                        </td>

                        {/* Items Summary info */}
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2.5">
                            <div className="p-2 bg-[#F5F5F7] rounded-xl text-slate-650 shrink-0 border border-[#E8E8ED]">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 leading-normal font-sans whitespace-nowrap">
                                เบิกไป {totalItemsCount} รายการ
                              </div>
                              <div className="text-[10px] text-slate-450 mt-0.5 font-sans leading-relaxed whitespace-nowrap">
                                รวม <span className="font-bold text-slate-700 font-mono">{totalQty}</span> ชิ้น
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Borrower */}
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-start space-x-2.5">
                            <User className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-800 leading-tight font-sans whitespace-nowrap" title={group.borrower_name}>{group.borrower_name}</div>
                              <div className="text-[10.5px] text-slate-450 mt-1 flex items-center gap-1.5 leading-none font-sans whitespace-nowrap">
                                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                                <span className="whitespace-nowrap" title={group.borrower_department}>{group.borrower_department}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Dates */}
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1 text-[10.5px] leading-normal font-sans text-slate-500">
                            <p className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>ยืม: <span className="font-mono font-bold text-slate-650">{new Date(group.borrow_date).toLocaleDateString('th-TH')}</span></span>
                            </p>
                            <p className={`flex items-center gap-1.5 ${group.status === 'overdue' ? 'text-rose-500 font-bold' : ''}`}>
                              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>คืน: <span className="font-mono font-bold">{new Date(group.due_date).toLocaleDateString('th-TH')}</span></span>
                            </p>
                          </div>
                        </td>

                        {/* Purpose and Evidence */}
                        <td className="px-4 xl:px-6 py-4 max-w-[200px]">
                          <div className="space-y-1.5">
                            {/* Purpose with tooltip for long text */}
                            <div className="group relative">
                              <p className="text-xs text-slate-600 line-clamp-2 font-sans italic leading-relaxed cursor-default" title={group.purpose || 'ไม่ได้ระบุวัตถุประสงค์'}>
                                "{group.purpose || 'ไม่ได้ระบุวัตถุประสงค์'}"
                              </p>
                              {/* Hover tooltip for full purpose text */}
                              {group.purpose && group.purpose.length > 40 && (
                                <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover:block w-64 bg-[#1D1D1F] text-white text-[11px] font-sans leading-relaxed rounded-xl px-3 py-2.5 shadow-2xl pointer-events-none">
                                  <p className="text-white/70 text-[9px] font-bold uppercase tracking-wider mb-1">วัตถุประสงค์เต็มข้อความ</p>
                                  {group.purpose}
                                </div>
                              )}
                            </div>
                            {group.evidence_image_url && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveLightboxUrl(group.evidence_image_url);
                                }}
                                title="คลิกดูภาพหลักฐานการเบิก"
                                className="inline-flex items-center justify-center w-7 h-7 bg-blue-50/60 hover:bg-blue-100 rounded-lg cursor-pointer border border-blue-100/60 transition-all active:scale-90 shrink-0"
                              >
                                <Camera className="w-3.5 h-3.5 text-apple-primary" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Expand/Collapse Toggle Detail Button */}
                        <td className="px-4 xl:px-6 py-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer border active:scale-95 ${
                              isExpanded 
                                ? 'bg-blue-50 text-apple-primary border-blue-100/80 shadow-xs' 
                                : 'bg-[#F5F5F7] text-slate-600 border-[#E8E8ED] hover:bg-slate-100 hover:text-slate-800'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isExpanded ? 'ซ่อน' : 'แสดงลิสต์'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Detail Accordion Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-[#F5F5F7]/30 p-0 border-y border-[#E8E8ED]">
                            <div className="px-6 py-5 animate-fade-in space-y-4 text-left">
                              <div className="flex items-center justify-between border-b border-[#E8E8ED] pb-2 shrink-0">
                                <div className="flex items-center space-x-2.5">
                                  <FileText className="w-4 h-4 text-apple-primary" />
                                  <span className="text-xs font-bold text-slate-800 font-sans">พัสดุในใบเบิกชุดนี้ ({totalItemsCount} รายการ)</span>
                                </div>
                                <span className="text-[10px] text-slate-450 font-sans">
                                  ทำรายการเมื่อ {new Date(group.created_at || group.borrow_date).toLocaleString('th-TH')}
                                </span>
                              </div>

                              <div className="bg-white rounded-2xl border border-[#E8E8ED] overflow-hidden shadow-apple-card">
                                <table className="min-w-full divide-y divide-[#E8E8ED]">
                                  <thead className="bg-[#F5F5F7]">
                                    <tr>
                                      <th scope="col" className="px-5 py-3 text-[10.5px] font-bold text-slate-500 font-sans text-left uppercase tracking-wider">รหัสอุปกรณ์</th>
                                      <th scope="col" className="px-5 py-3 text-[10.5px] font-bold text-slate-500 font-sans text-left uppercase tracking-wider">รายละเอียดคุณสมบัติอุปกรณ์</th>
                                      <th scope="col" className="px-5 py-3 text-[10.5px] font-bold text-slate-500 font-sans text-center w-32 uppercase tracking-wider">จำนวน</th>
                                      <th scope="col" className="px-5 py-3 text-[10.5px] font-bold text-slate-500 font-sans text-center w-40 uppercase tracking-wider">สถานะพัสดุ</th>
                                      <th scope="col" className="px-5 py-3 text-[10.5px] font-bold text-slate-500 font-sans text-left uppercase tracking-wider">บันทึกประวัติการส่งมอบคืน</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#E8E8ED] bg-white">
                                    {group.items.map((item) => (
                                      <tr key={item.transaction_id} className="hover:bg-[#F5F5F7]/30 transition-all duration-200">
                                        {/* Equipment code */}
                                        <td className="px-5 py-3 whitespace-nowrap text-xs font-sans">
                                          <span className="font-mono bg-[#F5F5F7] text-slate-700 px-2 py-1 rounded-md select-all font-bold border border-[#E8E8ED]">
                                            {item.equipment_code}
                                          </span>
                                        </td>

                                        {/* Equipment Name */}
                                        <td className="px-5 py-3 text-xs font-semibold text-slate-800 font-sans leading-relaxed">
                                          {item.equipment_name}
                                        </td>

                                        {/* Borrow Qty */}
                                        <td className="px-5 py-3 text-center text-xs text-slate-800 font-bold font-mono">
                                          {item.borrow_qty} ชิ้น
                                        </td>

                                        {/* Item Status */}
                                        <td className="px-5 py-3 whitespace-nowrap text-center">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                                            item.status === 'returned'
                                              ? 'bg-[#EAF9EE] text-[#1D8F3D]'
                                              : item.status === 'overdue'
                                                ? 'bg-rose-50 text-rose-700 border border-rose-100/50'
                                                : 'bg-blue-50/50 text-blue-700 border border-blue-100/30'
                                          }`}>
                                            {item.status === 'returned' ? '✔ คืนสำเร็จ' : item.status === 'overdue' ? '✖ เลยกำหนด' : '● กำลังเบิกใช้'}
                                          </span>
                                        </td>

                                        {/* Return details info */}
                                        <td className="px-5 py-3 text-xs text-slate-600 leading-relaxed font-sans">
                                          {item.return_date ? (
                                            <div className="space-y-0.5">
                                              <p className="font-bold text-slate-700 text-[11px]">
                                                คืนเมื่อ: <span className="font-mono text-slate-600">{new Date(item.return_date).toLocaleDateString('th-TH')}</span>
                                              </p>
                                              {item.condition_on_return && (
                                                <p className="text-[10px] italic text-slate-450">
                                                  สภาพ: "{item.condition_on_return}"
                                                </p>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[10px] italic text-slate-400">อยู่ระหว่างใช้งาน รอรับคืน...</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards rendering */}
          <div className="block md:hidden divide-y divide-[#E8E8ED]" id="history-mobile-list">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroupIds.includes(group.id);
              const totalItemsCount = group.items.length;
              const totalQty = group.items.reduce((sum, item) => sum + item.borrow_qty, 0);

              return (
                <div key={group.id} className="p-5 space-y-3.5 hover:bg-[#F5F5F7]/30 transition-all duration-200 text-left">
                  <div className="flex items-center justify-between shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                      group.status === 'returned' ? 'bg-[#EAF9EE] text-[#1D8F3D]' :
                      group.status === 'overdue' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50/50 text-blue-700'
                    }`}>
                      {group.status === 'returned' ? 'คืนครบถ้วน' : group.status === 'overdue' ? 'เลยกำหนดส่ง' : 'กำลังเบิกใช้'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      ใบเบิก: #{group.id.substring(6, 14).toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold font-sans text-slate-900 leading-snug">
                      ใบเสร็จเบิกพัสดุ {totalItemsCount} รายการ (รวม {totalQty} ชิ้น)
                    </h4>
                    <p className="text-[11px] text-slate-550 font-sans leading-normal">โดย: {group.borrower_name} ({group.borrower_department})</p>
                  </div>

                  <div className="bg-[#F5F5F7]/60 p-3 rounded-xl border border-[#E8E8ED] grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-sans">
                    <div>
                      <span className="block text-slate-400 mb-0.5 text-[9.5px]">วันที่เริ่มยืม:</span>
                      <span className="font-bold text-slate-700 text-[11px]">{new Date(group.borrow_date).toLocaleDateString('th-TH')}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400 mb-0.5 text-[9.5px]">กำหนดส่งคืน:</span>
                      <span className={`font-bold text-[11px] ${group.status === 'overdue' ? 'text-rose-500' : 'text-slate-700'}`}>{new Date(group.due_date).toLocaleDateString('th-TH')}</span>
                    </div>
                  </div>

                  {group.purpose && (
                    <p className="text-[11px] text-slate-500 italic font-sans leading-relaxed">วัตถุประสงค์: "{group.purpose}"</p>
                  )}

                  {group.evidence_image_url && (
                    <div className="pt-1 flex justify-start">
                      <button
                        type="button"
                        onClick={() => setActiveLightboxUrl(group.evidence_image_url)}
                        title="คลิกดูภาพหลักฐานการเบิก"
                        className="inline-flex items-center justify-center w-8 h-8 bg-blue-50/60 hover:bg-blue-100 rounded-xl cursor-pointer border border-blue-100/60 transition-all active:scale-90"
                      >
                        <Camera className="w-4 h-4 text-apple-primary shrink-0" />
                      </button>
                    </div>
                  )}

                  {/* Mobile Detail Show/Hide */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between px-3.5 py-2 bg-[#F5F5F7]/60 hover:bg-slate-100 border border-[#E8E8ED] rounded-xl text-xs font-bold text-slate-650 font-sans transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-apple-primary shrink-0" />
                        <span>แสดงพัสดุทั้งหมด ({totalItemsCount} รายการ)</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border border-[#E8E8ED] rounded-2xl bg-white overflow-hidden divide-y divide-[#E8E8ED] animate-fade-in mt-2 shadow-sm">
                      {group.items.map((item) => (
                        <div key={item.transaction_id} className="p-4.5 text-xs space-y-2 bg-[#F5F5F7]/20 text-left">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 leading-snug font-sans">{item.equipment_name}</p>
                              <p className="font-mono text-slate-400 text-[9.5px] mt-1 font-bold select-all">{item.equipment_code}</p>
                            </div>
                            <span className="bg-slate-900 text-white font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-lg shrink-0">
                              {item.borrow_qty} ชิ้น
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between border-t border-[#E8E8ED] pt-2.5 mt-2">
                            <span className={`font-bold px-2 py-0.5 rounded-full text-[9.5px] font-sans ${
                              item.status === 'returned' ? 'text-[#1D8F3D] bg-[#EAF9EE]' :
                              item.status === 'overdue' ? 'text-rose-700 bg-rose-50' : 'text-blue-700 bg-blue-50/50'
                            }`}>
                              {item.status === 'returned' ? 'คืนแล้ว' : item.status === 'overdue' ? 'เลยกำหนดส่ง' : 'กำลังเบิกใช้'}
                            </span>
                            
                            {item.return_date ? (
                              <p className="text-slate-500 font-sans text-[10.5px]">
                                คืนเมื่อ: <span className="font-bold">{new Date(item.return_date).toLocaleDateString('th-TH')}</span>
                              </p>
                            ) : (
                              <p className="text-slate-400 italic font-sans text-[10.5px]">ยังไม่ได้คืน</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox Modal for Evidence Images */}
      {activeLightboxUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1D1D1F]/80 backdrop-blur-md transition-opacity duration-300 animate-fade-in"
          onClick={() => setActiveLightboxUrl(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] p-4 bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center animate-in zoom-in-95 duration-250 border border-[#E8E8ED]" 
            onClick={e => e.stopPropagation()}
          >
            <button 
              type="button"
              className="absolute top-4 right-4 p-2 bg-[#1D1D1F]/10 hover:bg-[#1D1D1F]/20 text-[#1D1D1F] rounded-full transition-all cursor-pointer z-10" 
              onClick={() => setActiveLightboxUrl(null)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full overflow-auto flex items-center justify-center p-2">
              <img 
                src={activeLightboxUrl} 
                alt="Evidence" 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-sm" 
              />
            </div>
            <div className="mt-4 text-xs font-semibold text-[#86868B] font-sans flex items-center gap-2 pb-2">
              <Camera className="w-4 h-4 text-blue-650" />
              <span>ภาพหลักฐานใบเบิกคลังอุปกรณ์ (Cyfence Inventory Evidence Image)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
