/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // Aponta para o public/index.html
    "./src/**/*.{js,ts,jsx,tsx}", // Abrange todos os ficheiros relevantes na pasta src
  ],
  darkMode: 'class', // Para que o nosso tema escuro funcione
  theme: {
    extend: {
      // Pode adicionar as suas personalizações de tema aqui se desejar
    },
  },
  plugins: [
    // Pode adicionar plugins do Tailwind aqui se desejar
  ],
}