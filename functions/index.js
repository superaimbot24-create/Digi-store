/**
 * Cloud Functions for Digi Store Marketplace
 * Secure backend wallet deduction, UTR verification, and order refund processing
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

/**
 * 1. Process Product Purchase (Secure atomic wallet deduction)
 */
exports.createPurchaseOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { productId } = data;
  const userId = context.auth.uid;
  const userRef = db.collection("users").doc(userId);
  const productRef = db.collection("products").doc(productId);

  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }

    const productDoc = await transaction.get(productRef);
    if (!productDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Product not found.");
    }

    const product = productDoc.data();
    if (!product.active) {
      throw new functions.https.HttpsError("failed-precondition", "Product is not active.");
    }

    const price = product.discountedPrice;
    const currentBalance = userDoc.data().walletBalance || 0;

    if (currentBalance < price) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Insufficient balance. Available: $${currentBalance}, Required: $${price}`
      );
    }

    // Deduct wallet balance
    transaction.update(userRef, {
      walletBalance: Number((currentBalance - price).toFixed(2)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create order document
    const orderRef = db.collection("orders").doc();
    transaction.set(orderRef, {
      orderId: `ORD-${Date.now().toString().slice(-6)}`,
      userId: userId,
      userName: userDoc.data().name || context.auth.token.name || "Customer",
      userEmail: userDoc.data().email || context.auth.token.email || "",
      productId: productId,
      productTitle: product.title,
      productImage: product.imageUrl || "",
      price: price,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create transaction history
    const txRef = db.collection("transactions").doc();
    transaction.set(txRef, {
      userId: userId,
      amount: price,
      type: "debit",
      description: `Purchase of ${product.title}`,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, orderId: orderRef.id };
  });
});

/**
 * 2. Admin Approve Wallet Request (Credit user's wallet with duplicate prevention)
 */
exports.approveWalletDeposit = functions.https.onCall(async (data, context) => {
  // Verify administrator
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
  const isSuperEmail = context.auth.token.email === "pranjalkr47@gmail.com";
  if (!adminDoc.exists && !isSuperEmail) {
    throw new functions.https.HttpsError("permission-denied", "Staff authorization required.");
  }

  const { requestId } = data;
  const reqRef = db.collection("walletRequests").doc(requestId);

  return db.runTransaction(async (transaction) => {
    const reqDoc = await transaction.get(reqRef);
    if (!reqDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Deposit request not found.");
    }

    const requestData = reqDoc.data();
    if (requestData.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Request already processed.");
    }

    const userRef = db.collection("users").doc(requestData.userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }

    const currentBalance = userDoc.data().walletBalance || 0;
    const newBalance = Number((currentBalance + requestData.amount).toFixed(2));

    // Credit user balance
    transaction.update(userRef, {
      walletBalance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark request approved
    transaction.update(reqRef, {
      status: "approved",
      approvedBy: context.auth.token.email || context.auth.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Ledger transaction
    const txRef = db.collection("transactions").doc();
    transaction.set(txRef, {
      userId: requestData.userId,
      amount: requestData.amount,
      type: "credit",
      description: `UTR Verification Top-up (${requestData.utr})`,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, newBalance };
  });
});
