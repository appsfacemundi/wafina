/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully client-rendered SPA (no Server Components with data fetching, no
  // Route Handlers, no middleware, no next/image, no dynamic routes) — safe
  // to export as static HTML and serve from a CDN/static host instead of a
  // running Node process. Verified via a full production build under this
  // setting before making it permanent.
  output: 'export',
};

module.exports = nextConfig;
