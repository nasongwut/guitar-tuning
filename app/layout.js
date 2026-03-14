import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Guitar tuner | ตั้งสายกีต้า",
    template: "%s | Guitar tuner | ตั้งสายกีต้า",
  },
  description:
    "Guitar tuner - ตั้งสายกีต้า ไม่มีโฆษณา ใช้งานฟรี ติดตั้งเป็น PWA ได้",
  keywords: [
    "Guitar tuner",
    "ตั้งสายกีต้า",
    "tuner online",
    "ไม่มีโฆษณา",
    "PWA guitar tuner",
  ],
  manifest: "/guitar-tuning/manifest.json",
};

export const viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950`}
      >
        <Link
          href="/"
          className="fixed left-4 top-4 z-50 rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur active:scale-[0.97]"
        >
          ⬅ Home
        </Link>

        <div className="pt-20">
          {children}
        </div>
      </body>
    </html>
  );
}