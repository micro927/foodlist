import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Pad the full-bleed icons with the icon's own vermilion so they don't get a white frame.
const background = '#E0452B'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.3, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background } },
  },
  images: ['public/favicon.svg'],
})
