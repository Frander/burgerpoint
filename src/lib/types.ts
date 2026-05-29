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
  /** Transitorio: indica si el producto tiene grupos de opciones (storefront). */
  has_modifiers?: boolean;
}

export interface Modifier {
  id: string;
  group_id: string | null;
  product_id: string;
  name: string;
  extra_price: number;
  sort_order: number;
  created_at: string;
}

export interface ModifierGroup {
  id: string;
  product_id: string;
  name: string;
  /** Mínimo de opciones a elegir; >= 1 lo hace obligatorio. */
  min_select: number;
  /** Máximo de opciones; 1 = elección única (radio), >1 = múltiple. */
  max_select: number;
  sort_order: number;
  created_at: string;
}

/** Un grupo con sus opciones (para el detalle de producto y el admin). */
export interface ModifierGroupWithOptions extends ModifierGroup {
  modifiers: Modifier[];
}

/** Un producto con sus grupos de opciones (para el detalle del storefront). */
export interface ProductWithModifiers extends Product {
  modifier_groups: ModifierGroupWithOptions[];
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

/** Un pedido con sus líneas (para el panel y la cocina). */
export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}
