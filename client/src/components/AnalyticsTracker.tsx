import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { getCookieChoice } from "./CookieConsent";

function deviceType() {
  if (typeof navigator === "undefined") return "desconocido" as const;
  return /tablet|ipad/i.test(navigator.userAgent) ? "tablet" as const : /mobile|android|iphone/i.test(navigator.userAgent) ? "móvil" as const : "ordenador" as const;
}

export default function AnalyticsTracker() {
  const page = typeof window === "undefined" ? "/" : window.location.pathname || "/";
  const record = trpc.analytics.record.useMutation();
  const [enabled, setEnabled] = useState(() => typeof window !== "undefined" && getCookieChoice() === "accepted");
  const startedAt = useRef(Date.now());
  const sentEnd = useRef(false);

  useEffect(() => {
    const onConsent = (event: Event) => setEnabled((event as CustomEvent).detail === "accepted");
    window.addEventListener("radio-patio-consent-changed", onConsent);
    return () => window.removeEventListener("radio-patio-consent-changed", onConsent);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    startedAt.current = Date.now();
    sentEnd.current = false;
    record.mutate({ page, eventType: "page_view", deviceType: deviceType() });
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") record.mutate({ page, eventType: "session_end", durationSeconds: Math.min(3600, Math.round((Date.now() - startedAt.current) / 1000)), deviceType: deviceType() });
    }, 30_000);
    const sendEnd = () => {
      if (sentEnd.current) return;
      sentEnd.current = true;
      if (document.visibilityState === "hidden") record.mutate({ page, eventType: "session_end", durationSeconds: Math.min(3600, Math.round((Date.now() - startedAt.current) / 1000)), deviceType: deviceType() });
    };
    document.addEventListener("visibilitychange", sendEnd);
    window.addEventListener("pagehide", sendEnd);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", sendEnd); window.removeEventListener("pagehide", sendEnd); sendEnd(); };
  }, [enabled, page]);

  return null;
}
