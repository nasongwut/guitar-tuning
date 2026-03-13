import withPWAInit from "next-pwa";

const isProd = process.env.NODE_ENV === "production";
const repoName = "guitar-tuning";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: !isProd,
});

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: isProd ? `/${repoName}` : "",
  assetPrefix: isProd ? `/${repoName}/` : "",
  images: {
    unoptimized: true,
  },
  webpack(config) {
    return config;
  },
};

export default withPWA(nextConfig);