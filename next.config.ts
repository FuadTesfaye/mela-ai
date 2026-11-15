import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { useTypeScriptCli: false },
  turbopack: { root: process.cwd() },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      ...[
        "/db-assistant.js",
        "/avatar-view.js",
        "/content.json",
        "/openapi.yaml",
      ].map((source) => ({
        source,
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      })),
    ];
  },
};
export default config;
