/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#070c12',
        card: '#0e1622',
        gold: '#d4a72c',
        txt: '#e8edf5',
        muted: '#6e7f99',
      },
    },
  },
  plugins: [],
};
