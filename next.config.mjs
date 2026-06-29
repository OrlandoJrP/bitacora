/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output produces a minimal server bundle for the Docker image.
  // Se puede desactivar en local (Windows no permite symlinks sin permisos):
  //   NEXT_DISABLE_STANDALONE=1 pnpm build
  output: process.env.NEXT_DISABLE_STANDALONE === "1" ? undefined : "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Server Actions are used heavily; bump the body limit for XLSX imports.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  // @react-pdf/renderer and xlsx are server-only heavy deps.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
