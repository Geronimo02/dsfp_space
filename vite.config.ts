import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  // Detectamos entorno
  const isVercel = process.env.VERCEL === "1";
  const baseUrl = process.env.BASE_URL || (isVercel ? "/" : "/dsfp_space/");

  // 👇 Mensaje de depuración útil
  console.log("🔧 VITE CONFIG INFO:");
  console.log("MODE:", mode);
  console.log("VERCEL:", process.env.VERCEL);
  console.log("BASE_URL env var:", process.env.BASE_URL);
  console.log("Final base path →", baseUrl);

  return {
    base: baseUrl,
    server: { host: "0.0.0.0", port: 8080 },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
