/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm Editorial Light Theme
        cream: {
          bg: '#F6F1EA',
          surface: '#FFFDF9',
          subtle: '#EDE5DA',
          border: '#E5DACD',
          muted: '#746A61',
          text: '#1C1817',
        },
        // Warm Deep Charcoal Dark Theme
        charcoal: {
          bg: '#151217',
          surface: '#1F1A21',
          subtle: '#28222B',
          border: '#332B36',
          muted: '#A499AA',
          text: '#F6F0EB',
        },
        // Signature Coral-Red & Warm Amber accents
        coral: {
          DEFAULT: '#FF513C',
          hover: '#E6422E',
          light: '#FF6B58',
          subtle: '#FFF1EF',
        },
        amberAccent: {
          DEFAULT: '#F47742',
          hover: '#DE6531',
        },
        statusSuccess: '#16A34A',
        statusError: '#DC2626',
        statusWarning: '#EA580C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
