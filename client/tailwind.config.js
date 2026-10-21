/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Base backgrounds ── */
        bg:      '#060918',
        surface: {
          DEFAULT: '#0a0e24',
          subtle: '#10142e',
          card: '#191d3a',
          2:       '#10142e',
          3:       '#191d3a',
          border:  'rgba(255,255,255,0.06)',
          'border-hi': 'rgba(255,255,255,0.14)',
          'border-bright': 'rgba(255,255,255,0.18)',
        },

        /* ── Primary — Electric Blue (brand accent) ── */
        coral: {
          DEFAULT: '#3861fb',
          hi:      '#818cf8',
          soft:    'rgba(56,97,251,0.12)',
          glow:    'rgba(56,97,251,0.22)',
        },

        /* ── Purple/Indigo (UI accent / interactive elements) ── */
        purple: {
          DEFAULT: '#6366f1',
          hi:      '#a5b4fc',
          soft:    'rgba(99,102,241,0.14)',
          glow:    'rgba(99,102,241,0.26)',
        },

        /* Legacy alias */
        primary: {
          DEFAULT: '#3861fb',
          hi:      '#818cf8',
          soft:    'rgba(56,97,251,0.12)',
          glow:    'rgba(56,97,251,0.22)',
        },

        /* ── Success — Emerald ── */
        success: {
          DEFAULT: '#059669',
          hi:      '#34d399',
          soft:    'rgba(5,150,105,0.14)',
          glow:    'rgba(5,150,105,0.22)',
        },

        /* ── Warning — Amber ── */
        warn: {
          DEFAULT: '#F59E0B',
          hi:      '#FBBF24',
          soft:    'rgba(245,158,11,0.12)',
        },

        /* ── Danger — Red ── */
        danger: {
          DEFAULT: '#EF4444',
          soft:    'rgba(239,68,68,0.10)',
        },

        /* ── Neutral text ── */
        ink: {
          DEFAULT: '#e2e8f0',
          2:       '#94a3b8',
          3:       '#64748b',
        },

        /* ── Legacy aliases ── */
        background:    '#060918',
        'brand-coral': '#3861fb',
        'brand-blue':  '#06b6d4',
        'brand-cyan':  '#67e8f9',
        'brand-purple':'#818cf8',
        'brand-pink':  '#f472b6',
        'signal-yellow': '#fbbf24',
        'signal-green':'#059669',
        'signal-amber':'#f59e0b',
        'signal-red':  '#ef4444',
      },

      fontFamily: {
        display: ['"DM Sans"', 'sans-serif'],
        sans:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
      },

      boxShadow: {
        'glow-coral':  '0 0 24px -4px rgba(56,97,251,0.3)',
        'glow-purple': '0 0 24px -4px rgba(99,102,241,0.3)',
        'glow-violet': '0 0 24px -4px rgba(99,102,241,0.3)',
        'glow-green':  '0 0 20px -5px rgba(16,185,129,0.28)',
        'glow-amber':  '0 0 20px -5px rgba(245,158,11,0.25)',
        'glow-red':    '0 0 20px -5px rgba(239,68,68,0.25)',
      },

      animation: {
        'pulse-subtle':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'scan-line':      'scanline 2s ease-in-out infinite',
        'flash-valid':    'flashValid 0.6s ease-out',
        'flash-duplicate':'flashDuplicate 0.6s ease-out',
        'flash-invalid':  'flashInvalid 0.6s ease-out',
        'scale-in':       'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)',
        'reticle-spin':   'reticleSpin 8s linear infinite',
        'reticle-pulse':  'reticlePulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'float':          'float 6s ease-in-out infinite',
        'slide-up':       'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':        'fadeIn 0.5s ease-out',
        'count-up':       'countUp 0.8s cubic-bezier(0.16,1,0.3,1)',
        'ring-progress':  'ringProgress 1.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'shimmer':        'shimmer 2s linear infinite',
        'glow-pulse':     'glowPulse 3s ease-in-out infinite',
      },

      keyframes: {
        scanline: {
          '0%,100%': { transform:'translateY(-100%)', opacity:'0.2' },
          '50%':     { transform:'translateY(100%)',  opacity:'0.8' },
        },
        flashValid: {
          '0%':   { backgroundColor:'rgba(16,185,129,0.4)' },
          '100%': { backgroundColor:'transparent' },
        },
        flashDuplicate: {
          '0%':   { backgroundColor:'rgba(245,158,11,0.4)' },
          '100%': { backgroundColor:'transparent' },
        },
        flashInvalid: {
          '0%':   { backgroundColor:'rgba(239,68,68,0.4)' },
          '100%': { backgroundColor:'transparent' },
        },
        scaleIn: {
          '0%':   { transform:'scale(0.95)', opacity:'0' },
          '100%': { transform:'scale(1)',    opacity:'1' },
        },
        reticleSpin:  { to: { transform:'rotate(360deg)' } },
        reticlePulse: {
          '0%,100%': { opacity:'0.4', transform:'scale(1)' },
          '50%':     { opacity:'1',   transform:'scale(1.05)' },
        },
        float: {
          '0%,100%': { transform:'translateY(0)' },
          '50%':     { transform:'translateY(-10px)' },
        },
        slideUp: {
          '0%':   { transform:'translateY(14px)', opacity:'0' },
          '100%': { transform:'translateY(0)',    opacity:'1' },
        },
        fadeIn: {
          '0%':   { opacity:'0' },
          '100%': { opacity:'1' },
        },
        countUp: {
          '0%':   { transform:'translateY(8px)', opacity:'0' },
          '100%': { transform:'translateY(0)',   opacity:'1' },
        },
        ringProgress: {
          '0%': { strokeDashoffset:'283' },
        },
        shimmer: {
          '0%':   { transform:'translateX(-100%)' },
          '100%': { transform:'translateX(100%)' },
        },
        glowPulse: {
          '0%,100%': { boxShadow:'0 0 15px -3px rgba(124,58,237,0.15)' },
          '50%':     { boxShadow:'0 0 28px -3px rgba(124,58,237,0.40)' },
        },
      },
    },
  },
  plugins: [],
}
