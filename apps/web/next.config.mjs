/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The API base the server components / actions call. Overridable per environment.
  env: {
    UZA_API_URL: process.env.UZA_API_URL ?? 'http://127.0.0.1:3000',
  },
};

export default nextConfig;
