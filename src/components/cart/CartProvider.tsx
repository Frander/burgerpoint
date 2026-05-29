"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { Product } from "@/lib/types";

/** Una opción elegida para una línea del carrito. */
export interface CartModifier {
  id?: string;
  name: string;
  extra_price: number;
  group_name?: string;
}

export interface CartItem {
  /** Clave única de la línea (mismo producto con distintas opciones = líneas distintas). */
  lineId: string;
  productId: string;
  name: string;
  basePrice: number;
  /** Precio unitario = base + suma de extras. */
  unitPrice: number;
  quantity: number;
  modifiers: CartModifier[];
  notes?: string;
}

/** Datos para agregar una línea (lo que produce el detalle de producto). */
export interface AddLineInput {
  productId: string;
  name: string;
  basePrice: number;
  quantity?: number;
  modifiers?: CartModifier[];
  notes?: string;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "addLine"; input: AddLineInput }
  | { type: "increment"; lineId: string }
  | { type: "decrement"; lineId: string }
  | { type: "remove"; lineId: string }
  | { type: "clear" }
  | { type: "hydrate"; items: CartItem[] };

const STORAGE_KEY = "bp_cart";

/** Identidad de una línea: producto + opciones (ordenadas) + notas. */
function lineKey(input: AddLineInput): string {
  const mods = (input.modifiers ?? [])
    .map((m) => m.id ?? m.name)
    .sort()
    .join("|");
  const notes = input.notes?.trim() ?? "";
  if (!mods && !notes) return input.productId;
  return `${input.productId}::${mods}::${notes}`;
}

function buildItem(input: AddLineInput): CartItem {
  const modifiers = input.modifiers ?? [];
  const extras = modifiers.reduce((sum, m) => sum + m.extra_price, 0);
  return {
    lineId: lineKey(input),
    productId: input.productId,
    name: input.name,
    basePrice: input.basePrice,
    unitPrice: input.basePrice + extras,
    quantity: input.quantity ?? 1,
    modifiers,
    notes: input.notes?.trim() || undefined,
  };
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return { items: action.items };
    case "addLine": {
      const item = buildItem(action.input);
      const existing = state.items.find((i) => i.lineId === item.lineId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.lineId === item.lineId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          ),
        };
      }
      return { items: [...state.items, item] };
    }
    case "increment":
      return {
        items: state.items.map((i) =>
          i.lineId === action.lineId ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      };
    case "decrement":
      return {
        items: state.items
          .map((i) =>
            i.lineId === action.lineId ? { ...i, quantity: i.quantity - 1 } : i,
          )
          .filter((i) => i.quantity > 0),
      };
    case "remove":
      return { items: state.items.filter((i) => i.lineId !== action.lineId) };
    case "clear":
      return { items: [] };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  /** Agrega una línea configurada (con o sin opciones). */
  addLine: (input: AddLineInput) => void;
  /** Atajo para productos simples sin opciones. */
  addProduct: (product: Product) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  remove: (lineId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [hydrated, setHydrated] = useState(false);

  // Cargar del localStorage al montar.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        dispatch({ type: "hydrate", items: JSON.parse(raw) as CartItem[] });
      }
    } catch {
      // localStorage no disponible o JSON inválido: empezamos vacío.
    }
    setHydrated(true);
  }, []);

  // Guardar en localStorage cuando cambia (tras hidratar).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Ignorar errores de cuota/privacidad.
    }
  }, [state.items, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = state.items.reduce((n, i) => n + i.quantity, 0);
    const total = state.items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0,
    );
    return {
      items: state.items,
      itemCount,
      total,
      addLine: (input) => dispatch({ type: "addLine", input }),
      addProduct: (product) =>
        dispatch({
          type: "addLine",
          input: {
            productId: product.id,
            name: product.name,
            basePrice: product.price,
          },
        }),
      increment: (lineId) => dispatch({ type: "increment", lineId }),
      decrement: (lineId) => dispatch({ type: "decrement", lineId }),
      remove: (lineId) => dispatch({ type: "remove", lineId }),
      clear: () => dispatch({ type: "clear" }),
    };
  }, [state.items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
