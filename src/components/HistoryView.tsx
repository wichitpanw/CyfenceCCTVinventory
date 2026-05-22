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
  Package
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
        <h2 className="text-xl font-bold font-sans text-gray-900">ประวัติการเบิก-คืนคลังทั้งหมด</h2>
        <p className="text-xs text-gray-500 font-sans">หน้าสถิติตรวจสอบแบบรวมศูนย์ทุกเหตุการณ์การเคลื่อนไหวของอุปกรณ์</p>
      </div>

      {/* Filter and Search inside History */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-3xs grid grid-cols-1 md:grid-cols-12 gap-4" id="history-controls">
        {/* Search */}
        <div className="relative md:col-span-8" id="history-search-box">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาข้อมูลประวัติด้วย ชื่อผู้เบิก, ฝ่าย, หรือชื่อ/รหัสพัสดุอุปกรณ์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-gray-100 rounded-xl text-xs font-sans focus:outline-hidden font-medium"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative md:col-span-4" id="history-filter-box">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-4 pr-4 py-2.5 rounded-xl border border-gray-150 text-xs font-sans focus:outline-hidden bg-white font-medium"
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
        <div className="flex flex-col items-center justify-center py-20" id="history-loading">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-500 font-sans text-xs">กำลังสืบค้นสารสนเทศ...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-150 shadow-3xs" id="history-empty">
          <History className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold font-sans text-gray-800">ไม่พบประวัติการทำรายการเบิกคืน</h4>
          <p className="text-xs text-gray-500 font-sans mt-0.5">โปรดลองปรับตัวกรอง หรือทำรายการยืม-คืนอุปกรณ์เข้ารหัส</p>
        </div>
      ) : (
        /* Responsive Desktop Table & Mobile Cards */
        <div className="bg-white rounded-2xl border border-gray-150 shadow-2xs overflow-hidden" id="history-data-view">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto lg:overflow-x-visible text-left">
            <table className="min-w-full divide-y divide-gray-100 table-auto lg:table-fixed">
              <colgroup className="hidden lg:table-column-group">
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
                <col className="w-[18%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-[#FAF9FB]">
                <tr>
                  <th scope="col" className="px-4 xl:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">สถานะใบเบิก</th>
                  <th scope="col" className="px-4 xl:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">สรุปรายการพัสดุ</th>
                  <th scope="col" className="px-4 xl:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">ผู้เบิกยืมและสังกัด</th>
                  <th scope="col" className="px-4 xl:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">วันที่เบิก / กำหนดคืน</th>
                  <th scope="col" className="px-4 xl:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">วัตถุประสงค์</th>
                  <th scope="col" className="px-4 xl:px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredGroups.map((group) => {
                  const isExpanded = expandedGroupIds.includes(group.id);
                  const totalItemsCount = group.items.length;
                  const totalQty = group.items.reduce((sum, item) => sum + item.borrow_qty, 0);

                  return (
                    <React.Fragment key={group.id}>
                      {/* Master Row */}
                      <tr 
                        onClick={() => toggleGroup(group.id)} 
                        className={`hover:bg-slate-50/75 transition cursor-pointer select-none ${isExpanded ? 'bg-slate-50/40' : ''}`}
                      >
                        {/* Overall Group Status */}
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold font-sans ${
                            group.status === 'returned'
                              ? 'bg-emerald-50 text-emerald-700'
                              : group.status === 'overdue'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-blue-50 text-blue-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                              group.status === 'returned' ? 'bg-emerald-500' :
                              group.status === 'overdue' ? 'bg-red-500' : 'bg-blue-500'
                            }`}></span>
                            {group.status === 'returned' ? 'คืนครบถ้วน' : group.status === 'overdue' ? 'เลยกำหนดส่ง' : 'กำลังเบิกใช้'}
                          </span>
                        </td>

                        {/* Items Summary info */}
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-700 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-900 leading-normal truncate">
                                เบิกไป {totalItemsCount} รายการ
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 font-sans leading-relaxed truncate">
                                รวม <span className="font-bold text-slate-705 font-mono">{totalQty}</span> ชิ้น
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Borrower */}
                        <td className="px-4 xl:px-6 py-4">
                          <div className="flex items-start space-x-2">
                            <User className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-gray-800 leading-tight truncate" title={group.borrower_name}>{group.borrower_name}</div>
                              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 leading-none">
                                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate" title={group.borrower_department}>{group.borrower_department}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Dates */}
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1 text-[11px] leading-normal font-sans text-slate-650">
                            <p className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>เริ่มยืม: <span className="font-mono font-medium text-slate-700">{new Date(group.borrow_date).toLocaleDateString('th-TH')}</span></span>
                            </p>
                            <p className={`flex items-center gap-1.5 ${group.status === 'overdue' ? 'text-red-500 font-bold' : ''}`}>
                              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>คืนก่อน: <span className="font-mono font-medium">{new Date(group.due_date).toLocaleDateString('th-TH')}</span></span>
                            </p>
                          </div>
                        </td>

                        {/* Purpose and Evidence */}
                        <td className="px-4 xl:px-6 py-4">
                          <div className="space-y-1.5">
                            <p className="text-xs text-slate-600 line-clamp-1 font-sans" title={group.purpose}>
                              "{group.purpose || 'ไม่ได้ระบุวัตถุประสงค์'}"
                            </p>
                            {group.evidence_image_url && (
                              <div className="inline-flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded-md text-[10px] text-blue-700 font-bold hover:underline cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <Camera className="w-3 h-3 shrink-0" />
                                <a href={group.evidence_image_url} target="_blank" rel="noreferrer" className="font-sans">
                                  ภาพหลักฐานเบิก &rarr;
                                </a>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Expand/Collapse Toggle Detail Button */}
                        <td className="px-4 xl:px-6 py-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                              isExpanded 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-3xs' 
                                : 'bg-slate-50 text-slate-600 border border-slate-205 hover:bg-slate-100 hover:text-slate-800'
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
                          <td colSpan={6} className="bg-slate-50/50 p-0 border-y border-slate-100">
                            <div className="px-4 md:px-6 py-4 animate-fade-in space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <div className="flex items-center space-x-2">
                                  <FileText className="w-4 h-4 text-indigo-600" />
                                  <span className="text-xs font-bold text-slate-800 font-sans">บัญชีแสดงอุปกรณ์ในรหัสใบเบิกชุดนี้ ({totalItemsCount} รายการ)</span>
                                </div>
                                <span className="text-xs text-slate-400 font-sans">
                                  ทำรายการเมื่อ {new Date(group.created_at || group.borrow_date).toLocaleString('th-TH')}
                                </span>
                              </div>

                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                                <table className="min-w-full divide-y divide-slate-100">
                                  <thead className="bg-[#FAF9FB]">
                                    <tr>
                                      <th scope="col" className="px-5 py-3 text-[11px] font-bold text-slate-550 font-sans text-left">รหัสอุปกรณ์</th>
                                      <th scope="col" className="px-5 py-3 text-[11px] font-bold text-slate-550 font-sans text-left">รายละเอียดคุณสมบัติอุปกรณ์</th>
                                      <th scope="col" className="px-5 py-3 text-[11px] font-bold text-slate-550 font-sans text-center w-32">จำนวนที่เบิก</th>
                                      <th scope="col" className="px-5 py-3 text-[11px] font-bold text-slate-550 font-sans text-center w-40">สถานะพัสดุ</th>
                                      <th scope="col" className="px-5 py-3 text-[11px] font-bold text-slate-550 font-sans text-left">บันทึกประวัติการส่งมอบคืน</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-150 bg-white">
                                    {group.items.map((item) => (
                                      <tr key={item.transaction_id} className="hover:bg-slate-50/40 transition">
                                        {/* Equipment code */}
                                        <td className="px-5 py-3 whitespace-nowrap text-xs font-sans">
                                          <span className="font-mono bg-slate-100 text-slate-705 px-2 py-1 rounded select-all font-bold">
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
                                          <span className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold font-sans ${
                                            item.status === 'returned'
                                              ? 'bg-emerald-50 text-emerald-700'
                                              : item.status === 'overdue'
                                                ? 'bg-red-50 text-red-700'
                                                : 'bg-blue-50 text-blue-700'
                                          }`}>
                                            {item.status === 'returned' ? '✔ คืนสำเร็จ' : item.status === 'overdue' ? '✖ เลยกำหนด' : '● กำลังเบิกใช้'}
                                          </span>
                                        </td>

                                        {/* Return details info */}
                                        <td className="px-5 py-3 text-xs text-slate-600 leading-relaxed">
                                          {item.return_date ? (
                                            <div className="space-y-0.5">
                                              <p className="font-medium text-slate-700 font-sans">
                                                ส่งคืน: <span className="font-mono font-bold text-slate-600">{new Date(item.return_date).toLocaleDateString('th-TH')}</span>
                                              </p>
                                              {item.condition_on_return && (
                                                <p className="text-[11px] italic text-slate-450 font-sans">
                                                  สภาพ: "{item.condition_on_return}"
                                                </p>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[11px] italic text-slate-400 font-sans">อยู่ระหว่างใช้งาน รอรับพัสดุคืนคลัง...</span>
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
          <div className="block md:hidden divide-y divide-gray-100" id="history-mobile-list">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroupIds.includes(group.id);
              const totalItemsCount = group.items.length;
              const totalQty = group.items.reduce((sum, item) => sum + item.borrow_qty, 0);

              return (
                <div key={group.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition text-left">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-sans ${
                      group.status === 'returned' ? 'bg-emerald-50 text-emerald-700' :
                      group.status === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {group.status === 'returned' ? 'คืนครบถ้วน' : group.status === 'overdue' ? 'เลยกำหนดส่ง' : 'กำลังเบิกใช้'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">
                      ใบเบิก: #{group.id.substring(6, 14).toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold font-sans text-gray-950 leading-relaxed">
                      ใบเสร็จเบิกพัสดุ {totalItemsCount} รายการ (รวม {totalQty} ชิ้น)
                    </h4>
                    <p className="text-[11px] text-slate-600 font-sans font-medium leading-normal">โดย: {group.borrower_name} ({group.borrower_department})</p>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 grid grid-cols-2 gap-2 text-3xs text-slate-500 font-sans">
                    <div>
                      <span className="block text-gray-400 mb-0.5 text-[10px]">วันที่เริ่มยืม:</span>
                      <span className="font-semibold text-slate-700 text-[11px]">{new Date(group.borrow_date).toLocaleDateString('th-TH')}</span>
                    </div>
                    <div>
                      <span className="block text-gray-400 mb-0.5 text-[10px]">กำหนดส่งคืน:</span>
                      <span className={`font-semibold text-[11px] ${group.status === 'overdue' ? 'text-red-500 font-bold' : 'text-slate-700'}`}>{new Date(group.due_date).toLocaleDateString('th-TH')}</span>
                    </div>
                  </div>

                  {group.purpose && (
                    <p className="text-[11px] text-slate-500 italic font-sans leading-relaxed">วัตถุประสงค์: "{group.purpose}"</p>
                  )}

                  {/* Mobile Detail Show/Hide */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 font-sans transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-505" />
                        <span>แสดงพัสดุทั้ง ({totalItemsCount}) รายการคลัง</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden divide-y divide-slate-100 animate-fade-in mt-2">
                      {group.items.map((item) => (
                        <div key={item.transaction_id} className="p-3 text-xs space-y-1.5 bg-slate-50/30">
                          <div className="flex items-start justify-between gap-2.5">
                            <div>
                              <p className="font-bold text-slate-800 leading-normal font-sans">{item.equipment_name}</p>
                              <p className="font-mono text-slate-400 text-[10px] mt-1 font-bold">{item.equipment_code}</p>
                            </div>
                            <span className="bg-slate-200 text-slate-805 font-mono text-xs font-bold px-2 py-0.5 rounded shrink-0">
                              {item.borrow_qty} ชิ้น
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between border-t border-slate-150 pt-2 mt-1.5">
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              item.status === 'returned' ? 'text-emerald-700 bg-emerald-50' :
                              item.status === 'overdue' ? 'text-red-700 bg-red-50' : 'text-blue-700 bg-blue-50'
                            }`}>
                              {item.status === 'returned' ? 'คืนแล้ว' : item.status === 'overdue' ? 'เลยกำหนดส่ง' : 'กำลังเบิกใช้'}
                            </span>
                            
                            {item.return_date ? (
                              <p className="text-slate-600 font-sans text-[11px]">
                                คืนเมื่อ: {new Date(item.return_date).toLocaleDateString('th-TH')}
                              </p>
                            ) : (
                              <p className="text-slate-400 italic font-sans text-[11px]">ยังไม่ได้คืน</p>
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
    </div>
  );
}
