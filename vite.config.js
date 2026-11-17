/**
 * vite.config.js — configuração do Vite
 *
 *  npm run dev      → servidor de desenvolvimento (http://localhost:5173).
 *  npm run build    → dist/: versão do site publicado.
 *  npm run preview  → testa a dist/ (http://localhost:4173).
 *
 * A abertura usa o modelo 3D "Honda Civic Type R (EK9) - Low Poly & Stylized", de marksform
 * (Sketchfab), licença CC BY 4.0 (crédito no rodapé e no README).
 */
import { defineConfig } from 'vite';

export default defineConfig({
  // './' = caminhos relativos: o build funciona em qualquer pasta ou endereço
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true, // apaga o build anterior antes de gerar o novo
    chunkSizeWarningLimit: 1500, // o Three.js é grande, mas só carrega na abertura (import dinâmico)
  },
});
