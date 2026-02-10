import { useReducer, Dispatch } from 'react';

// Types
export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface PaymentMethod {
  id: string;
  method: string;
  baseAmount: number;
  surcharge: number;
  amount: number;
  installments?: number;
  currency?: string;
}

export interface POSState {
  // Search & Cart
  searchQuery: string;
  cart: CartItem[];
  
  // Payment
  paymentMethods: PaymentMethod[];
  currentPaymentMethod: string;
  currentPaymentAmount: string;
  currentInstallments: number;
  currentPaymentCurrency: string;
  discountRate: number;
  loyaltyPointsToUse: number;
  selectedPaymentMethod: string;
  
  // Customer
  selectedCustomer: any | null;
  newCustomerName: string;
  newCustomerPhone: string;
  newCustomerEmail: string;
  newCustomerDocument: string;
  tempPhoneNumber: string;
  tempEmail: string;
  
  // Selection
  selectedWarehouse: string;
  selectedPOSAfipId: string;
  
  // UI
  createCustomerDialog: boolean;
  showReceiptOptions: boolean;
  isProcessingSale: boolean;
  walkInSale: boolean;
  
  // Receipt
  lastSaleData: any | null;
}

// Action Types
export type POSAction =
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'UPDATE_CART_ITEM'; payload: { productId: string; quantity: number; subtotal: number } }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_PAYMENT_METHODS'; payload: PaymentMethod[] }
  | { type: 'ADD_PAYMENT_METHOD'; payload: PaymentMethod }
  | { type: 'REMOVE_PAYMENT_METHOD'; payload: string }
  | { type: 'SET_CURRENT_PAYMENT_METHOD'; payload: string }
  | { type: 'SET_CURRENT_PAYMENT_AMOUNT'; payload: string }
  | { type: 'SET_CURRENT_INSTALLMENTS'; payload: number }
  | { type: 'SET_CURRENT_PAYMENT_CURRENCY'; payload: string }
  | { type: 'SET_DISCOUNT_RATE'; payload: number }
  | { type: 'SET_LOYALTY_POINTS_TO_USE'; payload: number }
  | { type: 'SET_SELECTED_CUSTOMER'; payload: any | null }
  | { type: 'SET_NEW_CUSTOMER_NAME'; payload: string }
  | { type: 'SET_NEW_CUSTOMER_PHONE'; payload: string }
  | { type: 'SET_NEW_CUSTOMER_EMAIL'; payload: string }
  | { type: 'SET_NEW_CUSTOMER_DOCUMENT'; payload: string }
  | { type: 'SET_TEMP_PHONE_NUMBER'; payload: string }
  | { type: 'SET_TEMP_EMAIL'; payload: string }
  | { type: 'RESET_NEW_CUSTOMER_FORM' }
  | { type: 'SET_SELECTED_WAREHOUSE'; payload: string }
  | { type: 'SET_SELECTED_POS_AFIP_ID'; payload: string }
  | { type: 'SET_CREATE_CUSTOMER_DIALOG'; payload: boolean }
  | { type: 'SET_SHOW_RECEIPT_OPTIONS'; payload: boolean }
  | { type: 'SET_IS_PROCESSING_SALE'; payload: boolean }
  | { type: 'SET_WALK_IN_SALE'; payload: boolean }
  | { type: 'SET_LAST_SALE_DATA'; payload: any | null }
  | { type: 'SET_SELECTED_PAYMENT_METHOD'; payload: string }
  | { type: 'RESET_POS' };

// Initial State
const initialState: POSState = {
  searchQuery: '',
  cart: [],
  paymentMethods: [],
  currentPaymentMethod: 'cash',
  currentPaymentAmount: '',
  currentInstallments: 1,
  currentPaymentCurrency: 'ARS',
  discountRate: 0,
  loyaltyPointsToUse: 0,
  selectedPaymentMethod: 'cash',
  selectedCustomer: null,
  newCustomerName: '',
  newCustomerPhone: '',
  newCustomerEmail: '',
  newCustomerDocument: '',
  tempPhoneNumber: '',
  tempEmail: '',
  selectedWarehouse: '',
  selectedPOSAfipId: '',
  createCustomerDialog: false,
  showReceiptOptions: false,
  isProcessingSale: false,
  walkInSale: false,
  lastSaleData: null,
};

