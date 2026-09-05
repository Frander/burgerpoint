import type { StaffRole } from "@/lib/types";

/**
 * Secciones del panel. Una sección = una entrada del menú lateral + las
 * acciones de servidor que le pertenecen.
 */
export type AdminSection =
  | "inicio"
  | "pdv"
  | "pedidos"
  | "cocina"
  | "whatsapp"
  | "menu"
  | "mesas"
  | "inventario"
  | "caja"
  | "reportes"
  | "entregas";

export const SECTIONS: {
  id: AdminSection;
  href: string;
  label: string;
  desc: string;
  /** No sale en el menú lateral del panel (tiene su propia pantalla). */
  hidden?: boolean;
}[] = [
  { id: "inicio", href: "/admin", label: "Inicio", desc: "Resumen del panel" },
  { id: "pdv", href: "/admin/pdv", label: "PDV", desc: "Tomar pedidos y cobrar" },
  { id: "pedidos", href: "/admin/pedidos", label: "Pedidos", desc: "Historial y estados" },
  { id: "cocina", href: "/admin/cocina", label: "Cocina", desc: "Pantalla en tiempo real" },
  { id: "whatsapp", href: "/admin/whatsapp", label: "WhatsApp", desc: "Conversaciones del bot" },
  { id: "menu", href: "/admin/menu", label: "Menú", desc: "Categorías y productos" },
  { id: "mesas", href: "/admin/mesas", label: "Mesas", desc: "Salas y mesas" },
  { id: "inventario", href: "/admin/inventario", label: "Inventario", desc: "Control de stock" },
  { id: "caja", href: "/admin/caja", label: "Caja", desc: "Apertura, arqueo y cierre" },
  { id: "reportes", href: "/admin/reportes", label: "Reportes", desc: "Ventas y productos top" },
  {
    id: "entregas",
    href: "/repartidor",
    label: "Mis entregas",
    desc: "Pedidos asignados al repartidor",
    hidden: true,
  },
];

/**
 * Qué ve cada rol. **Este es el único lugar que hay que tocar** para dar o
 * quitar accesos.
 *
 * - `admin`: todo.
 * - `cajero`: su trabajo es levantar pedidos, cobrarlos y cuadrar el turno.
 *   No ve reportes, ni edita el menú, ni toca el inventario.
 * - `cocina`: solo el KDS. No ve dinero ni catálogo.
 * - `repartidor`: solo su pantalla de entregas, y ahí solo los pedidos que
 *   trae él (la restricción real está en las políticas RLS de 0011).
 */
export const ROLE_SECTIONS: Record<StaffRole, AdminSection[]> = {
  admin: SECTIONS.map((s) => s.id),
  cajero: ["pdv", "pedidos", "caja"],
  cocina: ["cocina"],
  repartidor: ["entregas"],
};

/** Página a la que aterriza cada rol al entrar o al pedir algo que no le toca. */
export function homeFor(role: StaffRole): string {
  const first = ROLE_SECTIONS[role][0] ?? "inicio";
  return SECTIONS.find((s) => s.id === first)?.href ?? "/admin";
}

export function canAccess(role: StaffRole, sections: AdminSection[]): boolean {
  const allowed = ROLE_SECTIONS[role] ?? [];
  return sections.some((s) => allowed.includes(s));
}

/** Entradas del menú lateral que le corresponden al rol, en orden. */
export function navFor(role: StaffRole) {
  return SECTIONS.filter(
    (s) => !s.hidden && ROLE_SECTIONS[role]?.includes(s.id),
  );
}
