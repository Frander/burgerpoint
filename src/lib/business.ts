// Datos del negocio usados en tickets y páginas públicas.

export const BUSINESS = {
  name: process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Burguer Point",
  address: "México 188 246, Ticul, 97864 Ticul, Yuc., México",
  /** URL pública del sitio (para el QR del ticket). */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  reviewsUrl:
    "https://search.google.com/local/reviews?placeid=ChIJnXY2cpdTVo8Rcp3_7ONQUE4",
  logoPath: "/logo.jpg",
} as const;
