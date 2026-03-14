"use client";

import { useEffect, useState } from "react";

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setOpen(true);
      console.log("beforeinstallprompt fired");
    };

    const installedHandler = () => {
      setOpen(false);
      setDeferredPrompt(null);
      console.log("appinstalled fired");
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    console.log("User response:", choice.outcome);

    setDeferredPrompt(null);
    setOpen(false);
  };

  const isIOS =
    typeof window !== "undefined" &&
    /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true);

  if (!open || isStandalone) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">ติดตั้งแอป</h2>
            <p className="mt-2 text-sm text-slate-600">
              เพิ่ม Guitar Tuner ไว้ที่หน้าจอหลัก เพื่อเปิดใช้งานได้เร็วขึ้น
            </p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="rounded-full px-3 py-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {deferredPrompt ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              เบราว์เซอร์นี้รองรับการติดตั้งแล้ว กดปุ่มด้านล่างเพื่อเปิดหน้าต่างติดตั้ง
            </div>

            <button
              onClick={handleInstall}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              📲 ติดตั้งตอนนี้
            </button>
          </div>
        ) : isIOS ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              บน iPhone / iPad ให้เปิดเว็บนี้ด้วย Safari แล้วกด Share จากนั้นเลือก
              Add to Home Screen
            </div>

            <button
              onClick={() => setOpen(false)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ปิด
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              ตอนนี้เบราว์เซอร์ยังไม่ส่งสัญญาณติดตั้งแอปมา อาจเป็นเพราะยังไม่ผ่านเงื่อนไข
              installable หรือเบราว์เซอร์นี้ไม่รองรับ
            </div>

            <button
              onClick={() => setOpen(false)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ปิด
            </button>
          </div>
        )}
      </div>
    </div>
  );
}