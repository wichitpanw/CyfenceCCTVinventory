# Design Specification: Edit Equipment Quantities in Approved Borrow Requests

This design specification details the functionality enabling admins to edit equipment quantities in borrow requests that are already in the "Approved" (รอเบิกจ่าย) state before dispatching them.

## Requirements & Scope

- **State Eligibility**: Editing is permitted only for borrow requests with `status === 'approved'`.
- **Quantity Constraints**:
  - Minimum quantity per item: `1`.
  - Maximum quantity per item: The current available stock of the equipment in the database (`equipment.available_qty`).
- **Persistence**: Changes must immediately persist to the backend/LocalStorage so they are retained if the page refreshes.
- **Dispatch Integration**: When the admin dispatches the request (Approved -> Borrowing), the system creates transactions and deducts stock using the modified quantities.

## Proposed Changes

### 1. Database Services (`src/services/db.ts`)
Add a new function `updateBorrowRequestItems` to update the JSON items list in the `borrow_requests` table.

```typescript
export async function updateBorrowRequestItems(
  config: SupabaseConfig,
  requestId: string,
  items: BorrowRequestItem[]
): Promise<BorrowRequest>
```

#### Behavior:
- **Supabase**: Perform an `.update({ items, updated_at })` query on `borrow_requests` for the matching ID and select the updated row.
- **LocalStorage fallback**: Locate the request by ID in `borrow_requests_local`, replace its `items` field, and save the list back to storage.

### 2. Approval View UI Component (`src/components/ApprovalView.tsx`)
Modify the item rendering logic in `ApprovalView.tsx` (specifically inside the expanded card details of an approved request).

#### Key Modifying Areas:
- Import `updateBorrowRequestItems` from `../services/db`.
- When rendering items (`req.items.map(...)`):
  - If `req.status === 'approved'`, display a quantity adjuster instead of static text.
  - Implement a numeric input field with Minus/Plus buttons.
  - Limit input values between `1` and the equipment's `available_qty`.
  - Handle value updates on click (Minus/Plus) and keyboard inputs (numeric typing).
  - Use `onBlur` for input fields to sanitize/clamp out-of-bound values before persisting them to the database.

## Validation & Quality Check

### Self-Review:
- No placeholders like TBD or TODO are included.
- Quantity bounds are strictly checked against available stock to prevent over-borrowing errors.
- The UI handles loading states gracefully if saving items fails, displaying appropriate error banners inside the card.
