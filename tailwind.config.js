/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // ✅ Esta linha garante que ele olhe TODAS as pastas dentro de 'src'
  ],
  darkMode: 'class', // Habilita o modo escuro baseado na classe 'dark' no HTML
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'], // Adiciona a fonte Inter se você a estiver a usar
      },
    },
  },
  plugins: [],
}
