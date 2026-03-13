import withPWA from "next-pwa";

const config = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // ปิด PWA ตอน dev เพื่อไม่ให้ cache กวน
  reactStrictMode: true,
  // บังคับใช้ webpack แทน turbopack
  webpack: (config) => {
    return config;
  },
});

export default config;
