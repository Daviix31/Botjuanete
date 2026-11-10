import type { NextConfig } from "next";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: process.env.ENV_FILE ?? fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});
const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default config;
