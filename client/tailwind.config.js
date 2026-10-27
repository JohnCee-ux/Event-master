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
        bg:      'var(--c-bg)',
        surface: {
          DEFAULT: 'var(--c-surface)',
          subtle: 'var(--c-surface-2)',
          card: 'var(--c-surface-3)',
          2:       'var(--c-surface-2)',
          3:       'var(--c-surface-3)',
          border:  'var(--c-border)',
          'border-hi': 'var(--c-border-hi)',
          'border-bright': 'var(--c-border-hi)',
        },

        /* ── Primary — shared Purple/Indigo brand ── */
        coral: {
          DEFAULT: 'var(--c-coral)',
          hi:      'var(--c-coral-hi)',
          soft:    'var(--c-coral-soft)',
          glow:    'var(--c-coral-glow)',
        },

        /* ── Purple/Indigo (UI accent / interactive elements) ── */
        purple: {
          DEFAULT: 'var(--c-purple)',
          hi:      'var(--c-purple-hi)',
          soft:    'var(--c-purple-soft)',
          glow:    'var(--c-purple-glow)',
        },

        /* Legacy alias */
        primary: {
          DEFAULT: 'var(--c-coral)',
          hi:      'var(--c-coral-hi)',
          soft:    'var(--c-coral-soft)',
          glow:    'var(--c-coral-glow)',
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
          DEFAULT: 'var(--c-text)',
          2:       'var(--c-text-2)',
          3:       'var(--c-text-3)',
        },

        /* ── Legacy aliases ── */
        background:    'var(--c-bg)',
        'brand-coral': 'var(--c-coral)',
        'brand-blue':  'var(--c-coral)',
        'brand-cyan':  'var(--c-purple-hi)',
        'brand-purple':'var(--c-purple-hi)',
        'brand-pink':  'var(--c-purple-hi)',
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
        'glow-coral':  '0 0 24px -4px rgba(124,58,237,0.3)',
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
