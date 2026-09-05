// Tipos del dominio (espejo del esquema en supabase/migrations/0001_init.sql).
// Más adelante se pueden autogenerar con: supabase gen types typescript

export type OrderStatus =
  | "nuevo"
  | "en_cocina"
  | "listo"
  | "entregado"
  | "cancelado";

export type OrderType = "delivery" | "pickup" | "en_local" | "en_mesa";
export type OrderOrigin = "web" | "pdv" | "whatsapp";
export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";
export type PaymentStatus = "no_pagado" | "pagado";
export type StaffRole = "admin" | "cajero" | "cocina" | "repartidor";
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
  /**
   * Transitorio: el producto se muestra pero no se puede pedir, sea porque el
   * staff lo marcó como no disponible o porque se quedó sin existencias.
   */
  sold_out?: boolean;
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

export interface Sala {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Mesa {
  id: string;
  sala_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

/** Una sala con sus mesas (para el PDV). */
export interface SalaWithMesas extends Sala {
  mesas: Mesa[];
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
  origin: OrderOrigin;
  payment_status: PaymentStatus;
  /** Costo de envío incluido en `total` (solo domicilio). */
  delivery_fee: number;
  mesa_id: string | null;
  /** Nombre de quien tomó el pedido en el PDV. */
  served_by: string | null;
  closed_at: string | null;
  /** Repartidor asignado (solo domicilio); ver 0011_repartidor.sql. */
  courier_id: string | null;
  assigned_at: string | null;
}

/** Repartidor disponible para asignar (lo que el PDV necesita mostrar). */
export interface Courier {
  id: string;
  name: string;
}

export interface OrderPayment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  /** Efectivo recibido (para el cambio); null en tarjeta/transferencia. */
  received: number | null;
  created_by: string | null;
  created_at: string;
  cash_session_id?: string | null;
}

export type CashMovementType = "ingreso" | "gasto";

export interface CashSession {
  id: string;
  opened_at: string;
  opened_by: string | null;
  opening_amount: number;
  closed_at: string | null;
  closed_by: string | null;
  /** Efectivo contado al cerrar (arqueo). */
  closing_amount: number | null;
  /** Efectivo esperado según el sistema al cerrar. */
  expected_amount: number | null;
  notes: string | null;
}

export interface CashMovement {
  id: string;
  session_id: string;
  type: CashMovementType;
  category: string | null;
  method: PaymentMethod;
  amount: number;
  notes: string | null;
  created_by: string | null;
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
  /** Presente cuando la consulta trae las opciones de la línea. */
  order_item_modifiers?: OrderItemModifier[];
}

export interface OrderItemModifier {
  id: string;
  order_item_id: string;
  modifier_name: string;
  extra_price: number;
  group_name: string | null;
}

/** Una categoría con sus productos disponibles (para el storefront). */
export interface MenuCategory extends Category {
  products: Product[];
}

/** Un pedido con sus líneas (para el panel y la cocina). */
export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

/** Un pedido con líneas y pagos (para el PDV). */
export interface OrderFull extends OrderWithItems {
  order_payments: OrderPayment[];
}

// ---------- WhatsApp (bitácora del bot, ver supabase/migrations/0008) ----------

export interface WaContact {
  phone: string;
  name: string | null;
  last_inbound_at: string | null;
  opted_out: boolean;
  created_at: string;
}

export interface WaMessage {
  id: string;
  direction: "in" | "out";
  phone: string;
  wamid: string | null;
  kind: string | null;
  template_name: string | null;
  dedupe_tag: string | null;
  body: string | null;
  order_id: string | null;
  status: string | null;
  error: string | null;
  created_at: string;
}
