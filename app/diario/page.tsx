"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SKIP_CURTAIN_KEY } from "../components/WelcomeCurtain";

export default function DiarioPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { unlocked } = await fetch("/api/unlock", { cache: "no-store" }).then((response) => response.json());
      if (cancelled) return;
      if (!unlocked) return router.replace("/");
      const { mount } = await import("./diary");
      if (cancelled || !rootRef.current) return;
      cleanup = mount(rootRef.current, {
        exit: () => {
          sessionStorage.setItem(SKIP_CURTAIN_KEY, "1");
          router.push("/");
        },
      });
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  return <div ref={rootRef} className="dy" />;
}
