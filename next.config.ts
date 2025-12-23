import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
      {
        protocol: "https",
        hostname: "img.omdbapi.com",
      },
      {
        protocol: "https",
        hostname: "ia.media-imdb.com",
      },
    ],
  },
};

export default nextConfig;
