import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite verificar builds en un directorio aislado cuando OneDrive mantiene
  // bloqueado `.next`; en producción conserva el valor por defecto.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
