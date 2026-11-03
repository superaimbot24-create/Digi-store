import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType, 
  DEFAULT_SETTINGS, 
  INITIAL_PRODUCTS 
} from '../firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  runTransaction 
} from 'firebase/firestore';
import { 
  Product, 
  Order, 
  WalletRequest, 
  TransactionRecord, 
  StoreSettings, 
  PRODUCT_CATEGORIES 
} from '../types';
import confetti from 'canvas-confetti';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Sliders, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldAlert, 
  ShieldCheck, 
  LogOut, 
  LogIn, 
  RefreshCw, 
  AlertTriangle, 
  Image as ImageIcon, 
  Send, 
  ArrowLeft,
  X
} from 'lucide-react';

const AUTHORIZED_ADMIN_EMAIL = 'pranjalkr47@gmail.com';

export default function AdminApp() {
  // Navigation: 'home' | 'orders' | 'money' | 'adjust'
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'money' | 'adjust'>('home');

  // Auth State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [authError, setAuthError] = useState('');

  // Email login inputs
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // Admin Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [walletRequests, setWalletRequests] = useState<WalletRequest[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  // Filters & Search
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [moneyStatusFilter, setMoneyStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Product Modals
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<Omit<Product, 'id'>>({
    title: '',
    description: '',
    imageUrl: '',
    originalPrice: 19.99,
    discountedPrice: 9.99,
    category: 'AI & ChatGPT',
    active: true,
    features: ''
  });
  const [savingProduct, setSavingProduct] = useState(false);

  // Order Approval Modal
  const [orderToFulfill, setOrderToFulfill] = useState<Order | null>(null);
  const [deliveryUrlInput, setDeliveryUrlInput] = useState('');
  const [fulfillingOrder, setFulfillingOrder] = useState(false);

  // Order Reject Modal
  const [orderToReject, setOrderToReject] = useState<Order | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejectingOrder, setRejectingOrder] = useState(false);

  // Wallet Request Processing
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Adjust / Settings State
  const [adjustBanner, setAdjustBanner] = useState(DEFAULT_SETTINGS.banner);
  const [adjustQR, setAdjustQR] = useState(DEFAULT_SETTINGS.paymentQR);
  const [adjustStoreName, setAdjustStoreName] = useState(DEFAULT_SETTINGS.storeName);
  const [adjustTagline, setAdjustTagline] = useState(DEFAULT_SETTINGS.storeTagline);
  const [adjustSupport, setAdjustSupport] = useState(DEFAULT_SETTINGS.supportContact);
  const [adjustTerms, setAdjustTerms] = useState(DEFAULT_SETTINGS.termsAndConditions);
  const [adjustPrivacy, setAdjustPrivacy] = useState(DEFAULT_SETTINGS.privacyPolicy);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');

  // Listen to Auth State and Admin Verification
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        // Verify admin permissions:
        // 1. Matches AUTHORIZED_ADMIN_EMAIL
        // 2. Or exists in Firestore `/admins/{uid}`
        const isAuthorizedEmail = user.email?.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
        let hasAdminDoc = false;

        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            hasAdminDoc = true;
          } else if (isAuthorizedEmail) {
            // Self-register in admins collection if authorized email
            await setDoc(doc(db, 'admins', user.uid), {
              email: user.email,
              role: 'superadmin',
              createdAt: new Date().toISOString()
            });
            hasAdminDoc = true;
          }
        } catch (e) {
          console.warn("Admin check:", e);
        }

        setIsAdminAuthorized(isAuthorizedEmail || hasAdminDoc);
      } else {
        setIsAdminAuthorized(false);
      }
      setAdminCheckDone(true);
    });

    return () => unsub();
  }, []);

  // Real-time Data Listeners for Admin Dashboard
  useEffect(() => {
    if (!isAdminAuthorized) return;

    // 1. Products listener
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Product));
      setProducts(items);
    }, (err) => console.warn("Admin products error:", err));

    // 2. Orders listener
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const items: Order[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Order));
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setOrders(items);
    }, (err) => console.warn("Admin orders error:", err));

    // 3. Wallet Requests listener
    const unsubMoney = onSnapshot(collection(db, 'walletRequests'), (snapshot) => {
      const items: WalletRequest[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as WalletRequest));
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setWalletRequests(items);
    }, (err) => console.warn("Admin money error:", err));

    // 4. Global Settings listener
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const s = snap.data() as StoreSettings;
        setStoreSettings(s);
        setAdjustBanner(s.banner || DEFAULT_SETTINGS.banner);
        setAdjustQR(s.paymentQR || DEFAULT_SETTINGS.paymentQR);
        setAdjustStoreName(s.storeName || DEFAULT_SETTINGS.storeName);
        setAdjustTagline(s.storeTagline || DEFAULT_SETTINGS.storeTagline);
        setAdjustSupport(s.supportContact || DEFAULT_SETTINGS.supportContact);
        setAdjustTerms(s.termsAndConditions || DEFAULT_SETTINGS.termsAndConditions);
        setAdjustPrivacy(s.privacyPolicy || DEFAULT_SETTINGS.privacyPolicy);
      }
    });

    return () => {
      unsubProducts();
      unsubOrders();
      unsubMoney();
      unsubSettings();
    };
  }, [isAdminAuthorized]);

  // Google Login for Admin
  const handleAdminGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Admin google sign-in error:", err);
      let msg = err.message || 'Admin sign in failed';
      if (err.code === 'auth/popup-blocked') {
        msg = 'Browser popup block ho gaya. Kripya URL bar me popups allow karein ya New Tab me open karein.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in window band kar di gayi thi.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = `Domain (${window.location.hostname}) Firebase Auth Authorized Domains me add nahi hai.`;
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  // Email Login for Admin
  const handleAdminEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    try {
      setAuthLoading(true);
      setAuthError('');
      await signInWithEmailAndPassword(auth, emailInput, passwordInput);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid administrator credentials');
    } finally {
      setAuthLoading(false);
    }
  };

  // Make Current User Admin (For development / setup convenience)
  const handleClaimAdminAccess = async () => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'admins', currentUser.uid), {
        email: currentUser.email || 'admin@digistore.com',
        role: 'superadmin',
        createdAt: new Date().toISOString()
      });
      setIsAdminAuthorized(true);
    } catch (err: any) {
      alert("Failed to grant admin privileges: " + err.message);
    }
  };

  // Save / Update Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      if (editingProduct && editingProduct.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...productForm,
          originalPrice: Number(productForm.originalPrice),
          discountedPrice: Number(productForm.discountedPrice),
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...productForm,
          originalPrice: Number(productForm.originalPrice),
          discountedPrice: Number(productForm.discountedPrice),
          createdAt: new Date().toISOString()
        });
      }
      setShowAddProductModal(false);
      setEditingProduct(null);
    } catch (err: any) {
      alert("Failed to save product: " + err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  // Toggle Product Active / Inactive
  const handleToggleProductActive = async (product: Product) => {
    if (!product.id) return;
    try {
      await updateDoc(doc(db, 'products', product.id), {
        active: !product.active
      });
    } catch (err: any) {
      alert("Status toggle failed: " + err.message);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  // Open Edit Product Modal
  const handleStartEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      title: product.title,
      description: product.description,
      imageUrl: product.imageUrl,
      originalPrice: product.originalPrice,
      discountedPrice: product.discountedPrice,
      category: product.category,
      active: product.active,
      features: product.features || ''
    });
    setShowAddProductModal(true);
  };

  // Seed sample products into catalog
  const handleSeedDemoProducts = async () => {
    if (!confirm("Add 6 sample digital tools to the catalog?")) return;
    try {
      for (const item of INITIAL_PRODUCTS) {
        await addDoc(collection(db, 'products'), item);
      }
      alert("Products added successfully!");
    } catch (err: any) {
      alert("Seed failed: " + err.message);
    }
  };

  // Approve Order with Delivery URL
  const handleFulfillOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToFulfill || !orderToFulfill.id) return;
    if (!deliveryUrlInput.trim()) {
      alert("Please enter the delivery credentials or access URL");
      return;
    }

    setFulfillingOrder(true);
    try {
      await updateDoc(doc(db, 'orders', orderToFulfill.id), {
        status: 'approved',
        deliveryUrl: deliveryUrlInput.trim(),
        fulfilledAt: new Date().toISOString()
      });

      confetti({ particleCount: 50, spread: 60 });
      setOrderToFulfill(null);
      setDeliveryUrlInput('');
    } catch (err: any) {
      alert("Failed to fulfill order: " + err.message);
    } finally {
      setFulfillingOrder(false);
    }
  };

  // Reject Order and Automatically Refund User's Reserved Wallet Funds
  const handleRejectOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToReject || !orderToReject.id) return;

    setRejectingOrder(true);
    try {
      const orderRef = doc(db, 'orders', orderToReject.id);
      const userRef = doc(db, 'users', orderToReject.userId);

      await runTransaction(db, async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Order not found");
        if (orderSnap.data().status !== 'pending') {
          throw new Error("Only pending orders can be rejected and refunded");
        }

        const userSnap = await tx.get(userRef);
        if (userSnap.exists()) {
          const currentBal = (userSnap.data().walletBalance as number) || 0;
          const refundedBal = Number((currentBal + orderToReject.price).toFixed(2));
          // Refund wallet balance
          tx.update(userRef, { walletBalance: refundedBal });
        }

        // Mark order rejected
        tx.update(orderRef, {
          status: 'rejected',
          rejectReason: rejectReasonInput.trim() || 'Declined by administrator',
          rejectedAt: new Date().toISOString()
        });

        // Add refund transaction record
        const refundTxRef = doc(collection(db, 'transactions'));
        tx.set(refundTxRef, {
          userId: orderToReject.userId,
          amount: orderToReject.price,
          type: 'refund',
          description: `Refund for rejected order: ${orderToReject.productTitle}`,
          status: 'completed',
          createdAt: new Date().toISOString()
        });
      });

      setOrderToReject(null);
      setRejectReasonInput('');
    } catch (err: any) {
      alert("Failed to reject order: " + err.message);
    } finally {
      setRejectingOrder(false);
    }
  };

  // Approve Add Money Request with Atomic Wallet Credit
  const handleApproveMoneyRequest = async (req: WalletRequest) => {
    if (!req.id || !req.userId) return;
    if (req.status !== 'pending') {
      alert("This request has already been processed!");
      return;
    }

    setProcessingRequestId(req.id);
    try {
      const reqRef = doc(db, 'walletRequests', req.id);
      const userRef = doc(db, 'users', req.userId);

      await runTransaction(db, async (tx) => {
        const requestSnap = await tx.get(reqRef);
        if (!requestSnap.exists()) throw new Error("Request document does not exist");
        if (requestSnap.data().status !== 'pending') {
          throw new Error("Request already processed by another administrator");
        }

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error("User record does not exist");

        const curBal = (userSnap.data().walletBalance as number) || 0;
        const newBal = Number((curBal + req.amount).toFixed(2));

        // 1. Credit User Wallet
        tx.update(userRef, {
          walletBalance: newBal
        });

        // 2. Mark Request Approved
        tx.update(reqRef, {
          status: 'approved',
          approvedAt: new Date().toISOString(),
          processedBy: currentUser?.email || 'admin'
        });

        // 3. Log Credit Transaction
        const txRef = doc(collection(db, 'transactions'));
        tx.set(txRef, {
          userId: req.userId,
          amount: req.amount,
          type: 'credit',
          description: `Wallet top-up approved (UTR: ${req.utr})`,
          status: 'completed',
          createdAt: new Date().toISOString()
        });
      });

      confetti({ particleCount: 40, spread: 50 });
    } catch (err: any) {
      alert("Failed to approve wallet request: " + err.message);
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Reject Add Money Request
  const handleRejectMoneyRequest = async (req: WalletRequest) => {
    if (!req.id) return;
    const reason = prompt("Enter rejection reason (e.g., UTR not matching bank statement):", "Invalid or unpaid UTR");
    if (reason === null) return;

    setProcessingRequestId(req.id);
    try {
      await updateDoc(doc(db, 'walletRequests', req.id), {
        status: 'rejected',
        rejectReason: reason,
        rejectedAt: new Date().toISOString()
      });
    } catch (err: any) {
      alert("Rejection failed: " + err.message);
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Save Store Settings (Banner, QR, Info, Policies)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccessMsg('');
    try {
      const updated: StoreSettings = {
        storeName: adjustStoreName.trim(),
        storeTagline: adjustTagline.trim(),
        supportContact: adjustSupport.trim(),
        banner: adjustBanner,
        paymentQR: adjustQR,
        termsAndConditions: adjustTerms,
        privacyPolicy: adjustPrivacy,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'settings', 'global'), updated);
      setSettingsSuccessMsg("All store settings and payment configurations updated successfully!");
    } catch (err: any) {
      alert("Settings update failed: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Filtered products
  const adminFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = productCategoryFilter === 'All' || p.category === productCategoryFilter;
      const matchSearch = p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.description.toLowerCase().includes(productSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, productCategoryFilter, productSearch]);

  // Filtered orders
  const adminFilteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderStatusFilter === 'all') return true;
      return o.status === orderStatusFilter;
    });
  }, [orders, orderStatusFilter]);

  // Filtered money requests
  const adminFilteredMoney = useMemo(() => {
    return walletRequests.filter((m) => {
      if (moneyStatusFilter === 'all') return true;
      return m.status === moneyStatusFilter;
    });
  }, [walletRequests, moneyStatusFilter]);

  // Statistics
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const pendingMoneyCount = walletRequests.filter(m => m.status === 'pending').length;

  // ===================== SCREEN: ADMIN LOGIN / UNAUTHORIZED =====================
  if (!isAdminAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 font-sans">
        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Digi Store Administrator</h1>
            <p className="text-xs text-slate-400 mt-1">
              Independent Admin Portal • Authorized Staff Access Only
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-left space-y-2">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{authError}</span>
              </div>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center justify-center space-x-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </a>
            </div>
          )}

          {currentUser ? (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <p className="text-xs text-amber-400 font-semibold">
                Logged in as: <span className="font-mono text-white">{currentUser.email}</span>
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your account is authenticated, but administrator role has not been provisioned yet for this user ID.
              </p>
              <div className="flex flex-col space-y-2 pt-1">
                <button
                  onClick={handleClaimAdminAccess}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-md flex items-center justify-center space-x-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Grant Admin Rights to this Account</span>
                </button>
                <button
                  onClick={() => signOut(auth)}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Sign Out / Switch Account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleAdminGoogleSignIn}
                disabled={authLoading}
                className="w-full py-3 rounded-2xl font-bold text-xs bg-white text-slate-950 hover:bg-slate-100 shadow flex items-center justify-center space-x-2 transition-all"
              >
                <LogIn className="w-4 h-4 text-indigo-600" />
                <span>Sign In with Admin Google Account</span>
              </button>

              <div className="flex items-center">
                <div className="flex-1 border-t border-slate-800"></div>
                <span className="px-2 text-[10px] text-slate-500 uppercase font-bold">or email credentials</span>
                <div className="flex-1 border-t border-slate-800"></div>
              </div>

              <form onSubmit={handleAdminEmailSignIn} className="space-y-3 text-left">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="admin@digistore.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                {authError && <p className="text-[11px] text-rose-400">{authError}</p>}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-black shadow"
                >
                  {authLoading ? 'Verifying...' : 'Authenticate Admin'}
                </button>
              </form>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
            Digi Store Admin Console • HopWeb Compatible
          </div>
        </div>
      </div>
    );
  }

  // ===================== SCREEN: AUTHORIZED ADMIN DASHBOARD =====================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Admin Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <ShieldCheck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white flex items-center space-x-1.5">
                <span>Digi Store Admin</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Staff
                </span>
              </span>
              <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
                {currentUser?.email}
              </span>
            </div>
          </div>

          {/* Quick Metrics & Logout */}
          <div className="flex items-center space-x-3">
            {pendingOrdersCount > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-400 border border-rose-800/80 animate-pulse">
                {pendingOrdersCount} New Orders
              </span>
            )}
            {pendingMoneyCount > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80 animate-pulse">
                {pendingMoneyCount} UTR Deposits
              </span>
            )}

            <button
              onClick={() => signOut(auth)}
              className="p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Sign Out Admin"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex border-t border-slate-800/60 overflow-x-auto no-scrollbar">
          {/* 1. Home */}
          <button
            onClick={() => setActiveTab('home')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'home'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>1. Home (Products)</span>
          </button>

          {/* 2. Orders */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap relative ${
              activeTab === 'orders'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>2. Orders</span>
            {pendingOrdersCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-extrabold">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          {/* 3. Money */}
          <button
            onClick={() => setActiveTab('money')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap relative ${
              activeTab === 'money'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>3. Money (UTR Requests)</span>
            {pendingMoneyCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-extrabold">
                {pendingMoneyCount}
              </span>
            )}
          </button>

          {/* 4. Adjust */}
          <button
            onClick={() => setActiveTab('adjust')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'adjust'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>4. Adjust (Settings & QR)</span>
          </button>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* ===================== ADMIN TAB 1: HOME (PRODUCTS) ===================== */}
        {activeTab === 'home' && (
          <div className="space-y-5 animate-fade-in">
            {/* Top Product Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300"
                >
                  {PRODUCT_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                {products.length === 0 && (
                  <button
                    onClick={handleSeedDemoProducts}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    Seed 6 Tools
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm({
                      title: '',
                      description: '',
                      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
                      originalPrice: 20,
                      discountedPrice: 9.99,
                      category: 'AI & ChatGPT',
                      active: true,
                      features: ''
                    });
                    setShowAddProductModal(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black flex items-center space-x-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Product</span>
                </button>
              </div>
            </div>

            {/* Products Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm">Store Products ({adminFilteredProducts.length})</h3>
                <span className="text-xs text-slate-400">All products are synced with User App</span>
              </div>

              {adminFilteredProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No products found. Click "Add New Product" to populate your catalog.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="p-3">Tool</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Original</th>
                        <th className="p-3">Discounted</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {adminFilteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/30">
                          <td className="p-3">
                            <div className="flex items-center space-x-3">
                              <img 
                                src={p.imageUrl} 
                                alt={p.title} 
                                className="w-10 h-10 rounded-lg object-cover border border-slate-800 shrink-0" 
                              />
                              <div className="max-w-xs truncate">
                                <span className="font-bold block truncate text-white">{p.title}</span>
                                <span className="text-[11px] text-slate-400 truncate block">{p.description}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-300">
                              {p.category}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-400 line-through">
                            ${p.originalPrice.toFixed(2)}
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-400">
                            ${p.discountedPrice.toFixed(2)}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleToggleProductActive(p)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                                p.active 
                                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800 hover:bg-rose-950 hover:text-rose-400' 
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-emerald-950 hover:text-emerald-400'
                              }`}
                              title="Click to toggle active state"
                            >
                              {p.active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleStartEditProduct(p)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                                title="Edit Product"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => p.id && handleDeleteProduct(p.id, p.title)}
                                className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400 hover:bg-rose-900/60"
                                title="Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== ADMIN TAB 2: ORDERS ===================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-fade-in">
            {/* Filter buttons */}
            <div className="flex items-center space-x-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setOrderStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                    orderStatusFilter === st
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st} ({orders.filter(o => st === 'all' || o.status === st).length})
                </button>
              ))}
            </div>

            {/* Orders List */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm">Customer Orders ({adminFilteredOrders.length})</h3>
                <span className="text-xs text-slate-400">Approve to deliver links, or reject to refund wallet</span>
              </div>

              {adminFilteredOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No orders found for this status.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {adminFilteredOrders.map((order) => (
                    <div key={order.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-white">{order.productTitle}</span>
                          <span className="font-mono text-xs text-amber-400">${order.price.toFixed(2)}</span>
                          <span className="font-mono text-[10px] text-slate-500">[{order.orderId}]</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Buyer: <span className="text-slate-200">{order.userName}</span> ({order.userEmail}) • {new Date(order.createdAt).toLocaleString()}
                        </div>
                        {order.deliveryUrl && (
                          <div className="text-xs font-mono text-emerald-400 truncate max-w-lg bg-slate-950 p-1.5 rounded-lg border border-emerald-900/40">
                            Delivered: {order.deliveryUrl}
                          </div>
                        )}
                        {order.rejectReason && (
                          <div className="text-xs text-rose-400">
                            Reason: {order.rejectReason}
                          </div>
                        )}
                      </div>

                      {/* Status / Action Buttons */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {order.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => {
                                setOrderToFulfill(order);
                                setDeliveryUrlInput('');
                              }}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve & Deliver</span>
                            </button>
                            <button
                              onClick={() => {
                                setOrderToReject(order);
                                setRejectReasonInput('');
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900"
                            >
                              <span>Reject & Refund</span>
                            </button>
                          </>
                        ) : order.status === 'approved' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Fulfilled</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800 flex items-center space-x-1">
                            <X className="w-3.5 h-3.5" />
                            <span>Refunded</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== ADMIN TAB 3: MONEY (WALLET DEPOSIT REQUESTS) ===================== */}
        {activeTab === 'money' && (
          <div className="space-y-4 animate-fade-in">
            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setMoneyStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                    moneyStatusFilter === st
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st} ({walletRequests.filter(m => st === 'all' || m.status === st).length})
                </button>
              ))}
            </div>

            {/* Wallet Requests Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Add Money / Deposit Requests ({adminFilteredMoney.length})</h3>
                  <p className="text-xs text-slate-400">Verifying and approving automatically credits the customer's wallet balance</p>
                </div>
              </div>

              {adminFilteredMoney.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No wallet requests found.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {adminFilteredMoney.map((req) => (
                    <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-black text-emerald-400">${req.amount.toFixed(2)}</span>
                          <span className="text-xs text-slate-300 font-bold">{req.userName}</span>
                          <span className="text-xs text-slate-400">({req.userEmail})</span>
                        </div>

                        {/* UTR Copy Box */}
                        <div className="flex items-center space-x-2 pt-0.5">
                          <span className="text-xs text-slate-400">UTR / Ref:</span>
                          <span className="font-mono text-xs font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-white select-all">
                            {req.utr}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(req.utr);
                              setCopiedUtr(req.utr);
                              setTimeout(() => setCopiedUtr(null), 2000);
                            }}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                            title="Copy UTR"
                          >
                            {copiedUtr === req.utr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <span className="text-[11px] text-slate-500">• {new Date(req.createdAt).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Approval Action */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {req.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleApproveMoneyRequest(req)}
                              disabled={processingRequestId === req.id}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 shadow"
                            >
                              {processingRequestId === req.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Verify & Credit</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleRejectMoneyRequest(req)}
                              disabled={processingRequestId === req.id}
                              className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900"
                            >
                              <span>Reject</span>
                            </button>
                          </>
                        ) : req.status === 'approved' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Approved & Credited
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-400 border border-rose-800">
                            Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== ADMIN TAB 4: ADJUST (SETTINGS & CONFIG) ===================== */}
        {activeTab === 'adjust' && (
          <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in max-w-4xl">
            {settingsSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{settingsSuccessMsg}</span>
              </div>
            )}

            {/* 1. Promotional Banner Config */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-bold text-sm flex items-center space-x-2 text-white">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  <span>1. Promotional Banner Management</span>
                </h4>
                <label className="flex items-center space-x-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={adjustBanner.active}
                    onChange={(e) => setAdjustBanner({ ...adjustBanner, active: e.target.checked })}
                    className="rounded accent-amber-500"
                  />
                  <span>Banner Active in User App</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Banner Image URL</label>
                  <input
                    type="url"
                    value={adjustBanner.imageUrl}
                    onChange={(e) => setAdjustBanner({ ...adjustBanner, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Redirect / Target Link</label>
                  <input
                    type="text"
                    value={adjustBanner.redirectUrl}
                    onChange={(e) => setAdjustBanner({ ...adjustBanner, redirectUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Headline Title</label>
                  <input
                    type="text"
                    value={adjustBanner.title}
                    onChange={(e) => setAdjustBanner({ ...adjustBanner, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Subtitle / Subtext</label>
                  <input
                    type="text"
                    value={adjustBanner.subtitle}
                    onChange={(e) => setAdjustBanner({ ...adjustBanner, subtitle: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              {/* Preview Banner */}
              <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-3">
                <img 
                  src={adjustBanner.imageUrl || DEFAULT_SETTINGS.banner.imageUrl} 
                  alt="Banner Preview" 
                  className="w-20 h-12 object-cover rounded-lg border border-slate-800"
                />
                <div className="truncate">
                  <span className="text-[10px] uppercase font-bold text-amber-400">Live User Banner Preview:</span>
                  <p className="font-bold text-xs truncate">{adjustBanner.title}</p>
                  <p className="text-[11px] text-slate-400 truncate">{adjustBanner.subtitle}</p>
                </div>
              </div>
            </div>

            {/* 2. Payment QR & Account Config */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <h4 className="font-bold text-sm flex items-center space-x-2 text-white border-b border-slate-800 pb-3">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>2. Payment QR & UPI Management</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">QR Image URL</label>
                  <input
                    type="url"
                    value={adjustQR.imageUrl}
                    onChange={(e) => setAdjustQR({ ...adjustQR, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">UPI ID / Address</label>
                  <input
                    type="text"
                    value={adjustQR.upiId}
                    onChange={(e) => setAdjustQR({ ...adjustQR, upiId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Beneficiary / Account Name</label>
                  <input
                    type="text"
                    value={adjustQR.accountName}
                    onChange={(e) => setAdjustQR({ ...adjustQR, accountName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">User Instructions Note</label>
                  <input
                    type="text"
                    value={adjustQR.notes}
                    onChange={(e) => setAdjustQR({ ...adjustQR, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              {/* QR Preview */}
              <div className="flex items-center space-x-3 p-3 bg-slate-950 rounded-xl border border-slate-800 max-w-sm">
                <img 
                  src={adjustQR.imageUrl || DEFAULT_SETTINGS.paymentQR.imageUrl} 
                  alt="QR Preview" 
                  className="w-16 h-16 object-contain bg-white rounded-lg p-1"
                />
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-400">QR Code Preview</span>
                  <p className="text-xs font-mono font-bold">{adjustQR.upiId}</p>
                  <p className="text-[10px] text-slate-400">{adjustQR.accountName}</p>
                </div>
              </div>
            </div>

            {/* 3. Store Info & Policies */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <h4 className="font-bold text-sm flex items-center space-x-2 text-white border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>3. Store Branding & Legal Policies</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Store Name</label>
                  <input
                    type="text"
                    value={adjustStoreName}
                    onChange={(e) => setAdjustStoreName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Support Contact / Channel</label>
                  <input
                    type="text"
                    value={adjustSupport}
                    onChange={(e) => setAdjustSupport(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Store Tagline</label>
                <input
                  type="text"
                  value={adjustTagline}
                  onChange={(e) => setAdjustTagline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Terms & Conditions</label>
                  <textarea
                    rows={4}
                    value={adjustTerms}
                    onChange={(e) => setAdjustTerms(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Privacy Policy</label>
                  <textarea
                    rows={4}
                    value={adjustPrivacy}
                    onChange={(e) => setAdjustPrivacy(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2"
            >
              {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Save & Publish All Store Adjustments</span>
            </button>
          </form>
        )}

      </main>

      {/* ===================== MODAL: ADD / EDIT PRODUCT ===================== */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-950 border border-slate-800 text-white overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-base">
                {editingProduct ? 'Edit Product' : 'Add New Digital Tool'}
              </h3>
              <button onClick={() => setShowAddProductModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={productForm.title}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                  placeholder="e.g. ChatGPT Plus (1 Month Shared)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Original Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.originalPrice}
                    onChange={(e) => setProductForm({ ...productForm, originalPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Discounted Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.discountedPrice}
                    onChange={(e) => setProductForm({ ...productForm, discountedPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-amber-400 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    {PRODUCT_CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Active / Live in Store</label>
                  <select
                    value={productForm.active ? 'true' : 'false'}
                    onChange={(e) => setProductForm({ ...productForm, active: e.target.value === 'true' })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value="true">Active (Visible)</option>
                    <option value="false">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Image URL</label>
                <input
                  type="url"
                  required
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Product description, warranty info and usage instructions..."
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Features / Inclusions (Bullet Points)</label>
                <textarea
                  rows={3}
                  value={productForm.features || ''}
                  onChange={(e) => setProductForm({ ...productForm, features: e.target.value })}
                  placeholder="• 4K HDR Streaming&#10;• 30-Day Warranty&#10;• Dedicated Slot"
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="w-full py-3 rounded-2xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-black shadow flex items-center justify-center space-x-1.5"
                >
                  {savingProduct ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingProduct ? 'Save Changes' : 'Publish Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: FULFILL ORDER & ATTACH DELIVERY LINK ===================== */}
      {orderToFulfill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-950 border border-slate-800 text-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Approve Order & Deliver</span>
              </h3>
              <button onClick={() => setOrderToFulfill(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-sm text-white">{orderToFulfill.productTitle}</h4>
              <p className="text-xs text-slate-400">
                Buyer: <span className="text-white">{orderToFulfill.userName}</span> ({orderToFulfill.userEmail})
              </p>
              <p className="text-xs text-amber-400 font-mono font-bold">${orderToFulfill.price.toFixed(2)}</p>
            </div>

            <form onSubmit={handleFulfillOrderSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Product Delivery URL / Account Credentials / License Key
                </label>
                <textarea
                  rows={3}
                  required
                  value={deliveryUrlInput}
                  onChange={(e) => setDeliveryUrlInput(e.target.value)}
                  placeholder="e.g. Email: user@example.com | Pass: SecurePass123 | PIN: 4321 OR Drive link"
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  This delivery information will appear instantly in the customer's "My Purchases" section.
                </span>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToFulfill(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 text-xs font-bold hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fulfillingOrder}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center space-x-1"
                >
                  {fulfillingOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Deliver Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: REJECT ORDER & REFUND ===================== */}
      {orderToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-950 border border-slate-800 text-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base flex items-center space-x-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Reject Order & Refund Customer</span>
              </h3>
              <button onClick={() => setOrderToReject(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Rejecting this order will atomically refund <span className="font-bold text-amber-400">${orderToReject.price.toFixed(2)}</span> back to <span className="font-bold text-white">{orderToReject.userName}</span>'s wallet.
            </p>

            <form onSubmit={handleRejectOrderSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Reason for Rejection</label>
                <input
                  type="text"
                  required
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  placeholder="e.g. Out of stock, technical issue, or provider outage"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToReject(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 text-xs font-bold hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectingOrder}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center space-x-1"
                >
                  {rejectingOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  <span>Reject & Refund</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
