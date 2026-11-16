import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates PNG icons (any, maskable, apple-touch) and favicon.ico from public/icon.svg.
// Run with `npm run icons` after changing the SVG.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0a0a0a' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0a0a0a' } },
  },
  images: ['public/icon.svg'],
});
