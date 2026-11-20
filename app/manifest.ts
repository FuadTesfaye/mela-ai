import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MELA AI — accessible learning",
    short_name: "MELA",
    description:
      "Download public lessons and learn with a localised course assistant.",
    start_url: "/offline.html",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7f3",
    theme_color: "#103c4b",
    icons: [
      { src: "/icons/mela-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/mela-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/mela-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
