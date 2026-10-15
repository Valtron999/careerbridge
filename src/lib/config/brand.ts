// Single place to rebrand the product.
export const brand = {
  name: 'CareerBridge',
  tagline: 'Your next opportunity starts here.',
  description: 'Discover jobs, internships, SIWES placements and career opportunities. Build your CV, apply with confidence, and track every application in one place.',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;
