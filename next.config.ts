import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite verificar builds en un directorio aislado cuando OneDrive mantiene
  // bloqueado `.next`; en producción conserva el valor por defecto.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Para probar desde el celular en la misma red con `next dev`.
  devIndicators: false,
  allowedDevOrigins: process.env.NEXT_DEV_ORIGINS?.split(",") ?? [],
};

export default nextConfig;
