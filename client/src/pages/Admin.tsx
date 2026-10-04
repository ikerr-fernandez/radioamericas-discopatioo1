import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Activity, ArrowLeft, Check, Clock3, Copy, Download, KeyRound, Loader2, LogOut, MessageCircle, MonitorSmartphone, Music2, Play, Search, ShieldCheck, Star, X } from "lucide-react";

const logoPath = "/logo_disco_patio.png";
const statusLabels = { pending: "Pendiente", selected: "Seleccionada", played: "Emitida", rejected: "Descartada" } as const;
const statusColors = { pending: "border-amber-300/20 bg-amber-300/10 text-amber-200", selected: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200", played: "border-blue-300/20 bg-blue-300/10 text-blue-200", rejected: "border-red-300/20 bg-red-300/10 text-red-200" } as const;
type Status = keyof typeof statusLabels;
type RequestItem = { id: number; songTitle: string; artist: string; album: string | null; year: number | null; requesterName: string | null; course: string | null; dedication: string | null; sourceUrl?: string | null; termsAccepted?: boolean; termsVersion?: string; notes: string | null; status: Status; createdAt: Date; updatedAt?: Date };
type FeedbackItem = { id: number; requestId: number; rating: number; createdAt: Date };

const formatRequestCode = (id: number) => String(id).padStart(5, "0");
const maskName = (value: string | null) => {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return "No indicado";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.slice(1).map(part => "█".repeat(Math.max(4, Math.min(part.length, 10)))).join(" ")}`;
};
const formatShareDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }) : "No indicada";
const shareValue = (value: string | number | null | undefined) => value === null || value === undefined || value === "" ? "No indicado" : String(value);
const getShareLines = (item: RequestItem) => [
  `${formatRequestCode(item.id)} · ${item.songTitle} — ${item.artist}`,
  `Enviado por: ${maskName(item.requesterName)} · Clase: ${shareValue(item.course)} · Hora: ${formatShareDate(item.createdAt)}`,
  `Álbum: ${shareValue(item.album)} · Año: ${shareValue(item.year)} · Estado: ${statusLabels[item.status]}`,
  `Dedicatoria: ${shareValue(item.dedication)}`,
  `Notas: ${shareValue(item.notes)}`,
  `Enlace: ${shareValue(item.sourceUrl)}`,
];
const wrapForImage = (text: string, maxLength = 95) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxLength) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
};
const getShareText = (items: RequestItem[]) => [
  "LISTA DE CANCIONES · RADIO PATIO LAS AMÉRICAS",
  "Datos completos · Apellidos ocultos",
  "",
  ...items.flatMap((item, index) => [...(index ? [""] : []), ...getShareLines(item)]),
  "",
  "Enviado por el equipo de Radio América.",
].join("\n");

function downloadSongListImage(items: RequestItem[]) {
  const canvas = document.createElement("canvas");
  const width = 1400;
  const imageRows = items.map(item => getShareLines(item).slice(1).flatMap(line => wrapForImage(line)));
  const rowHeights = imageRows.map(lines => Math.max(220, 100 + lines.length * 30));
  const height = 245 + (rowHeights.length ? rowHeights.reduce((total, value) => total + value, 0) : 220) + 110;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return false;

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#07111f");
  background.addColorStop(1, "#102b4c");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#67e8f9";
  context.fillRect(78, 76, 90, 8);
  context.font = "700 50px Arial, sans-serif";
  context.fillText("Radio Patio Las Américas", 78, 145);
  context.fillStyle = "#cbd5e1";
  context.font = "500 22px Arial, sans-serif";
  context.fillText("Datos completos · apellidos ocultos", 80, 185);

  if (items.length === 0) {
    context.fillStyle = "#94a3b8";
    context.font = "500 28px Arial, sans-serif";
    context.fillText("No hay canciones en esta vista", 80, 290);
  } else {
    let top = 235;
    items.forEach((item, index) => {
      const y = top + 35;
      context.fillStyle = "rgba(255,255,255,0.055)";
      context.fillRect(70, top, width - 140, rowHeights[index] - 18);
      context.fillStyle = "#67e8f9";
      context.font = "700 24px Arial, sans-serif";
      context.fillText(`#${formatRequestCode(item.id)}`, 80, y);
      context.fillStyle = "#f8fafc";
      context.font = "700 27px Arial, sans-serif";
      context.fillText(`${item.songTitle} — ${item.artist}`.slice(0, 76), 245, y);
      context.fillStyle = "#94a3b8";
      context.font = "500 21px Arial, sans-serif";
      imageRows[index].forEach((line, lineIndex) => context.fillText(line, 245, y + 36 + lineIndex * 30));
      top += rowHeights[index];
    });
  }

  context.fillStyle = "#64748b";
  context.font = "500 18px Arial, sans-serif";
  context.fillText(new Date().toLocaleDateString("es-ES", { dateStyle: "long" }), 80, height - 48);
  const link = document.createElement("a");
  link.download = `lista-disco-patio-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  return true;
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [code, setCode] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();
  const isOwner = user?.loginMethod === "team-owner";
  const login = trpc.team.login.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); toast.success("Acceso concedido"); }, onError: error => toast.error("No se pudo acceder", { description: error.message }) });
  const teamLogout = trpc.team.logout.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); toast.success("Sesión cerrada"); } });
  const requests = trpc.requests.adminList.useQuery(undefined, { enabled: user?.role === "admin", retry: false });
  const feedback = trpc.feedback.adminList.useQuery(undefined, { enabled: user?.role === "admin", retry: false });
  const activity = trpc.activity.adminLive.useQuery(undefined, { enabled: user?.role === "admin", retry: false, refetchInterval: 15_000 });
  const update = trpc.requests.update.useMutation({ onSuccess: () => { utils.requests.adminList.invalidate(); toast.success("Petición actualizada"); }, onError: error => toast.error("No se pudo actualizar", { description: error.message }) });
  const ownerControl = trpc.owner.control.useQuery(undefined, { enabled: isOwner, retry: false });
  const ownerCodes = trpc.owner.codes.useQuery(undefined, { enabled: isOwner, retry: false });
  const updateControl = trpc.owner.updateControl.useMutation({ onSuccess: () => { ownerControl.refetch(); utils.requests.status.invalidate(); toast.success("Configuración guardada"); }, onError: error => toast.error("No se pudo guardar", { description: error.message }) });
  const createCode = trpc.owner.createCode.useMutation({ onSuccess: ({ code }) => { ownerCodes.refetch(); toast.success(`Código generado: ${code}`, { duration: 10000 }); }, onError: error => toast.error("No se pudo generar", { description: error.message }) });
  const deletePermanent = trpc.requests.deletePermanent.useMutation({ onSuccess: () => { utils.requests.adminList.invalidate(); toast.success("Petición eliminada definitivamente"); }, onError: error => toast.error("No se pudo eliminar", { description: error.message }) });

  const visible = useMemo(() => (requests.data ?? []).filter(item => {
    const matchesStatus = filter === "all" || item.status === filter;
    const term = search.trim().toLowerCase();
    const matchesTerm = !term || [item.songTitle, item.artist, item.requesterName, item.course, item.dedication].some(value => value?.toLowerCase().includes(term));
    return matchesStatus && matchesTerm;
  }), [requests.data, filter, search]);
  const feedbackAverage = feedback.data?.length ? Math.round((feedback.data.reduce((total, item) => total + item.rating, 0) / feedback.data.length) * 10) / 10 : 0;

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ code: code.toUpperCase() });
  };

  const handleDownload = () => {
    if (downloadSongListImage(visible)) toast.success("Imagen descargada", { description: `${visible.length} ${visible.length === 1 ? "canción" : "canciones"} en la lista.` });
    else toast.error("No se pudo crear la imagen");
  };

  const handleWhatsApp = () => {
    const text = getShareText(visible);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    toast.success("Abriendo WhatsApp", { description: "La lista está preparada para enviarla al equipo." });
  };

  const handleCopy = async () => {
    const text = getShareText(visible);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      toast.success("Lista copiada", { description: "Ya puedes pegarla en el chat del equipo." });
    } catch {
      toast.error("No se pudo copiar la lista");
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 text-center text-slate-300"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Comprobando acceso...</div>;
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 py-8 text-slate-100"><div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center shadow-2xl shadow-black/20 sm:p-9"><img src={logoPath} alt="Radio Patio Las Américas" className="mx-auto mb-6 h-24 w-24 rounded-full" /><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">Radio América</p><h1 className="mt-3 text-3xl font-bold">Acceso privado</h1><p className="mt-3 text-sm leading-6 text-slate-400">Introduce el código de equipo o el código privado de propietario.</p><form onSubmit={handleLogin} className="mt-7 space-y-3 text-left"><label><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">Código de acceso</span><Input autoFocus required maxLength={21} value={code} onChange={event => setCode(event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 21).toUpperCase())} placeholder="Código privado" type="password" inputMode="text" autoCapitalize="characters" className="h-12 border-white/10 bg-[#07111f] text-center font-mono text-base tracking-[0.16em] text-white placeholder:text-slate-600 placeholder:tracking-normal" /></label><Button disabled={login.isPending || code.length < 16} type="submit" className="h-12 w-full bg-cyan-300 font-semibold text-[#07111f] hover:bg-cyan-200">{login.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Entrar</Button></form><div className="mt-6"><Link href="/" className="inline-flex items-center gap-2 text-sm text-blue-200 hover:text-white"><ArrowLeft className="h-4 w-4" />Volver</Link></div></div></div>;
  if (user.role !== "admin") return <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-5 text-center text-slate-100"><div><h1 className="text-3xl font-bold">Acceso restringido</h1><p className="mt-3 text-slate-400">Esta zona es solo para el equipo de Radio América.</p><Link href="/" className="mt-6 inline-block text-sm text-cyan-300 hover:text-white">Volver al buzón</Link></div></div>;

  return <div className="min-h-screen bg-[#07111f] text-slate-100"><header className="border-b border-white/10 bg-[#07111f]/90"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-8"><Link href="/" className="flex min-w-0 items-center gap-2.5"><img src={logoPath} alt="Radio Patio Las Américas" className="h-10 w-10 rounded-full sm:h-11 sm:w-11" /><div className="min-w-0"><p className="font-mono text-[9px] uppercase tracking-[0.28em] text-blue-200/60">Radio América</p><p className="truncate font-semibold">Panel Radio Patio Las Américas</p></div></Link><div className="flex shrink-0 items-center gap-2"><button onClick={() => teamLogout.mutate()} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white sm:gap-2 sm:text-sm"><LogOut className="h-4 w-4" />Salir</button><Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white sm:gap-2 sm:text-sm"><ArrowLeft className="h-4 w-4" />Buzón</Link></div></div></header><main className="mx-auto max-w-6xl px-4 py-7 sm:px-5 sm:py-10 lg:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[0.26em] text-cyan-300 sm:text-xs">Gestión de peticiones</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Lo que suena el jueves</h1><p className="mt-2 text-sm text-slate-400">Revisa las propuestas y elige las 3 o 4 canciones del próximo recreo.</p></div><div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left sm:w-auto sm:text-right"><p className="text-xs uppercase tracking-wider text-slate-500">En el buzón</p><p className="mt-1 text-2xl font-bold text-cyan-300">{requests.data?.length ?? 0}</p></div></div><div className="mt-7 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-3 sm:p-4 lg:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar canción, artista o nombre" className="border-white/10 bg-[#07111f] pl-10 text-white placeholder:text-slate-600" /></div><div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">{(["all", "pending", "selected", "played", "rejected"] as const).map(value => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition ${filter === value ? "bg-cyan-300 text-[#07111f]" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"}`}>{value === "all" ? "Todas" : statusLabels[value]}</button>)}</div></div><section className="mt-4 flex flex-col gap-4 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><div className="flex items-center gap-2"><p className="font-semibold text-white">Compartir lista con el equipo</p><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200">{visible.length} temas</span></div><p className="mt-1 text-xs leading-5 text-slate-400">Incluye canción, artista, remitente con apellidos ocultos, clase, hora, dedicatoria, estado, notas y enlace.</p></div><div className="grid grid-cols-3 gap-2 sm:flex"><Button type="button" onClick={handleDownload} className="h-10 bg-cyan-300 px-3 text-xs font-semibold text-[#07111f] hover:bg-cyan-200"><Download className="mr-1.5 h-4 w-4" />Imagen</Button><Button type="button" onClick={handleWhatsApp} variant="outline" className="h-10 border-cyan-300/25 bg-transparent px-3 text-xs text-cyan-100 hover:bg-cyan-300/10"><MessageCircle className="mr-1.5 h-4 w-4" />WhatsApp</Button><Button type="button" onClick={handleCopy} variant="outline" className="h-10 border-white/10 bg-transparent px-3 text-xs text-slate-200 hover:bg-white/10"><Copy className="mr-1.5 h-4 w-4" />Copiar</Button></div></section><section className="mt-4 rounded-3xl border border-amber-300/15 bg-amber-300/[0.06] p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white">Valoraciones de la experiencia</p><p className="mt-1 text-xs leading-5 text-slate-400">Opiniones anónimas sobre la web y el proceso de envío.</p></div><div className="flex items-center gap-3"><div className="flex items-center gap-1 text-amber-300">{[1, 2, 3, 4, 5].map(value => <Star key={value} className="h-4 w-4" fill={feedbackAverage >= value ? "currentColor" : "none"} />)}</div><div><p className="font-semibold text-white">{feedbackAverage ? `${feedbackAverage}/5` : "Sin valoraciones"}</p><p className="text-[11px] text-slate-500">{feedback.data?.length ?? 0} respuestas</p></div></div></div>{feedback.data && feedback.data.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{feedback.data.slice(0, 8).map(item => <div key={item.id} className="rounded-2xl border border-white/10 bg-[#07111f]/60 p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-0.5 text-amber-300">{[1, 2, 3, 4, 5].map(value => <Star key={value} className="h-3.5 w-3.5" fill={value <= item.rating ? "currentColor" : "none"} />)}</div><span className="font-mono text-[10px] text-slate-500">#{formatRequestCode(item.requestId)}</span></div><p className="mt-2 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</p></div>)}</div>}</section><section className="mt-4 rounded-3xl border border-blue-300/15 bg-blue-300/[0.06] p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300" /><p className="font-semibold text-white">Actividad en tiempo real</p><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200">{activity.data?.visitors.length ?? 0} activos</span></div><p className="mt-1 text-xs leading-5 text-slate-400">Sesiones anónimas activas y últimos envíos. No se registran pulsaciones.</p></div><ShieldCheck className="hidden h-5 w-5 text-cyan-300/70 sm:block" /></div><div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#07111f]/60 p-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Personas conectadas ahora</p>{(activity.data?.visitors.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No hay sesiones activas en los últimos 2 minutos.</p> : <div className="space-y-2">{activity.data?.visitors.map(visitor => <div key={visitor.sessionId} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.035] px-3 py-2 text-xs"><span className="flex min-w-0 items-center gap-2 text-slate-300"><MonitorSmartphone className="h-4 w-4 shrink-0 text-cyan-300" />{visitor.deviceType} · {visitor.browser}</span><span className="shrink-0 font-mono text-[10px] text-slate-500">IP hash {visitor.ipHash?.slice(0, 8) ?? "—"}</span></div>)}</div>}</div><div className="rounded-2xl border border-white/10 bg-[#07111f]/60 p-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Últimos envíos con contexto</p>{(activity.data?.requests.length ?? 0) === 0 ? <p className="text-sm text-slate-500">Todavía no hay actividad registrada.</p> : <div className="space-y-2">{activity.data?.requests.slice(0, 6).map(item => <div key={item.requestId} className="rounded-xl bg-white/[0.035] px-3 py-2 text-xs"><div className="flex items-center justify-between gap-2"><p className="truncate font-medium text-slate-200">{item.songTitle} · {item.artist}</p><span className="shrink-0 font-mono text-[10px] text-slate-500">#{formatRequestCode(item.requestId)}</span></div><p className="mt-1 text-slate-500">{item.requesterName ?? "Sin nombre"} · {item.deviceType ?? "dispositivo desconocido"} · {item.browser ?? "navegador desconocido"} · IP hash {item.ipHash?.slice(0, 8) ?? "—"}{item.accessCodeUsed ? " · código usado" : ""}</p></div>)}</div>}</div></div></section>{isOwner && <OwnerControls control={ownerControl.data} codes={ownerCodes.data ?? []} onSave={value => updateControl.mutate(value)} onCreate={studentName => createCode.mutate({ studentName })} />}<div className="mt-5 space-y-3">{requests.isLoading ? <div className="flex justify-center py-16 text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Cargando peticiones...</div> : visible.length === 0 ? <div className="rounded-3xl border border-dashed border-white/15 py-16 text-center text-slate-500"><Music2 className="mx-auto mb-3 h-8 w-8 text-blue-300/50" /><p>No hay peticiones con estos filtros.</p></div> : visible.map(item => <RequestCard key={item.id} item={item} onUpdate={(status, notes) => update.mutate({ id: item.id, status, notes })} onDelete={() => deletePermanent.mutate({ id: item.id, confirmation: "ELIMINAR" })} canDelete={isOwner} updating={update.isPending || deletePermanent.isPending} />)}</div></main></div>;
}

function OwnerControls({ control, codes, onSave, onCreate }: { control: any; codes: Array<{ code: string; studentName: string; usedAt: Date | null }>; onSave: (value: any) => void; onCreate: (studentName: string) => void }) {
  const [studentName, setStudentName] = useState("");
  const [bannerText, setBannerText] = useState(control?.bannerText ?? "");
  return <section className="mt-5 rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/[0.06] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-white">Acceso propietario</p><p className="mt-1 text-xs text-slate-400">Control exclusivo: bloqueo, timer, banner y códigos de un solo uso.</p></div><ShieldCheck className="h-5 w-5 text-fuchsia-200" /></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Button onClick={() => onSave({ blocked: !control?.blocked })} variant="outline" className="border-fuchsia-300/30 bg-transparent text-fuchsia-100">{control?.blocked ? "Desbloquear página" : "Bloquear página"}</Button><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#07111f] px-3 text-xs text-slate-300"><input type="checkbox" checked={Boolean(control?.bannerEnabled)} onChange={e => onSave({ bannerEnabled: e.target.checked, bannerText })} /> Mostrar banner</label></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input type="datetime-local" defaultValue={control?.unlockAt ? new Date(control.unlockAt).toISOString().slice(0, 16) : ""} className="border-white/10 bg-[#07111f] text-white" onChange={e => onSave({ unlockAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /><span className="self-center text-xs text-slate-400">Fecha y hora de desbloqueo automático</span></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={bannerText} onChange={e => setBannerText(e.target.value)} placeholder="Texto del banner de aviso" className="border-white/10 bg-[#07111f] text-white" /><Button onClick={() => onSave({ bannerText, bannerEnabled: true })} className="bg-fuchsia-300 text-[#07111f]">Guardar banner</Button></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Nombre asociado al código" className="border-white/10 bg-[#07111f] text-white" /><Button onClick={() => { if (studentName.trim()) { onCreate(studentName.trim()); setStudentName(""); } }} variant="outline" className="border-cyan-300/30 text-cyan-100">Generar código 6 dígitos</Button></div><div className="mt-3 flex flex-wrap gap-2">{codes.slice(0, 12).map(item => <span key={item.code} className={`rounded-xl border px-3 py-2 font-mono text-xs ${item.usedAt ? "border-white/10 text-slate-600 line-through" : "border-cyan-300/20 text-cyan-100"}`}>{item.code} · {item.studentName}</span>)}</div></section>;
}

function RequestCard({ item, onUpdate, onDelete, canDelete, updating }: { item: RequestItem; onUpdate: (status: Status, notes?: string) => void; onDelete: () => void; canDelete: boolean; updating: boolean }) {
  const [notes, setNotes] = useState(item.notes ?? "");
  return <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-blue-200/20 sm:p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-cyan-200">#{formatRequestCode(item.id)}</span><h2 className="truncate text-xl font-semibold text-white">{item.songTitle}</h2><span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusColors[item.status]}`}>{statusLabels[item.status]}</span></div><p className="mt-1 text-sm text-cyan-200">{item.artist}{item.album ? ` · ${item.album}` : ""}{item.year ? ` · ${item.year}` : ""}</p><p className="mt-3 text-xs text-slate-500">Recibida el {new Date(item.createdAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}{item.requesterName ? ` · ${item.requesterName}` : " · Anónimo"}{item.course ? ` · ${item.course}` : ""}</p>{item.dedication && <div className="mt-4 rounded-2xl border border-blue-200/10 bg-blue-300/5 p-3 text-sm leading-6 text-slate-300">“{item.dedication}”</div>}</div><div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap md:justify-end"><Button disabled={updating} onClick={() => onUpdate("selected", notes)} className="w-full bg-cyan-300 text-[#07111f] hover:bg-cyan-200 sm:w-auto"><Check className="mr-1.5 h-4 w-4" />Elegir</Button><Button disabled={updating} onClick={() => onUpdate("played", notes)} variant="outline" className="w-full border-blue-200/20 bg-transparent text-blue-100 hover:bg-blue-300/10 sm:w-auto"><Play className="mr-1.5 h-4 w-4" />Emitida</Button><Button disabled={updating} onClick={() => onUpdate("rejected", notes)} variant="outline" className="w-full border-red-200/20 bg-transparent text-red-200 hover:bg-red-300/10 sm:w-auto"><X className="mr-1.5 h-4 w-4" />Descartar</Button>{canDelete && <Button disabled={updating} onClick={onDelete} variant="outline" className="w-full border-red-300/30 bg-red-300/10 text-red-200 hover:bg-red-300/20 sm:w-auto">Eliminar definitivamente</Button>}</div></div><div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end"><label><span className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Curiosidad o nota para locutar</span><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej. Este tema se grabó en..." className="min-h-20 resize-none border-white/10 bg-[#07111f] text-white placeholder:text-slate-600" /></label><Button disabled={updating} onClick={() => onUpdate(item.status, notes)} variant="outline" className="w-full border-white/10 bg-transparent text-slate-300 hover:bg-white/10 md:w-auto"><Clock3 className="mr-2 h-4 w-4" />Guardar nota</Button></div></article>;
}
