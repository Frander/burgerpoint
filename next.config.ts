import type { NextConfig } from "next";

// Permite servir imágenes desde el Storage de Supabase con next/image.
// El host se deriva de NEXT_PUBLIC_SUPABASE_URL (ej. xxxx.supabase.co).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // CDN de OlaClick: fotos de productos del menú de ejemplo (preview).
      {
        protocol: "https" as const,
        hostname: "assets.olaclick.app",
        pathname: "/companies/**",
      },
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
