"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[PWA] Service Worker registrado:", registration.scope);

          // Si hay un SW esperando para activarse, pedir skipWaiting
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  console.log("[PWA] Nueva versión disponible");
                  // TODO: mostrar toast "Nueva versión disponible"
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("[PWA] Error al registrar Service Worker:", error);
        });
    }
  }, []);

  return null;
}
