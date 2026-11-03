# Security Specification & Threat Model for Digi Store

## 1. Data Invariants
1. **User Identity Invariant**: A user document at `/users/{userId}` can only be read or written by the authenticated user whose `request.auth.uid == userId` or an authorized administrator. Users cannot maliciously change their own `walletBalance` directly; balance alterations must happen via authenticated atomic server logic or admin verification.
2. **Product Catalog Invariant**: Any visitor can read active products. Only authorized administrators (in `/admins/{uid}` or authenticated admin email `pranjalkr47@gmail.com`) can create, update, or delete products.
3. **Order Access Invariant**: An order at `/orders/{orderId}` can only be read by the purchaser `resource.data.userId == request.auth.uid` or an authorized administrator. Delivery links (`deliveryUrl`) are confidential and must not be exposed to unauthorized parties. Status transitions ('approved', 'rejected') can only be set by administrators.
4. **Wallet Request Invariant**: Users can create a wallet top-up request with their own `userId` and status `'pending'`. Users cannot set status to `'approved'` or `'rejected'`. Only administrators can approve or reject wallet requests.
5. **Admin Access Invariant**: Documents in `/admins/{adminId}` can only be read/managed by verified administrators.

## 2. The "Dirty Dozen" Threat Payloads (Must be Denied)
1. **Payload 1 (Self-Credited Wallet)**: A normal customer sends an update to `/users/{userId}` changing `walletBalance: 999999`.
2. **Payload 2 (Ghost Field Injection)**: A user creates a user document with an unpermitted field `isAdmin: true` or `role: "superadmin"`.
3. **Payload 3 (ID Spoofing on Order)**: An authenticated attacker submits an order with `userId: "victim_user_123"` to purchase tools on another user's behalf.
4. **Payload 4 (Direct Order Self-Approval)**: A user submits an order directly with `status: "approved"` and arbitrary `deliveryUrl`.
5. **Payload 5 (Order Status Tampering)**: A user attempts to update an existing pending order to `status: "approved"`.
6. **Payload 6 (Other User Order Snooping)**: User B attempts to read `/orders/{orderA}` belonging to User A.
7. **Payload 7 (Direct Wallet Request Approval)**: A user creates or updates a walletRequest directly with `status: "approved"`.
8. **Payload 8 (Product Price Forgery)**: A non-admin user attempts to create or update a document in `/products`.
9. **Payload 9 (Settings Hijacking)**: A non-admin user attempts to modify `/settings/paymentQR` with their personal payment QR code.
10. **Payload 10 (Admin Role Injection)**: A non-admin user writes to `/admins/{uid}` to grant themselves administrator privileges.
11. **Payload 11 (Oversized Payload / Denial-of-Wallet)**: An attacker attempts to write a 1MB string into product title or order notes.
12. **Payload 12 (Transaction History Forgery)**: A user writes a fake `credit` record to `/transactions`.

## 3. Test Runner Definition (`firestore.rules.test.ts`)
The test cases verify that all 12 dirty payloads are rejected with `PERMISSION_DENIED`.
