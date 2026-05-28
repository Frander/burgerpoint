// Tipos del dominio (espejo del esquema en supabase/migrations/0001_init.sql).
// Más adelante se pueden autogenerar con: supabase gen types typescript

export type OrderStatus =
  | "nuevo"
  | "en_cocina"
  | "listo"
  | "entregado"
  | "cancelado";

export type OrderType = "delivery" | "pickup";
export type StaffRole = "admin" | "cajero" | "cocina";
export type InventoryMoveType = "entrada" | "salida";

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  available: boolean;
  track_stock: boolean;
  stock: number;
  sort_order: number;
  created_at: string;
}

export interface Modifier {
  id: string;
  product_id: string;
  name: string;
  extra_price: number;
  created_at: string;
}

export interface Order {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string | null;
  type: OrderType;
  address: string | null;
  status: OrderStatus;
  notes: string | null;
  total: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
}

/** Una categoría con sus productos disponibles (para el storefront). */
export interface MenuCategory extends Category {
  products: Product[];
}
