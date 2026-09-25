// ---------------------------------------------------------------------------
// Order-management domain types
// ---------------------------------------------------------------------------

export interface OrderItem {
  productId: string;
  name: string;
  unitPrice: number;   // must be >= 0
  quantity: number;    // 1 – 100 inclusive
}

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Order {
  id: string;
  items: OrderItem[];
  promoCode?: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  status: OrderStatus;
  createdAt: Date;
}

export interface CreateOrderRequest {
  items: OrderItem[];
  promoCode?: string;
}

export interface PromoCode {
  code: string;
  discountPercent: number;   // 0 – 100
  expiresAt: Date | null;    // null = never expires
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  total: number;
}
