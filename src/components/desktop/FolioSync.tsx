import { useEffect, useRef } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadDesk, saveDesk } from "@/lib/folio-desk";
import { deskSnapshot, useFolioStore } from "@/lib/store";

export function FolioSync() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const hydrateDesk = useFolioStore((state) => state.hydrateDesk);
  const ready = useRef(false);

  useEffect(() => {
    if (isPending || !userId) {
      ready.current = false;
      return;
    }
    let cancelled = false;
    void loadDesk()
      .then((desk) => {
        if (cancelled) return;
        if (desk) {
          hydrateDesk(desk);
          return;
        }
        void saveDesk({ data: deskSnapshot(useFolioStore.getState()) }).catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) ready.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [userId, isPending, hydrateDesk]);

  useEffect(() => {
    if (isPending || !userId) return;
    let timer: number | undefined;
    const save = () => {
      if (!ready.current) return;
      void saveDesk({ data: deskSnapshot(useFolioStore.getState()) }).catch(() => undefined);
    };
    const unsub = useFolioStore.subscribe(() => {
      if (!ready.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(save, 600);
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      window.clearTimeout(timer);
      save();
    };
  }, [userId, isPending]);

  return null;
}