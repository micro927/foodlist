import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The rounded icon: favicon.ico and the plain PWA icons. The maskable and Apple icons come from
// pwa-assets.full-bleed.config.ts.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Full-colour PNGs: the default 60%-quality palette bands the blurred gradient into blotches.
    png: { compressionLevel: 9, palette: false },
    maskable: { sizes: [] },
    apple: { sizes: [] },
  },
  images: ['public/favicon.svg'],
})
