import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with specific database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection as required by Firebase skill
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Global default settings and initial seed data
export const DEFAULT_SETTINGS = {
  storeName: "Digi Store",
  storeTagline: "Premium Digital Tools & Subscriptions at Wholesale Rates",
  supportContact: "support@digistore.tools | Telegram @DigiStoreOfficial",
  banner: {
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    title: "MEGA FLASH SALE: Up to 80% OFF",
    subtitle: "ChatGPT Plus, Canva Pro, OTT Subscriptions & Dev Licenses. Instant Delivery to Your Dashboard!",
    redirectUrl: "#products",
    active: true
  },
  paymentQR: {
    imageUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=digistore@upi&pn=DigiStore&cu=INR",
    upiId: "digistore@upi",
    accountName: "DIGI STORE PRIVATE LIMITED",
    notes: "Scan using GPay, PhonePe, Paytm or any UPI app. After payment, copy the 12-digit UTR/Ref No. and submit below. Your balance will be credited upon verification."
  },
  termsAndConditions: `### Terms & Conditions
1. **Digital Deliveries**: All tools and subscription accounts provided are strictly for personal or business testing according to the respective provider's terms of service.
2. **Warranty & Replacement**: A 30-day replacement warranty is applicable for all active purchases if an account fails prematurely.
3. **Wallet Balance**: Funds deposited into Digi Store wallet cannot be withdrawn to bank accounts; they can only be redeemed for store tools.
4. **Order Processing**: Most digital access credentials are processed within 5-30 minutes during standard support hours.`,
  privacyPolicy: `### Privacy Policy
1. **Data Collected**: We only collect your email address, username, order history, and payment UTR references to fulfill orders.
2. **Zero Sharing**: We never sell or share your personal contact details with third-party advertising companies.
3. **Security**: All orders and wallet operations are secured with Firebase Cloud encryption.`
};

export const INITIAL_PRODUCTS = [
  {
    title: "ChatGPT Plus (1 Month Shared)",
    description: "Full access to GPT-4o, DALL·E 3, Canvas, Code Interpreter, Voice Mode and Web Browsing with fast response speed and custom GPTs.",
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80",
    originalPrice: 20,
    discountedPrice: 6.99,
    category: "AI & ChatGPT",
    active: true,
    features: "• GPT-4o Uncapped Engine\n• DALL·E 3 Image Generation\n• Voice & Code Interpreter\n• Private Profile Slot with Warranty",
    createdAt: new Date().toISOString()
  },
  {
    title: "Canva Pro (1-Year Team Invite)",
    description: "Unlock 100M+ premium stock photos, graphics, templates, brand kits, background remover, and magic studio AI features directly on your personal email.",
    imageUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=800&q=80",
    originalPrice: 45,
    discountedPrice: 9.99,
    category: "Design & Creative",
    active: true,
    features: "• 100M+ Premium Stock Assets\n• Magic Background Remover\n• Brand Kit & Unlimited Resizing\n• 1-Year Full Warranty",
    createdAt: new Date().toISOString()
  },
  {
    title: "GitHub Copilot (6-Month Pass)",
    description: "The world's leading AI pair programmer. Autocomplete code in real time, generate unit tests, explain legacy syntax across VS Code, IntelliJ, and JetBrains.",
    imageUrl: "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=800&q=80",
    originalPrice: 60,
    discountedPrice: 14.99,
    category: "Developer Tools",
    active: true,
    features: "• VS Code & JetBrains Plug-in\n• Real-Time Context Autocomplete\n• Multi-Language Support\n• Dedicated Access",
    createdAt: new Date().toISOString()
  },
  {
    title: "Netflix Premium 4K UHD Profile",
    description: "Ultra HD 4K single-screen profile with personal PIN protection. Enjoy unlimited movies, award-winning series, and offline downloads on any device.",
    imageUrl: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=800&q=80",
    originalPrice: 15,
    discountedPrice: 4.49,
    category: "Streaming & OTT",
    active: true,
    features: "• 4K HDR + Dolby Atmos Sound\n• Dedicated Pin-Locked Profile\n• Mobile, TV, Laptop Compatible\n• 30-Day Guaranteed Renewal",
    createdAt: new Date().toISOString()
  },
  {
    title: "NordVPN Ultra (1-Year License)",
    description: "Top-tier cybersecurity and private internet access. 5500+ ultra-fast servers in 60 countries with Threat Protection, malware blocker, and Double VPN.",
    imageUrl: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80",
    originalPrice: 89,
    discountedPrice: 12.99,
    category: "VPN & Privacy",
    active: true,
    features: "• High Speed No-Logs Servers\n• Threat & Ad Blocker Included\n• Connect up to 6 Devices\n• 1-Year Peace of Mind",
    createdAt: new Date().toISOString()
  },
  {
    title: "Midjourney AI (Standard Shared)",
    description: "Create breathtaking, ultra-realistic digital art and photography through Discord. Fast GPU hours included with relax mode.",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    originalPrice: 30,
    discountedPrice: 8.99,
    category: "AI & ChatGPT",
    active: true,
    features: "• Fast GPU Generations\n• Version 6.1 Photorealism\n• Commercial Usage Rights\n• Fast Discord Access",
    createdAt: new Date().toISOString()
  }
];
