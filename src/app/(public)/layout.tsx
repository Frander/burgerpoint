import { CartProvider } from "@/components/cart/CartProvider";
import CartBar from "@/components/cart/CartBar";

// Envuelve todas las rutas públicas (portada, menú, detalle de producto) con
// un único carrito, de modo que el estado persista al navegar entre páginas.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      {children}
      <CartBar />
    </CartProvider>
  );
}
