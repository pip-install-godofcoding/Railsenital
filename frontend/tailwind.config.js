/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        rail: {
          bg:          '#040b14',
          panel:       '#091524',
          panelHover:  '#0d1e33',
          border:      '#1a3655',
          borderHover: '#254b75',
          text:        '#e2f1ff',
          textMuted:   '#8da9c4',
          accent:      '#00f2fe',
          accentDim:   '#00b8c8',
          warning:     '#ffb800',
          danger:      '#ff4d4f',
          success:     '#00e676',
        },
        // legacy aliases kept so old components still compile
        railDark:   '#040b14',
        railPanel:  '#091524',
        railRed:    '#ff4d4f',
        railGreen:  '#00e676',
        railYellow: '#ffb800',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel:        '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
        'panel-hover':'0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,170,0.15)',
        accent:       '0 0 0 1px rgba(0,242,254,0.25), 0 4px 24px rgba(0,0,0,0.6)',
      },
      animation: {
        'ping-slow': 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
      },
    },
  },
  plugins: [],
}
