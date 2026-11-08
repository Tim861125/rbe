export default defineNuxtConfig({
  compatibilityDate: "2025-07-17",
  nitro: {
    preset: "cloudflare_module",
    cloudflare: { deployConfig: true, nodeCompat: true },
  },
});
