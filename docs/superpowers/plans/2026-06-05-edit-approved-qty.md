# Edit Approved Borrow Request Quantities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to edit the quantities of equipment items in a borrow request that is already approved but pending dispatch (`req.status === 'approved'`), validating against the available stock of the equipment in the database.

**Architecture:** 
1. Implement a database persistence function `updateBorrowRequestItems` in `src/services/db.ts` to update the JSON items field for a borrow request (supporting both Supabase and LocalStorage modes).
2. Update the UI in `src/components/ApprovalView.tsx` to display an interactive quantity editor (minus/plus buttons and a numeric input box) for items in approved requests.
3. Validate quantities between `1` and the equipment's current `available_qty` on input/blur and persist changes immediately.

**Tech Stack:** React, TypeScript, Tailwind CSS (Vanilla CSS/Lucide-react icons), Supabase JS Client

---

### Task 1: Implement `updateBorrowRequestItems` in DB Service

**Files:**
- Modify: `src/services/db.ts`

- [ ] **Step 1: Add implementation of `updateBorrowRequestItems` to `src/services/db.ts`**
  Add the following exported function near other borrow request functions (e.g. around line 1620):

  ```typescript
  // Update borrow request items (Admin action before dispatching)
  export async function updateBorrowRequestItems(
    config: SupabaseConfig,
    requestId: string,
    items: BorrowRequestItem[]
  ): Promise<BorrowRequest> {
    const now = new Date().toISOString();
    const patch: any = { items, updated_at: now };

    const client = getSupabaseClient(config);
    if (client) {
      try {
        const { data, error } = await client
          .from('borrow_requests')
          .update(patch)
          .eq('id', requestId)
          .select();
        if (!error && data && data[0]) {
          const r = data[0] as any;
          return {
            ...r,
            items: Array.isArray(r.items) ? r.items : JSON.parse(r.items || '[]'),
            transaction_ids: Array.isArray(r.transaction_ids) ? r.transaction_ids : [],
          } as BorrowRequest;
        }
        if (error) throw error;
      } catch (err: any) {
        console.error('Error updating borrow_request items:', err);
        handleSupabaseError(err, 'อัปเดตรายการใบเบิก');
      }
    }

    // LocalStorage fallback
    const stored = localStorage.getItem('borrow_requests_local');
    const list: BorrowRequest[] = stored ? JSON.parse(stored) : [];
    const idx = list.findIndex(r => r.id === requestId);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        items,
        updated_at: now
      };
      localStorage.setItem('borrow_requests_local', JSON.stringify(list));
      return list[idx];
    }

    throw new Error('ไม่พบใบเบิกที่ระบุ');
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles successfully**
  Run: `npx tsc --noEmit`
  Expected: No compilation errors related to `db.ts` or `BorrowRequestItem`.

- [ ] **Step 3: Commit changes**
  Run:
  ```bash
  git add src/services/db.ts
  git commit -m "feat: add updateBorrowRequestItems service function"
  ```

---

### Task 2: Implement UI and Event Handlers in `ApprovalView.tsx`

**Files:**
- Modify: `src/components/ApprovalView.tsx`

- [ ] **Step 1: Import the new service function**
  Modify imports at the top of the file to include `updateBorrowRequestItems`:

  ```typescript
  import {
    getBorrowRequests,
    updateBorrowRequestStatus,
    borrowEquipment,
    getEquipments,
    returnBorrowRequestItems,
    revertEntireBorrowRequestReturn,
    deleteBorrowRequest,
    updateBorrowRequestItems, // Add this
  } from '../services/db';
  ```

- [ ] **Step 2: Add `handleUpdateItemQty` state handler function**
  Add the helper handler inside `ApprovalView` component:

  ```typescript
  const handleUpdateItemQty = async (req: BorrowRequest, equipmentId: string, newQty: number) => {
    const eq = equipments.find(e => e.id === equipmentId);
    const maxQty = eq ? (eq.available_qty ?? 0) : 999;
    
    // Clamp quantity
    const clampedQty = Math.max(1, Math.min(maxQty, newQty));
    
    const updatedItems = req.items.map(item => {
      if (item.equipment_id === equipmentId) {
        return { ...item, qty: clampedQty };
      }
      return item;
    });

    // Optimistically update local UI state
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, items: updatedItems } : r));

    try {
      await updateBorrowRequestItems(config, req.id, updatedItems);
    } catch (err: any) {
      setCardError(req.id, err?.message || 'ไม่สามารถปรับปรุงจำนวนพัสดุได้');
      // Revert state on database failure by reloading
      await loadData();
    }
  };
  ```

- [ ] **Step 3: Update item rendering in `ApprovalView.tsx`**
  Modify the item rendering map around line 572:

  *Target code to modify:*
  ```tsx
  <div className="text-right">
    <p className="text-xs font-extrabold text-[#000000]">
      {item.qty} ชิ้น
    </p>
    {actualReturnedQty > 0 && (
      <p className="text-[9px] font-semibold text-[#86868B]">
        (คืนแล้ว {actualReturnedQty} ชิ้น, ค้าง {remainingQty} ชิ้น)
      </p>
    )}
  </div>
  ```

  *Replacement code:*
  ```tsx
  <div className="text-right flex items-center gap-2">
    {req.status === 'approved' ? (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleUpdateItemQty(req, item.equipment_id, item.qty - 1)}
          disabled={item.qty <= 1}
          className="p-1 rounded bg-[#E8E8ED] hover:bg-[#D8D8DC] text-[#1D1D1F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="ลดจำนวน"
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          type="number"
          value={item.qty}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            const updatedItems = req.items.map(it => 
              it.equipment_id === item.equipment_id ? { ...it, qty: isNaN(val) ? 0 : val } : it
            );
            setRequests(prev => prev.map(r => r.id === req.id ? { ...r, items: updatedItems } : r));
          }}
          onBlur={(e) => {
            const val = parseInt(e.target.value, 10);
            const eq = equipments.find(el => el.id === item.equipment_id);
            const maxLimit = eq ? (eq.available_qty ?? 0) : 999;
            const finalVal = Math.max(1, Math.min(maxLimit, isNaN(val) ? 1 : val));
            handleUpdateItemQty(req, item.equipment_id, finalVal);
          }}
          className="w-12 text-center text-xs font-bold bg-[#FFFFFF] border border-[#D1D1D6] rounded px-1 py-0.5 focus:outline-none focus:border-[#000000]"
        />
        <button
          type="button"
          onClick={() => handleUpdateItemQty(req, item.equipment_id, item.qty + 1)}
          disabled={(() => {
            const eq = equipments.find(el => el.id === item.equipment_id);
            return eq ? item.qty >= (eq.available_qty ?? 0) : false;
          })()}
          className="p-1 rounded bg-[#E8E8ED] hover:bg-[#D8D8DC] text-[#1D1D1F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="เพิ่มจำนวน"
        >
          <Plus className="h-3 w-3" />
        </button>
        <span className="text-xs text-[#86868B] ml-0.5">ชิ้น</span>
      </div>
    ) : (
      <>
        <div>
          <p className="text-xs font-extrabold text-[#000000]">
            {item.qty} ชิ้น
          </p>
          {actualReturnedQty > 0 && (
            <p className="text-[9px] font-semibold text-[#86868B]">
              (คืนแล้ว {actualReturnedQty} ชิ้น, ค้าง {remainingQty} ชิ้น)
            </p>
          )}
        </div>
      </>
    )}
  </div>
  ```

- [ ] **Step 4: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`
  Expected: Success without compilation errors.

- [ ] **Step 5: Commit changes**
  Run:
  ```bash
  git add src/components/ApprovalView.tsx
  git commit -m "feat: implement inline quantity editing for approved requests"
  ```
