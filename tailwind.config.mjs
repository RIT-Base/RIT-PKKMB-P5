/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        p5: {
          red: '#E60012',
          black: '#0A0A0D',
          dark: '#141416',
          white: '#FFFFFF',
          gray: '#8C8C8C',
          lightgray: '#D1D5DB',
        },
      },
      fontFamily: {
        p5: ['P5Hatty', 'Impact', 'sans-serif'],
        sans: ['PT Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
