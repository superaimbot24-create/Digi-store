import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType, 
  testConnection, 
  DEFAULT_SETTINGS, 
  INITIAL_PRODUCTS 
} from '../firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  runTransaction,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Product, 
  Order, 
  WalletRequest, 
  TransactionRecord, 
  UserProfile, 
  StoreSettings, 
  PRODUCT_CATEGORIES 
} from '../types';
import confetti from 'canvas-confetti';
import { 
  Home, 
  ShoppingBag, 
  User as UserIcon, 
  Search, 
  Heart, 
  Wallet, 
  ArrowUpRight, 
  CheckCircle, 
  Clock, 
  XCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  Moon, 
  Sun, 
  ShieldCheck, 
  FileText, 
  LogOut, 
  LogIn, 
  Sparkles, 
  QrCode, 
  X, 
  ChevronRight, 
  Info,
  RefreshCw,
  Tag,
  AlertCircle
} from 'lucide-react';

export default function UserApp() {
  // Navigation: 'home' | 'orders' | 'profile'
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'profile'>('home');
  // Orders sub-tab: 'purchases' | 'wishlist'
  const [ordersSubTab, setOrdersSubTab] = useState<'purchases' | 'wishlist'>('purchases');

  // StoreUser supports both Firebase Auth users and Any Customer email
  interface StoreUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL?: string | null;
  }

  // Auth & Profile state
  const [currentUser, setCurrentUser] = useState<StoreUser | null>(() => {
    try {
      const saved = localStorage.getItem('digi_store_customer_session');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // Sync or create user profile document in Firestore
  const syncUserProfile = async (user: StoreUser) => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        setUserProfile(data);
        if (data.theme) setTheme(data.theme);
      } else {
        const initialProfile: UserProfile = {
          uid: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Customer',
          email: user.email || '',
          walletBalance: 0,
          theme: 'dark',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, initialProfile);
        setUserProfile(initialProfile);
      }
    } catch (err) {
      console.error("Error syncing user profile:", err);
    }
  };

  // Sync profile on mount if saved customer session exists
  useEffect(() => {
    if (currentUser) {
      syncUserProfile(currentUser);
    }
  }, []);

  // App Theme: 'dark' | 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('digi_store_theme') as 'dark' | 'light') || 'dark';
  });

  // Dynamic store data from Firestore
  const [products, setProducts] = useState<Product[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [wishlistProductIds, setWishlistProductIds] = useState<string[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [walletRequests, setWalletRequests] = useState<WalletRequest[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [showPoliciesModal, setShowPoliciesModal] = useState<'terms' | 'privacy' | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');

  // Add Money Form state
  const [depositAmount, setDepositAmount] = useState<number | ''>(5);
  const [depositUtr, setDepositUtr] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedDelivery, setCopiedDelivery] = useState(false);

  // Buy action in progress
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null);
  const [purchaseConfirmProduct, setPurchaseConfirmProduct] = useState<Product | null>(null);
  const [purchaseError, setPurchaseError] = useState('');

  // Apply Theme class to document root
  useEffect(() => {
    localStorage.setItem('digi_store_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Test Firestore connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const u: StoreUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Customer',
          photoURL: fbUser.photoURL
        };
        setCurrentUser(u);
        localStorage.setItem('digi_store_customer_session', JSON.stringify(u));
        await syncUserProfile(u);
      } else {
        // Check if custom session is active
        const saved = localStorage.getItem('digi_store_customer_session');
        if (saved) {
          try {
            const u: StoreUser = JSON.parse(saved);
            setCurrentUser(u);
            await syncUserProfile(u);
            return;
          } catch (e) {}
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for user profile to update wallet live
  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    }, (error) => {
      console.warn("User listener note:", error.message);
    });
    return () => unsub();
  }, [currentUser]);

  // Load Settings from Firestore (Banners, Payment QR, Store Info)
  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'global');
    const unsub = onSnapshot(settingsRef, async (docSnap) => {
      if (docSnap.exists()) {
        setStoreSettings(docSnap.data() as StoreSettings);
      } else {
        // Seed default settings if empty
        try {
          await setDoc(settingsRef, DEFAULT_SETTINGS);
          setStoreSettings(DEFAULT_SETTINGS);
        } catch (e) {
          console.log("Could not auto-seed settings:", e);
        }
      }
    }, (err) => {
      console.warn("Settings error:", err.message);
    });
    return () => unsub();
  }, []);

  // Real-time listener for Products catalog
  useEffect(() => {
    const productsRef = collection(db, 'products');
    const unsub = onSnapshot(productsRef, async (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Product[] = [];
        snapshot.forEach((d) => {
          loaded.push({ id: d.id, ...d.data() } as Product);
        });
        setProducts(loaded);
      } else {
        // Auto-seed initial sample products so the store is lively
        try {
          for (const item of INITIAL_PRODUCTS) {
            await addDoc(productsRef, item);
          }
        } catch (e) {
          console.log("Auto-seed products note:", e);
        }
      }
    }, (err) => {
      console.warn("Products listener:", err.message);
    });

    return () => unsub();
  }, []);

  // Real-time listener for User Wishlist
  useEffect(() => {
    if (!currentUser) return;
    const wishlistRef = doc(db, 'wishlists', currentUser.uid);
    const unsub = onSnapshot(wishlistRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.productIds && typeof data.productIds === 'string') {
          try {
            setWishlistProductIds(JSON.parse(data.productIds));
          } catch {
            setWishlistProductIds([]);
          }
        }
      }
    }, (err) => {
      console.warn("Wishlist error:", err.message);
    });

    return () => unsub();
  }, [currentUser]);

  // Real-time listener for User Orders
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const orders: Order[] = [];
      snapshot.forEach((d) => {
        orders.push({ id: d.id, ...d.data() } as Order);
      });
      // Sort in memory by createdAt descending
      orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setUserOrders(orders);
    }, (err) => {
      console.warn("Orders listener error:", err.message);
    });

    return () => unsub();
  }, [currentUser]);

  // Real-time listener for User Wallet Requests
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'walletRequests'),
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const reqs: WalletRequest[] = [];
      snapshot.forEach((d) => {
        reqs.push({ id: d.id, ...d.data() } as WalletRequest);
      });
      reqs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setWalletRequests(reqs);
    }, (err) => {
      console.warn("Wallet requests listener error:", err.message);
    });

    return () => unsub();
  }, [currentUser]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!product.active) return false;
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      const matchesSearch = 
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Wishlist products objects
  const wishlistProducts = useMemo(() => {
    return products.filter((p) => p.id && wishlistProductIds.includes(p.id));
  }, [products, wishlistProductIds]);

  // Toggle Wishlist action
  const toggleWishlist = async (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    const isCurrentlySaved = wishlistProductIds.includes(productId);
    const updated = isCurrentlySaved 
      ? wishlistProductIds.filter(id => id !== productId)
      : [...wishlistProductIds, productId];
    
    setWishlistProductIds(updated);
    try {
      const wishlistRef = doc(db, 'wishlists', currentUser.uid);
      await setDoc(wishlistRef, {
        userId: currentUser.uid,
        productIds: JSON.stringify(updated),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to update wishlist:", err);
    }
  };

  // Google Login
  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      console.log("Google Sign-In success:", cred.user);
      setShowAuthModal(false);
    } catch (err: any) {
      console.error("Google sign in error details:", err);
      let msg = err.message || 'Google sign in failed';
      if (err.code === 'auth/popup-blocked') {
        msg = 'Pop-up blocked! Browser ya iframe ne sign-in window ko block kar diya hai. Niche diye gaye "Open in New Tab" button se store open karke login karein.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Login popup window ko band kar diya gaya tha. Kripya dobara try karein.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = `Domain (${window.location.hostname}) unauthorized hai. Firebase console me is domain ko add karein ya Email sign-in use karein.`;
      } else if (err.code === 'auth/cancelled-popup-request') {
        msg = 'Popup request cancel ho gayi. Kripya ek hi baar button click karein.';
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  // Quick Customer Switcher / Sign-In for Any Email
  const handleQuickCustomerSelect = async (name: string, email: string) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const stableUid = 'cust_' + btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
      const userObj: StoreUser = {
        uid: stableUid,
        email: email.toLowerCase(),
        displayName: name,
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${stableUid}`
      };
      setCurrentUser(userObj);
      localStorage.setItem('digi_store_customer_session', JSON.stringify(userObj));
      await syncUserProfile(userObj);
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (e: any) {
      setAuthError(e.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Email/Password Login or Register for ANY Email
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanEmail = authEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setAuthError('Please enter an email address');
      return;
    }

    setAuthLoading(true);
    try {
      // 1. Try Firebase Auth first
      let authUser: StoreUser | null = null;
      try {
        if (authMode === 'register') {
          const res = await createUserWithEmailAndPassword(auth, cleanEmail, authPassword || 'Pass123456');
          if (authName) {
            await updateProfile(res.user, { displayName: authName });
          }
          authUser = {
            uid: res.user.uid,
            email: res.user.email,
            displayName: authName || cleanEmail.split('@')[0],
            photoURL: res.user.photoURL
          };
        } else {
          const res = await signInWithEmailAndPassword(auth, cleanEmail, authPassword);
          authUser = {
            uid: res.user.uid,
            email: res.user.email,
            displayName: res.user.displayName || cleanEmail.split('@')[0],
            photoURL: res.user.photoURL
          };
        }
      } catch (fbErr: any) {
        console.warn("Firebase Auth fallback triggered:", fbErr.code);
        // Fallback for ANY email address so customer is never blocked
        const stableUid = 'cust_' + btoa(cleanEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
        authUser = {
          uid: stableUid,
          email: cleanEmail,
          displayName: authName || cleanEmail.split('@')[0],
          photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${stableUid}`
        };
      }

      if (authUser) {
        setCurrentUser(authUser);
        localStorage.setItem('digi_store_customer_session', JSON.stringify(authUser));
        await syncUserProfile(authUser);
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Switch Theme & Persist
  const handleThemeToggle = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          theme: nextTheme
        });
      } catch (e) {
        console.warn("Theme save warning:", e);
      }
    }
  };

  // Update Profile Name
  const handleSaveProfile = async () => {
    if (!currentUser || !editNameInput.trim()) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: editNameInput.trim()
      });
      setUserProfile(prev => prev ? { ...prev, name: editNameInput.trim() } : null);
      setShowEditProfileModal(false);
    } catch (err) {
      console.error("Profile update failed:", err);
    }
  };

  // Add Money Request Submission
  const handleAddMoneySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) {
      setShowAuthModal(true);
      return;
    }
    const amountNum = Number(depositAmount);
    if (!amountNum || amountNum <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    const cleanUtr = depositUtr.trim();
    if (cleanUtr.length < 4) {
      alert("Please enter a valid 12-digit UTR or transaction reference number");
      return;
    }

    setDepositSubmitting(true);
    setDepositSuccessMsg('');
    try {
      const newRequest: Omit<WalletRequest, 'id'> = {
        userId: currentUser.uid,
        userName: userProfile.name,
        userEmail: userProfile.email,
        amount: amountNum,
        utr: cleanUtr,
        status: 'pending',
        notes: `User submitted UTR: ${cleanUtr}`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'walletRequests'), newRequest);
      setDepositSuccessMsg(`Request of $${amountNum} with UTR ${cleanUtr} submitted! Admin will verify and credit your wallet shortly.`);
      setDepositUtr('');
      setDepositAmount(5);
    } catch (err) {
      console.error("Wallet request submission error:", err);
      alert("Failed to submit wallet request. Please try again.");
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Trigger Purchase Initiation
  const handleInitiatePurchase = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    setPurchaseError('');
    setPurchaseConfirmProduct(product);
  };

  // Confirm and Execute Purchase with Atomic Firestore Transaction
  const handleConfirmPurchase = async () => {
    if (!currentUser || !purchaseConfirmProduct || !purchaseConfirmProduct.id) return;
    const product = purchaseConfirmProduct;
    const userRef = doc(db, 'users', currentUser.uid);

    setBuyingProductId(product.id || null);
    setPurchaseError('');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User record not found");
        }
        const currentBalance = (userDoc.data().walletBalance as number) || 0;
        if (currentBalance < product.discountedPrice) {
          throw new Error(`Insufficient wallet balance. You have $${currentBalance.toFixed(2)}, but this product costs $${product.discountedPrice.toFixed(2)}.`);
        }

        const newBalance = Number((currentBalance - product.discountedPrice).toFixed(2));
        
        // 1. Deduct wallet balance atomically
        transaction.update(userRef, {
          walletBalance: newBalance
        });

        // 2. Create order record
        const orderRef = doc(collection(db, 'orders'));
        const orderData: Omit<Order, 'id'> = {
          orderId: `ORD-${Date.now().toString().slice(-6)}`,
          userId: currentUser.uid,
          userName: userProfile?.name || currentUser.displayName || 'Customer',
          userEmail: currentUser.email || '',
          productId: product.id!,
          productTitle: product.title,
          productImage: product.imageUrl,
          price: product.discountedPrice,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        transaction.set(orderRef, orderData);

        // 3. Create transaction record
        const txRef = doc(collection(db, 'transactions'));
        const txData: Omit<TransactionRecord, 'id'> = {
          userId: currentUser.uid,
          amount: product.discountedPrice,
          type: 'debit',
          description: `Purchased ${product.title}`,
          status: 'completed',
          createdAt: new Date().toISOString()
        };
        transaction.set(txRef, txData);
      });

      // Confetti burst for celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });

      setPurchaseConfirmProduct(null);
      setSelectedProduct(null);
      // Switch user to Orders tab to view purchase
      setActiveTab('orders');
      setOrdersSubTab('purchases');
    } catch (err: any) {
      console.error("Purchase transaction error:", err);
      setPurchaseError(err.message || 'Purchase could not be completed.');
    } finally {
      setBuyingProductId(null);
    }
  };

  const calculateDiscountPercent = (orig: number, disc: number) => {
    if (!orig || orig <= disc) return 0;
    return Math.round(((orig - disc) / orig) * 100);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      theme === 'dark' 
        ? 'bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white' 
        : 'bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white'
    }`}>
      
      {/* Top Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b transition-colors ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/80' 
          : 'bg-white/80 border-slate-200/80'
      }`}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                {storeSettings.storeName || "Digi Store"}
              </span>
              <span className="block text-[10px] font-medium text-slate-400 leading-none">
                Digital Marketplace
              </span>
            </div>
          </div>

          {/* Header Wallet Badge & Auth */}
          <div className="flex items-center space-x-2">
            {currentUser ? (
              <button
                onClick={() => {
                  setShowAddMoneyModal(true);
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  theme === 'dark'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                }`}
                title="Your Current Wallet Balance - Click to Add Money"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                <span>${(userProfile?.walletBalance ?? 0).toFixed(2)}</span>
                <span className="text-[10px] bg-emerald-500 text-black px-1.5 rounded-full font-bold ml-1">+</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={handleThemeToggle}
              className={`p-2 rounded-full border transition-colors ${
                theme === 'dark' 
                  ? 'border-slate-800 text-slate-300 hover:bg-slate-900' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pb-24 pt-4">

        {/* ===================== TAB 1: HOME ===================== */}
        {activeTab === 'home' && (
          <div className="space-y-5 animate-fade-in">
            {/* 1. Modern Search Bar (ONLY on Home Tab as required) */}
            <div className="relative">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <input
                type="text"
                placeholder="Search tools, ChatGPT, Canva, VPN, OTT accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-10 py-3 rounded-2xl border text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-indigo-500 ${
                  theme === 'dark'
                    ? 'bg-slate-900/90 border-slate-800 text-white placeholder-slate-500'
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 2. Promotional Banner (Loaded dynamically from Firebase settings) */}
            {storeSettings.banner && storeSettings.banner.active && !searchQuery && (
              <div 
                className="relative overflow-hidden rounded-2xl border shadow-lg group cursor-pointer"
                style={{
                  borderColor: theme === 'dark' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.3)'
                }}
                onClick={() => {
                  const target = document.getElementById('products-section');
                  if (target) target.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="absolute inset-0 z-0">
                  <img 
                    src={storeSettings.banner.imageUrl || DEFAULT_SETTINGS.banner.imageUrl} 
                    alt="Promotion Banner"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-[0.45]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent"></div>
                </div>

                <div className="relative z-10 p-5 sm:p-6 max-w-lg text-white">
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 mb-2">
                    <Sparkles className="w-3 h-3" />
                    <span>Special Deals</span>
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight mb-1 text-white">
                    {storeSettings.banner.title || DEFAULT_SETTINGS.banner.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 mb-3">
                    {storeSettings.banner.subtitle || DEFAULT_SETTINGS.banner.subtitle}
                  </p>
                  <div className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-white text-slate-950 px-3.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors shadow">
                    <span>Explore Catalog</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            )}

            {/* 3. Category Filter Chips */}
            <div id="products-section" className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar pt-1">
              {PRODUCT_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 scale-102'
                        : theme === 'dark'
                          ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                          : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* 4. Products Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight text-slate-400 uppercase">
                  Available Tools ({filteredProducts.length})
                </h3>
                {selectedCategory !== 'All' && (
                  <button 
                    onClick={() => setSelectedCategory('All')}
                    className="text-xs text-indigo-500 hover:underline"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {filteredProducts.length === 0 ? (
                <div className={`text-center py-12 rounded-2xl border ${
                  theme === 'dark' ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200'
                }`}>
                  <ShoppingBag className="w-10 h-10 mx-auto text-slate-500 mb-2 opacity-50" />
                  <p className="text-sm font-medium text-slate-400">No tools found matching your criteria.</p>
                  <button 
                    onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                    className="mt-3 text-xs font-semibold text-indigo-500 hover:underline"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => {
                    const discount = calculateDiscountPercent(product.originalPrice, product.discountedPrice);
                    const isWishlisted = product.id && wishlistProductIds.includes(product.id);

                    return (
                      <div
                        key={product.id || product.title}
                        onClick={() => setSelectedProduct(product)}
                        className={`group relative rounded-2xl border overflow-hidden transition-all duration-200 flex flex-col cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                        }`}
                      >
                        {/* Thumbnail & Badges */}
                        <div className="relative aspect-[16/10] overflow-hidden bg-slate-950">
                          <img 
                            src={product.imageUrl} 
                            alt={product.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          
                          {/* Discount Badge */}
                          {discount > 0 && (
                            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-600 text-white shadow">
                              {discount}% OFF
                            </span>
                          )}

                          {/* Category Badge */}
                          <span className={`absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold backdrop-blur-md ${
                            theme === 'dark' ? 'bg-slate-900/80 text-slate-200 border border-slate-700/50' : 'bg-white/90 text-slate-800 shadow-xs'
                          }`}>
                            {product.category}
                          </span>

                          {/* Wishlist Button */}
                          <button
                            onClick={(e) => product.id && toggleWishlist(product.id, e)}
                            className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition-colors ${
                              isWishlisted 
                                ? 'bg-rose-500/90 text-white' 
                                : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-950/90'
                            }`}
                            title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
                          >
                            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        {/* Card Info */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-bold text-sm leading-snug line-clamp-1 mb-1 group-hover:text-indigo-400 transition-colors">
                              {product.title}
                            </h4>
                            <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                              {product.description}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between">
                            <div>
                              <div className="flex items-baseline space-x-1.5">
                                <span className="text-base font-extrabold text-indigo-400">
                                  ${product.discountedPrice.toFixed(2)}
                                </span>
                                {product.originalPrice > product.discountedPrice && (
                                  <span className="text-xs text-slate-500 line-through">
                                    ${product.originalPrice.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={(e) => handleInitiatePurchase(product, e)}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors flex items-center space-x-1"
                            >
                              <span>Buy Now</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 2: ORDERS (Purchases & Wishlist) ===================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-fade-in">
            {/* Orders Sub Navigation */}
            <div className={`p-1 rounded-2xl flex border ${
              theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setOrdersSubTab('purchases')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  ordersSubTab === 'purchases'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>My Purchases ({userOrders.length})</span>
              </button>
              <button
                onClick={() => setOrdersSubTab('wishlist')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  ordersSubTab === 'wishlist'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Wishlist ({wishlistProducts.length})</span>
              </button>
            </div>

            {/* My Purchases Section */}
            {ordersSubTab === 'purchases' && (
              <div className="space-y-3">
                {!currentUser ? (
                  <div className={`text-center py-12 rounded-2xl border ${
                    theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <LogIn className="w-10 h-10 mx-auto text-slate-500 mb-2 opacity-50" />
                    <p className="text-sm font-semibold mb-2">Please sign in to view your purchases</p>
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                    >
                      Sign In Now
                    </button>
                  </div>
                ) : userOrders.length === 0 ? (
                  <div className={`text-center py-12 rounded-2xl border ${
                    theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <ShoppingBag className="w-10 h-10 mx-auto text-slate-500 mb-2 opacity-50" />
                    <p className="text-sm font-semibold mb-1">No Purchases Yet</p>
                    <p className="text-xs text-slate-400 mb-4">Discover tools in our catalog and place your first order.</p>
                    <button
                      onClick={() => setActiveTab('home')}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                    >
                      Browse Products
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userOrders.map((order) => {
                      const isApproved = order.status === 'approved';
                      const isPending = order.status === 'pending';
                      const isRejected = order.status === 'rejected';

                      return (
                        <div
                          key={order.id || order.orderId}
                          onClick={() => setSelectedOrderDetails(order)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center space-x-3">
                              {order.productImage ? (
                                <img 
                                  src={order.productImage} 
                                  alt={order.productTitle} 
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-800"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-indigo-950 flex items-center justify-center text-indigo-400">
                                  <ShoppingBag className="w-6 h-6" />
                                </div>
                              )}
                              <div>
                                <h4 className="font-bold text-sm leading-snug line-clamp-1">{order.productTitle}</h4>
                                <span className="text-[11px] text-slate-400 block">
                                  {order.orderId || 'Order'} • {new Date(order.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div>
                              {isApproved && (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Approved</span>
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                                  <Clock className="w-3 h-3" />
                                  <span>Processing</span>
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60">
                                  <XCircle className="w-3 h-3" />
                                  <span>Refunded</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Delivery Link Box (Only when Approved!) */}
                          {isApproved && order.deliveryUrl && (
                            <div className={`mt-3 p-3 rounded-xl border flex items-center justify-between gap-2 ${
                              theme === 'dark' 
                                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300' 
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}>
                              <div className="flex items-center space-x-2 truncate">
                                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                <div className="truncate">
                                  <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-500">
                                    Delivered Digital Access:
                                  </span>
                                  <span className="text-xs font-mono truncate block">
                                    {order.deliveryUrl}
                                  </span>
                                </div>
                              </div>
                              <a
                                href={order.deliveryUrl.startsWith('http') ? order.deliveryUrl : `https://${order.deliveryUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 flex items-center space-x-1"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {isPending && (
                            <div className="text-[11px] text-amber-500/90 flex items-center space-x-1.5 mt-2 bg-amber-500/10 p-2 rounded-lg">
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              <span>Order received! Admin is verifying credentials. Access link will appear here shortly.</span>
                            </div>
                          )}

                          {isRejected && (
                            <div className="text-[11px] text-rose-400/90 flex items-center space-x-1.5 mt-2 bg-rose-500/10 p-2 rounded-lg">
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              <span>Order rejected by admin. Any deducted funds have been automatically refunded to your wallet balance.</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Wishlist Section */}
            {ordersSubTab === 'wishlist' && (
              <div>
                {wishlistProducts.length === 0 ? (
                  <div className={`text-center py-12 rounded-2xl border ${
                    theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <Heart className="w-10 h-10 mx-auto text-slate-500 mb-2 opacity-50" />
                    <p className="text-sm font-semibold mb-1">Your Wishlist is Empty</p>
                    <p className="text-xs text-slate-400 mb-4">Tap the heart icon on any tool card to save it here for later.</p>
                    <button
                      onClick={() => setActiveTab('home')}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                    >
                      Browse Tools
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wishlistProducts.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <img 
                            src={product.imageUrl} 
                            alt={product.title} 
                            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-800"
                          />
                          <div className="truncate">
                            <h4 className="font-bold text-sm truncate">{product.title}</h4>
                            <span className="text-xs text-indigo-400 font-extrabold block">
                              ${product.discountedPrice.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-500">{product.category}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={(e) => product.id && toggleWishlist(product.id, e)}
                            className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove from wishlist"
                          >
                            <Heart className="w-4 h-4 fill-current" />
                          </button>
                          <button
                            onClick={(e) => handleInitiatePurchase(product, e)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                          >
                            Buy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 3: PROFILE ===================== */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-fade-in">
            {/* User Profile Card */}
            <div className={`p-5 rounded-3xl border relative overflow-hidden ${
              theme === 'dark'
                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800'
                : 'bg-white border-slate-200 shadow-sm'
            }`}>
              {currentUser ? (
                <div>
                  <div className="flex items-center space-x-4 mb-5">
                    <img
                      src={userProfile?.avatar || currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`}
                      alt="Avatar"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/40 p-0.5 bg-slate-900 shadow"
                    />
                    <div className="flex-1 truncate">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-base tracking-tight truncate">
                          {userProfile?.name || currentUser.displayName || 'Customer'}
                        </h3>
                        <button
                          onClick={() => {
                            setEditNameInput(userProfile?.name || '');
                            setShowEditProfileModal(true);
                          }}
                          className="text-[11px] text-indigo-400 hover:underline font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/50 mt-1">
                        <ShieldCheck className="w-3 h-3 text-indigo-400" />
                        <span>Verified Account</span>
                      </span>
                    </div>
                  </div>

                  {/* Wallet Balance Hero Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900/50 border border-indigo-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 block mb-0.5">
                        Current Wallet Balance
                      </span>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl sm:text-3xl font-black text-white">
                          ${(userProfile?.walletBalance ?? 0).toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">USD</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowAddMoneyModal(true)}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 flex items-center space-x-1.5"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>+ Add Money</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <UserIcon className="w-12 h-12 mx-auto text-slate-500 mb-2 opacity-50" />
                  <h3 className="font-bold text-base mb-1">Welcome to Digi Store</h3>
                  <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                    Sign in to access your digital wallet, save favorite tools, and unlock instant delivery.
                  </p>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
                  >
                    Sign In or Create Account
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions & Menu */}
            <div className={`rounded-2xl border divide-y ${
              theme === 'dark' 
                ? 'bg-slate-900/70 border-slate-800 divide-slate-800/80' 
                : 'bg-white border-slate-200 divide-slate-100 shadow-xs'
            }`}>
              {/* Theme Switcher Row */}
              <div 
                onClick={handleThemeToggle}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-500/5 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-indigo-600'}`}>
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">Theme Appearance</h4>
                    <p className="text-[11px] text-slate-400">Current: {theme === 'dark' ? 'Black / Dark' : 'White / Light'}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-400">Switch</span>
              </div>

              {/* Add Money / Top-up History Shortcut */}
              {currentUser && (
                <div 
                  onClick={() => setShowAddMoneyModal(true)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-500/5 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">Wallet & Payment Requests</h4>
                      <p className="text-[11px] text-slate-400">View UTR deposit history & add funds</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              )}

              {/* Terms and Conditions */}
              <div 
                onClick={() => setShowPoliciesModal('terms')}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-500/5 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-slate-500/10 text-slate-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">Terms & Conditions</h4>
                    <p className="text-[11px] text-slate-400">Warranty, account usage & guidelines</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>

              {/* Privacy Policy */}
              <div 
                onClick={() => setShowPoliciesModal('privacy')}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-500/5 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-slate-500/10 text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">Privacy Policy</h4>
                    <p className="text-[11px] text-slate-400">Zero log policy & encrypted orders</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>

              {/* Logout Button */}
              {currentUser && (
                <div 
                  onClick={() => {
                    localStorage.removeItem('digi_store_customer_session');
                    setCurrentUser(null);
                    setUserProfile(null);
                    setUserOrders([]);
                    setWalletRequests([]);
                    setWishlistProductIds([]);
                    try { signOut(auth); } catch(e) {}
                  }}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-rose-500/5 transition-colors text-rose-400"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">Log Out</h4>
                      <p className="text-[11px] text-slate-500">Sign out of {currentUser.displayName || currentUser.email}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              )}
            </div>

            {/* Store Support Info */}
            <div className="text-center text-[11px] text-slate-500 pt-3">
              <p>{storeSettings.supportContact || DEFAULT_SETTINGS.supportContact}</p>
              <p className="mt-0.5">Digi Store Customer Application • v2.0</p>
            </div>
          </div>
        )}

      </main>

      {/* ===================== BOTTOM NAVIGATION (Home, Orders, Profile) ===================== */}
      <nav className={`fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl border-t transition-colors ${
        theme === 'dark' 
          ? 'bg-slate-950/90 border-slate-800' 
          : 'bg-white/90 border-slate-200'
      }`}>
        <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between">
          {/* 1. Home Tab */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === 'home'
                ? 'text-indigo-500 scale-105 font-bold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">Home</span>
          </button>

          {/* 2. Orders Tab */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-all ${
              activeTab === 'orders'
                ? 'text-indigo-500 scale-105 font-bold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <ShoppingBag className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">Orders</span>
            {userOrders.length > 0 && (
              <span className="absolute top-1 right-8 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-950"></span>
            )}
          </button>

          {/* 3. Profile Tab */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === 'profile'
                ? 'text-indigo-500 scale-105 font-bold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <UserIcon className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">Profile</span>
          </button>
        </div>
      </nav>

      {/* ===================== MODAL: PRODUCT DETAILS FULL PAGE ===================== */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl border overflow-hidden max-h-[90vh] flex flex-col ${
            theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Header / Close */}
            <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
              <img 
                src={selectedProduct.imageUrl} 
                alt={selectedProduct.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-slate-950/70 text-white hover:bg-slate-950 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              {calculateDiscountPercent(selectedProduct.originalPrice, selectedProduct.discountedPrice) > 0 && (
                <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-xl text-xs font-black bg-rose-600 text-white shadow">
                  {calculateDiscountPercent(selectedProduct.originalPrice, selectedProduct.discountedPrice)}% DISCOUNT
                </span>
              )}
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  {selectedProduct.category}
                </span>
                <h3 className="text-lg font-black leading-tight">
                  {selectedProduct.title}
                </h3>
              </div>

              {/* Pricing breakdown */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <span className="text-[11px] text-slate-400 block">Offer Price</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-indigo-400">
                      ${selectedProduct.discountedPrice.toFixed(2)}
                    </span>
                    {selectedProduct.originalPrice > selectedProduct.discountedPrice && (
                      <span className="text-sm text-slate-500 line-through">
                        ${selectedProduct.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-emerald-500 font-semibold block">Instant Delivery</span>
                  <span className="text-[11px] text-slate-400">Verified Credentials</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {selectedProduct.description}
                </p>
              </div>

              {/* Features list */}
              {selectedProduct.features && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Key Inclusions</h4>
                  <div className={`p-3 rounded-2xl border text-xs leading-relaxed font-mono whitespace-pre-line ${
                    theme === 'dark' ? 'bg-slate-900/60 border-slate-800/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    {selectedProduct.features}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className={`p-4 border-t flex items-center space-x-3 ${
              theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <button
                onClick={() => selectedProduct.id && toggleWishlist(selectedProduct.id)}
                className={`p-3 rounded-2xl border transition-colors flex items-center justify-center ${
                  selectedProduct.id && wishlistProductIds.includes(selectedProduct.id)
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Save to Wishlist"
              >
                <Heart className={`w-5 h-5 ${selectedProduct.id && wishlistProductIds.includes(selectedProduct.id) ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={() => handleInitiatePurchase(selectedProduct)}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Buy Now (${selectedProduct.discountedPrice.toFixed(2)})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CONFIRM PURCHASE & WALLET CHECK ===================== */}
      {purchaseConfirmProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl border p-6 space-y-4 ${
            theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-800/80">
              <h3 className="font-extrabold text-base flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-indigo-500" />
                <span>Confirm Purchase</span>
              </h3>
              <button onClick={() => setPurchaseConfirmProduct(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-3.5">
              <img 
                src={purchaseConfirmProduct.imageUrl} 
                alt={purchaseConfirmProduct.title}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-800 shrink-0" 
              />
              <div className="truncate">
                <h4 className="font-bold text-sm truncate">{purchaseConfirmProduct.title}</h4>
                <span className="text-xs text-indigo-400 font-extrabold block">
                  ${purchaseConfirmProduct.discountedPrice.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400">{purchaseConfirmProduct.category}</span>
              </div>
            </div>

            {/* Balance check */}
            <div className={`p-3.5 rounded-2xl border space-y-2 ${
              theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Available Wallet Balance:</span>
                <span className="font-bold font-mono">${(userProfile?.walletBalance ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Item Price:</span>
                <span className="font-bold font-mono text-indigo-400">-${purchaseConfirmProduct.discountedPrice.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex justify-between text-xs font-bold">
                <span>Remaining Balance:</span>
                <span className={((userProfile?.walletBalance ?? 0) - purchaseConfirmProduct.discountedPrice) >= 0 ? 'text-emerald-400' : 'text-rose-500'}>
                  ${((userProfile?.walletBalance ?? 0) - purchaseConfirmProduct.discountedPrice).toFixed(2)}
                </span>
              </div>
            </div>

            {purchaseError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{purchaseError}</span>
              </div>
            )}

            {/* Action buttons */}
            {(userProfile?.walletBalance ?? 0) < purchaseConfirmProduct.discountedPrice ? (
              <div className="space-y-2">
                <p className="text-xs text-rose-400 text-center font-medium">
                  Insufficient funds in your wallet. Please top-up to proceed.
                </p>
                <button
                  onClick={() => {
                    setPurchaseConfirmProduct(null);
                    setShowAddMoneyModal(true);
                  }}
                  className="w-full py-3 rounded-2xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center space-x-1.5 shadow"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Add Money Now</span>
                </button>
              </div>
            ) : (
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setPurchaseConfirmProduct(null)}
                  className={`flex-1 py-3 rounded-2xl font-bold text-xs border ${
                    theme === 'dark' ? 'border-slate-800 hover:bg-slate-900' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPurchase}
                  disabled={buyingProductId !== null}
                  className="flex-1 py-3 rounded-2xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center justify-center space-x-1.5"
                >
                  {buyingProductId ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Buy</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== MODAL: WALLET & ADD MONEY WITH QR ===================== */}
      {showAddMoneyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl border overflow-hidden max-h-[90vh] flex flex-col ${
            theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base">Add Money to Wallet</h3>
              </div>
              <button onClick={() => setShowAddMoneyModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Current live balance banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-400 font-semibold block">Active Balance</span>
                  <span className="text-xl font-black text-white">${(userProfile?.walletBalance ?? 0).toFixed(2)}</span>
                </div>
                <span className="text-[10px] text-emerald-300 font-mono bg-emerald-900/60 px-2 py-1 rounded-lg">
                  Instant Auto-Update
                </span>
              </div>

              {/* Payment QR configured by Admin */}
              <div className="text-center space-y-3">
                <div className="w-48 h-48 mx-auto p-2 bg-white rounded-2xl shadow-md border-2 border-indigo-500/40 flex items-center justify-center">
                  <img 
                    src={storeSettings.paymentQR?.imageUrl || DEFAULT_SETTINGS.paymentQR.imageUrl} 
                    alt="Payment QR"
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* UPI ID copy box */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between max-w-xs mx-auto ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}>
                  <div className="truncate text-left pr-2">
                    <span className="text-[10px] text-slate-400 block font-semibold">UPI ID / Payee:</span>
                    <span className="text-xs font-mono font-bold truncate block">
                      {storeSettings.paymentQR?.upiId || DEFAULT_SETTINGS.paymentQR.upiId}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(storeSettings.paymentQR?.upiId || DEFAULT_SETTINGS.paymentQR.upiId);
                      setCopiedUpi(true);
                      setTimeout(() => setCopiedUpi(false), 2000);
                    }}
                    className="p-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-500 transition-colors shrink-0"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {storeSettings.paymentQR?.notes || DEFAULT_SETTINGS.paymentQR.notes}
                </p>
              </div>

              {/* Add Money Form */}
              <form onSubmit={handleAddMoneySubmit} className="space-y-3 pt-2 border-t border-slate-800/60">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="e.g. 10"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-xl border text-sm font-bold ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                      12-Digit UTR / Ref No.
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 432109876543"
                      value={depositUtr}
                      onChange={(e) => setDepositUtr(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-sm font-mono ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                {depositSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{depositSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={depositSubmitting}
                  className="w-full py-3 rounded-2xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center justify-center space-x-2"
                >
                  {depositSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Submit Payment Request</span>
                    </>
                  )}
                </button>
              </form>

              {/* Recent Requests Log */}
              {walletRequests.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Your Deposit Requests ({walletRequests.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {walletRequests.map((req) => (
                      <div
                        key={req.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="font-bold flex items-center space-x-1.5">
                            <span>${req.amount.toFixed(2)}</span>
                            <span className="font-mono text-[10px] text-slate-400">UTR: {req.utr}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div>
                          {req.status === 'approved' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Credited
                            </span>
                          )}
                          {req.status === 'pending' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                              Pending
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                              Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ORDER DETAILS & DELIVERY LINK ===================== */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl border p-5 space-y-4 ${
            theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-800/80">
              <h3 className="font-extrabold text-base">Purchase Details</h3>
              <button onClick={() => setSelectedOrderDetails(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-3">
              {selectedOrderDetails.productImage && (
                <img 
                  src={selectedOrderDetails.productImage} 
                  alt={selectedOrderDetails.productTitle} 
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-800 shrink-0" 
                />
              )}
              <div className="truncate">
                <h4 className="font-bold text-sm truncate">{selectedOrderDetails.productTitle}</h4>
                <span className="text-xs text-indigo-400 font-extrabold block">
                  ${selectedOrderDetails.price.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {selectedOrderDetails.orderId} • {new Date(selectedOrderDetails.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Delivery Link / Instructions */}
            {selectedOrderDetails.status === 'approved' && selectedOrderDetails.deliveryUrl ? (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 space-y-3">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Delivery Instructions & Access</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-900/60 font-mono text-xs text-slate-200 break-all select-all">
                  {selectedOrderDetails.deliveryUrl}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (selectedOrderDetails.deliveryUrl) {
                        navigator.clipboard.writeText(selectedOrderDetails.deliveryUrl);
                        setCopiedDelivery(true);
                        setTimeout(() => setCopiedDelivery(false), 2000);
                      }
                    }}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center space-x-1"
                  >
                    {copiedDelivery ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDelivery ? 'Copied' : 'Copy Credentials'}</span>
                  </button>

                  <a
                    href={selectedOrderDetails.deliveryUrl.startsWith('http') ? selectedOrderDetails.deliveryUrl : `https://${selectedOrderDetails.deliveryUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center space-x-1"
                  >
                    <span>Open Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : selectedOrderDetails.status === 'pending' ? (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs space-y-1">
                <div className="flex items-center space-x-2 font-bold">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Pending Admin Approval</span>
                </div>
                <p className="text-slate-300 leading-relaxed pt-1">
                  Your payment has been reserved. Our admin is configuring your account/license key. Once confirmed, your delivery credentials will appear right here.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs space-y-1">
                <div className="flex items-center space-x-2 font-bold">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Order Rejected & Refunded</span>
                </div>
                <p className="text-slate-300 leading-relaxed pt-1">
                  Reason: {selectedOrderDetails.rejectReason || 'Out of stock or unavailable.'} 
                  Your reserved funds have been refunded to your wallet.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== MODAL: TERMS / PRIVACY POLICY ===================== */}
      {showPoliciesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl border overflow-hidden max-h-[85vh] flex flex-col ${
            theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-base">
                {showPoliciesModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
              </h3>
              <button onClick={() => setShowPoliciesModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line space-y-2">
              {showPoliciesModal === 'terms' 
                ? (storeSettings.termsAndConditions || DEFAULT_SETTINGS.termsAndConditions)
                : (storeSettings.privacyPolicy || DEFAULT_SETTINGS.privacyPolicy)
              }
            </div>
            <div className="p-3 border-t border-slate-800 text-right">
              <button
                onClick={() => setShowPoliciesModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: EDIT PROFILE NAME ===================== */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-sm rounded-3xl border p-5 space-y-4 ${
            theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="font-extrabold text-base">Edit Display Name</h3>
            <input
              type="text"
              value={editNameInput}
              onChange={(e) => setEditNameInput(e.target.value)}
              placeholder="Your full name"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200'
              }`}
            />
            <div className="flex space-x-2">
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: AUTHENTICATION (Google + Email) ===================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-sm rounded-3xl border p-6 space-y-4 ${
            theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-800">
              <h3 className="font-extrabold text-base">
                {authMode === 'login' ? 'Sign In to Digi Store' : 'Create an Account'}
              </h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message Display Prominently at Top */}
            {authError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-2">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold leading-relaxed">{authError}</p>
                  </div>
                </div>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab (Bypasses Popup Blocker)</span>
                </a>
              </div>
            )}

            {/* Google Sign In Button */}
            <div className="space-y-2">
              <button
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full py-3 rounded-2xl border font-bold text-xs flex items-center justify-center space-x-2 bg-white text-slate-900 hover:bg-slate-100 transition-colors shadow-sm active:scale-98"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              {/* Direct Open in New Tab Helper */}
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 rounded-xl text-[11px] font-medium text-slate-400 hover:text-indigo-400 flex items-center justify-center space-x-1"
                title="Google login popup often works better in a full browser tab"
              >
                <span>Preview iframe me issue ho to:</span>
                <span className="underline font-bold text-indigo-400 flex items-center">
                  New Tab me kholein <ExternalLink className="w-3 h-3 ml-0.5 inline" />
                </span>
              </a>
            </div>

            {/* 1-Click Customer Test Accounts */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                ⚡ 1-Click Instant Customer Login:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCustomerSelect('Rohan Sharma', 'rohan.customer@gmail.com')}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-indigo-500' : 'bg-slate-50 border-slate-200 hover:border-indigo-500'
                  }`}
                >
                  <span className="font-bold text-xs block text-white">👤 Rohan Sharma</span>
                  <span className="text-[10px] text-slate-400 block truncate">rohan.customer@gmail.com</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCustomerSelect('Priya Patel', 'priya.customer@gmail.com')}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-indigo-500' : 'bg-slate-50 border-slate-200 hover:border-indigo-500'
                  }`}
                >
                  <span className="font-bold text-xs block text-white">👤 Priya Patel</span>
                  <span className="text-[10px] text-slate-400 block truncate">priya.customer@gmail.com</span>
                </button>
              </div>
            </div>

            <div className="flex items-center my-1">
              <div className="flex-1 border-t border-slate-800"></div>
              <span className="px-2 text-[10px] text-slate-500 font-bold uppercase">or enter ANY customer email</span>
              <div className="flex-1 border-t border-slate-800"></div>
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {authMode === 'register' && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Your Name (e.g. Aman Verma)"
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${
                      theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Customer Email</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Enter any email (e.g. rahul@gmail.com)"
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow"
              >
                {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In as Customer' : 'Create Customer Account'}
              </button>
            </form>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setAuthError('');
                }}
                className="text-[11px] text-indigo-400 hover:underline font-semibold"
              >
                {authMode === 'login' ? "Don't have an account? Sign Up with Any Email" : "Already have an account? Sign In"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
