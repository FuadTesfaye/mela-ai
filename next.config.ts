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
        "/course-media.js",
        "/savanna-integration.js",
        "/avatar-view.js",
        "/avatar/:path*",
        "/content.json",
        "/openapi.yaml",
        "/mela-sdk.js",
        "/locale.js",
        "/voice.js",
        "/spelling.js",
        "/i18n/:path*",
        "/fonts/:path*",
        "/sdk/:path*",
        "/transcripts/:path*",
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
