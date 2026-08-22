/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required by the container image: Next traces the server and its real dependencies
  // into .next/standalone instead of needing the whole workspace at runtime.
  output: 'standalone',
  // The API base the server components / actions call. Overridable per environment.
  env: {
    UZA_API_URL: process.env.UZA_API_URL ?? 'http://127.0.0.1:3000',
  },
};

export default nextConfig;
