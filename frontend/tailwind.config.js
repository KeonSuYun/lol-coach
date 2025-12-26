/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LOL 官方海克斯配色
        hex: {
          black: '#010A13',     // 最深的背景
          dark: '#091428',      // 主容器背景 (深蓝)
          blue: '#0AC8B9',      // 魔法发光/强调色 (青色)
          gold: '#C8AA6E',      // 边框/标题金
          'gold-light': '#F0E6D2', // 高亮文字 (羊皮纸白)
          'gold-dim': '#785A28',   // 暗淡的金色
        }
      },
      backgroundImage: {
        'magic-pattern': "url('https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/magic-pattern-sprite.png')",
      },
      boxShadow: {
        'hex': '0 0 15px rgba(10, 200, 185, 0.1)',
        'gold': '0 0 10px rgba(200, 170, 110, 0.2)',
        'gold-glow': '0 0 20px rgba(200, 170, 110, 0.4)',
      },
      fontFamily: {
        // 尝试使用系统自带的类似衬线体，增加史诗感
        serif: ['"Beaufort for LOL"', 'serif'], 
        sans: ['"Spiegel"', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}