// Single place to rebrand the product.
export const brand = {
  name: 'CareerBridge',
  tagline: 'Your next opportunity starts here.',
  description: 'Find SIWES placements and internships, build a professional CV even with no work experience, and take your first step into the working world.',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;
