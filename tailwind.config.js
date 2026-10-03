/** @type {import('tailwindcss').Config} */

// Dark mode works by flipping the white/slate/violet palette: each shade is a
// CSS variable (defined in css/styles.css) whose light values match Tailwind's
// defaults and whose dark values are swapped in by prefers-color-scheme or
// [data-theme="dark"]. Existing classes like bg-white / text-slate-900 then
// adapt automatically, including ones generated in JS - no dark: variants.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: ["./index.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        white: v('white'),
        // Text on brand-colored (violet/red) buttons - stays white in both modes.
        onbrand: '#ffffff',
        slate: {
          50: v('slate-50'), 100: v('slate-100'), 200: v('slate-200'), 300: v('slate-300'),
          400: v('slate-400'), 500: v('slate-500'), 600: v('slate-600'), 700: v('slate-700'),
          800: v('slate-800'), 900: v('slate-900'),
        },
        violet: {
          50: v('violet-50'), 200: v('violet-200'), 300: v('violet-300'),
          800: v('violet-800'), 900: v('violet-900'), 950: v('violet-950'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
