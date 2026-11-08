export default defineNuxtConfig({
  compatibilityDate: "2025-07-17",
  nitro: {
    preset: "cloudflare_module",
    cloudflare: { deployConfig: true, nodeCompat: true },
  },
  modules: ["@nuxtjs/tailwindcss", "@nuxtjs/color-mode", "shadcn-nuxt"],
  colorMode: { classSuffix: "" },
  css: ["~/assets/css/tailwind.css"],
  shadcn: {
    /**
     * Prefix for all the imported component.
     * @default "Ui"
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * Will respect the Nuxt aliases.
     * @link https://nuxt.com/docs/api/nuxt-config#alias
     * @default "@/components/ui"
     */
    componentDir: "@/components/ui",
  },
});
