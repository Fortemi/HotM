/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
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