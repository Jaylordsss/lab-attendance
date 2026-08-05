import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest by Next's metadata route.
 *
 * `display: standalone` is what makes the installed app open without browser
 * chrome — which matters here because the scan screen is a camera viewfinder,
 * and an address bar over it costs vertical space students need.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "General Science Laboratory Attendance",
    short_name: "Lab Attendance",
    description:
      "Scan the laboratory code to record your attendance.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBFAF7",
    theme_color: "#16202B",
    lang: "en-PH",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Scan to check in",
        short_name: "Scan",
        url: "/student",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
