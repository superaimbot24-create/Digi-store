export interface Product {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  originalPrice: number;
  discountedPrice: number;
  category: string;
  active: boolean;
  features?: string;
  createdAt?: string;
}

export type OrderStatus = 'pending' | 'approved' | 'rejected';

export interface Order {
  id?: string;
  orderId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  price: number;
  status: OrderStatus;
  deliveryUrl?: string;
  rejectReason?: string;
  createdAt: string;
}

export type WalletRequestStatus = 'pending' | 'approved' | 'rejected';

export interface WalletRequest {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  utr: string;
  status: WalletRequestStatus;
  notes?: string;
  createdAt: string;
}

export interface TransactionRecord {
  id?: string;
  userId: string;
  amount: number;
  type: 'credit' | 'debit' | 'refund';
  description: string;
  status: 'completed' | 'failed';
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  walletBalance: number;
  theme?: 'dark' | 'light';
  avatar?: string;
  createdAt?: string;
}

export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  supportContact: string;
  banner: {
    imageUrl: string;
    title: string;
    subtitle: string;
    redirectUrl: string;
    active: boolean;
  };
  paymentQR: {
    imageUrl: string;
    upiId: string;
    accountName: string;
    notes: string;
  };
  termsAndConditions: string;
  privacyPolicy: string;
  updatedAt?: string;
}

export const PRODUCT_CATEGORIES = [
  'All',
  'AI & ChatGPT',
  'Streaming & OTT',
  'Design & Creative',
  'Developer Tools',
  'VPN & Privacy',
  'Productivity'
];
