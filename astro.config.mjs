import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://ismaelmartinez.github.io",
  base: "/votescot/",
  redirects: {
    "/candidates/region/central-scotland": "/votescot/candidates/region/central-scotland-and-lothians-west",
    "/candidates/region/edinburgh-and-lothians-west": "/votescot/candidates/region/central-scotland-and-lothians-west",
    "/quiz/regional": "/votescot/quiz",
  },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
