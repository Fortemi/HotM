/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'inherit',
            a: {
              color: 'var(--primary)',
              '&:hover': {
                color: 'var(--primary)',
              },
            },
            'h1, h2, h3, h4, h5, h6': {
              color: 'inherit',
              fontWeight: '600',
            },
            strong: {
              color: 'inherit',
              fontWeight: '600',
            },
            code: {
              color: 'inherit',
              backgroundColor: 'var(--muted)',
              borderRadius: '0.25rem',
              padding: '0.125rem 0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: 'var(--muted)',
              color: 'inherit',
            },
            blockquote: {
              borderLeftColor: 'var(--primary)',
              color: 'inherit',
              fontStyle: 'italic',
            },
            hr: {
              borderColor: 'var(--border)',
            },
            'ul > li::marker': {
              color: 'var(--muted-foreground)',
            },
            'ol > li::marker': {
              color: 'var(--muted-foreground)',
            },
            'ul > li': {
              paddingLeft: '1.5em',
            },
            'ol > li': {
              paddingLeft: '1.5em',
            },
            p: {
              marginTop: '1em',
              marginBottom: '1em',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}