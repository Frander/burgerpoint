import type { MenuCategory, ModifierGroupWithOptions } from "@/lib/types";

/**
 * Menú de ejemplo para previsualizar el storefront antes de conectar Supabase.
 * Refleja supabase/seed.sql. Los IDs son fijos para que el carrito funcione.
 */
export const SAMPLE_MENU: MenuCategory[] = [
  {
    id: "cat-burgers",
    name: "Hamburguesas",
    sort_order: 1,
    active: true,
    created_at: "",
    products: [
      {
        id: "prod-clasica",
        category_id: "cat-burgers",
        name: "Hamburguesa Clásica",
        description: "Carne de res, lechuga, tomate, queso",
        price: 75,
        image_url: null,
        available: true,
        track_stock: false,
        stock: 0,
        sort_order: 1,
        created_at: "",
      },
      {
        id: "prod-doble",
        category_id: "cat-burgers",
        name: "Hamburguesa Doble",
        description: "Doble carne, doble queso, tocino",
        price: 110,
        image_url: null,
        available: true,
        track_stock: false,
        stock: 0,
        sort_order: 2,
        created_at: "",
      },
    ],
  },
  {
    id: "cat-hotdogs",
    name: "Hot Dogs",
    sort_order: 2,
    active: true,
    created_at: "",
    products: [
      {
        id: "prod-hd-sencillo",
        category_id: "cat-hotdogs",
        name: "Hot Dog Sencillo",
        description: "Salchicha, mostaza, catsup",
        price: 45,
        image_url: null,
        available: true,
        track_stock: false,
        stock: 0,
        sort_order: 1,
        created_at: "",
      },
      {
        id: "prod-hd-especial",
        category_id: "cat-hotdogs",
        name: "Hot Dog Especial",
        description: "Salchicha, tocino, queso, jalapeños",
        price: 65,
        image_url: null,
        available: true,
        track_stock: false,
        stock: 0,
        sort_order: 2,
        created_at: "",
      },
    ],
  },
  {
    id: "cat-bebidas",
    name: "Bebidas",
    sort_order: 3,
    active: true,
    created_at: "",
    products: [
      {
        id: "prod-refresco",
        category_id: "cat-bebidas",
        name: "Refresco 600ml",
        description: "Coca-Cola, Sprite o Fanta",
        price: 25,
        image_url: null,
        available: true,
        track_stock: false,
        stock: 0,
        sort_order: 1,
        created_at: "",
      },
      {
        id: "prod-agua",
        category_id: "cat-bebidas",
        name: "Agua embotellada",
        description: "600ml",
        price: 18,
        image_url: null,
        available: true,
        track_stock: false,
        stock: 0,
        sort_order: 2,
        created_at: "",
      },
    ],
  },
];

/**
 * Grupos de opciones de ejemplo (modo preview), indexados por id de producto.
 * Refleja la estructura de modifier_groups + modifiers de la base real.
 */
export const SAMPLE_MODIFIER_GROUPS: Record<
  string,
  ModifierGroupWithOptions[]
> = {
  "prod-doble": [
    {
      id: "g-sin",
      product_id: "prod-doble",
      name: "Sin",
      min_select: 0,
      max_select: 5,
      sort_order: 1,
      created_at: "",
      modifiers: [
        { id: "m-sin-cebolla", group_id: "g-sin", product_id: "prod-doble", name: "Sin cebolla", extra_price: 0, sort_order: 1, created_at: "" },
        { id: "m-sin-tomate", group_id: "g-sin", product_id: "prod-doble", name: "Sin tomate", extra_price: 0, sort_order: 2, created_at: "" },
        { id: "m-sin-lechuga", group_id: "g-sin", product_id: "prod-doble", name: "Sin lechuga", extra_price: 0, sort_order: 3, created_at: "" },
      ],
    },
    {
      id: "g-extra",
      product_id: "prod-doble",
      name: "Agrégale",
      min_select: 0,
      max_select: 3,
      sort_order: 2,
      created_at: "",
      modifiers: [
        { id: "m-tocino", group_id: "g-extra", product_id: "prod-doble", name: "Tocino", extra_price: 15, sort_order: 1, created_at: "" },
        { id: "m-queso", group_id: "g-extra", product_id: "prod-doble", name: "Queso extra", extra_price: 10, sort_order: 2, created_at: "" },
        { id: "m-huevo", group_id: "g-extra", product_id: "prod-doble", name: "Huevo", extra_price: 10, sort_order: 3, created_at: "" },
      ],
    },
  ],
};
