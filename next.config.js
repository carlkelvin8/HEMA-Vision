const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Pin the workspace root to this project (avoids picking up a parent lockfile)
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
