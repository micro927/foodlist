import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The maskable and Apple icons, where the phone cuts its own shape. Full-bleed with the torii inside the maskable
// safe zone, so no padding: padding or rounded corners show as a frame inside the launcher's shape.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Full-colour PNGs: the default 60%-quality palette bands the blurred gradient into blotches.
    png: { compressionLevel: 9, palette: false },
    transparent: { sizes: [], favicons: [] },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon-full-bleed.svg'],
})
