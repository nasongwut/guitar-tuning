"use client";

import { useEffect, useState } from "react";

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert("อุปกรณ์นี้ยังไม่รองรับการติดตั้ง");
      return;
    }

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button
      onClick={handleInstall}
      className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 shadow active:scale-[0.98]"
    >
      ติดตั้งแอป
    </button>
  );
}