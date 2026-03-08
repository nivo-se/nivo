
import type { Config } from "tailwindcss";

export default {
        darkMode: "class",
        content: [
                "./pages/**/*.{ts,tsx}",
                "./components/**/*.{ts,tsx}",
                "./app/**/*.{ts,tsx}",
                "./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
                        fontFamily: {
                                heading: ['var(--font-zapf)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial'],
                                sans: ['var(--font-poppins)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial'],
                        },
			colors: {
                                transparent: 'transparent',
                                current: 'currentColor',
                                jetBlack: 'hsl(var(--foreground))',
                                platinum: 'hsl(var(--muted))',
                                border: 'hsl(var(--border))',
                                input: 'hsl(var(--input))',
                                ring: 'hsl(var(--ring))',
                                background: 'hsl(var(--background))',
                                foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				brand: {
					DEFAULT: 'hsl(var(--brand))',
					foreground: 'hsl(var(--brand-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'var(--sidebar-bg)',
					foreground: 'var(--sidebar-fg)',
					border: 'var(--sidebar-border)',
					muted: 'var(--sidebar-muted)',
					accent: 'var(--sidebar-hover-bg)',
					'accent-foreground': 'var(--sidebar-fg)',
					primary: 'var(--sidebar-active-bg)',
					'primary-foreground': 'var(--sidebar-active-fg)',
					ring: 'hsl(var(--ring))',
					bg: 'var(--sidebar-bg)',
					fg: 'var(--sidebar-fg)',
					'active-bg': 'var(--sidebar-active-bg)',
					'active-fg': 'var(--sidebar-active-fg)',
					'hover-bg': 'var(--sidebar-hover-bg)',
				},
				chart: {
					1: 'hsl(var(--chart-1))',
					2: 'hsl(var(--chart-2))',
					3: 'hsl(var(--chart-3))',
				},
				deck: {
					DEFAULT: 'hsl(var(--deck-accent))',
					accent: 'hsl(var(--deck-accent))',
					'accent-hover': 'hsl(var(--deck-accent-hover))',
					'accent-foreground': 'hsl(var(--deck-accent-foreground))',
					fg: 'hsl(var(--deck-fg))',
					'fg-foreground': 'hsl(var(--deck-fg-foreground))',
					bg: 'hsl(var(--deck-bg))',
					surface: 'hsl(var(--deck-surface))',
					'quote-foreground': 'hsl(var(--deck-quote-foreground))',
					border: 'hsl(var(--deck-border))',
					'accent-border': 'hsl(var(--deck-accent-border))',
				},
				orangery: {
					50: 'hsl(var(--muted))',
					100: 'hsl(var(--muted))',
					200: 'hsl(var(--border))',
					300: 'hsl(var(--border))',
					400: 'hsl(var(--muted-foreground))',
					500: 'hsl(var(--muted-foreground))',
					600: 'hsl(var(--foreground))',
					700: 'hsl(var(--foreground))',
					800: 'hsl(var(--foreground))',
					900: 'hsl(var(--foreground))',
				},
				inv2: {
					olive: 'hsl(var(--inv2-olive))',
					'olive-muted': 'hsl(var(--inv2-olive-muted))',
					sage: 'hsl(var(--inv2-sage))',
					'sage-muted': 'hsl(var(--inv2-sage-muted))',
					fg: 'hsl(var(--inv2-fg))',
					'fg-muted': 'hsl(var(--inv2-fg-muted))',
					divider: 'hsl(var(--inv2-divider))',
					'bg-subtle': 'hsl(var(--inv2-bg-subtle))',
				},
				/* Design profile: Nivo palette — use with data-design-profile="nivo" */
				profile: {
					accent: 'hsl(var(--profile-accent))',
					'accent-secondary': 'hsl(var(--profile-accent-secondary))',
					'accent-muted': 'hsl(var(--profile-accent-muted))',
					'sage-muted': 'hsl(var(--profile-sage-muted))',
					fg: 'hsl(var(--profile-fg))',
					'fg-muted': 'hsl(var(--profile-fg-muted))',
					divider: 'hsl(var(--profile-divider))',
					'bg-subtle': 'hsl(var(--profile-bg-subtle))',
					'bg-surface': 'hsl(var(--profile-bg-surface))',
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				"background-gradient": {
					"0%, 100%": {
						transform: "translate(0, 0)",
					},
					"20%": {
						transform:
							"translate(calc(100% * var(--tx-1, 1)), calc(100% * var(--ty-1, 1)))",
					},
					"40%": {
						transform:
							"translate(calc(100% * var(--tx-2, -1)), calc(100% * var(--ty-2, 1)))",
					},
					"60%": {
						transform:
							"translate(calc(100% * var(--tx-3, 1)), calc(100% * var(--ty-3, -1)))",
					},
					"80%": {
						transform:
							"translate(calc(100% * var(--tx-4, -1)), calc(100% * var(--ty-4, -1)))",
					},
				},
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fade-in-up': {
					'0%': {
						opacity: '0',
						transform: 'translateY(20px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fade-in-down': {
					'0%': {
						opacity: '0',
						transform: 'translateY(-20px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'text-reveal': {
					'0%': {
						transform: 'translateY(100%)',
						opacity: '0'
					},
					'100%': {
						transform: 'translateY(0)',
						opacity: '1'
					}
				},
				aurora: {
					from: {
						backgroundPosition: "50% 50%, 50% 50%",
					},
					to: {
						backgroundPosition: "350% 50%, 350% 50%",
					},
				},
				appear: {
					"0%": { opacity: "0", transform: "translateY(10px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
				"appear-zoom": {
					"0%": { opacity: "0", transform: "scale(0.95)" },
					"100%": { opacity: "1", transform: "scale(1)" },
				},
			},
			animation: {
				aurora: "aurora 60s linear infinite",
				"background-gradient":
					"background-gradient var(--background-gradient-speed, 15s) cubic-bezier(0.445, 0.05, 0.55, 0.95) infinite",
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.5s ease-out forwards',
				'fade-in-up': 'fade-in-up 0.7s ease-out forwards',
				'fade-in-down': 'fade-in-down 0.7s ease-out forwards',
				'text-reveal': 'text-reveal 0.7s ease-out forwards',
				appear: "appear 0.5s ease-out forwards",
				"appear-zoom": "appear-zoom 0.5s ease-out forwards",
			},
			animationDelay: {
				"100": "100ms",
				"300": "300ms",
				"700": "700ms",
				"1000": "1000ms",
			},
		}
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
