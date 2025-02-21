/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/liquid-metal-drbaph',
  assetPrefix: '/liquid-metal-drbaph',
  distDir: 'out/liquid-metal-drbaph',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
