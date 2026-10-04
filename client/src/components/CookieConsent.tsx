import { useEffect, useState } from "react";

export const COOKIE_CONSENT_KEY = "radio-patio-cookie-consent-v1";
export type CookieChoice = "accepted" | "rejected";

export function getCookieChoice(): CookieChoice | null {
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

function saveChoice(choice: CookieChoice) {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  window.dispatchEvent(new CustomEvent("radio-patio-consent-changed", { detail: choice }));
}

export default function CookieConsent() {
  const [choice, setChoice] = useState<CookieChoice | null>(() => typeof window === "undefined" ? null : getCookieChoice());
  const [details, setDetails] = useState(false);

  useEffect(() => {
    const open = () => { setChoice(null); setDetails(true); };
    window.addEventListener("radio-patio-open-consent", open);
    return () => window.removeEventListener("radio-patio-open-consent", open);
  }, []);

  if (choice) return null;
  return <div className="fixed inset-x-3 bottom-3 z-[200] rounded-2xl border border-cyan-300/25 bg-[#07111f]/[.98] p-4 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-xl sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-xl" role="dialog" aria-labelledby="cookie-title" aria-describedby="cookie-description">
    <p id="cookie-title" className="font-semibold text-white">Cookies y privacidad</p>
    <p id="cookie-description" className="mt-2 text-xs leading-5 text-slate-300">Usamos almacenamiento técnico para que la web funcione. Si lo autorizas, mediremos de forma agregada las visitas, el tiempo aproximado, el dispositivo y el país, sin IP cruda, perfiles, grabación de sesiones ni publicidad.</p>
    {details && <div className="mt-3 rounded-xl border border-white/10 bg-white/[.04] p-3 text-xs leading-5 text-slate-400"><p><strong className="text-slate-200">Necesarias:</strong> preferencias del aviso y sesión privada del equipo cuando se accede al panel.</p><p className="mt-1"><strong className="text-slate-200">Analítica:</strong> opcional, propia de Radio Patio, con país agregado y conservación limitada. Puedes cambiar la decisión desde “Gestionar cookies” en el pie.</p><a className="mt-2 inline-block text-cyan-200 underline" href="/cookies">Leer la política de cookies</a></div>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => saveChoice("accepted")} className="min-h-10 rounded-xl bg-cyan-300 px-4 text-xs font-semibold text-[#07111f] hover:bg-cyan-200">Aceptar analítica</button><button type="button" onClick={() => saveChoice("rejected")} className="min-h-10 rounded-xl border border-white/20 bg-transparent px-4 text-xs font-semibold text-slate-100 hover:bg-white/10">Rechazar</button><button type="button" onClick={() => setDetails(value => !value)} className="min-h-10 rounded-xl border border-cyan-300/25 bg-transparent px-4 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10">{details ? "Ocultar detalles" : "Configurar"}</button></div>
  </div>;
}

export function CookieSettingsLink() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event("radio-patio-open-consent"))} className="text-cyan-200 underline underline-offset-2 hover:text-white">Gestionar cookies</button>;
}
