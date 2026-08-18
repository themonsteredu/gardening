"use client";

import { useCallback, useSyncExternalStore } from "react";

type BrowserStorageKind = "local" | "session";
const INTERNAL_STORAGE_EVENT = "gardening:storage";

function getStorage(kind: BrowserStorageKind): Storage {
  return kind === "local" ? window.localStorage : window.sessionStorage;
}

export function useBrowserStorageValue(
  kind: BrowserStorageKind,
  key: string,
): string | null {
  const subscribe = useCallback(
    (notify: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) notify();
      };
      const onInternalStorage = (event: Event) => {
        const detail = (event as CustomEvent<{ key: string }>).detail;
        if (detail?.key === key) notify();
      };

      window.addEventListener("storage", onStorage);
      window.addEventListener(INTERNAL_STORAGE_EVENT, onInternalStorage);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(INTERNAL_STORAGE_EVENT, onInternalStorage);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(() => getStorage(kind).getItem(key), [kind, key]);
  const getServerSnapshot = useCallback(() => null, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function writeBrowserStorage(
  kind: BrowserStorageKind,
  key: string,
  value: string,
): void {
  getStorage(kind).setItem(key, value);
  window.dispatchEvent(
    new CustomEvent(INTERNAL_STORAGE_EVENT, { detail: { key } }),
  );
}

export function removeBrowserStorage(kind: BrowserStorageKind, key: string): void {
  getStorage(kind).removeItem(key);
  window.dispatchEvent(
    new CustomEvent(INTERNAL_STORAGE_EVENT, { detail: { key } }),
  );
}
