import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths: the site is served from /piano_trainer/ on GitHub Pages
  base: './',
  plugins: [react(), tailwindcss()],
})
