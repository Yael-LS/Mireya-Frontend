// @ts-nocheck
// El diario de Mireya. Es una interfaz muy manual (hoja que da la vuelta, stickers, sobres), así que
// se maneja directo sobre el DOM en lugar de con estado de React.

const MARKUP = '<div class="desk" id="desk">\n  <div class="top">\n        <span class="spacer"></span>\n    <button class="tool" data-act="today" type="button" id="btnToday"></button>\n    <button class="tool" data-act="search" type="button" id="btnSearch"></button>\n    <span class="save-state" id="saveState" role="status"></span>\n    <button class="tool" data-act="exit" type="button" id="btnExit"></button>\n    <button class="tool" data-act="change-pin" type="button" id="btnKey"></button>\n    <button class="tool" data-act="done" type="button" id="btnDone">Listo</button>\n    <button class="tool" data-act="toggle-book" type="button" id="btnClose"></button>\n  </div>\n  <div class="strip" id="strip"></div>\n  <div class="layout">\n    <div class="book-col">\n      <div class="book closed" id="book">\n        <div class="board board-l"></div><div class="board board-r"></div>\n        <div class="edges l"></div><div class="edges r"></div>\n        <div class="page left" id="pageL"></div>\n        <div class="page right" id="pageR"></div>\n        <div class="spine"></div>\n        <div class="ribbon"></div>\n        <div class="cover" id="cover" data-act="open-book" role="button" tabindex="0" aria-label="Abrir el diario">\n          <div class="cf" id="coverFront"><h2>El diario de Mireya</h2><p>Una aventura que vale la pena recordar</p><span class="tap">Toca para abrirlo</span></div>\n          <div class="cb" id="coverBack"></div>\n        </div>\n      </div>\n      <div class="deco" id="deco" aria-hidden="true"></div>\n    </div>\n    <aside class="side" aria-label="Calendario, carpetitas y cartas">\n      <div class="wall"><span class="nail"></span><div id="calSmall"></div></div>\n      <div class="drawer"><h3 style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">Mis carpetitas<button type="button" data-act="folders" style="font:600 12px/1 var(--ui);color:var(--era-ink)">+ crear otra</button></h3><div class="folders-mini" id="foldersMini"></div></div>\n      <button class="letterbox" type="button" data-act="letters" id="letterbox"></button>\n    </aside>\n  </div>\n  <nav class="bottom-nav" id="bottomNav" aria-label="Secciones"></nav>\n</div>\n<input type="file" id="photoInput" accept="image/*" hidden>\n<input type="file" id="bgInput" accept="image/*" hidden>\n<div id="ovRoot"></div>';

