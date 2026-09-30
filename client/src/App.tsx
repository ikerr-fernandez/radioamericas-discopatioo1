import { useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Clock3, Loader2 } from "lucide-react";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/Admin";
import Home from "@/pages/Home";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const logoPath = "/logo_disco_patio.png";
// 15:00 CEST (UTC+02:00) = 13:00 UTC. Keeping the instant explicit makes the
// countdown correct even when the visitor's device uses another time zone.
const OPEN_AT_MS = Date.parse("2026-10-01T13:00:00Z");

type Countdown = { days: number; hours: number; minutes: number; seconds: number; total: number };

function getCountdown(now = Date.now()): Countdown {
  const total = Math.max(0, OPEN_AT_MS - now);
  const totalSeconds = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

function OpeningCountdown() {
  const [countdown, setCountdown] = useState<Countdown>(() => getCountdown());

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(getCountdown()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (countdown.total <= 0) return <Router />;

  const units = [
    [countdown.days, "días"],
    [countdown.hours, "horas"],
    [countdown.minutes, "minutos"],
    [countdown.seconds, "segundos"],
  ] as const;

  return <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 py-8 text-slate-100">
    <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center shadow-2xl shadow-black/20 sm:p-9">
      <img src={logoPath} alt="Disco Patio" className="mx-auto mb-6 h-24 w-24 rounded-full" />
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10">
        <Clock3 className="h-6 w-6 text-cyan-300" aria-hidden="true" />
      </div>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">Radio América · Disco Patio</p>
      <h1 className="mt-3 text-3xl font-bold">Abrimos muy pronto</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">La web estará disponible el <strong className="font-semibold text-slate-200">1 de octubre a las 15:00 CEST</strong>.</p>
      <div className="mt-7 grid grid-cols-4 gap-2" aria-live="polite" aria-label="Cuenta atrás hasta la apertura">
        {units.map(([value, label]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#07111f]/80 px-2 py-3">
          <p className="font-mono text-2xl font-bold tracking-tight text-cyan-200 sm:text-3xl">{label === "días" ? value : pad(value)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
        </div>)}
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-xs leading-5 text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300/70" aria-hidden="true" />Se abrirá automáticamente, sin introducir ningún PIN.</p>
    </div>
  </div>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" /><OpeningCountdown /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
