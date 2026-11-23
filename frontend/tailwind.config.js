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
        // Theme tokens from reference screenshots
        cream: {
          bg: '#F5F0EA',
          surface: '#FFFDFC',
          border: '#EAE3D9',
          muted: '#8A827B',
          text: '#1D1919'
        },
        charcoal: {
          bg: '#151217',
          surface: '#201B20',
          border: '#2E2730',
          muted: '#9F95A3',
          text: '#F6F0EB'
        },
        coral: {
          DEFAULT: '#FF513C',
          hover: '#E84532',
          subtle: '#FFF1EF',
          darkSubtle: '#331B19'
        },
        amberAccent: {
          DEFAULT: '#F47742',
          hover: '#DD6430'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Playfair Display', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}