export function mount(root, opts) {
  root.innerHTML = MARKUP;
  const offs = [];
  const listen = (target, type, fn, o) => { target.addEventListener(type, fn, o); offs.push(() => target.removeEventListener(type, fn, o)); };
  const cleanup = () => { flushSaves(); offs.forEach((off) => off()); root.innerHTML = ""; };

  /* ---------- Utilidades ---------- */
  const pubImg = (n) => "/_next/image?url=" + encodeURIComponent("/" + n + ".png") + "&w=640&q=75";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  let TODAY = iso(new Date());
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isPhone = () => window.matchMedia("(max-width: 767px)").matches;
  const fmt = (s, o) => parse(s).toLocaleDateString("es-MX", o);
  const longDate = (s) => fmt(s, { day: "numeric", month: "long", year: "numeric" });
  const shortDate = (s) => fmt(s, { day: "numeric", month: "short", year: "numeric" });
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

  const I = {
    left: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    search: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.900" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.500 7V4.500h5V7M6.500 7l1 13h9l1-13M10 11v5.500M14 11v5.500"/></svg>',
    key: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15.500" r="4.500"/><path d="M11.500 12L20 3.500M16 7.500l3 3"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16.500 4.500a2 2 0 013 3L8 19z"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 11-2.500-5.800M20 3v4.500h-4.500"/></svg>',
    resize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L19 5M12 5h7v7M12 19H5v-7"/></svg>',
    close: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="9" cy="10.5" r="1.7"/><path d="M4 18l5-4 3 2 4-4 4 4"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
    memo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v4a2 2 0 000 3v4H4v-4a2 2 0 000-3z"/><path d="M15 7v11" stroke-dasharray="2 2.5"/></svg>',
    grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4.3" height="15" rx="1"/><rect x="13.7" y="4.5" width="4.3" height="15" rx="1"/></svg>',
    book: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-2-1.6-5-2-8-1.5v14c3-.5 6-.1 8 1.5 2-1.6 5-2 8-1.5v-14C17 4 14 4.400 12 6zM12 6v14"/></svg>',
    cal: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.500" y="5" width="17" height="15.500" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4"/></svg>',
    mail: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.500" width="18" height="13.500" rx="2"/><path d="M3.500 7l8.500 6.500L20.500 7"/></svg>',
    folder: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.500a2 2 0 012-2h4l2 2.500h8a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
    info: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.800v.2"/></svg>',
    sun: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M18.400 5.600L17 7M7 17l-1.400 1.400"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="6" y="11" width="12" height="9" rx="1.500" fill="currentColor"/><path d="M8.500 11V8a3.500 3.500 0 017 0v3"/></svg>',
  };
  const envSvg = (sealed, ready) => '<svg class="env" viewBox="0 0 30 21" aria-hidden="true"><rect x=".7" y=".7" width="28.600" height="19.600" rx="2" fill="' + (ready ? "#d7eafb" : "#ffffff") + '" stroke="#6f93b8"/><path d="M1 1.500l14 10.500L29 1.500" fill="none" stroke="#6f93b8"/>' + (sealed ? '<circle cx="15" cy="11" r="4.300" fill="#4f86c0"/>' : "") + "</svg>";

  /* ---------- Guardar en el servidor ---------- */
  async function api(path, options) {
    const res = await fetch("/api/backend/diario" + path, { cache: "no-store", headers: { "Content-Type": "application/json" }, ...options });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || "No se pudo guardar.");
    return res.status === 204 ? null : res.json();
  }
  const send = (path, method, body) => api(path, { method, body: JSON.stringify(body) });
  const PENDING_KEY = "mireya-diario-pendiente";
  const dirty = new Set();
  let saveTimer = 0, retryTimer = 0;
  const entryPayload = (e) => ({
    body: e.day, feel: e.feel, moods: e.moods, ink: e.ink, font: e.font,
    items: e.items.map(({ url, fresh, ...keep }) => keep),
    ...(e.folder ? { folder_id: e.folder } : { clear_folder: true }),
  });
  function setSaveState(text, bad) {
    const n = $("#saveState");
    if (!n) return;
    n.textContent = text;
    n.classList.toggle("bad", Boolean(bad));
  }
  // Lo que aún no llega al servidor se queda en el navegador: nada de lo que escriba se pierde.
  function backupPending() {
    try {
      if (!dirty.size) return localStorage.removeItem(PENDING_KEY);
      localStorage.setItem(PENDING_KEY, JSON.stringify(Object.fromEntries([...dirty].map((d) => [d, entryPayload(ent(d))]))));
    } catch {}
  }
  function touch(day) {
    dirty.add(day);
    backupPending();
    setSaveState("Guardando…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSaves, 800);
  }
  async function flushSaves() {
    clearTimeout(saveTimer); clearTimeout(retryTimer);
    const days = [...dirty];
    if (!days.length) return;
    dirty.clear();
    const failed = [];
    await Promise.all(days.map((d) => {
      const body = JSON.stringify(entryPayload(ent(d)));
      // keepalive deja que termine aunque se cierre la pestaña (tiene un límite de 64 KB).
      return api("/entries/" + d, { method: "PATCH", body, keepalive: body.length < 60000 }).catch(() => failed.push(d));
    }));
    failed.forEach((d) => dirty.add(d));
    backupPending();
    if (dirty.size) {
      setSaveState("No se pudo guardar. Sigue en este equipo y vuelvo a intentar.", true);
      retryTimer = setTimeout(flushSaves, 5000);
    } else setSaveState("Guardado");
  }
  let settingsTimer = 0;
  const saveSettings = (extra) => {
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => send("/settings", "PATCH", { era_by: state.eraBy, cal_see: state.calSee, bg_month: state.bgMonth, ink: state.ink, font: state.font, ...(state.myBg ? { my_bg: state.myBg } : {}), ...(state.bgAll ? { bg_all: state.bgAll } : { clear_bg_all: true }), ...extra }).catch(() => setSaveState("No se pudo guardar el calendario.", true)), 400);
  };
  async function uploadPhoto(file) {
    setSaveState("Subiendo tu foto…");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = await send("/photos", "POST", { photo_base64: canvas.toDataURL("image/jpeg", .85), photo_type: "image/jpeg" });
    setSaveState("Guardado");
    return out;
  }

  /* ---------- Caritas ---------- */
  const INK = "#2f3a5c";
  // Dibujitos de papelería: cada emoción tiene su propia forma, color plano y línea de tinta corrida.
  function blob(fn, n) {
    const pts = [];
    for (let i = 0; i < (n || 96); i++) {
      const t = i / (n || 96) * Math.PI * 2, r = fn(t);
      pts.push((24 + r[0]).toFixed(1) + " " + (25 + r[1]).toFixed(1));
    }
    return "M" + pts.join("L") + "Z";
  }
  const polar = (rf, sx, sy) => (t) => [Math.cos(t) * rf(t) * (sx || 1), Math.sin(t) * rf(t) * (sy || 1)];
  const SHAPES = {
    flor: blob(polar((t) => 15.5 + 3.4 * Math.cos(8 * t))),
    nube: blob(polar((t) => 14 + 2.6 * Math.abs(Math.sin(2.5 * t + .4)) + 1.2 * Math.cos(t * 2), 1.28, .92)),
    corazon: blob((t) => [1.19 * 16 * Math.sin(t) ** 3 * .92, -1.15 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * .92 - 1]),
    gota: blob((t) => [14.5 * Math.sin(t) * Math.sin(t / 2) ** 1.25, -20 * Math.cos(t) + 2]),
    almohada: blob(polar((t) => 15 + 1.6 * Math.cos(4 * t), 1.26, .82)),
    grumo: blob(polar((t) => 15.5 + 2 * Math.cos(11 * t) + 1.6 * Math.cos(5 * t + 1))),
    chispa: blob(polar((t) => 15 + 5.2 * Math.abs(Math.cos(4.5 * t)) ** 2.2)),
    piedra: blob(polar((t) => 16 + 1.2 * Math.cos(3 * t + .7), 1.14, .9)),
    luna: blob(polar((t) => 17 + .8 * Math.cos(3 * t))),
  };
  const line = 'fill="none" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const dots = (y) => '<circle cx="18.500" cy="' + y + '" r="1.350" fill="' + INK + '"/><circle cx="29.500" cy="' + y + '" r="1.350" fill="' + INK + '"/>';
  const blush = (y) => '<path d="M13 ' + y + 'l2-1.500M15.500 ' + (y + .5) + 'l2-1.500M30.500 ' + (y + .5) + 'l2-1.500M33 ' + y + 'l2-1.500" fill="none" stroke="#ee8a9c" stroke-width="1.100" stroke-linecap="round"/>';
  const MOODS = {
    feliz: { label: "feliz", b: "#ffd98a", shape: "flor", e: '<path d="M16.500 25q2-2.500 4 0M27.500 25q2-2.500 4 0" ' + line + "/>" + blush(29) + '<path d="M21 29q3 3 6 0" ' + line + "/>" },
    tranquila: { label: "tranquila", b: "#bde6cd", shape: "nube", e: '<path d="M16.500 24q2 2 4 0M27.500 24q2 2 4 0" ' + line + '/><path d="M22 29q2 1.500 4 0" ' + line + "/>" },
    agradecida: { label: "agradecida", b: "#f8c7cd", shape: "corazon", e: '<path d="M16.500 21q2-2.200 4 0M27.500 21q2-2.200 4 0" ' + line + "/>" + blush(25) + '<path d="M22 25.500q2 1.700 4 0" ' + line + "/>" },
    nostalgica: { label: "nostálgica", b: "#d2c6f4", shape: "luna", e: '<path d="M33 9.500a17 17 0 010 31a15 15 0 000-31z" fill="#b8a8ea"/>' + '<path d="M16.500 24.500q2 1.700 4 0M26.500 24.500q2 1.700 4 0" ' + line + '/><path d="M21.500 30q2 1 4 0" ' + line + "/>" },
    sensible: { label: "sensible", b: "#f4cbe6", shape: "gota", e: dots(28) + '<path d="M22 32q2 1.500 4 0" ' + line + "/>" },
    triste: { label: "triste", b: "#a9cff2", shape: "nube", e: dots(23.5) + '<path d="M21.500 30q2.500-2 5 0" ' + line + '/><path d="M15 39l-1 4M24 40l-1 4M33 39l-1 4" fill="none" stroke="#6ea8df" stroke-width="1.700" stroke-linecap="round"/>' },
    cansada: { label: "cansada", b: "#ddd8ea", shape: "almohada", e: '<path d="M15.500 25h5M27.500 25h5" ' + line + '/><circle cx="24" cy="30" r="1.300" fill="none" stroke="' + INK + '" stroke-width="1.300"/><path d="M36 8h4l-4 4h4M42 3h2.500l-2.500 2.500h2.500" ' + line + "/>" },
    ansiosa: { label: "ansiosa", b: "#c6cef5", shape: "grumo", e: dots(23) + '<path d="M18.500 29.500q1.400-1.800 2.800 0t2.800 0 2.800 0 2.800 0" ' + line + "/>" },
    enojada: { label: "enojada", b: "#f8ac9e", shape: "chispa", e: '<path d="M16 20.500l4 1.800M32 20.500l-4 1.800" ' + line + "/>" + dots(24.5) + '<path d="M21 30.500q3-2.200 6 0" ' + line + "/>" },
    estuve: { label: "estuve", b: "#dbe5ef", shape: "piedra", e: dots(24) + '<path d="M21.500 29.500h5" ' + line + "/>" },
    mil: { label: "mil cosas", b: "#f6c9dc", shape: "grumo", under: '<circle cx="13" cy="15" r="9.500" fill="#ffd98a"/><circle cx="36" cy="14" r="9" fill="#bde6cd"/><circle cx="37" cy="36" r="9.500" fill="#a9cff2"/><circle cx="11" cy="36" r="8.500" fill="#d2c6f4"/>', e: '<path d="M19.500 23.500a1.300 1.300 0 11-1.300-1.300M30.800 23.500a1.300 1.300 0 11-1.300-1.300" ' + line + '/><path d="M19.500 29.500q1.500-1.800 3 0t3 0 3 0" ' + line + "/>" },
    nose: { label: "no sé", b: "#cfe0f6", shape: "nube", e: dots(24) + '<path d="M21.500 30q1.500-1 3 0t2.500-.5" ' + line + '/><path d="M38 6.500q0-2.800 2.700-2.800t2.700 2.500q0 1.500-2.700 3v1.500" ' + line + '/><circle cx="40.700" cy="13.500" r=".9" fill="' + INK + '"/>' },
  };
  // El orden: primero lo que más la describe a ella.
  const face = (k) => { const m = MOODS[k], d = SHAPES[m.shape]; return '<svg viewBox="0 0 48 48" aria-hidden="true">' + (m.under || "") + '<path d="' + d + '" fill="' + m.b + '"/><path d="' + d + '" transform="translate(.9 -.9)" ' + line + "/>" + m.e + "</svg>"; };

  // Para Mireya casi nunca es una sola emoción: un día puede tener varias.
  const moodsOf = (e) => (e && e.moods) || [];
  const FONTS = {
    caveat: { n: "A mano", f: "var(--font-caveat), cursive", z: 1 },
    dancing: { n: "Elegante", f: "var(--font-dancing), cursive", z: .96 },
    indie: { n: "Redonda", f: "var(--font-indie), cursive", z: .88 },
    patrick: { n: "Ordenada", f: "var(--font-patrick), cursive", z: .95 },
    shadows: { n: "Delgada", f: "var(--font-shadows), cursive", z: .98 },
    kalam: { n: "Cuaderno", f: "var(--font-kalam), cursive", z: .8 },
    libro: { n: "De libro", f: "var(--font-cormorant), Georgia, serif", z: .96 },
    maquina: { n: "Máquina de escribir", f: "var(--font-courier), 'Courier New', monospace", z: .74 },
  };
  const INKS = ["#27405f", "#3f78b5", "#3f9fd8", "#2b8f9c", "#7a8fd6", "#7d5bc4", "#c2558f", "#b3202f", "#c96a2c", "#3f8a5c", "#8a6a4f", "#222222"];
  const penVars = (o) => "--pen:" + o.ink + ";--write:" + FONTS[o.font].f + ";--wz:" + FONTS[o.font].z;

  /* ---------- Eras: cada mes es una era ---------- */
  const m = (d) => '<svg viewBox="0 0 24 24" fill="currentColor">' + d + "</svg>";
  const ERAS = [
    { n: "Debut", b: "DEBUT", c: "#2c8a7a", s: "#d7efe6", i: "#1b5a50", song: "Our Song", mo: m('<path d="M12 12c-1-5-5-8-8-6s0 8 8 6zm0 0c1-5 5-8 8-6s0 8-8 6zm0 0c-1 5-5 7-7 5s1-6 7-5zm0 0c1 5 5 7 7 5s-1-6-7-5z"/>') },
    { n: "Lover", b: "LOVER", c: "#df5f97", s: "#fddfeb", i: "#8f2d5c", song: "Cruel Summer", mo: m('<path d="M12 21C5 15 2 11.500 2 8a5 5 0 0110-1.500A5 5 0 0122 8c0 3.500-3 7-10 13z"/>') },
    { n: "Fearless", b: "FEARLESS", c: "#bd8b26", s: "#f8eac6", i: "#6f5215", song: "Love Story", mo: m('<path d="M12 2l2.900 6.300 6.900.8-5.100 4.700 1.400 6.800L12 17.200 5.900 20.600l1.400-6.800L2.200 9.100l6.900-.8z"/>') },
    { n: "Speak Now", b: "SPEAK NOW", c: "#7a4fb0", s: "#eadffa", i: "#4a2b78", song: "Enchanted", mo: m('<path d="M12 2c2 4 1 6 0 8 4-2 7-1 9 2-3 0-5 1-6 3 1 3 0 5-3 7 0-3-1-5-3-6-3 1-5 0-7-2 3-1 5-2 6-4C7 7 8 4 12 2z"/>') },
    { n: "1989", b: "1989", c: "#3f94c9", s: "#dcf0fb", i: "#1f5b80", song: "Out Of The Woods", mo: m('<path d="M2 13c4-5 7-5 10-1 3-4 6-4 10 1-4-2-7-1-10 3-3-4-6-5-10-3z"/>') },
    { n: "The Tortured Poets", b: "TTPD", c: "#857b6d", s: "#efeadf", i: "#4e483e", song: "Fortnight", mo: m('<path d="M21 3C12 3 6 8 5 16l-2 5 1 .5 3-4c6 0 12-5 14-14.500zM8 15c1.500-3 4-6 8-8-2 3-5 6-8 8z"/>') },
    { n: "folklore", b: "FOLKLORE", c: "#6f7f7c", s: "#e6ecea", i: "#3e4c4a", song: "august", mo: m('<path d="M12 2l5 7h-3l5 6h-4l5 6H4l5-6H5l5-6H7z"/>') },
    { n: "reputation", b: "REP", c: "#2b2a2e", s: "#e1dfe2", i: "#1b1a1e", song: "Delicate", mo: m('<path d="M4 18c0-4 4-4 7-4s6-1 6-3-3-3-6-3-3-3 1-4c5-1 9 1 9 6 0 4-4 6-8 6s-6 .5-6 2c0 2 5 2 8 1-2 3-11 4-11-1z"/>') },
    { n: "The Life of a Showgirl", b: "SHOWGIRL", c: "#d4691f", s: "#fde7d4", i: "#84400f", song: "The Fate of Ophelia", mo: m('<path d="M12 3a9 9 0 019 9h-3a6 6 0 00-12 0H3a9 9 0 019-9zm0 8a4 4 0 014 4v6H8v-6a4 4 0 014-4z"/>') },
    { n: "Midnights", b: "MIDNIGHTS", c: "#2e3d7d", s: "#dde2f5", i: "#1e2a5c", song: "Anti-Hero", mo: m('<path d="M20 15A9 9 0 019 4a9 9 0 1011 11z"/><circle cx="18" cy="6" r="1.300"/><circle cx="14" cy="4" r=".8"/>') },
    { n: "Red", b: "RED", c: "#b3202f", s: "#f9dcdc", i: "#7a1320", song: "All Too Well", mo: m('<path d="M12 22v-6M12 2c2 3 3 3 5 3-.3 2 .3 3 2 4.500-1 1-1.700 2-1.500 3.500-2-.5-3 0-3.500 1 0 .7.300 1.300.8 2H9.200c.5-.7.8-1.300.8-2-.5-1-1.500-1.500-3.500-1 .2-1.500-.5-2.500-1.500-3.500C6.700 8 7.300 7 7 5c2 0 3 0 5-3z"/>') },
    { n: "evermore", b: "EVERMORE", c: "#ab5f1b", s: "#f3e3d0", i: "#693a10", song: "willow", mo: m('<path d="M12 2l1 3.500 3-2-1 3.500 3.500-.5-2 3 3.500 1-3 1.500 3 1.500-3.500 1 2 3-3.500-.5 1 3.500-3-2-1 3.500-1-3.500-3 2 1-3.500-3.500.5 2-3-3.500-1 3-1.500-3-1.500 3.500-1-2-3 3.500.5-1-3.500 3 2z"/>') },
  ];
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const beads = (t) => t.split("").map((ch) => ch === " " ? '<span class="bead dot"></span>' : '<span class="bead">' + esc(ch) + "</span>").join("");
  const pearls = '<span class="bead dot"></span>'.repeat(4);
  const braceletFor = (e) => '<span class="br">' + pearls + beads(e ? e.b : "M") + pearls + "</span>";
  const eraOf = (mo) => (state.eraBy[mo] === -1 ? null : ERAS[state.eraBy[mo]]);
  const applyEra = () => {};


  /* Fondos del calendario */
  const SKY = "radial-gradient(ellipse 30% 22% at 20% 32%, #fff 0, rgba(255,255,255,.75) 45%, rgba(255,255,255,0) 72%), radial-gradient(ellipse 24% 18% at 34% 26%, #fff 0, rgba(255,255,255,0) 72%), radial-gradient(ellipse 34% 24% at 76% 20%, #fff 0, rgba(255,255,255,.7) 45%, rgba(255,255,255,0) 72%), radial-gradient(ellipse 26% 16% at 92% 62%, rgba(255,255,255,.9) 0, rgba(255,255,255,0) 72%), radial-gradient(ellipse 30% 14% at 8% 78%, rgba(255,255,255,.85) 0, rgba(255,255,255,0) 72%), linear-gradient(180deg, #8fc1ea, #cfe6f8)";
  const PRESETS = [
    { id: "cielo", n: "Cielo", css: SKY },
    { id: "mar", n: "Mar", css: "repeating-radial-gradient(ellipse 120% 26% at 50% 118%, rgba(255,255,255,.3) 0 5%, rgba(255,255,255,0) 5% 10%), linear-gradient(180deg, #d5ebfa 0%, #a7d0ef 45%, #6ea9dc 100%)" },
    { id: "tarde", n: "Azul suave", css: "radial-gradient(ellipse 60% 44% at 80% 12%, #fff 0, rgba(255,255,255,0) 70%), radial-gradient(ellipse 50% 40% at 10% 70%, #e7dcf8 0, rgba(231,220,248,0) 72%), linear-gradient(160deg, #b9d9f4, #dceaf9)" },
    { id: "hortensia", n: "Hortensias", css: "url('" + pubImg("hortensia0") + "') center / cover no-repeat" },
    { id: "bibble", n: "Bibble", css: "url('" + pubImg("bibble2") + "') center / cover no-repeat" },
  ];
  const bgCss = (t) => {
    if (!t) return null;
    if (t.startsWith("preset:")) return PRESETS.find((p) => p.id === t.slice(7))?.css ?? null;
    const url = state.bgUrls[t.slice(6)];
    return url ? "url('" + url + "') center / cover no-repeat" : null;
  };
  const bgFor = (y, mo) => { const v = state.bgMonth[y + "-" + mo]; return v === "none" ? null : bgCss(v || state.bgAll); };

  /* ---------- Datos de ejemplo ---------- */
  const COLORS = ["#cfe4f6", "#ffffff", "#d6dcf6", "#b5d4ef", "#c6e9ea", "#f9d5e0", "#ffe3b8", "#d9f0c8", "#f3d9fa", "#ffd1c2", "#fff3b0", "#e8e4dc"];
  const SLOTS = [{ x: 3, y: 2 }, { x: 48, y: 5 }, { x: 8, y: 48 }, { x: 50, y: 47 }, { x: 28, y: 24 }, { x: 60, y: 22 }];
  const SIZE = { photo: 37, song: 62, memo: 46, thought: 45 };
  const state = {
    eraBy: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], calSee: 30, bgUrls: {}, myBg: null, bgAll: null, bgMonth: {}, bgScope: "mes", bgFrom: null, eraFrom: null, cur: TODAY, side: "l", ink: "#27405f", font: "caveat", calY: 0, calM: 0, bigTab: "mes", search: { q: "", moods: [], month: null, has: [], folder: null }, folderView: "sueltas", newColor: COLORS[0], busy: false,
    folders: [],
    entries: {}, letters: [],
  };
  const ent = (s) => state.entries[s] || (state.entries[s] = { day: "", moods: [], feel: "", items: [], folder: null, ink: state.ink, font: state.font });
  const hasContent = (e) => e && (e.day.trim() || moodsOf(e).length || e.feel || e.items.length);
  const thoughtText = (e) => e.items.filter((it) => it.type === "thought").map((it) => it.text).join(" · ");
  const canOpen = (l) => !l.sealed || l.to <= TODAY;
  const lettersOn = (s) => state.letters.filter((l) => l.to === s);

  /* ---------- Páginas ---------- */
  function renderLeft(s, live) {
    const e = state.entries[s] || { day: "", moods: [], feel: "", ink: state.ink, font: state.font };
    const era = eraOf(parse(s).getMonth());
    const d = parse(s);
    const body = live
      ? '<textarea id="txtDay" class="lined" data-field="day" maxlength="100000" placeholder="Querido diario, hoy…" aria-label="Lo que viví hoy">' + esc(e.day) + "</textarea>"
      : '<div class="lined">' + esc(e.day) + "</div>";
    return '<div class="inner" style="' + penVars(e) + '">' +
      '<div class="date-row"><div><div class="date-num">' + d.getDate() + '</div><div class="date-txt">' + esc(fmt(s, { weekday: "long" })) + " · " + MONTHS[d.getMonth()] + " " + d.getFullYear() + '</div></div><div class="era-tag">' + (era ? "era " + esc(era.n) : "") + "</div></div>" +
      '<div class="side-switch">' + switchBtns("l", live) + "</div>" +
      feelHtml(e, live) +
      '<div class="writing"><div class="label-row"><span class="label">lo que viví hoy</span><button type="button" class="pen-btn" ' + (live ? 'data-act="pen" data-t="page"' : 'tabindex="-1"') + ' aria-label="Elegir tinta y letra de esta hoja"><i></i><b>Aa</b>Tinta y letra</button></div>' + body + "</div>" +
      "</div>" + (live ? '<button type="button" class="corner prev" data-act="prev" aria-label="Día anterior">' + I.left + "</button>" : "");
  }
  function feelHtml(e, live) {
    const ms = moodsOf(e);
    const names = ms.map((k) => MOODS[k].label).join(", ");
    const txt = [names, e.feel].filter(Boolean).join(" · ");
    const faces = ms.length ? '<span class="feel-faces">' + ms.slice(0, 5).map(face).join("") + "</span>" : '<span class="feel-empty">+</span>';
    return '<button type="button" class="feel" ' + (live ? 'data-act="feel"' : 'tabindex="-1"') + '><span class="label">¿cómo te sentiste hoy?</span><span class="feel-line">' + faces + '<span class="feel-txt">' + (txt ? esc(txt) : "toca para elegir todo lo que sentiste") + "</span></span></button>";
  }
  function switchBtns(side, live) {
    return '<button type="button" class="' + (side === "l" ? "on" : "") + '" ' + (live ? 'data-act="side" data-s="l"' : 'tabindex="-1"') + '>Lo que viví</button><button type="button" class="' + (side === "r" ? "on" : "") + '" ' + (live ? 'data-act="side" data-s="r"' : 'tabindex="-1"') + ">Pedacitos de hoy</button>";
  }
  function itemHtml(it, i, live) {
    const style = "left:" + it.x + "%;top:" + it.y + "%;width:" + SIZE[it.type] + "%;transform:rotate(" + it.r + "deg) scale(" + (it.s || 1) + ")";
    const canEdit = it.type === "thought" || it.type === "memo";
    const tools = live ? '<button type="button" class="x" data-act="rm" data-i="' + i + '" aria-label="Quitar">×</button><span class="knob rot" data-knob="rot" title="Girar">' + I.rotate + '</span><span class="knob size" data-knob="size" title="Cambiar tamaño">' + I.resize + "</span>" + (canEdit ? '<button type="button" class="edit" data-act="edit-it" data-i="' + i + '">Leer o editar</button>' : "") : "";
    let inner = "";
    if (it.type === "photo") inner = '<div class="polaroid"><img src="' + esc(it.url || "") + '" alt="' + esc(it.cap || "Foto del día") + '" draggable="false">' + (live ? '<input class="cap" data-cap="' + i + '" value="' + esc(it.cap || "") + '" maxlength="40" placeholder="escribe algo…" aria-label="Texto de la foto">' : "<p>" + (esc(it.cap) || "&nbsp;") + "</p>") + "</div>";
    if (it.type === "song") inner = songCard(it, live);
    if (it.type === "memo") inner = '<div class="memo"><small>un recuerdo</small><p>' + esc(it.text) + "</p></div>";
    if (it.type === "thought") inner = '<div class="thought"><small>' + esc(it.time) + "</small><p>" + esc(it.text) + "</p></div>";
    return '<div class="it ' + (it.fresh ? "drop" : "") + '" data-i="' + i + '" style="' + style + '">' + tools + inner + "</div>";
  }
  function songCard(s, live) {
    if (live && s.id) return '<div class="song-embed"><iframe src="https://open.spotify.com/embed/track/' + esc(s.id) + '" title="' + esc(s.t) + '" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe><span class="song-shield"></span></div>';
    return '<div class="song" style="--tile:' + (s.c || "#3f78b5") + '"><span class="art">' + (s.art ? '<img src="' + esc(s.art) + '" alt="">' : I.music) + '</span><span class="mid"><b>' + esc(s.t) + "</b><i>" + esc(s.a) + "</i></span></div>";
  }
  function renderRight(s, live) {
    const e = state.entries[s] || { items: [], folder: null, ink: state.ink, font: state.font };
    const fold = state.folders.find((f) => f.id === e.folder);
    const items = e.items.map((it, i) => itemHtml(it, i, live)).join("");
    const hint = e.items.length ? "" : SCRAP_HINT;
    const off = 'tabindex="-1"';
    return '<div class="inner" style="' + penVars(e) + '"><div class="side-switch">' + switchBtns("r", live) + "</div>" +
      '<div class="r-head"><span class="label">pedacitos de hoy</span>' + (fold ? '<button type="button" class="fold-tag" style="--fc:' + fold.color + '" ' + (live ? 'data-act="folders" data-open="' + fold.id + '"' : off) + ">" + esc(fold.name) + "</button>" : "") + "</div>" +
      '<div class="scrap" id="' + (live ? "scrap" : "") + '">' + hint + items + "</div>" +
      '<div class="page-tools">' +
      '<button type="button" class="ptool" ' + (live ? 'data-act="add-thought"' : off) + ">" + I.pen + "Pensamiento</button>" +
      '<button type="button" class="ptool" ' + (live ? 'data-act="add-photo"' : off) + ">" + I.photo + "Foto</button>" +
      '<button type="button" class="ptool" ' + (live ? 'data-act="add-song"' : off) + ">" + I.music + "Canción</button>" +
      '<button type="button" class="ptool" ' + (live ? 'data-act="add-memo"' : off) + ">" + I.memo + "Recuerdo</button>" +
      '<button type="button" class="ptool grip" ' + (live ? 'data-grip="page"' : off) + ' title="Arrástrala a una carpetita">' + I.grip + "Guardar</button>" +
      "</div></div>" +
      (live ? '<button type="button" class="corner next" data-act="next" aria-label="Día siguiente" ' + (s >= TODAY ? "disabled" : "") + ">" + I.right + "</button>" : "");
  }
  /* ---------- Tablero: solo se toca lo que cambió ---------- */
  // Volver a pintar la hoja recargaba fotos y reproductores de Spotify que nadie había movido.
  const SCRAP_HINT = '<div class="scrap-hint">escribe un pensamiento o pega aquí tus fotos, canciones y recuerdos de este día</div>';
  function showRightSide() {
    if (!isPhone() || state.side === "r") return;
    state.side = "r";
    $("#pageL").classList.remove("show");
    $("#pageR").classList.add("show");
  }
  const htmlNode = (html) => { const box = document.createElement("div"); box.innerHTML = html; return box.firstElementChild; };
  function appendItem(i) {
    const it = ent(state.cur).items[i], scrap = $("#scrap");
    scrap.querySelector(".scrap-hint")?.remove();
    scrap.appendChild(htmlNode(itemHtml(it, i, true)));
    delete it.fresh;
  }
  function removeItem(i) {
    const scrap = $("#scrap");
    scrap.querySelector('.it[data-i="' + i + '"]').remove();
    scrap.querySelectorAll(".it").forEach((node, n) => {
      node.dataset.i = n;
      node.querySelectorAll("[data-act][data-i]").forEach((b) => { b.dataset.i = n; });
      node.querySelectorAll("[data-cap]").forEach((c) => { c.dataset.cap = n; });
    });
    if (!scrap.querySelector(".it")) scrap.innerHTML = SCRAP_HINT;
  }
  function repaintItem(i) {
    const node = $('#scrap .it[data-i="' + i + '"]');
    node.replaceWith(htmlNode(itemHtml(ent(state.cur).items[i], i, true)));
  }
  function paintFolderTag() {
    const head = $("#pageR .r-head");
    if (!head) return;
    head.querySelector(".fold-tag")?.remove();
    const fold = state.folders.find((f) => f.id === ent(state.cur).folder);
    if (fold) head.insertAdjacentHTML("beforeend", '<button type="button" class="fold-tag" style="--fc:' + fold.color + '" data-act="folders" data-open="' + fold.id + '">' + esc(fold.name) + "</button>");
  }

  function paint() {
    const pl = $("#pageL"), pr = $("#pageR");
    pl.innerHTML = renderLeft(state.cur, true);
    pr.innerHTML = renderRight(state.cur, true);
    pl.classList.toggle("show", state.side === "l");
    pr.classList.toggle("show", state.side === "r");
    applyEra(state.cur);
  }
  function paintRight() { $("#pageR").innerHTML = renderRight(state.cur, true); state.entries[state.cur]?.items.forEach((it) => delete it.fresh); }

  /* ---------- Dar la vuelta a la hoja ---------- */
  function animate(el, frames, ms, easing) {
    if (reduced() || !el.animate) return Promise.resolve();
    return el.animate(frames, { duration: ms, easing: easing || "cubic-bezier(.35,.05,.25,1)", fill: "both" }).finished;
  }
  async function flipTo(target) {
    if (state.busy || target === state.cur) return;
    const book = $("#book");
    const forward = target > state.cur;
    const old = state.cur;
    state.busy = true;
    state.cur = target;
    state.side = "l";
    applyEra(target);
    state.calY = parse(target).getFullYear(); state.calM = parse(target).getMonth();
    if (isPhone()) {
      const leaf = document.createElement("div");
      leaf.className = "leaf";
      leaf.innerHTML = '<div class="face front">' + (forward ? renderLeft(old, false) : renderLeft(target, false)) + '<span class="shade"></span></div>';
      book.appendChild(leaf);
      if (forward) paint();
      await animate(leaf, forward ? [{ transform: "rotateY(0deg)", opacity: 1 }, { transform: "rotateY(-100deg)", opacity: .2 }] : [{ transform: "rotateY(-100deg)", opacity: .2 }, { transform: "rotateY(0deg)", opacity: 1 }], 520);
      if (!forward) paint();
      leaf.remove();
    } else {
      const leaf = document.createElement("div");
      leaf.className = "leaf";
      const front = forward ? renderRight(old, false) : renderRight(target, false);
      const back = forward ? renderLeft(target, false) : renderLeft(old, false);
      leaf.innerHTML = '<div class="face front page" style="position:absolute;left:0;width:100%">' + front + '<span class="shade"></span></div><div class="face back page" style="position:absolute;left:0;width:100%">' + back + '<span class="shade"></span></div>';
      if (forward) { $("#pageR").innerHTML = renderRight(target, true); } else { $("#pageL").innerHTML = renderLeft(target, true); }
      book.appendChild(leaf);
      const shades = leaf.querySelectorAll(".shade");
      shades.forEach((sh) => { if (!reduced() && sh.animate) sh.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 760, fill: "both" }); });
      await animate(leaf, forward ? [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }] : [{ transform: "rotateY(-180deg)" }, { transform: "rotateY(0deg)" }], 760);
      paint();
      leaf.remove();
    }
    state.busy = false;
    refreshDesk();
  }
  async function flipSidePhone(side) {
    if (state.side === side || state.busy) return;
    state.side = side;
    const shown = side === "l" ? $("#pageL") : $("#pageR");
    $("#pageL").classList.toggle("show", side === "l");
    $("#pageR").classList.toggle("show", side === "r");
    await animate(shown, [{ transform: "translateX(" + (side === "r" ? "6%" : "-6%") + ")", opacity: .3 }, { transform: "none", opacity: 1 }], 240);
  }

  /* ---------- Portada ---------- */
  let closed = true;
  async function openBook() {
    if (!closed || state.busy) return;
    state.busy = true; closed = false;
    $("#coverBack").innerHTML = '<div class="page left" style="position:absolute;inset:0;width:100%;left:0;display:block">' + renderLeft(state.cur, false) + "</div>";
    const cover = $("#cover");
    $("#book").classList.remove("closed");
    if (isPhone()) await animate(cover, [{ transform: "rotateY(0deg)", opacity: 1 }, { transform: "rotateY(-95deg)", opacity: 0 }], 800);
    else await animate(cover, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }], 1000);
    cover.hidden = true;
    state.busy = false;
    setCloseLabel();
    try {
      if (isPhone() && !localStorage.getItem("mireya-diario-desliza")) {
        localStorage.setItem("mireya-diario-desliza", "1");
        toast("Desliza la hoja para cambiar de día");
      }
    } catch {}
  }
  async function closeBook() {
    if (closed || state.busy) return;
    state.busy = true; closed = true;
    const cover = $("#cover");
    cover.hidden = false;
    $("#coverBack").innerHTML = '<div class="page left" style="position:absolute;inset:0;width:100%;left:0;display:block">' + renderLeft(state.cur, false) + "</div>";
    $("#book").classList.add("closed");
    if (isPhone()) await animate(cover, [{ transform: "rotateY(-95deg)", opacity: 0 }, { transform: "rotateY(0deg)", opacity: 1 }], 800);
    else await animate(cover, [{ transform: "rotateY(-180deg)" }, { transform: "rotateY(0deg)" }], 900);
    state.busy = false;
    setCloseLabel();
  }
  function setCloseLabel() { $("#btnClose").innerHTML = I.book + '<span class="lbl">' + (closed ? "Abrir" : "Cerrar") + "</span>"; $("#btnClose").setAttribute("aria-label", closed ? "Abrir el diario" : "Cerrar el diario"); $("#desk").classList.toggle("is-closed", closed); }

  /* ---------- Calendario ---------- */
  function faceStack(e, max) {
    const ms = moodsOf(e);
    if (!ms.length) return "";
    return '<span class="fcs">' + ms.slice(0, max).map((k) => '<span class="fc">' + face(k) + "</span>").join("") + (ms.length > max ? '<span class="more">+' + (ms.length - max) + "</span>" : "") + "</span>";
  }
  function calHtml(y, mo, opts) {
    const o = opts || {};
    const era = eraOf(mo);
    const first = new Date(y, mo, 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(y, mo + 1, 0).getDate();
    let cells = "";
    for (let i = 0; i < lead; i++) cells += '<span class="day out"></span>';
    for (let d = 1; d <= count; d++) {
      const s = y + "-" + pad(mo + 1) + "-" + pad(d);
      const e = state.entries[s];
      const ls = lettersOn(s);
      const cls = ["day"];
      if (moodsOf(e).length) cls.push("has-face");
      if (e && hasContent(e)) cls.push("has-text");
      if (s === TODAY) cls.push("today");
      if (s > TODAY) cls.push("fut");
      if (o.pick ? s === o.pick : s === state.cur) cls.push("sel");
      const act = o.pickAct ? 'data-act="' + o.pickAct + '" data-d="' + s + '"' : 'data-act="cal-day" data-d="' + s + '"';
      const disabled = o.pickAct && s <= TODAY ? "disabled" : "";
      const aria = longDate(s) + (moodsOf(e).length ? ", " + moodsOf(e).map((k) => MOODS[k].label).join(", ") : "") + (ls.length ? ", tiene carta" : "");
      cells += '<button type="button" class="' + cls.join(" ") + '" data-cal="' + s + '" ' + act + " " + disabled + ' aria-label="' + esc(aria) + '"><span class="n">' + d + "</span>" + faceStack(e, o.small || o.preview ? 1 : isPhone() ? 2 : 3) + (ls.length ? envSvg(ls[0].sealed, canOpen(ls[0])) : "") + "</button>";
    }
    const dow = ["L", "M", "M", "J", "V", "S", "D"].map((x) => "<span>" + x + "</span>").join("");
    const expand = o.small ? '<button type="button" class="expand" data-act="calendar">Ver mi calendario completo</button>' : "";
    const legend = o.legend ? '<div class="legend"><span>' + envSvg(true, false) + "carta sellada</span><span>" + envSvg(true, true) + "carta lista para leer</span><span>" + envSvg(false, false) + "carta sin sellar</span></div>" : "";
    const nav = o.navAct || "cal-nav";
    const chip = '<button type="button" class="era-chip" data-act="pick-era" data-m="' + mo + '" aria-label="Elegir la era de ' + MONTHS[mo] + '">' + (era ? '<span class="mo">' + era.mo + "</span><span>era " + esc(era.n) + "</span>" : "<span>Elegir una era</span>") + '<svg class="ch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>';
    const bg = bgFor(y, mo);
    const soft = era ? era.s : "#eaf3fb";
    const rgb = [1, 3, 5].map((i) => parseInt(soft.slice(i, i + 2), 16)).join(",");
    const vars = "--era:" + (era ? era.c : "#6ea3d6") + ";--era-soft:" + soft + ";--era-ink:" + (era ? era.i : "#3a6ea5") + ";--sheet:rgba(" + rgb + "," + (o.pickAct || !bg ? 1 : (100 - state.calSee) / 100) + ")";
    return '<div class="cal" style="' + vars + '">' + (bg ? '<div class="cal-photo" style="background:' + bg + '"></div>' : "") +
      '<button type="button" class="cal-change" data-act="bg" aria-label="Cambiar la imagen del calendario">' + I.photo + (o.small ? "" : "Cambiar imagen") + "</button>" +
      '<div class="cal-sheet">' + (era ? '<span class="cal-mark" aria-hidden="true">' + era.mo + "</span>" : "") + '<div class="bracelet" aria-hidden="true">' + braceletFor(era) + "</div>" +
      '<div class="cal-head"><button type="button" class="mnav" data-act="' + nav + '" data-dir="-1" aria-label="Mes anterior">' + I.left + '</button><div class="cal-title"><b>' + MONTHS[mo] + "</b><small>" + y + '</small></div><button type="button" class="mnav" data-act="' + nav + '" data-dir="1" aria-label="Mes siguiente">' + I.right + "</button></div>" + chip +
      '<div class="dow">' + dow + '</div><div class="grid">' + cells + "</div>" + legend + expand + "</div></div>";
  }
  function moveMonth(dir) {
    let mo = state.calM + dir, y = state.calY;
    if (mo < 0) { mo = 11; y--; }
    if (mo > 11) { mo = 0; y++; }
    state.calM = mo; state.calY = y;
  }
  function renderCalSmall(anim) {
    const box = $("#calSmall");
    box.innerHTML = calHtml(state.calY, state.calM, { small: true });
    if (anim) animate(box.querySelector(".cal-sheet"), [{ transform: "translateY(8px)", opacity: .35 }, { transform: "none", opacity: 1 }], 280);
  }
  function renderStrip() {
    const start = addDays(state.cur, -3);
    let html = "";
    for (let i = 0; i < 7; i++) {
      const s = addDays(start, i);
      const e = state.entries[s];
      const ls = lettersOn(s);
      html += '<button type="button" class="sd ' + (s === state.cur ? "on" : "") + '" data-act="cal-day" data-d="' + s + '" aria-label="' + esc(longDate(s)) + '"><span>' + esc(fmt(s, { weekday: "short" }).slice(0, 3)) + "</span>" + (moodsOf(e).length ? faceStack(e, 1) : '<span class="blank">' + parse(s).getDate() + "</span>") + (ls.length ? envSvg(ls[0].sealed, canOpen(ls[0])) : "") + "</button>";
    }
    $("#strip").innerHTML = html;
  }
  const hojas = (n) => n + (n === 1 ? " hoja" : " hojas");
  // Solo se ven unas pocas: las que más usa quedan primero y las demás viven en "Ver todas".
  function renderFoldersMini() {
    const counts = {};
    Object.values(state.entries).forEach((e) => { if (e.folder) counts[e.folder] = (counts[e.folder] || 0) + 1; });
    const list = state.folders, many = list.length > 4;
    const tiles = (many ? list.slice(0, 3) : list).map((f) => '<button type="button" class="fold" data-folder="' + f.id + '" data-act="folders" data-open="' + f.id + '" style="--fc:' + f.color + '"><b>' + esc(f.name) + "</b><small>" + hojas(counts[f.id] || 0) + "</small></button>").join("");
    $("#foldersMini").innerHTML = tiles + (many ? '<button type="button" class="fold more-f" data-act="folders" data-open="' + list[3].id + '"><b>Ver todas</b><small>' + list.length + " carpetitas</small></button>" : "");
  }
  function renderLetterbox() {
    const ready = state.letters.filter((l) => canOpen(l) && !l.opened).length;
    $("#letterbox").innerHTML = '<span class="e">' + envSvg(true, ready > 0).replace('class="env"', 'class="env big"') + "</span><span><b>Cartas a mi yo del futuro</b><small>" + state.letters.length + (state.letters.length === 1 ? " guardada" : " guardadas") + (ready ? " · " + ready + " lista" + (ready > 1 ? "s" : "") + " para leer" : "") + "</small></span>";
  }
  function refreshDesk() { renderCalSmall(); renderStrip(); renderFoldersMini(); renderLetterbox(); }

  /* ---------- Barra del celular ---------- */
  const duo = (shape) => '<svg viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + shape + "</svg>";
  const NAV = {
    cal: duo('<rect x="4" y="6.500" width="20" height="18" rx="4.500" fill="var(--nav-fill)"/><path d="M4 12h20M9.500 4v4.500M18.500 4v4.500"/><path d="M14 21.500c-3-2-4.200-3.300-4.200-4.800 0-1.200 1-2 2-2 .9 0 1.700.5 2.200 1.300.5-.8 1.300-1.300 2.200-1.300 1 0 2 .8 2 2 0 1.500-1.200 2.800-4.200 4.800z" fill="currentColor" stroke="none"/>'),
    mail: duo('<rect x="3.500" y="7" width="21" height="15.500" rx="3.500" fill="var(--nav-fill)"/><path d="M4.500 8.500L14 16l9.500-7.500"/><circle cx="14" cy="16.500" r="2.600" fill="currentColor" stroke="none"/>'),
    book: duo('<path d="M14 8c-2.600-2-6-2.500-10-2v15.500c4-.5 7.400 0 10 2 2.600-2 6-2.500 10-2V6c-4-.5-7.400 0-10 2z" fill="var(--nav-fill)"/><path d="M14 8v15.500"/><path d="M8 11c1.300-.2 2.500 0 3.500.5M8 15c1.300-.2 2.500 0 3.500.5M16.500 11.500c1-.5 2.200-.7 3.500-.5M16.500 15.500c1-.5 2.200-.7 3.500-.5"/>'),
    folder: duo('<path d="M3.500 9a2.500 2.500 0 012.500-2.500h5l2.600 3H22A2.500 2.500 0 0124.500 12v8.500A2.500 2.500 0 0122 23H6a2.500 2.500 0 01-2.500-2.500z" fill="var(--nav-fill)"/><path d="M14 19.800c-2.300-1.500-3.300-2.600-3.300-3.700 0-1 .8-1.600 1.600-1.600.7 0 1.300.4 1.700 1 .4-.6 1-1 1.700-1 .8 0 1.600.6 1.600 1.600 0 1.100-1 2.200-3.300 3.700z" fill="currentColor" stroke="none"/>'),
    search: duo('<circle cx="12.500" cy="12.500" r="8" fill="var(--nav-fill)"/><path d="M18.500 18.500L24 24"/><path d="M12.500 8.500l.9 2.600 2.600.9-2.600.9-.9 2.600-.9-2.600-2.600-.9 2.600-.9z" fill="currentColor" stroke="none"/>'),
  };
  const navBtn = (act, icon, label, kind) => '<button type="button" data-act="' + act + '" data-kind="' + kind + '">' + icon + "<span>" + label + "</span></button>";
  function markNav(kind) { document.querySelectorAll("#bottomNav button").forEach((b) => b.classList.toggle("on", b.dataset.kind === (kind || ""))); }

  /* ---------- Capas ---------- */
  let lastFocus = null;
  function openSheet(kind, html) {
    if (!$("#ovRoot").firstChild) lastFocus = document.activeElement;
    markNav(kind);
    $("#ovRoot").innerHTML = '<div class="ov ov-' + kind + '" data-act="backdrop" role="dialog" aria-modal="true"><div class="sheet ' + kind + '"><button type="button" class="close" data-act="close-ov" aria-label="Cerrar">' + I.close + "</button>" + html + "</div></div>";
    const first = $("#ovRoot input, #ovRoot textarea");
    if (first && !isPhone()) first.focus();
  }
  function closeSheet() { markNav(""); $("#ovRoot").innerHTML = ""; lastFocus?.focus?.(); }
  function refreshSheet(html) { const sheet = $("#ovRoot .sheet"); const top = sheet.scrollTop; const btn = sheet.querySelector(".close").outerHTML; sheet.style.animation = "none"; sheet.innerHTML = btn + html; sheet.scrollTop = top; }

  function toast(text) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = text;
    root.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  /* Calendario grande */
  function bigCalHtml() {
    const tabs = '<div class="cal-tabs"><button type="button" class="ctab ' + (state.bigTab === "mes" ? "on" : "") + '" data-act="big-tab" data-t="mes">Este mes</button><button type="button" class="ctab ' + (state.bigTab === "año" ? "on" : "") + '" data-act="big-tab" data-t="año">Mi año en caritas</button></div>';
    if (state.bigTab === "año") {
      let html = '<div class="year">';
      for (let mo = 0; mo < 12; mo++) {
        const lead = (new Date(state.calY, mo, 1).getDay() + 6) % 7, count = new Date(state.calY, mo + 1, 0).getDate();
        let cells = "";
        for (let i = 0; i < lead; i++) cells += '<i class="out"></i>';
        for (let d = 1; d <= count; d++) { const e = state.entries[state.calY + "-" + pad(mo + 1) + "-" + pad(d)]; cells += "<i" + (moodsOf(e).length ? ' style="background:' + MOODS[moodsOf(e)[0]].b + '"' : "") + "></i>"; }
        const yEra = eraOf(mo);
        html += '<button type="button" class="ym" ' + (yEra ? 'style="--ys:' + yEra.s + ";--yi:" + yEra.i + '" ' : "") + 'data-act="big-month" data-m="' + mo + '"><b>' + MONTHS[mo] + '</b><span class="pix">' + cells + "</span></button>";
      }
      return tabs + html + "</div>" + legendMoods();
    }
    const counts = {};
    Object.entries(state.entries).forEach(([s, e]) => { const d = parse(s); if (d.getMonth() === state.calM && d.getFullYear() === state.calY) moodsOf(e).forEach((k) => { counts[k] = (counts[k] || 0) + 1; }); });
    const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const mm = keys.length ? '<div class="month-mood"><h4>así estuvo mi mes</h4>' + keys.map((k) => '<span class="mm" title="' + MOODS[k].label + '">' + face(k) + counts[k] + "</span>").join("") + "</div>" : '<div class="month-mood"><h4>todavía no hay caritas este mes</h4></div>';
    const foot = eraOf(state.calM);
    return calHtml(state.calY, state.calM, { navAct: "big-nav", legend: true }) + '<div class="cal-foot"' + (foot ? ' style="background:' + foot.s + '"' : "") + ">" + tabs + mm + "</div>";
  }
  function legendMoods() { return '<div class="month-mood" style="gap:8px 13px">' + Object.keys(MOODS).map((k) => '<span class="mm" style="font-weight:500">' + face(k) + MOODS[k].label + "</span>").join("") + "</div>"; }

  /* Cómo me sentí */
  function feelSheetHtml() {
    const e = state.entries[state.cur] || { moods: [], feel: "" };
    const opts = ["estuve", "mil", "feliz", "tranquila", "agradecida", "nostalgica", "sensible", "triste", "cansada", "ansiosa", "enojada", "nose"].map((k) => '<button type="button" class="feel-opt ' + (moodsOf(e).includes(k) ? "on" : "") + '" data-act="feel-toggle" data-m="' + k + '" aria-pressed="' + moodsOf(e).includes(k) + '">' + face(k) + MOODS[k].label + "</button>").join("");
    return '<h2>¿Cómo te sentiste hoy?</h2><p class="sub">Elige todas las que quieras. Casi nunca es una sola.</p><div class="feel-grid">' + opts + '</div><label class="feel-words" for="feelTxt"><span>o dilo con tus palabras</span><textarea id="feelTxt" maxlength="300" placeholder="hoy me sentí…">' + esc(e.feel) + '</textarea></label><div class="actions"><button type="button" class="btn" data-act="close-ov">Listo</button></div>';
  }
  function paintFeel() {
    const old = $("#pageL .feel");
    if (old) old.outerHTML = feelHtml(ent(state.cur), true);
  }
  /* Tinta y letra de cada hoja o carta */
  const penTargetObj = () => (state.penTarget === "letter" ? draft : ent(state.cur));
  function penSheetHtml() {
    const o = penTargetObj();
    const isLetter = state.penTarget === "letter";
    return "<h2>Tinta y letra</h2><p class=\"sub\">" + (isLetter ? "Solo para esta carta." : "Solo para esta hoja. Cada día puede ser distinto.") + '</p><div class="pen-prev" id="penPrev" style="' + penVars(o) + '">Querido diario, hoy…</div><h4 class="pen-h">la tinta</h4><div class="ink-grid">' + INKS.map((c) => '<button type="button" class="ink ' + (o.ink === c ? "on" : "") + '" style="--c:' + c + '" data-act="pen-ink" data-c="' + c + '" aria-label="Tinta ' + c + '" aria-pressed="' + (o.ink === c) + '"></button>').join("") + '</div><h4 class="pen-h">la letra</h4><div class="font-grid">' + Object.entries(FONTS).map(([k, f]) => '<button type="button" class="font-opt ' + (o.font === k ? "on" : "") + '" data-act="pen-font" data-f="' + k + '" aria-pressed="' + (o.font === k) + '"><b style="font-family:' + f.f + ";font-size:" + 24 * f.z + 'px">Querido diario</b><small>' + f.n + '</small></button>').join("") + '</div><div class="actions"><button type="button" class="btn" data-act="pen-done">Listo</button></div>';
  }
  function penChange(field, value) {
    penTargetObj()[field] = value;
    state[field] = value;
    const o = penTargetObj();
    $("#penPrev").setAttribute("style", penVars(o));
    document.querySelectorAll("#ovRoot .ink").forEach((b) => { const on = b.dataset.c === o.ink; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    document.querySelectorAll("#ovRoot .font-opt").forEach((b) => { const on = b.dataset.f === o.font; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    saveSettings();
    if (state.penTarget === "page") { touch(state.cur); const v = penVars(o); document.querySelectorAll("#pageL .inner, #pageR .inner").forEach((n) => n.setAttribute("style", v)); }
  }
  function penDone() {
    if (state.penTarget === "letter") openSheet("compose", composeHtml());
    else closeSheet();
  }

  /* Elegir era */
  function eraSheetHtml(mo) {
    const opts = ERAS.map((e, i) => {
      const other = state.eraBy.map((v, m) => (v === i && m !== mo ? MONTHS[m] : null)).filter(Boolean);
      return '<button type="button" class="era-opt ' + (state.eraBy[mo] === i ? "on" : "") + '" style="--es:' + e.s + ";--ei:" + e.i + '" data-act="set-era" data-m="' + mo + '" data-e="' + i + '"><span class="mo">' + e.mo + "</span><b>" + esc(e.n) + "</b><small>" + esc(e.song) + "</small>" + (other.length ? "<em>en " + other.join(", ") + "</em>" : "") + "</button>";
    }).join("");
    const none = '<button type="button" class="era-opt ' + (state.eraBy[mo] === -1 ? "on" : "") + '" style="--es:#eef5fb;--ei:#3a6ea5" data-act="set-era" data-m="' + mo + '" data-e="-1"><b>Sin era</b><small>Solo mi imagen</small></button>';
    return "<h2>¿Qué era quieres para " + MONTHS[mo] + '?</h2><p class="sub">Tú decides. Puedes repetirlas y cambiarlas cuando quieras.</p><div class="era-grid">' + opts + none + "</div>";
  }
  /* Elegir imagen */
  function bgSheetHtml() {
    const current = bgFor(state.calY, state.calM);
    const era = eraOf(state.calM);
    const mine = state.myBg && bgCss(state.myBg) ? [{ id: "mine", n: "Mi foto", css: bgCss(state.myBg) }] : [];
    const opts = [...mine, ...PRESETS].map((p) => '<button type="button" class="bg-opt ' + (current === p.css ? "on" : "") + '" style="background:' + p.css + '" data-act="bg-set" data-id="' + p.id + '"><span>' + p.n + "</span></button>").join("");
    return '<h2>La imagen de mi calendario</h2><p class="sub">Elige una o sube la que tú quieras.</p>' +
      '<div class="bg-layout"><div><div class="bg-grid"><button type="button" class="bg-opt up" data-act="bg-upload">' + I.photo + 'Subir mi imagen</button>' + opts + '</div><button type="button" class="bg-none ' + (!current ? "on" : "") + '" style="--ns:' + (era ? era.s : "#eaf3fb") + '" data-act="bg-none"><i></i>' + (era ? "Usar el color de la era" : "Sin imagen") + "</button>" +
      '<div class="scope" role="group" aria-label="Dónde usarla"><button type="button" class="' + (state.bgScope === "todos" ? "on" : "") + '" data-act="bg-scope" data-v="todos">En todos los meses</button><button type="button" class="' + (state.bgScope === "mes" ? "on" : "") + '" data-act="bg-scope" data-v="mes">Solo en ' + MONTHS[state.calM] + "</button></div>" +
      (current ? '<label class="see-ctl" for="calSee">Qué tanto se ve tu imagen<input id="calSee" type="range" min="10" max="60" step="2" value="' + state.calSee + '"><span><i>poco</i><i>mucho</i></span></label>' : "") +
      '</div><div class="bg-prev" aria-hidden="true">' + calHtml(state.calY, state.calM, { preview: true }) + "</div></div>";
  }
  function applyBg(css) {
    if (state.bgScope === "mes") state.bgMonth[state.calY + "-" + state.calM] = css;
    else { state.bgAll = css; state.bgMonth = {}; }
    saveSettings();
    renderCalSmall();
    refreshSheet(bgSheetHtml());
  }
  function backToCalendar(from) {
    if (from === "big") { state.bigTab = "mes"; openSheet("big-cal", bigCalHtml()); } else closeSheet();
  }

  /* Búsqueda */
  function matches(s, e) {
    const f = state.search;
    const d = parse(s);
    if (f.moods.length && !f.moods.some((k) => moodsOf(e).includes(k))) return false;
    if (f.month !== null && d.getMonth() !== f.month) return false;
    if (f.folder && e.folder !== f.folder) return false;
    for (const h of f.has) if (!e.items.some((it) => it.type === h)) return false;
    const q = f.q.trim().toLowerCase();
    if (!q) return true;
    const dateTxt = fmt(s, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toLowerCase() + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3);
    const stuff = [e.day, ...e.items.map((it) => (it.t || "") + " " + (it.a || "") + " " + (it.cap || "") + " " + (it.text || "")), e.feel || "", ...moodsOf(e).map((k) => MOODS[k].label)].join(" ").toLowerCase();
    return q.split(/\s+/).every((w) => stuff.includes(w) || dateTxt.includes(w));
  }
  function snippet(e, q) {
    const text = [e.day, thoughtText(e)].filter(Boolean).join(" · ") || e.items.map((it) => it.t || it.text || it.cap).join(" · ") || "Solo dejó cómo se sintió este día.";
    const w = q.trim().split(/\s+/)[0];
    if (!w) return esc(text.slice(0, 130));
    const i = text.toLowerCase().indexOf(w.toLowerCase());
    if (i < 0) return esc(text.slice(0, 130));
    const start = Math.max(0, i - 40);
    const piece = text.slice(start, i + 90) + (i + 90 < text.length ? "…" : "");
    const j = i - start;
    return (start ? "…" : "") + esc(piece.slice(0, j)) + "<mark>" + esc(piece.slice(j, j + w.length)) + "</mark>" + esc(piece.slice(j + w.length));
  }
  function resultsHtml() {
    const f = state.search;
    const rows = Object.entries(state.entries).filter(([s, e]) => hasContent(e) && matches(s, e)).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const active = f.q.trim() || f.moods.length || f.month !== null || f.has.length || f.folder;
    const title = active ? (rows.length === 1 ? "encontré 1 hoja" : "encontré " + rows.length + " hojas") : "mi historial, de lo más nuevo a lo más viejo";
    const list = rows.length ? rows.slice(0, 30).map(([s, e], i) => {
      const tags = [e.items.some((x) => x.type === "thought") ? I.pen : "", e.items.some((x) => x.type === "photo") ? I.photo : "", e.items.some((x) => x.type === "song") ? I.music : "", e.items.some((x) => x.type === "memo") ? I.memo : ""].join("");
      return '<button type="button" class="slip" style="--t:' + (i % 2 ? 3 : -3) + "deg;--r:" + ((i % 5) - 2) * .45 + "deg;--d:" + Math.min(i, 8) * .035 + 's" data-act="go" data-d="' + s + '">' + '<span class="fc">' + (moodsOf(e)[0] ? face(moodsOf(e)[0]) : "") + "</span>" + '<span class="body"><b>' + esc(fmt(s, { weekday: "long", day: "numeric", month: "long" })) + "</b><p>" + snippet(e, f.q) + '</p><span class="tags">' + tags + "</span></span></button>";
    }).join("") : '<div class="none">' + (active ? "No encontré esa hoja. Prueba con otra palabra o quita algún filtro." : "Todavía no hay hojas escritas. Aquí van a aparecer.") + "</div>";
    return '<h4 class="results-h">' + title + '</h4><div class="results">' + list + "</div>";
  }
  function searchFiltersHtml() {
    const f = state.search;
    const moods = Object.keys(MOODS).map((k) => '<button type="button" class="chip ' + (f.moods.includes(k) ? "on" : "") + '" data-act="f-mood" data-m="' + k + '">' + face(k) + MOODS[k].label + "</button>").join("");
    const months = ERAS.map((e, i) => '<button type="button" class="chip bd ' + (f.month === i ? "on" : "") + '" data-act="f-month" data-m="' + i + '">' + MONTHS[i].slice(0, 3).toUpperCase() + "</button>").join("");
    const has = [["thought", "un pensamiento", I.pen], ["photo", "una foto", I.photo], ["song", "una canción", I.music], ["memo", "un recuerdo", I.memo]].map(([k, t, ic]) => '<button type="button" class="chip ' + (f.has.includes(k) ? "on" : "") + '" data-act="f-has" data-h="' + k + '">' + ic + t + "</button>").join("");
    const folders = state.folders.map((x) => '<button type="button" class="chip fl ' + (f.folder === x.id ? "on" : "") + '" style="--c:' + x.color + '" data-act="f-folder" data-f="' + x.id + '">' + esc(x.name) + "</button>").join("");
    return '<div class="f-row f-scroll"><span class="f-label">cuando me sentí</span>' + moods + '</div><div class="f-row f-scroll"><span class="f-label">en</span>' + months + '</div><div class="f-row f-scroll"><span class="f-label">con</span>' + has + '</div><div class="f-row f-scroll"><span class="f-label">guardada en</span>' + folders + "</div>";
  }
  function openSearch() {
    openSheet("search", '<h2>¿Qué hoja estás buscando?</h2><div class="q-wrap">' + I.search + '<input id="q" class="q" placeholder="el cielo, Morat, noviembre…" autocomplete="off" aria-label="Buscar en mi diario" value="' + esc(state.search.q) + '"></div><div id="sFilters">' + searchFiltersHtml() + '</div><div id="sResults">' + resultsHtml() + "</div>");
  }
  function refreshSearch(filters) { if (filters) $("#sFilters").innerHTML = searchFiltersHtml(); $("#sResults").innerHTML = resultsHtml(); }

  /* Carpetitas */
  function folderHeadHtml(name, v) {
    if (v === "sueltas") return '<div class="fold-head"><h4 class="results-h">' + esc(name) + "</h4></div>";
    if (state.folderEdit === "rename") return '<form class="fold-head fold-rename" data-form="rename"><input id="renameFolder" value="' + esc(name) + '" maxlength="26" aria-label="Nuevo nombre de la carpetita"><button type="submit" class="btn">Guardar</button><button type="button" class="btn ghost" data-act="folder-cancel">Cancelar</button></form>';
    if (state.folderEdit === "delete") return '<div class="fold-confirm" role="alert"><p>¿Borrar <b>' + esc(name) + '</b>? Tus hojas no se borran: quedan en Hojas sueltas.</p><div><button type="button" class="btn" data-act="folder-delete-yes">Borrar carpetita</button><button type="button" class="btn ghost" data-act="folder-cancel">Cancelar</button></div></div>';
    return '<div class="fold-head"><h4 class="results-h">' + esc(name) + '</h4><button type="button" class="fold-act" data-act="folder-rename" aria-label="Cambiarle el nombre" title="Cambiarle el nombre">' + I.pen + '</button><button type="button" class="fold-act" data-act="folder-delete" aria-label="Borrar carpetita" title="Borrar carpetita">' + I.trash + "</button></div>";
  }
  function refreshFolders() {
    const left = $("#ovRoot .fold-grid")?.scrollLeft ?? 0;
    refreshSheet(foldersHtml());
    $("#ovRoot .fold-grid").scrollLeft = left;
  }
  function renameFolder() {
    const f = state.folders.find((x) => x.id === state.folderView), name = $("#renameFolder").value.trim();
    if (!f || !name) return $("#renameFolder").focus();
    send("/folders/" + f.id, "PATCH", { name }).then(() => {
      f.name = name;
      state.folderEdit = null;
      refreshFolders(); refreshDesk(); paintFolderTag();
    }).catch(() => toast("No pude cambiarle el nombre. Intenta otra vez."));
  }
  function deleteFolder() {
    const id = state.folderView;
    api("/folders/" + id, { method: "DELETE" }).then(() => {
      state.folders = state.folders.filter((f) => f.id !== id);
      Object.values(state.entries).forEach((e) => { if (e.folder === id) e.folder = null; });
      if (state.search.folder === id) state.search.folder = null;
      state.folderView = "sueltas";
      state.folderEdit = null;
      refreshFolders(); refreshDesk(); paintFolderTag();
      toast("Carpetita borrada. Tus hojas siguen en Hojas sueltas.");
    }).catch(() => toast("No pude borrarla. Intenta otra vez."));
  }

  /* Cambiar la clave */
  function pinSheetHtml(hint) {
    const field = (id, label, auto) => '<label class="pin-field" for="' + id + '">' + label + '<input id="' + id + '" type="password" inputmode="numeric" maxlength="6" autocomplete="' + auto + '"></label>';
    return '<h2>Mi clave</h2><p class="sub">Solo tú la sabes. Son 6 números.</p><form class="pin-form" data-form="pin">' + field("pinNow", "Clave actual", "current-password") + field("pinNew", "Clave nueva", "new-password") + field("pinAgain", "Repite la clave nueva", "new-password") +
      '<label class="pin-field" for="pinHint">Pista, para que no se te olvide<input id="pinHint" maxlength="200" value="' + esc(hint) + '"></label><p class="pin-error" id="pinError" role="alert"></p><div class="actions"><button type="submit" class="btn" id="pinSave">Guardar mi clave</button></div></form>';
  }
  async function savePin() {
    const now = $("#pinNow").value, next = $("#pinNew").value, hint = $("#pinHint").value.trim(), err = $("#pinError"), btn = $("#pinSave");
    err.textContent = "";
    if (!/^\d{6}$/.test(next)) return (err.textContent = "La clave nueva debe tener 6 números.");
    if (next !== $("#pinAgain").value) return (err.textContent = "Las claves nuevas no coinciden.");
    if (!hint) return (err.textContent = "Escribe una pista para que no se te olvide.");
    btn.disabled = true;
    const res = await fetch("/api/diario-lock", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_pin: now, new_pin: next, hint }) }).catch(() => null);
    if (!$("#pinSave")) return;
    btn.disabled = false;
    if (res?.ok) { closeSheet(); toast("Listo, tu clave cambió."); return; }
    err.textContent = res?.status === 429 ? "Demasiados intentos. Espera un minuto." : res?.status === 401 ? "La clave actual no es correcta." : "No se pudo cambiar. Intenta otra vez.";
  }
  function swatchesHtml() {
    const dot = (c) => '<button type="button" class="swatch ' + (state.newColor === c ? "on" : "") + '" style="--c:' + c + '" data-act="swatch" data-c="' + c + '" aria-label="Color"></button>';
    const first = COLORS.includes(state.newColor) && COLORS.indexOf(state.newColor) > 2 ? [COLORS[0], COLORS[1], state.newColor] : COLORS.slice(0, 3);
    return '<span class="few-colors" id="fewColors">' + first.map(dot).join("") + '<button type="button" class="swatch swatch-more" data-act="swatch-more" aria-label="Más colores"></button></span><span class="more-colors" id="moreColors" hidden>' + COLORS.map(dot).join("") + "</span>";
  }
  function foldersHtml() {
    const counts = {};
    let loose = 0;
    const rows = Object.entries(state.entries).filter(([, e]) => hasContent(e));
    rows.forEach(([, e]) => { if (e.folder) counts[e.folder] = (counts[e.folder] || 0) + 1; else loose++; });
    const v = state.folderView;
    const grid = '<button type="button" class="fold ' + (v === "sueltas" ? "on" : "") + '" style="--fc:#ffffff" data-folder="sueltas" data-act="fv" data-v="sueltas"><b>Hojas sueltas</b><small>' + hojas(loose) + "</small></button>" + state.folders.map((f) => '<button type="button" class="fold ' + (v === f.id ? "on" : "") + '" style="--fc:' + f.color + '" data-folder="' + f.id + '" data-act="fv" data-v="' + f.id + '"><b>' + esc(f.name) + "</b><small>" + hojas(counts[f.id] || 0) + "</small></button>").join("");
    const list = rows.filter(([, e]) => (v === "sueltas" ? !e.folder : e.folder === v)).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const name = v === "sueltas" ? "Hojas sueltas" : state.folders.find((f) => f.id === v)?.name;
    const cards = list.length ? list.map(([s, e]) => '<div class="card" data-card="' + s + '">' + (moodsOf(e)[0] ? '<span class="fc">' + face(moodsOf(e)[0]) + "</span>" : "") + '<span class="body"><b>' + esc(fmt(s, { day: "numeric", month: "long" })) + "</b><p>" + esc((e.day || thoughtText(e) || "Hoja con cosas pegadas").slice(0, 70)) + '</p></span><span class="gr" aria-hidden="true" style="width:28px">' + I.grip.replace("<svg", '<svg width="18" height="18"') + "</span></div>").join("") : '<div class="none" style="padding:16px">Esta carpetita está vacía. Arrastra una hoja hasta aquí.</div>';
    return '<h2>Mis carpetitas</h2><p class="sub">Agarra una hoja y suéltala en la carpetita que quieras.</p><div class="fold-grid">' + grid + '</div><form class="new-f" data-form="folder"><input id="newFolder" placeholder="Nueva carpetita" maxlength="26" aria-label="Nombre de la carpetita">' + '<span id="swatchBox" class="swatches">' + swatchesHtml() + "</span>" + '<button type="submit" class="btn ghost">Crear</button></form>' + folderHeadHtml(name, v) + '<div class="cards">' + cards + "</div>";
  }

  /* Cartas */
  function lettersHtml() {
    const sorted = state.letters.slice().sort((a, b) => (a.to < b.to ? -1 : 1));
    const cards = sorted.map((l) => {
      const ready = canOpen(l);
      const left = daysBetween(TODAY, l.to);
      const status = l.sealed ? (ready ? "Ya llegó. Ábrela cuando quieras." : "Sellada. Faltan " + left + " días.") : "Sin sellar. Léela cuando quieras.";
      return '<button type="button" class="letter-card" data-act="read-letter" data-l="' + l.id + '"><div style="container-type:inline-size">' + envelope(l.sealed && !l.opened, l.opened) + "</div><p>Para el " + esc(longDate(l.to)) + "</p><small>" + status + "</small></button>";
    }).join("");
    return '<h2>Cartas a mi yo del futuro</h2><p class="sub">Escríbete hoy algo para leerlo más adelante.</p><div class="actions" style="justify-content:flex-start"><button type="button" class="btn" data-act="compose">' + I.mail + 'Escribir una carta</button></div><div class="box-grid">' + cards + "</div>";
  }
  function envelope(sealed, open) {
    return '<div class="envelope ' + (open ? "is-open" : "") + '"><span class="bk"></span><span class="pp"></span><span class="fr"></span><span class="fl"></span>' + (sealed ? '<span class="wax">M</span>' : "") + "</div>";
  }
  let draft = null;
  function composeHtml() {
    const d = draft;
    const opts = [["1 mes", addDays(TODAY, 30)], ["6 meses", addDays(TODAY, 182)], ["1 año", addDays(TODAY, 365)]].map(([t, s]) => '<button type="button" class="chip ' + (d.to === s ? "on" : "") + '" data-act="draft-to" data-d="' + s + '" style="padding:3px 13px">En ' + t + "</button>").join("");
    return '<h2>Querida yo del futuro</h2><div style="' + penVars(d) + '"><textarea id="letterTxt" class="letter-paper" data-draft="' + LETTER_DRAFT + '" maxlength="100000" placeholder="Hoy quiero contarte…" aria-label="Texto de la carta">' + esc(d.text) + '</textarea><button type="button" class="pen-btn pen-letter-btn" style="--s:8.6px" data-act="pen" data-t="letter"><i></i><b>Aa</b>Tinta y letra</button></div><div class="when"><h4>¿Para cuándo es?</h4><div class="f-row" style="margin-top:0">' + opts + '</div><div class="pick-cal">' + calHtml(d.y, d.m, { pick: d.to, pickAct: "draft-to", navAct: "draft-nav" }) + '</div></div><div class="when"><h4 class="seal-q">¿Cómo la guardo?</h4><div class="seal-opts"><button type="button" class="seal-opt ' + (d.sealed ? "on" : "") + '" data-act="draft-seal" data-v="1"><span class="ic" style="color:var(--wax)">' + I.lock + '</span><span><b>Sellarla hasta ese día</b><small>No se puede abrir antes.</small></span></button><button type="button" class="seal-opt ' + (!d.sealed ? "on" : "") + '" data-act="draft-seal" data-v="0"><span class="ic">' + I.mail + '</span><span><b>Dejarla sin sellar</b><small>La lees en cualquier momento.</small></span></button></div></div><div class="actions"><button type="button" class="btn ghost" data-act="letters">Cancelar</button><button type="button" class="btn" data-act="save-letter">' + (d.sealed ? "Sellar y guardar" : "Guardar carta") + "</button></div>";
  }
  async function sealAnimation(letter) {
    closeSheet();
    const stage = document.createElement("div");
    stage.className = "seal-stage";
    stage.innerHTML = envelope(false, true);
    root.appendChild(stage);
    const env = stage.firstChild, flap = env.querySelector(".fl"), pp = env.querySelector(".pp");
    if (!reduced()) {
      await animate(env, [{ transform: "translateY(30px) scale(.8)", opacity: 0 }, { transform: "none", opacity: 1 }], 260);
      if (pp.animate) await pp.animate([{ transform: "translateY(-46%)" }, { transform: "translateY(0)" }], { duration: 380, easing: "ease-in", fill: "both" }).finished;
      await animate(flap, [{ transform: "rotateX(178deg)" }, { transform: "rotateX(0deg)" }], 300);
    }
    env.classList.remove("is-open");
    if (letter.sealed) {
      const w = document.createElement("span");
      w.className = "wax"; w.textContent = "M";
      env.appendChild(w);
      await animate(w, [{ transform: "translate(-50%,-50%) scale(2.4)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(.92)", opacity: 1, offset: .75 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], 340, "ease-in");
    }
    const d = parse(letter.to);
    state.calY = d.getFullYear(); state.calM = d.getMonth();
    renderCalSmall(true); renderLetterbox(); renderStrip();
    const target = isPhone() ? $("#bottomNav [data-act='letters']") : ($(`#calSmall [data-cal="${letter.to}"]`) || $("#calSmall"));
    const from = env.getBoundingClientRect(), to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - from.left - from.width / 2, dy = to.top + to.height / 2 - from.top - from.height / 2;
    await animate(env, [{ transform: "none", opacity: 1 }, { transform: "translate(" + dx + "px," + dy + "px) scale(.1) rotate(10deg)", opacity: .5 }], 620, "cubic-bezier(.5,0,.3,1)");
    stage.remove();
    const cell = $(`#calSmall [data-cal="${letter.to}"] .env`);
    if (cell) cell.classList.add("pop");
    toast(letter.sealed ? "Sellada hasta el " + longDate(letter.to) : "Guardada para el " + longDate(letter.to));
  }
  function readLetter(id) {
    const l = state.letters.find((x) => x.id === id);
    if (!l) return;
    if (!canOpen(l)) {
      const n = daysBetween(TODAY, l.to);
      openSheet("read", '<h2>Todavía no</h2><p class="sub">Esta carta se abre el ' + esc(longDate(l.to)) + ". Faltan " + n + ' días.</p><div class="read-env" id="readEnv">' + envelope(true, false) + '</div><div class="actions" style="justify-content:center"><button type="button" class="btn ghost" data-act="letters">Volver a mis cartas</button></div>');
      $("#readEnv").firstChild.classList.add("shake");
      return;
    }
    openSheet("read", '<h2>Para el ' + esc(longDate(l.to)) + '</h2><p class="sub">Te la escribiste el ' + esc(longDate(l.written)) + '.</p><div class="read-env" id="readEnv">' + envelope(l.sealed && !l.opened, l.opened) + '</div><div class="read-txt" id="readTxt" style="' + penVars({ ink: l.ink || "#27405f", font: l.font || "caveat" }) + '">' + esc(l.text) + '</div><div class="actions"><button type="button" class="btn ghost" data-act="letters">Volver a mis cartas</button></div>');
    if (!l.opened) send("/letters/" + l.id + "/open", "PATCH", {}).catch(() => {});
    if (l.sealed && !l.opened) openEnvelopeAnim(l); else l.opened = true;
    renderLetterbox();
  }
  async function openEnvelopeAnim(l) {
    const env = $("#readEnv .envelope"), txt = $("#readTxt");
    txt.style.opacity = 0;
    const wax = env.querySelector(".wax");
    if (wax) await animate(wax, [{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(-50%,-30%) scale(.6) rotate(25deg)", opacity: 0 }], 330);
    wax?.remove();
    await animate(env.querySelector(".fl"), [{ transform: "rotateX(0deg)" }, { transform: "rotateX(178deg)" }], 380);
    env.classList.add("is-open");
    l.opened = true;
    txt.style.transition = "opacity .5s"; txt.style.opacity = 1;
    renderLetterbox(); renderCalSmall();
  }

  /* Agregar canción y recuerdo */
  let songHits = [], songTimer = 0, songAsk = 0;
  const SONG_HINT = '<p class="track-hint">Escribe el nombre o el artista</p>';
  const SONG_LOADING = '<div class="track-skel"><i></i><span><b></b><u></u></span></div>'.repeat(4);
  const songList = () => songHits.map((s, i) => '<button type="button" class="track" style="--d:' + i * .035 + 's" data-act="pick-song" data-i="' + i + '"><span class="track-art">' + (s.art ? '<img src="' + esc(s.art) + '" alt="">' : I.music) + '</span><span class="track-txt"><b>' + esc(s.t) + "</b><i>" + esc(s.a) + (s.album ? " · " + esc(s.album) : "") + '</i></span><span class="track-add" aria-hidden="true">+</span></button>').join("");
  function searchSongs(q) {
    clearTimeout(songTimer);
    const box = $("#songList");
    $("#songClear").hidden = !q;
    const ask = ++songAsk;
    if (!q.trim()) { songHits = []; box.innerHTML = SONG_HINT; return; }
    box.innerHTML = SONG_LOADING;
    songTimer = setTimeout(async () => {
      try {
        songHits = await api("/spotify?q=" + encodeURIComponent(q.trim()));
        const now = $("#songList");
        if (ask !== songAsk) return;
        if (now) now.innerHTML = songHits.length ? songList() : '<p class="track-hint">No la encontré. Prueba con el nombre y el artista.</p>';
      } catch {
        const now = $("#songList");
        if (ask === songAsk && now) now.innerHTML = '<p class="track-hint">Spotify no respondió. Intenta otra vez en un momento.</p>';
      }
    }, 350);
  }
  function addItem(it) {
    const e = ent(state.cur);
    const slot = SLOTS[e.items.length % SLOTS.length];
    Object.assign(it, { x: slot.x, y: slot.y, r: Math.round(Math.random() * 10 - 5), fresh: true });
    if (it.type === "song") it.x = Math.min(it.x, 36);
    e.items.push(it);
    touch(state.cur);
    showRightSide();
    appendItem(e.items.length - 1);
    refreshDesk();
  }

  /* ---------- Arrastrar ---------- */
  function startDrag(ev, label, payload, onDrop) {
    const sx = ev.clientX, sy = ev.clientY;
    let ghost = null, hot = null;
    const move = (e) => {
      if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
        ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        ghost.innerHTML = label;
        root.appendChild(ghost);
      }
      if (!ghost) return;
      e.preventDefault();
      ghost.style.transform = "translate(" + (e.clientX - 70) + "px," + (e.clientY - 30) + "px) rotate(-4deg)";
      const row = document.querySelector("#ovRoot .fold-grid");
      if (row) {
        const b = row.getBoundingClientRect();
        if (e.clientY > b.top && e.clientY < b.bottom) row.scrollLeft += e.clientX < b.left + 50 ? -14 : e.clientX > b.right - 50 ? 14 : 0;
      }
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-folder]");
      if (under !== hot) { hot?.classList.remove("hot"); under?.classList.add("hot"); hot = under; }
    };
    const up = (e) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      if (ghost) {
        ghost.remove();
        didDrag = true;
        setTimeout(() => { didDrag = false; }, 0);
        if (hot && e.type === "pointerup") { hot.classList.remove("hot"); onDrop(hot.dataset.folder, hot); }
        else hot?.classList.remove("hot");
      } else payload?.();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }
  let didDrag = false;
  // Al enfocar un texto la ventana sube para dejarle lugar al teclado: el dedo se suelta ya
  // sobre el fondo. Solo se cierra si el toque también empezó en el fondo.
  let pressedBackdrop = false;
  listen(document, "pointerdown", (ev) => { pressedBackdrop = ev.target.classList?.contains("ov") ?? false; }, true);
  function moveToFolder(s, id) {
    const e = ent(s);
    e.folder = id === "sueltas" ? null : id;
    touch(s);
    if (id !== "sueltas") send("/folders/" + id, "PATCH", { touch: true }).catch(() => {});
    const at = state.folders.findIndex((f) => f.id === id);
    if (at > 0) state.folders.unshift(state.folders.splice(at, 1)[0]);
    const name = id === "sueltas" ? "Hojas sueltas" : state.folders.find((f) => f.id === id)?.name;
    toast("Guardada en " + name);
    if (s === state.cur) paintFolderTag();
    refreshDesk();
  }

  listen(document, "pointerdown", (ev) => {
    const knob = ev.target.closest("[data-knob]");
    if (knob) { dragKnob(ev, knob); return; }
    const it = ev.target.closest(".it");
    if (it && it.closest("#scrap") && !ev.target.closest("[data-act],[data-cap]")) { dragItem(ev, it); return; }
    if (!it) selectItem(null);
    const grip = ev.target.closest("[data-grip='page']");
    if (grip) {
      const s = state.cur;
      startDrag(ev, "<b>" + esc(fmt(s, { day: "numeric", month: "long" })) + "</b>" + esc((ent(s).day || "Mi hoja").slice(0, 44)), () => { state.folderView = ent(s).folder || "sueltas"; openSheet("drawer-big", foldersHtml()); }, (id, el) => { moveToFolder(s, id); animate(el, [{ transform: "scale(1.12)" }, { transform: "none" }], 280); });
      return;
    }
    const card = ev.target.closest("[data-card]");
    if (card && (ev.pointerType === "mouse" || ev.target.closest(".gr"))) {
      const s = card.dataset.card;
      startDrag(ev, card.querySelector(".body").innerHTML, () => go(s), (id, el) => {
        ent(s).folder = id === "sueltas" ? null : id;
        touch(s);
        const left = $("#ovRoot .fold-grid").scrollLeft;
        refreshSheet(foldersHtml()); refreshDesk(); if (s === state.cur) paintFolderTag();
        $("#ovRoot .fold-grid").scrollLeft = left;
        animate($(`[data-folder="${id}"]`), [{ transform: "scale(1.14) rotate(-2deg)" }, { transform: "none" }], 320);
      });
    }
  });
  function selectItem(node) {
    document.querySelectorAll(".it.sel").forEach((n) => n !== node && n.classList.remove("sel"));
    node?.classList.add("sel");
  }
  const place = (g) => {
    g.node.style.left = g.it.x + "%"; g.node.style.top = g.it.y + "%";
    g.node.style.transform = "rotate(" + g.it.r + "deg) scale(" + (g.it.s || 1) + ")";
  };
  // Como en una historia: con un dedo se mueve; con dos se gira y cambia de tamaño.
  let gest = null;
  function rebase(g) {
    const pts = [...g.pts.values()];
    g.ox = g.it.x; g.oy = g.it.y; g.r0 = g.it.r; g.s0 = g.it.s || 1;
    g.sx = pts[0].x; g.sy = pts[0].y;
    if (pts.length > 1) {
      g.a0 = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      g.d0 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  }
  const snap = (deg) => {
    const near = Math.round(deg / 90) * 90;
    return Math.abs(deg - near) < 4 ? near : deg;
  };
  function dragItem(ev, node) {
    selectItem(node);
    if (gest && gest.node === node) { gest.pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); rebase(gest); return; }
    const it = ent(state.cur).items[+node.dataset.i];
    const box = $("#scrap").getBoundingClientRect();
    const g = (gest = { node, it, box, pts: new Map([[ev.pointerId, { x: ev.clientX, y: ev.clientY }]]) });
    rebase(g);
    node.classList.add("dragging");
    const move = (e) => {
      if (!g.pts.has(e.pointerId)) return;
      g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...g.pts.values()];
      if (pts.length > 1) {
        const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
        const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        it.r = snap(g.r0 + (a - g.a0) * 180 / Math.PI);
        it.s = Math.max(.5, Math.min(2.4, g.s0 * d / g.d0));
      } else {
        it.x = Math.max(-10, Math.min(100 - SIZE[it.type] + 10, g.ox + (pts[0].x - g.sx) / box.width * 100));
        it.y = Math.max(-8, Math.min(88, g.oy + (pts[0].y - g.sy) / box.height * 100));
      }
      place(g);
    };
    const up = (e) => {
      g.pts.delete(e.pointerId);
      if (g.pts.size) { rebase(g); return; }
      node.classList.remove("dragging");
      gest = null;
      touch(state.cur);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }
  // Con mouse o un solo dedo: las perillas de girar y de tamaño.
  function dragKnob(ev, knob) {
    ev.preventDefault();
    const node = knob.closest(".it"), it = ent(state.cur).items[+node.dataset.i], kind = knob.dataset.knob;
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const d0 = Math.hypot(ev.clientX - cx, ev.clientY - cy) || 1, s0 = it.s || 1;
    const g = { node, it };
    const move = (e) => {
      if (kind === "rot") it.r = snap(Math.round(Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90));
      else it.s = Math.max(.5, Math.min(2.4, s0 * Math.hypot(e.clientX - cx, e.clientY - cy) / d0));
      place(g);
    };
    const up = () => { touch(state.cur); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }

  /* Pensamientos y recuerdos: se leen y editan en grande */
  const nowTime = () => new Date().toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
  const readDraft = (key) => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } };
  const writeDraft = (key, text) => { try { text ? localStorage.setItem(key, text) : localStorage.removeItem(key); } catch {} };
  const LETTER_DRAFT = "mireya-diario-carta";
  const noteDraft = (type) => "mireya-diario-nota-" + type;
  function textSheet(title, sub, value, i, type) {
    if (i < 0) value = readDraft(noteDraft(type));
    openSheet("small-sheet", "<h2>" + title + '</h2><p class="sub">' + sub + '</p><textarea id="editTxt" class="note-area" maxlength="20000" ' + (i < 0 ? 'data-draft="' + noteDraft(type) + '" ' : "") + 'aria-label="' + title + '">' + esc(value) + '</textarea><div class="actions"><button type="button" class="btn" data-act="save-text" data-i="' + i + '" data-type="' + type + '">Pegarlo en mi hoja</button></div>');
  }
  function dayThoughtsHtml() {
    const list = ent(state.cur).items.map((it, i) => [it, i]).filter(([it]) => it.type === "thought");
    return "<h2>Lo que pensé este día</h2><p class=\"sub\">" + esc(longDate(state.cur)) + '</p><div class="day-notes">' + list.map(([it, i], n) => '<button type="button" class="day-note" style="--r:' + (n % 2 ? .5 : -.5) + 'deg" data-act="edit-it" data-i="' + i + '"><small>' + esc(it.time) + "</small><p>" + esc(it.text) + "</p></button>").join("") + '</div><div class="actions"><button type="button" class="btn" data-act="add-thought">Escribir otro</button></div>';
  }

  /* ---------- Navegación ---------- */
  function go(s) {
    closeSheet();
    if (closed) openBook().then(() => flipTo(s)); else flipTo(s);
  }

  /* ---------- Acciones ---------- */
  listen(document, "click", (ev) => {
    if (didDrag) return;
    const el = ev.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    switch (act) {
      case "backdrop": if (ev.target === el && pressedBackdrop) closeSheet(); break;
      case "close-ov":
        if ($("#ovRoot .pen-sheet")) penDone();
        else if ($("#ovRoot .bg-sheet") && state.bgFrom === "big") backToCalendar("big");
        else if ($("#ovRoot .era-sheet") && state.eraFrom === "big") backToCalendar("big");
        else closeSheet();
        break;
      case "open-book": openBook(); break;
      case "toggle-book": closed ? openBook() : closeBook(); break;
      case "done": document.activeElement?.blur?.(); break;
      case "today": closeSheet(); go(TODAY); break;
      case "prev": flipTo(addDays(state.cur, -1)); break;
      case "next": if (state.cur < TODAY) flipTo(addDays(state.cur, 1)); break;
      case "side": flipSidePhone(el.dataset.s); break;
      case "feel": openSheet("feel-sheet", feelSheetHtml()); break;
      case "feel-toggle": {
        const e = ent(state.cur), k = el.dataset.m, i = e.moods.indexOf(k);
        if (i >= 0) e.moods.splice(i, 1); else e.moods.push(k);
        el.classList.toggle("on", i < 0);
        el.setAttribute("aria-pressed", i < 0);
        touch(state.cur); paintFeel(); refreshDesk();
        break;
      }
      case "pen": {
        state.penTarget = el.dataset.t;
        if (state.penTarget === "letter") keepDraftText();
        openSheet("pen-sheet", penSheetHtml());
        break;
      }
      case "pen-ink": penChange("ink", el.dataset.c); break;
      case "pen-font": penChange("font", el.dataset.f); break;
      case "pen-done": penDone(); break;
      case "cal-nav": moveMonth(+el.dataset.dir); renderCalSmall(true); break;
      case "cal-day": {
        const s = el.dataset.d;
        const ls = lettersOn(s);
        if (ls.length && s > TODAY) { readLetter(ls[0].id); break; }
        if (s > TODAY) { toast("Ese día todavía no llega."); break; }
        go(s);
        break;
      }
      case "calendar": state.bigTab = "mes"; openSheet("big-cal", bigCalHtml()); break;
      case "pick-era": state.eraFrom = el.closest(".big-cal") ? "big" : null; openSheet("era-sheet", eraSheetHtml(+el.dataset.m)); break;
      case "set-era": {
        const mo = +el.dataset.m, e = +el.dataset.e;
        state.eraBy[mo] = e;
        saveSettings();
        applyEra(state.cur);
        renderCalSmall(true);
        if (state.cur.slice(0, 7) === parse(state.cur).getFullYear() + "-" + pad(mo + 1)) paint();
        backToCalendar(state.eraFrom);
        toast(e === -1 ? MONTHS[mo] + " se queda sin era" : MONTHS[mo] + " ahora es era " + ERAS[e].n);
        break;
      }
      case "bg": state.bgFrom = el.closest(".big-cal") ? "big" : null; openSheet("bg-sheet", bgSheetHtml()); break;
      case "bg-set": applyBg(el.dataset.id === "mine" ? state.myBg : "preset:" + el.dataset.id); break;
      case "bg-upload": $("#bgInput").click(); break;
      case "bg-scope": state.bgScope = el.dataset.v; refreshSheet(bgSheetHtml()); break;
      case "bg-none": {
        if (state.bgScope === "mes") state.bgMonth[state.calY + "-" + state.calM] = "none";
        else { state.bgAll = null; state.bgMonth = {}; }
        saveSettings();
        renderCalSmall(); refreshSheet(bgSheetHtml());
        break;
      }
      case "big-nav": moveMonth(+el.dataset.dir); refreshSheet(bigCalHtml()); renderCalSmall(); animate($("#ovRoot .cal-sheet"), [{ transform: "translateY(8px)", opacity: .35 }, { transform: "none", opacity: 1 }], 280); break;
      case "big-tab": state.bigTab = el.dataset.t; refreshSheet(bigCalHtml()); break;
      case "big-month": state.calM = +el.dataset.m; state.bigTab = "mes"; refreshSheet(bigCalHtml()); renderCalSmall(); break;
      case "search": openSearch(); break;
      case "f-mood": { const f = state.search.moods, k = el.dataset.m; f.includes(k) ? f.splice(f.indexOf(k), 1) : f.push(k); refreshSearch(true); break; }
      case "f-month": { const v = +el.dataset.m; state.search.month = state.search.month === v ? null : v; refreshSearch(true); break; }
      case "f-has": { const f = state.search.has, k = el.dataset.h; f.includes(k) ? f.splice(f.indexOf(k), 1) : f.push(k); refreshSearch(true); break; }
      case "f-folder": { const v = el.dataset.f; state.search.folder = state.search.folder === v ? null : v; refreshSearch(true); break; }
      case "go": go(el.dataset.d); break;
      case "folders": state.folderView = el.dataset.open || "sueltas"; state.folderEdit = null; openSheet("drawer-big", foldersHtml()); break;
      case "fv": state.folderView = el.dataset.v; state.folderEdit = null; refreshFolders(); break;
      case "folder-rename": state.folderEdit = "rename"; refreshFolders(); $("#renameFolder").focus(); break;
      case "folder-delete": state.folderEdit = "delete"; refreshFolders(); break;
      case "folder-cancel": state.folderEdit = null; refreshFolders(); break;
      case "folder-delete-yes": deleteFolder(); break;
      case "change-pin":
        openSheet("pin-sheet", pinSheetHtml(""));
        fetch("/api/diario-lock", { cache: "no-store" }).then((r) => r.json()).then(({ hint }) => { const box = $("#pinHint"); if (box && !box.value) box.value = hint || ""; }).catch(() => {});
        break;
      case "swatch": state.newColor = el.dataset.c; $("#swatchBox").innerHTML = swatchesHtml(); break;
      case "swatch-more": $("#moreColors").hidden = false; $("#fewColors").hidden = true; break;
      case "letters": draft = null; openSheet("letters", lettersHtml()); break;
      case "read-letter": readLetter(el.dataset.l); break;
      case "compose": { const to = addDays(TODAY, 30), d = parse(to); draft = { text: readDraft(LETTER_DRAFT), to, sealed: true, y: d.getFullYear(), m: d.getMonth(), ink: state.ink, font: state.font }; openSheet("compose", composeHtml()); break; }
      case "draft-to": { draft.to = el.dataset.d; const d = parse(draft.to); draft.y = d.getFullYear(); draft.m = d.getMonth(); keepDraftText(); refreshSheet(composeHtml()); break; }
      case "draft-nav": { let mo = draft.m + +el.dataset.dir; if (mo < 0) { mo = 11; draft.y--; } if (mo > 11) { mo = 0; draft.y++; } draft.m = mo; keepDraftText(); refreshSheet(composeHtml()); break; }
      case "draft-seal": draft.sealed = el.dataset.v === "1"; keepDraftText(); refreshSheet(composeHtml()); break;
      case "save-letter": {
        keepDraftText();
        if (!draft.text.trim()) { $("#letterTxt").focus(); toast("Escribe algo para tu yo del futuro."); break; }
        const d = draft;
        send("/letters", "POST", { open_on: d.to, sealed: d.sealed, body: d.text, ink: d.ink, font: d.font }).then((row) => {
          writeDraft(LETTER_DRAFT, "");
          const l = toLetter(row);
          state.letters.push(l);
          draft = null;
          sealAnimation(l);
        }).catch(() => toast("No pude guardar tu carta. Sigue aquí, intenta otra vez."));
        break;
      }
      case "add-photo": $("#photoInput").click(); break;
      case "add-song":
        openSheet("song-sheet", '<h2>¿Qué canción fue?</h2><label class="track-search">' + I.search + '<input id="songQ" placeholder="Busca en Spotify" autocomplete="off" enterkeyhint="search" aria-label="Buscar canción"><button type="button" class="track-clear" id="songClear" data-act="song-clear" aria-label="Borrar búsqueda" hidden>' + I.close + '</button></label><div class="track-list" id="songList">' + SONG_HINT + "</div>");
        $("#songQ").focus();
        break;
      case "song-clear": { const q = $("#songQ"); q.value = ""; searchSongs(""); q.focus(); break; }
      case "pick-song": { const s = songHits[+el.dataset.i]; closeSheet(); addItem(Object.assign({ type: "song", c: "#3f78b5" }, s)); break; }
      case "add-memo": textSheet("Un recuerdo de este día", "Lo que no quieres que se te olvide.", "", -1, "memo"); break;
      case "add-thought": textSheet("¿Qué estás pensando?", "Escribe los que quieras durante el día. Cada uno se pega como una nota.", "", -1, "thought"); break;
      case "day-thoughts": openSheet("small-sheet", dayThoughtsHtml()); break;
      case "edit-it": { const i = +el.dataset.i, it = ent(state.cur).items[i]; textSheet(it.type === "memo" ? "Un recuerdo de este día" : "Lo que pensé", it.time || "Puedes cambiarlo cuando quieras.", it.text, i, it.type); break; }
      case "save-text": {
        const t = $("#editTxt").value.trim(), i = +el.dataset.i, type = el.dataset.type;
        if (!t) { $("#editTxt").focus(); break; }
        closeSheet();
        if (i < 0) writeDraft(noteDraft(type), "");
        if (i >= 0) { ent(state.cur).items[i].text = t; touch(state.cur); showRightSide(); repaintItem(i); refreshDesk(); }
        else addItem(type === "thought" ? { type, text: t, time: state.cur === TODAY ? nowTime() : shortDate(state.cur) } : { type, text: t });
        break;
      }
      case "rm": { const i = +el.dataset.i; ent(state.cur).items.splice(i, 1); touch(state.cur); removeItem(i); refreshDesk(); break; }
      case "exit": flushSaves(); opts.exit(); break;
    }
  });
  function keepDraftText() { const t = $("#letterTxt"); if (t && draft) draft.text = t.value; }

  listen(document, "input", (ev) => {
    const t = ev.target;
    if (t.dataset.draft) writeDraft(t.dataset.draft, t.value);
    if (t.dataset.field) { ent(state.cur)[t.dataset.field] = t.value; touch(state.cur); renderCalSmall(); }
    if (t.id === "feelTxt") { ent(state.cur).feel = t.value; touch(state.cur); paintFeel(); refreshDesk(); }
    if (t.dataset.cap !== undefined) { ent(state.cur).items[+t.dataset.cap].cap = t.value; touch(state.cur); }
    if (t.id === "calSee") {
      state.calSee = +t.value;
      saveSettings();
      renderCalSmall();
      $("#ovRoot .bg-prev").innerHTML = calHtml(state.calY, state.calM, { preview: true });
    }
    if (t.id === "q") { state.search.q = t.value; refreshSearch(false); }
    if (t.id === "songQ") searchSongs(t.value);
  });
  listen(document, "submit", (ev) => {
    if (ev.target.dataset.form === "rename") { ev.preventDefault(); renameFolder(); return; }
    if (ev.target.dataset.form === "pin") { ev.preventDefault(); savePin(); return; }
    if (ev.target.dataset.form !== "folder") return;
    ev.preventDefault();
    const inp = $("#newFolder"), name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    send("/folders", "POST", { name, color: state.newColor }).then((f) => {
      state.folders.unshift({ id: f.id, name: f.name, color: f.color });
      state.folderView = f.id;
      refreshSheet(foldersHtml()); refreshDesk();
      animate($(`.fold-grid [data-folder="${f.id}"]`), [{ transform: "translateY(16px) scale(.8)", opacity: 0 }, { transform: "none", opacity: 1 }], 340, "cubic-bezier(.3,1.5,.5,1)");
    }).catch(() => toast("No pude crear la carpetita. Intenta otra vez."));
  });
  $("#photoInput").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    uploadPhoto(file).then((p) => addItem({ type: "photo", path: p.path, url: p.url, cap: "" })).catch(() => { setSaveState("No se pudo subir la foto.", true); toast("No pude subir tu foto. Intenta otra vez."); });
  });
  $("#bgInput").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    uploadPhoto(file).then((p) => { state.bgUrls[p.path] = p.url; state.myBg = "photo:" + p.path; applyBg(state.myBg); }).catch(() => { setSaveState("No se pudo subir la imagen.", true); toast("No pude subir tu imagen. Intenta otra vez."); });
  });
  listen(document, "keydown", (ev) => {
    if (ev.key === "Escape" && $("#ovRoot").firstChild) { closeSheet(); return; }
    if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches('[role="button"][data-act]')) { ev.preventDefault(); ev.target.click(); return; }
    if ($("#ovRoot").firstChild || ev.target.matches("input,textarea") || closed) return;
    if (ev.key === "ArrowLeft") flipTo(addDays(state.cur, -1));
    if (ev.key === "ArrowRight" && state.cur < TODAY) flipTo(addDays(state.cur, 1));
  });
  /* Deslizar para cambiar de día en celular */
  let swipe = null;
  $("#book").addEventListener("touchstart", (e) => {
    swipe = null;
    if (closed || e.touches.length > 1 || e.target.closest(".it,input") || document.activeElement?.matches?.("#book textarea")) return;
    swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  $("#book").addEventListener("touchend", (e) => {
    if (!swipe) return;
    const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) flipTo(addDays(state.cur, -1));
    else if (state.cur < TODAY) flipTo(addDays(state.cur, 1));
    else toast("Ese día todavía no llega.");
  }, { passive: true });


  /* ---------- Portada: flores de hortensia dibujadas ---------- */
  const PETALS = ["#ffffff", "#f4f9fe", "#dcebfa", "#cfdcf7", "#e6e0fa", "#c5dcf4"];
  function floret(x, y, r, rot, fill) {
    let g = '<g transform="translate(' + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + rot.toFixed(0) + ')">';
    for (let a = 0; a < 360; a += 90) g += '<ellipse cx="0" cy="' + (-r * .52).toFixed(1) + '" rx="' + (r * .47).toFixed(1) + '" ry="' + (r * .6).toFixed(1) + '" fill="' + fill + '" stroke="rgba(70,110,165,.32)" stroke-width=".5" transform="rotate(' + a + ')"/>';
    return g + '<circle r="' + (r * .15).toFixed(1) + '" fill="#7da7d4"/></g>';
  }
  const leaf = (x, y, rot, len) => '<path transform="translate(' + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + rot.toFixed(0) + ')" d="M0 0Q' + (len * .32).toFixed(1) + " " + (-len * .5).toFixed(1) + " 0 " + (-len).toFixed(1) + "Q" + (-len * .32).toFixed(1) + " " + (-len * .5).toFixed(1) + ' 0 0z" fill="#b9dcd6" stroke="rgba(60,110,120,.35)" stroke-width=".5"/>';
  // Hortensia: una bola llena de florecitas de 4 pétalos, más clara donde le da la luz.
  function bloom(cx, cy, R, pal, count) {
    let out = '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * .96).toFixed(1) + '" fill="' + pal[0] + '"/>';
    const size = R * .135;
    for (let i = count; i > 0; i--) {
      const d = R * .95 * Math.sqrt(i / count), a = i * 2.39996;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const light = (cx - x + (cy - y)) / (2 * R) + .5 + Math.sin(i * 12.9898) * .13;
      const fill = pal[Math.max(0, Math.min(pal.length - 1, Math.floor(light * pal.length)))];
      const r = size * (1.08 - .28 * (d / R));
      let g = '<g transform="translate(' + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + (i * 53 % 90) + ')">';
      for (let k = 0; k < 360; k += 90) g += '<ellipse cy="' + (-r * .56).toFixed(1) + '" rx="' + (r * .52).toFixed(1) + '" ry="' + (r * .62).toFixed(1) + '" fill="' + fill + '" stroke="rgba(30,55,110,.28)" stroke-width=".6" transform="rotate(' + k + ')"/>';
      out += g + '<circle r="' + (r * .15).toFixed(1) + '" fill="#f7f6d8"/></g>';
    }
    return out;
  }
  // Hoja ancha de borde dentado, con su nervadura.
  function bigLeaf(x, y, rot, L) {
    const W = L * .36, up = [], down = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, w = W * Math.sin(Math.PI * t ** .8) * (i % 2 ? 1 : .9);
      up.push(w.toFixed(1) + " " + (-L * t).toFixed(1));
      down.unshift((-w).toFixed(1) + " " + (-L * t).toFixed(1));
    }
    let veins = "";
    for (let i = 2; i < 8; i++) { const t = i / 9, w = W * .78 * Math.sin(Math.PI * t ** .8); veins += "M0 " + (-L * t).toFixed(1) + "L" + w.toFixed(1) + " " + (-L * (t + .09)).toFixed(1) + "M0 " + (-L * t).toFixed(1) + "L" + (-w).toFixed(1) + " " + (-L * (t + .09)).toFixed(1); }
    return '<g transform="translate(' + x + " " + y + ") rotate(" + rot + ')"><path d="M' + up.join("L") + "L" + down.join("L") + 'z" fill="#6aa883"/><path d="M0 0L' + down.join("L") + 'z" fill="#5a9a76"/><path d="M0 0L0 ' + (-L) + veins + '" fill="none" stroke="#3f7d5c" stroke-width="1.100" stroke-linecap="round"/></g>';
  }
  const BLUE = ["#4f7fc6", "#6494d8", "#7fa9e6", "#9dbff0", "#c3d9f7", "#e3eefc"];
  const LILAC = ["#7d78cc", "#9590dd", "#afa9e9", "#c8c3f2", "#dfdaf8", "#f0edfc"];
  const SKYB = ["#4b93cf", "#62a7dd", "#83bde8", "#a7d2f1", "#cde6f8", "#eaf5fd"];
  // Stickers de las cosas que le gustan: blanco alrededor, como recortados a mano.
  const sticker = (body, outline) => '<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round">' + outline + "</g>" + body + "</svg>";
  const HEART_PATH = "M50 88C18 62 8 46 8 31a21 21 0 0142-9 21 21 0 0142 9c0 15-10 31-42 57z";
  const ART = {
    hortensia: sticker('<g transform="translate(14 24) scale(.56)">' + bigLeaf(60, 90, -120, 60) + bigLeaf(100, 100, 130, 60) + bigLeaf(80, 60, -35, 58) + "</g>" + bloom(50, 50, 33, BLUE, 40), '<circle cx="50" cy="50" r="33"/>'),
    hortensiaLila: sticker('<g transform="translate(14 24) scale(.56)">' + bigLeaf(60, 90, -120, 60) + bigLeaf(100, 100, 130, 60) + "</g>" + bloom(50, 50, 31, LILAC, 34), '<circle cx="50" cy="50" r="31"/>'),
    vinilo: sticker('<circle cx="50" cy="50" r="40" fill="#25324d"/><circle cx="50" cy="50" r="32" fill="none" stroke="#3d4d70" stroke-width="1"/><circle cx="50" cy="50" r="25" fill="none" stroke="#3d4d70" stroke-width="1"/><path d="M26 22a40 40 0 0118-7l3 20a20 20 0 00-8 3z" fill="#fff" opacity=".16"/><circle cx="50" cy="50" r="15" fill="#9fc6ec"/><path d="M50 40l2.800 6.200 6.700.7-5 4.500 1.400 6.600-5.900-3.400-5.900 3.400 1.400-6.600-5-4.500 6.700-.7z" fill="#fff"/><circle cx="50" cy="50" r="2" fill="#25324d"/>', '<circle cx="50" cy="50" r="40"/>'),
    pinguino: sticker('<ellipse cx="50" cy="56" rx="27" ry="33" fill="#34466b"/><ellipse cx="50" cy="62" rx="18" ry="24" fill="#fff"/><ellipse cx="25" cy="60" rx="6" ry="16" fill="#34466b" transform="rotate(14 25 60)"/><ellipse cx="75" cy="60" rx="6" ry="16" fill="#34466b" transform="rotate(-14 75 60)"/><circle cx="41" cy="40" r="3.200" fill="#25324d"/><circle cx="59" cy="40" r="3.200" fill="#25324d"/><circle cx="40" cy="39" r="1" fill="#fff"/><circle cx="58" cy="39" r="1" fill="#fff"/><path d="M45 45h10l-5 6z" fill="#f6b04a"/><ellipse cx="34" cy="47" rx="4" ry="2.500" fill="#ffa7b6" opacity=".8"/><ellipse cx="66" cy="47" rx="4" ry="2.500" fill="#ffa7b6" opacity=".8"/><path d="M28 56q22 9 44 0v6q-22 9-44 0z" fill="#79b3e8"/><path d="M64 60l8 14-8 2-5-13z" fill="#5f9bd8"/><ellipse cx="39" cy="90" rx="8" ry="3.500" fill="#f6b04a"/><ellipse cx="61" cy="90" rx="8" ry="3.500" fill="#f6b04a"/>', '<ellipse cx="50" cy="56" rx="29" ry="36"/>'),
    mariposa: sticker('<path d="M50 50C36 18 12 16 10 34c-1 12 14 20 40 16z" fill="#c9b9f4"/><path d="M50 50c14-32 38-34 40-16 1 12-14 20-40 16z" fill="#a9cdf2"/><path d="M50 50C32 54 18 62 24 76c6 12 22 2 26-26z" fill="#e0d4fb"/><path d="M50 50c18 4 32 12 26 26-6 12-22 2-26-26z" fill="#cfe4f8"/><path d="M50 34v36" stroke="#34466b" stroke-width="3.500" stroke-linecap="round"/><path d="M50 34q-4-10-9-12M50 34q4-10 9-12" fill="none" stroke="#34466b" stroke-width="1.700" stroke-linecap="round"/>', '<path d="M50 50C36 18 12 16 10 34c-1 12 8 18 16 18-6 10-6 24 4 26 8 2 16-10 20-22 4 12 12 24 20 22 10-2 10-16 4-26 8 0 17-6 16-18-2-18-26-16-40 16z"/>'),
    estrella: sticker('<path d="M50 10l12 26 28 3-21 19 6 28-25-14-25 14 6-28-21-19 28-3z" fill="#ffd97c"/>', '<path d="M50 10l12 26 28 3-21 19 6 28-25-14-25 14 6-28-21-19 28-3z"/>'),
    luna: sticker('<path d="M70 82a36 36 0 11-8-68 30 30 0 008 68z" fill="#c9d6f7"/><circle cx="78" cy="30" r="4" fill="#ffd97c"/><circle cx="86" cy="50" r="2.500" fill="#ffd97c"/>', '<path d="M70 82a36 36 0 11-8-68 30 30 0 008 68z"/>'),
    nota: sticker('<path d="M36 20l40-8v52a12 10 0 11-8-9V30l-24 5v39a12 10 0 11-8-9z" fill="#5f9bd8"/>', '<path d="M36 20l40-8v52a12 10 0 11-8-9V30l-24 5v39a12 10 0 11-8-9z"/>'),
    corazon: sticker('<path d="' + HEART_PATH + '" fill="#ffb9cc"/><path d="M26 22q-9 2-9 13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>', '<path d="' + HEART_PATH + '"/>'),
  };
  const wide = (w, h, body, outline) => '<svg viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><g fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round">' + outline + "</g>" + body + "</svg>";
  const TICKET = "M6 6h148a8 8 0 0016 0h24v22a9 9 0 000 18v24h-24a8 8 0 00-16 0H6V46a9 9 0 000-18z";
  Object.assign(ART, {
    // Su concierto de Morat, con el amarillo de su team
    boleto: wide(200, 76, '<path d="' + TICKET + '" fill="#ffd97c"/><path d="M162 12v52" stroke="#c99a2e" stroke-width="2" stroke-dasharray="4 4"/><text x="82" y="47" text-anchor="middle" font-size="30" font-weight="800" letter-spacing="3" style="font-family:var(--font-figtree),Arial,sans-serif" fill="#7a5a12">MORAT</text><path d="M178 26l2.800 6 6.500.7-4.900 4.400 1.400 6.400-5.800-3.300-5.800 3.300 1.400-6.400-4.900-4.400 6.500-.7z" fill="#7a5a12"/>', '<path d="' + TICKET + '"/>'),
    // Su graduación
    birrete: sticker('<path d="M28 50v18q22 13 44 0V50z" fill="#3f5a86"/><path d="M50 22L6 42l44 20 44-20z" fill="#27405f"/><circle cx="50" cy="42" r="3" fill="#ffd97c"/><path d="M50 42l29 9v20" fill="none" stroke="#ffd97c" stroke-width="2.500" stroke-linecap="round"/><path d="M75 71h8l1 13h-10z" fill="#ffd97c"/>', '<path d="M50 22L6 42l22 10v16q22 13 44 0V52l7-3v35h6V46l9-4z"/>'),
    // Tacos de canasta, en su canasta con su servilleta
    taco: sticker('<path d="M18 40a22 22 0 0144 0z" fill="#f6c766"/><path d="M38 40a22 22 0 0144 0z" fill="#f2b955"/><path d="M26 30q6-5 12-2" fill="none" stroke="#d99b34" stroke-width="1.800" stroke-linecap="round"/><path d="M56 28q6-4 12 0" fill="none" stroke="#d99b34" stroke-width="1.800" stroke-linecap="round"/><path d="M12 38h76q5 0 4 5l-3 6H11l-3-6q-1-5 4-5z" fill="#c8def5"/><path d="M12 42l8 7M30 38l10 11M50 38l10 11M70 38l10 11" stroke="#6d9fce" stroke-width="1.600"/><path d="M14 48h72l-8 34q-1 5-6 5H28q-5 0-6-5z" fill="#cf9a58"/><path d="M15 58h70M18 69h64M21 79h58" stroke="#a87638" stroke-width="2"/><path d="M28 49l4 37M42 49l2 38M58 49l-2 38M72 49l-4 37" stroke="#a87638" stroke-width="2"/><path d="M34 86q-22-2-20-36" fill="none" stroke="#a87638" stroke-width="0"/>', '<path d="M18 40a22 22 0 0132-16 22 22 0 0132 16h6q5 0 4 5l-3 6-8 31q-1 5-6 5H28q-5 0-6-5l-8-31-3-6q-1-5 4-5z"/>'),
    // Cheesecake en su platito, con tenedor
    cheesecake: sticker('<ellipse cx="50" cy="76" rx="44" ry="11" fill="#ffffff"/><ellipse cx="50" cy="75" rx="33" ry="6.500" fill="#e6f0fb"/><path d="M16 50l58-20 10 8v26l-68 8z" fill="#fff6dc"/><path d="M16 64l68-8v9l-68 8z" fill="#d9a766"/><path d="M16 50l58-20 10 8-68 12z" fill="#fffbef"/><path d="M36 42q12-11 26-9 7 7-2 11-13 5-24-2z" fill="#ef6f8a"/><circle cx="50" cy="35" r="6.500" fill="#e24c6c"/><path d="M50 27q3-4 6-3" stroke="#6fae74" stroke-width="2.200" fill="none" stroke-linecap="round"/><path d="M90 30v26M85 30v9q0 4 5 4t5-4v-9M90 30v9" fill="none" stroke="#9db4cc" stroke-width="2" stroke-linecap="round"/>', '<ellipse cx="50" cy="76" rx="44" ry="11"/><path d="M16 50l58-20 10 8v26l-68 8z"/><rect x="83" y="27" width="14" height="32" rx="4"/>'),
    // Boulevard
    libro: sticker('<rect x="26" y="10" width="52" height="78" rx="3" fill="#fff"/><rect x="20" y="10" width="52" height="78" rx="3" fill="#7fb2e3"/><rect x="20" y="10" width="7" height="78" rx="2" fill="#5f93c8"/><path d="M40 42c-5-6-12-3-10 3 1 5 6 8 10 11 4-3 9-6 10-11 2-6-5-9-10-3z" fill="#fff" transform="translate(9 -8)"/><text x="50" y="66" text-anchor="middle" font-size="9.500" font-style="italic" font-weight="600" font-family="Georgia,serif" fill="#fff">Boulevard</text>', '<rect x="20" y="10" width="58" height="78" rx="3"/>'),
    // Ver el cielo y el mar
    ola: sticker('<path d="M8 66c8-30 34-44 58-36 14 5 24 18 24 30-6-10-18-14-26-8 8 2 12 8 12 14-4-3-10-3-16 0-10 6-24 8-34 4-6-1-12-2-18-4z" fill="#79b3e8"/><path d="M8 66c14 6 30 6 42 0 10-5 20-6 28-2-8 10-32 18-52 14-8-2-14-6-18-12z" fill="#4f93d6"/><path d="M60 34q14 5 22 18" fill="none" stroke="#fff" stroke-width="3.500" stroke-linecap="round"/>', '<path d="M8 66c8-30 34-44 58-36 14 5 24 18 24 30 0 8-30 22-52 20-14-1-26-6-30-14z"/>'),
  });
  // Mini polaroids: pocas fotos y una con su atardecer en el mar dibujado.
  const polSt = (src, tape) => '<div class="st-pol"' + (tape ? ' style="--tape:' + tape + '"' : "") + '><img src="' + pubImg(src) + '" alt="" draggable="false"></div>';
  const atardecer = '<div class="st-pol" style="--tape:rgba(190,170,235,.85)"><svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="#ffd3c2"/><rect width="100" height="34" fill="#c9b9f4"/><rect y="24" width="100" height="22" fill="#f8b8cf"/><circle cx="50" cy="60" r="16" fill="#ffd97c"/><rect y="60" width="100" height="40" fill="#79b3e8"/><path d="M0 72q12-6 25 0t25 0 25 0 25 0" fill="none" stroke="#fff" stroke-width="2.500" opacity=".8"/><path d="M12 86q10-5 20 0t20 0 20 0 20 0" fill="none" stroke="#fff" stroke-width="2.500" opacity=".6"/><path d="M36 64h28" stroke="#ffd97c" stroke-width="3" stroke-linecap="round"/></svg></div>';
  // Repartidos por toda la portada, pequeños y con aire entre ellos.
  const STICKERS = [
    [ART.hortensia, 12, 3, 15, -20], [polSt("dino5"), 30, 5, 12.500, -16], [ART.boleto, 45, 6.500, 25, -14], [ART.pinguino, 80, 2.500, 13, 16], [ART.estrella, 72, 2, 7, 30],
    [ART.nota, 13, 22, 7, -32], [ART.birrete, 25, 19, 11, 22], [atardecer, 76, 17, 13, 18],
    [ART.mariposa, 11.500, 46, 9, -38], [ART.taco, 85, 44, 13, 12],
    [polSt("bibble4", "rgba(190,170,235,.85)"), 13, 74, 13, 14], [ART.cheesecake, 30, 79, 12.500, -14], [ART.libro, 47, 75.500, 10.500, 26], [polSt("taylor1"), 62, 77, 13, -15], [ART.hortensiaLila, 80, 72, 14, 30], [ART.vinilo, 83, 88, 11, -24], [ART.estrella, 14, 90, 6, -34],
  ];
  function coverArt() {
    return STICKERS.map(([html, x, y, w, r], i) => '<div class="st' + (html.includes("st-photo") ? " st-stamp" : "") + '" style="--x:' + x + "%;--y:" + y + "%;--w:" + w + "%;--r:" + r + 'deg;z-index:' + (i + 1) + '">' + html + "</div>").join("");
  }
  // Hilo azul marino liso, con un brillo suave abajo para que se sienta cosido sobre la tela.
  const THREAD = "#2f4a73";
  const SCRIPT = "var(--font-dancing),'Segoe Script',cursive";
  function embroidered(text, x, y, size, font, weight) {
    const attrs = 'x="' + x + '" y="' + y + '" text-anchor="middle" style="font-family:' + font + '" font-size="' + size + '" font-weight="' + weight + '"';
    return "<text " + attrs + ' transform="translate(.8 1.200)" fill="rgba(255,255,255,.7)">' + esc(text) + "</text><text " + attrs + ' fill="' + THREAD + '">' + esc(text) + "</text>";
  }
  function embroideredM() {
    return '<svg class="cov-m" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50.500" cy="51" r="44" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="3"/><circle cx="50" cy="50" r="44" fill="rgba(255,255,255,.28)" stroke="' + THREAD + '" stroke-width="3"/>' + embroidered("M", 50, 72, 66, SCRIPT, 700) + "</svg>";
  }
  function embroideredText() {
    return '<svg class="cov-emb" viewBox="0 0 400 170" role="img" aria-label="El diario de Mireya. Una aventura que vale la pena recordar">' +
      embroidered("El diario", 200, 58, 64, SCRIPT, 700) + embroidered("de Mireya", 200, 122, 64, SCRIPT, 700) +
      embroidered("Una aventura que vale la pena recordar", 200, 161, 27, "var(--font-caveat),cursive", 600) + "</svg>";
  }
  function braceletSvg() {
    const word = "MIREYA", n = 20, mid = n / 2, w = 360;
    const y = (x) => 16 + 22 * (1 - ((x - w / 2) / (w / 2)) ** 2);
    const fills = ["#ffffff", "#8fb9e4", "#c8c0ef", "#ffffff", "#a9cdf0"];
    let beads = "";
    for (let i = 0; i < n; i++) {
      const x = 22 + i * (w - 44) / (n - 1), yy = y(x), li = i - (mid - 3);
      if (li >= 0 && li < word.length) {
        beads += '<g transform="translate(' + x.toFixed(1) + " " + yy.toFixed(1) + ") rotate(" + (((x - w / 2) / w) * -18).toFixed(1) + ')"><rect x="-8" y="-8" width="16" height="16" rx="3.500" fill="#fff" stroke="' + THREAD + '" stroke-width="1"/><text y="4.300" text-anchor="middle" font-size="12" font-weight="700" style="font-family:var(--font-figtree),Arial,sans-serif" fill="' + THREAD + '">' + word[li] + "</text></g>";
      } else {
        beads += '<circle cx="' + x.toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="6.300" fill="' + fills[i % fills.length] + '" stroke="' + THREAD + '" stroke-width="1"/>';
      }
    }
    const curve = "M4 " + y(4).toFixed(1) + " Q" + w / 2 + " " + (2 * y(w / 2) - y(4)).toFixed(1) + " " + (w - 4) + " " + y(w - 4).toFixed(1);
    return '<svg class="cov-br" viewBox="0 0 360 62" aria-hidden="true"><path d="' + curve + '" fill="none" stroke="' + THREAD + '" stroke-width="1.500" stroke-linecap="round"/>' + beads + "</svg>";
  }
  function paintCover() {
    const f = $("#coverFront");
    f.insertAdjacentHTML("afterbegin", '<span class="frame"></span><span class="cov-fl">' + coverArt() + '</span><span class="spine-band"></span>');
    const label = document.createElement("div");
    label.className = "cov-label";
    label.innerHTML = embroideredM() + embroideredText();
    f.querySelector("h2").remove();
    f.querySelector("p").remove();
    label.insertAdjacentHTML("beforeend", braceletSvg());
    label.append(f.querySelector(".tap"));
    f.append(label);
    f.insertAdjacentHTML("beforeend", '<span class="cov-ribbon"></span>');
    let petals = "";
    [[9, 6, 9], [21, 14, 6], [4, 46, 7], [22, 56, 8], [14, 90, 9], [77, 12, 7], [93, 4, 9], [79, 62, 8], [96, 50, 6], [84, 92, 7]].forEach((q, i) => { petals += floret(q[0] * 10, q[1] * 7, q[2] + 2, i * 31, PETALS[(i + 2) % PETALS.length]); });
    $("#deco").innerHTML = '<svg class="d-petals" viewBox="0 0 1000 700" preserveAspectRatio="none">' + petals + "</svg>" +
      '<div class="d-pol" style="left:3%;top:7%;--r:-8deg"><img src="' + pubImg("dino0") + '" alt=""><p>Dino</p></div>' +
      '<div class="d-pol" style="left:5%;top:52%;--r:6deg"><img src="' + pubImg("bibble2") + '" alt=""><p>Bibble</p></div>' +
      '<div class="d-pol" style="right:3%;top:4%;--r:7deg"><img src="' + pubImg("taylor6") + '" alt=""><p>Taylor</p></div>' +
      '<div class="d-pol" style="right:5%;top:44%;--r:-6deg"><img src="' + pubImg("bungo1") + '" alt="" style="object-position:center 25%"><p>Bungo Stray Dogs</p></div>' +
      '<svg class="d-pen" style="right:3%;bottom:1%;--r:-14deg" viewBox="0 0 220 26"><rect x="34" y="6" width="150" height="14" rx="7" fill="#6d9fce"/><rect x="34" y="6" width="150" height="5" rx="2.500" fill="#9fc6ec"/><rect x="60" y="6" width="9" height="14" fill="#fff"/><path d="M34 6L8 13l26 7z" fill="#e3effa" stroke="#6d9fce"/><path d="M8 13l-6 0" stroke="#27405f" stroke-width="2" stroke-linecap="round"/><rect x="170" y="4" width="6" height="18" rx="2" fill="#fff"/></svg>';
  }

  /* ---------- Arranque ---------- */
  const toLetter = (r) => ({ id: r.id, to: r.open_on, sealed: r.sealed, opened: r.opened, written: r.created_at.slice(0, 10), text: r.body ?? "", ink: r.ink, font: r.font });
  function hydrate(data) {
    TODAY = data.today;
    state.cur = TODAY;
    state.folders = data.folders.map((f) => ({ id: f.id, name: f.name, color: f.color }));
    state.letters = data.letters.map(toLetter);
    state.entries = {};
    data.entries.forEach((r) => {
      state.entries[r.day] = { day: r.body, feel: r.feel, moods: r.moods || [], items: r.items || [], folder: r.folder_id, ink: r.ink, font: r.font };
    });
    const s = data.settings || {};
    state.bgUrls = data.bg_urls || {};
    if (s.era_by) state.eraBy = s.era_by;
    if (s.cal_see) state.calSee = s.cal_see;
    state.bgAll = s.bg_all || null;
    state.bgMonth = s.bg_month || {};
    state.myBg = s.my_bg || null;
    if (s.ink) state.ink = s.ink;
    if (s.font && FONTS[s.font]) state.font = s.font;
    // Lo que no alcanzó a guardarse la última vez
    try {
      const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "{}");
      Object.entries(pending).forEach(([d, p]) => {
        const e = ent(d);
        Object.assign(e, { day: p.body ?? e.day, feel: p.feel ?? e.feel, moods: p.moods ?? e.moods, items: p.items ? p.items.map((it) => ({ ...it, url: e.items.find((old) => old.path && old.path === it.path)?.url })) : e.items, folder: p.folder_id ?? (p.clear_folder ? null : e.folder), ink: p.ink ?? e.ink, font: p.font ?? e.font });
        dirty.add(d);
      });
    } catch {}
    if (dirty.size) flushSaves();
  }
  async function boot() {
    try {
      hydrate(await api(""));
    } catch {
      root.innerHTML = '<div class="diary-msg"><div>No pude abrir tu diario. Revisa tu conexión e intenta otra vez.<button type="button" id="diaryRetry">Intentar otra vez</button></div></div>';
      $("#diaryRetry").addEventListener("click", () => { cleanup(); mount(root, opts); });
      opts.onReady?.();
      return;
    }
    const d = parse(TODAY);
    state.calY = d.getFullYear(); state.calM = d.getMonth();
    $("#btnToday").innerHTML = I.sun + "Hoy";
    $("#btnSearch").innerHTML = I.search + "Buscar";
    $("#btnExit").innerHTML = I.left + '<span class="lbl">Volver al chat</span>';
    $("#btnExit").setAttribute("aria-label", "Volver al chat");
    $("#btnKey").innerHTML = I.key + '<span class="lbl">Mi clave</span>';
    $("#btnKey").setAttribute("aria-label", "Cambiar mi clave");
    $("#bottomNav").innerHTML = navBtn("calendar", NAV.cal, "Calendario", "big-cal") + navBtn("letters", NAV.mail, "Cartas", "letters") + navBtn("today", NAV.book, "Hoy", "") + navBtn("folders", NAV.folder, "Carpetitas", "drawer-big") + navBtn("search", NAV.search, "Buscar", "search");
    paintCover();
    markNav("");
    paint();
    opts.onReady?.();
    const syncViewport = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      root.style.setProperty("--vvh", vv.height + "px");
      root.style.setProperty("--vvt", vv.offsetTop + "px");
    };
    syncViewport();
    if (window.visualViewport) { listen(window.visualViewport, "resize", syncViewport); listen(window.visualViewport, "scroll", syncViewport); }
    const typing = (n) => n?.matches?.("textarea,input:not([type=range]):not([type=file])");
    listen(document, "focusin", (e) => { if (typing(e.target)) root.classList.add("is-writing"); });
    listen(document, "focusout", () => setTimeout(() => { if (!typing(document.activeElement)) root.classList.remove("is-writing"); }, 60));
    listen(window, "pagehide", flushSaves);
    listen(document, "visibilitychange", () => { if (document.hidden) flushSaves(); });
    refreshDesk();
    setCloseLabel();
  }
  boot();
  return cleanup;
}
