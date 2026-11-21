import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so dist/ works from any static host or sub-folder (itch.io, GitHub Pages).
  base: './',
  build: {
    assetsInlineLimit: 0, // keep sprites as separate PNG files
    chunkSizeWarningLimit: 1600, // Phaser alone is ~1.2 MB minified
  },
});