// Reducer
function posReducer(state: POSState, action: POSAction): POSState {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
      
    case 'SET_CART':
      return { ...state, cart: action.payload };
      
    case 'ADD_TO_CART':
      return { ...state, cart: [...state.cart, action.payload] };
      
    case 'UPDATE_CART_ITEM':
      return {
        ...state,
        cart: state.cart.map(item =>
          item.product_id === action.payload.productId
            ? { ...item, quantity: action.payload.quantity, subtotal: action.payload.subtotal }
            : item
        ),
      };
      
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter(item => item.product_id !== action.payload),
      };
      
    case 'CLEAR_CART':
      return {
        ...state,
        cart: [],
        paymentMethods: [],
        discountRate: 0,
        loyaltyPointsToUse: 0,
        selectedCustomer: null,
      };
      
    case 'SET_PAYMENT_METHODS':
      return { ...state, paymentMethods: action.payload };
      
    case 'ADD_PAYMENT_METHOD':
      return {
        ...state,
        paymentMethods: [...state.paymentMethods, action.payload],
      };
      
    case 'REMOVE_PAYMENT_METHOD':
      return {
        ...state,
        paymentMethods: state.paymentMethods.filter(pm => pm.id !== action.payload),
      };
      
    case 'SET_CURRENT_PAYMENT_METHOD':
      return { ...state, currentPaymentMethod: action.payload };
      
    case 'SET_CURRENT_PAYMENT_AMOUNT':
      return { ...state, currentPaymentAmount: action.payload };
      
    case 'SET_CURRENT_INSTALLMENTS':
      return { ...state, currentInstallments: action.payload };
      
    case 'SET_CURRENT_PAYMENT_CURRENCY':
      return { ...state, currentPaymentCurrency: action.payload };
      
    case 'SET_DISCOUNT_RATE':
      return { ...state, discountRate: action.payload };
      
    case 'SET_LOYALTY_POINTS_TO_USE':
      return { ...state, loyaltyPointsToUse: action.payload };
      
    case 'SET_SELECTED_CUSTOMER':
      return { ...state, selectedCustomer: action.payload };
      
    case 'SET_NEW_CUSTOMER_NAME':
      return { ...state, newCustomerName: action.payload };
      
    case 'SET_NEW_CUSTOMER_PHONE':
      return { ...state, newCustomerPhone: action.payload };
      
    case 'SET_NEW_CUSTOMER_EMAIL':
      return { ...state, newCustomerEmail: action.payload };
      
    case 'SET_NEW_CUSTOMER_DOCUMENT':
      return { ...state, newCustomerDocument: action.payload };
      
    case 'SET_TEMP_PHONE_NUMBER':
      return { ...state, tempPhoneNumber: action.payload };
      
    case 'SET_TEMP_EMAIL':
      return { ...state, tempEmail: action.payload };
      
    case 'RESET_NEW_CUSTOMER_FORM':
      return {
        ...state,
        newCustomerName: '',
        newCustomerPhone: '',
        newCustomerEmail: '',
        newCustomerDocument: '',
      };
      
    case 'SET_SELECTED_WAREHOUSE':
      return { ...state, selectedWarehouse: action.payload };
      
    case 'SET_SELECTED_POS_AFIP_ID':
      return { ...state, selectedPOSAfipId: action.payload };
      
    case 'SET_CREATE_CUSTOMER_DIALOG':
      return { ...state, createCustomerDialog: action.payload };
      
    case 'SET_SHOW_RECEIPT_OPTIONS':
      return { ...state, showReceiptOptions: action.payload };
      
    case 'SET_IS_PROCESSING_SALE':
      return { ...state, isProcessingSale: action.payload };
      
    case 'SET_WALK_IN_SALE':
      return { ...state, walkInSale: action.payload };
      
    case 'SET_LAST_SALE_DATA':
      return { ...state, lastSaleData: action.payload };
      
    case 'SET_SELECTED_PAYMENT_METHOD':
      return { ...state, selectedPaymentMethod: action.payload };
      
    case 'RESET_POS':
      return initialState;
      
    default:
      return state;
  }
}

// Hook
export function usePOSState(): [POSState, Dispatch<POSAction>] {
  const [state, dispatch] = useReducer(posReducer, initialState);
  return [state, dispatch];
}
