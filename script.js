// Hasen-Hintergrund, Story, Zoom, Ja/Nein-Spiel, Kalender und Versand

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------
     Hasen-Sternbilder im Hintergrund
     --------------------------------------------- */
  const canvas = document.getElementById("bg");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let bunnies = [];
  let nextSpawn = 0;

  // Hasen-Umriss (Frontansicht) aus Ellipsen, Einheit ≈ Hasenhöhe
  const SHAPES = [
    { cx: 0, cy: 0.22, rx: 0.30, ry: 0.27, rot: 0, n: 22 },      // Körper
    { cx: 0, cy: -0.12, rx: 0.19, ry: 0.17, rot: 0, n: 16 },     // Kopf
    { cx: -0.09, cy: -0.43, rx: 0.055, ry: 0.17, rot: -0.22, n: 12 }, // Ohr links
    { cx: 0.09, cy: -0.43, rx: 0.055, ry: 0.17, rot: 0.22, n: 12 },   // Ohr rechts
    { cx: -0.15, cy: 0.47, rx: 0.10, ry: 0.05, rot: 0, n: 8 },   // Fuss links
    { cx: 0.15, cy: 0.47, rx: 0.10, ry: 0.05, rot: 0, n: 8 },    // Fuss rechts
    { cx: 0.31, cy: 0.30, rx: 0.06, ry: 0.06, rot: 0, n: 6 },    // Schwänzchen
  ];
  const DOTS = [[-0.07, -0.14], [0.07, -0.14], [0, -0.07]]; // Augen, Nase

  const insideShape = (x, y, s) => {
    const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
    const dx = x - s.cx, dy = y - s.cy;
    const lx = dx * c - dy * sn, ly = dx * sn + dy * c;
    return (lx * lx) / (s.rx * s.rx) + (ly * ly) / (s.ry * s.ry) < 0.92;
  };

  // Punkte und Kanten nur dort, wo der Umriss aussen liegt
  const BUNNY = (() => {
    const pts = [], edges = [];
    SHAPES.forEach((s, si) => {
      const ids = [];
      for (let k = 0; k < s.n; k++) {
        const a = (k / s.n) * Math.PI * 2;
        const ex = Math.cos(a) * s.rx, ey = Math.sin(a) * s.ry;
        const x = s.cx + ex * Math.cos(s.rot) - ey * Math.sin(s.rot);
        const y = s.cy + ex * Math.sin(s.rot) + ey * Math.cos(s.rot);
        const hidden = SHAPES.some((o, oi) => oi !== si && insideShape(x, y, o));
        if (hidden) { ids.push(-1); continue; }
        ids.push(pts.length);
        pts.push({ x, y, dot: false });
      }
      for (let k = 0; k < ids.length; k++) {
        const a = ids[k], b = ids[(k + 1) % ids.length];
        if (a >= 0 && b >= 0) edges.push([a, b]);
      }
    });
    DOTS.forEach(([x, y]) => pts.push({ x, y, dot: true }));
    return { pts, edges };
  })();

  const GATHER = 2.4, HOLD = 4.5, RELEASE = 1.6;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wanted = Math.round(BUNNY.pts.length * 2.6 + (W * H) / 9000);
    while (particles.length < wanted) particles.push(makeParticle());
    particles.forEach((p) => { if (!p.bunny) { p.x = Math.min(p.x, W); p.y = Math.min(p.y, H); } });
  };

  const makeParticle = () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12,
    r: 0.6 + Math.random() * 1.2,
    tw: Math.random() * Math.PI * 2,
    bunny: null,
    tx: 0, ty: 0,
  });

  const maxBunnies = () => (W < 600 ? 2 : 3);

  const spawnBunny = (now, force = false) => {
    if (!force && bunnies.length >= maxBunnies()) return false;
    const size = Math.min(W, H) * (W < 600 ? 0.42 : 0.3) * (0.8 + Math.random() * 0.35);
    let cx, cy, tries = 0;
    do {
      cx = size * 0.45 + Math.random() * (W - size * 0.9);
      cy = size * 0.6 + Math.random() * (H - size * 1.2);
      tries++;
    } while (tries < 20 && bunnies.some((b) => Math.hypot(b.cx - cx, b.cy - cy) < (b.size + size) * 0.55));

    const free = particles.filter((p) => !p.bunny);
    if (free.length < BUNNY.pts.length) return false;
    free.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    const pool = free.slice(0, BUNNY.pts.length);

    const b = { cx, cy, size, t0: now, members: new Array(BUNNY.pts.length), flip: Math.random() < 0.5 ? -1 : 1 };
    BUNNY.pts.forEach((pt, i) => {
      const tx = cx + pt.x * size * b.flip, ty = cy + pt.y * size;
      let best = 0, bd = Infinity;
      pool.forEach((p, j) => {
        const d = (p.x - tx) ** 2 + (p.y - ty) ** 2;
        if (d < bd) { bd = d; best = j; }
      });
      const p = pool.splice(best, 1)[0];
      p.bunny = b; p.idx = i;
      b.members[i] = p;
    });
    bunnies.push(b);
    return true;
  };

  const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

  let last = performance.now();
  const frame = (nowMs) => {
    const now = nowMs / 1000;
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;

    if (now > nextSpawn) {
      spawnBunny(now);
      nextSpawn = now + 1.8 + Math.random() * 2;
    }

    ctx.clearRect(0, 0, W, H);

    // freie Punkte
    for (const p of particles) {
      p.tw += dt * 2;
      if (p.bunny) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + Math.sin(p.tw) * 0.2})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    // Hasen
    bunnies = bunnies.filter((b) => {
      const age = now - b.t0;
      const total = GATHER + HOLD + RELEASE;
      if (age > total) {
        b.members.forEach((p) => {
          p.bunny = null;
          const a = Math.random() * Math.PI * 2;
          p.vx = Math.cos(a) * 14; p.vy = Math.sin(a) * 14;
        });
        return false;
      }
      const holdT = age - GATHER;
      // kleine Hüpfer, während der Hase steht
      const hop = holdT > 0 && holdT < HOLD ? -Math.abs(Math.sin(holdT * 3.2)) * b.size * 0.07 : 0;
      const pull = age < GATHER ? 1 - Math.pow(0.02, dt) : 1;
      const lineA = age < GATHER ? ease((age - GATHER * 0.55) / (GATHER * 0.45))
        : age < GATHER + HOLD ? 1 : 1 - ease((age - GATHER - HOLD) / RELEASE);

      b.members.forEach((p, i) => {
        const pt = BUNNY.pts[i];
        const tx = b.cx + pt.x * b.size * b.flip, ty = b.cy + pt.y * b.size + hop;
        if (age >= GATHER + HOLD) {
          // auseinanderdriften
          p.x += (p.x - b.cx) * dt * 0.6; p.y += (p.y - b.cy) * dt * 0.6 + 6 * dt;
        } else if (age < GATHER) {
          p.x += (tx - p.x) * pull; p.y += (ty - p.y) * pull;
        } else {
          p.x = tx; p.y = ty;
        }
      });

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(255,190,225,${0.75 * lineA})`;
      ctx.beginPath();
      for (const [a, c] of BUNNY.edges) {
        const pa = b.members[a], pc = b.members[c];
        ctx.moveTo(pa.x, pa.y); ctx.lineTo(pc.x, pc.y);
      }
      ctx.stroke();

      b.members.forEach((p, i) => {
        const dot = BUNNY.pts[i].dot;
        const r = dot ? 2.6 : 1.5;
        ctx.fillStyle = dot ? `rgba(255,255,255,${0.4 + 0.6 * lineA})` : `rgba(255,220,240,${0.55 + 0.45 * lineA})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      });
      return true;
    });

    requestAnimationFrame(frame);
  };

  resize();
  window.addEventListener("resize", resize);
  if (!reduceMotion) requestAnimationFrame(frame);

  // Für Tripple Ja: ein paar Extra-Hasen
  const bunnyParty = () => {
    const now = performance.now() / 1000;
    for (let i = 0; i < 3; i++) spawnBunny(now, true);
  };

  /* ---------------------------------------------
     Herzchen-Regen
     --------------------------------------------- */
  const heartsBox = document.getElementById("hearts");
  const HEARTS = ["❤️", "💖", "💕", "💗", "💘"];
  const rainHearts = (count) => {
    for (let i = 0; i < count; i++) {
      const h = document.createElement("span");
      h.className = "heart";
      h.textContent = HEARTS[Math.floor(Math.random() * HEARTS.length)];
      h.style.left = Math.random() * 100 + "vw";
      h.style.fontSize = 16 + Math.random() * 26 + "px";
      h.style.animationDuration = 2.4 + Math.random() * 2.6 + "s";
      h.style.animationDelay = Math.random() * Math.min(2.5, count / 40) + "s";
      h.style.setProperty("--rot", (Math.random() - 0.5) * 720 + "deg");
      h.addEventListener("animationend", () => h.remove());
      heartsBox.appendChild(h);
    }
  };

  /* ---------------------------------------------
     Story: Einblenden, Platzhalter, Weiter-Button
     --------------------------------------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
  }, { threshold: 0.3 });
  const observeReveals = (root = document) => root.querySelectorAll(".reveal:not(.visible)").forEach((el) => io.observe(el));
  observeReveals();

  // Solange die Bilder fehlen, erscheint ein Platzhalter
  document.querySelectorAll("img[data-placeholder]").forEach((img) => {
    const swap = () => {
      const div = document.createElement("div");
      div.className = "placeholder" + (img.id === "zoom-img" ? " zoom-target" : "");
      div.id = img.id;
      div.textContent = img.dataset.placeholder;
      img.replaceWith(div);
    };
    if (img.complete && img.naturalWidth === 0) swap();
    else img.addEventListener("error", swap, { once: true });
    if (img.id === "zoom-img") img.classList.add("zoom-target");
  });

  const scrollToEl = (el) => el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  document.querySelector("[data-next]").addEventListener("click", (e) => {
    scrollToEl(e.target.closest(".screen").nextElementSibling);
  });

  const unlock = (id) => {
    const el = document.getElementById(id);
    el.classList.remove("locked");
    observeReveals(el);
    return el;
  };

  /* ---------------------------------------------
     Zoom mit Sprechblase
     --------------------------------------------- */
  const answers = { neinVersuche: 0, sicher: "", zoomKlicks: 0 };

  // x/y = Punkt im Bild (0–1), der in die Mitte gezoomt wird
  const ZOOM_STEPS = [
    { s: 1.8, x: 0.29, y: 0.29 }, // Hase
    { s: 3, x: 0.29, y: 0.28 },   // Hase, näher
    { s: 6, x: 0.64, y: 0.39 },   // ihr Gesicht
  ];
  const BUBBLE_TEXT = ["Nochmals 👆", "Nochmals!! 👆"];
  const zoomFrame = document.getElementById("zoom-frame");
  const bubble = document.getElementById("bubble");
  const dude = document.getElementById("dude");
  let zoomStep = 0;

  const zoomTo = ({ s, x, y }) => {
    const clamp = (v) => Math.min(0, Math.max(100 - 100 * s, v));
    const tx = clamp(50 - s * x * 100), ty = clamp(50 - s * y * 100);
    document.getElementById("zoom-img").style.transform = `translate(${tx}%, ${ty}%) scale(${s})`;
  };

  zoomFrame.addEventListener("click", () => {
    if (zoomStep >= ZOOM_STEPS.length) return;
    zoomTo(ZOOM_STEPS[zoomStep]);
    zoomStep++;
    answers.zoomKlicks = zoomStep;
    if (zoomStep < ZOOM_STEPS.length) {
      bubble.textContent = BUBBLE_TEXT[zoomStep - 1];
    } else {
      bubble.hidden = true;
      setTimeout(() => {
        dude.classList.add("show");
        const frage = unlock("frage");
        requestAnimationFrame(centerNein);
        setTimeout(() => scrollToEl(frage), 1800);
      }, 700);
    }
  });

  /* ---------------------------------------------
     Ja / Nein
     --------------------------------------------- */
  const btnJa = document.getElementById("btn-ja");
  const btnNein = document.getElementById("btn-nein");
  const noMsg = document.getElementById("no-msg");
  const answers1 = document.getElementById("answers-1");
  const answers2 = document.getElementById("answers-2");

  const NO_TEXT = [
    "Akzeptiere ich nicht. 🙅‍♂️",
    "Falsche Antwort. Versuch's nochmal.",
    "Der Hase ist jetzt traurig 🐰💔",
    "Error 404: „Nein“ nicht gefunden.",
    "Ich kann das den ganzen Tag machen 😌",
  ];
  const JA_AFTER = 3; // so oft muss sie Nein jagen, bis Ja auftaucht

  // Nein hüpft innerhalb der Spielfläche herum, ohne Ja zu verdecken
  const nein = { x: 0, y: 0, scale: 1 };
  const placeNein = () => {
    btnNein.style.transform = `translate(${nein.x}px, ${nein.y}px) scale(${nein.scale})`;
  };
  const centerNein = () => {
    nein.x = (answers1.clientWidth - btnNein.offsetWidth) / 2;
    nein.y = (answers1.clientHeight - btnNein.offsetHeight) / 2;
    placeNein();
  };

  const jumpNein = () => {
    const maxX = answers1.clientWidth - btnNein.offsetWidth;
    const maxY = answers1.clientHeight - btnNein.offsetHeight;
    const ja = btnJa.hidden ? null : {
      x: btnJa.offsetLeft - btnJa.offsetWidth / 2 - btnNein.offsetWidth - 12,
      y: btnJa.offsetTop - btnJa.offsetHeight / 2 - btnNein.offsetHeight - 12,
      w: btnJa.offsetWidth + btnNein.offsetWidth + 24,
      h: btnJa.offsetHeight + btnNein.offsetHeight + 24,
    };
    let x, y, tries = 0;
    do {
      x = Math.random() * maxX;
      y = Math.random() * maxY;
      tries++;
    } while (tries < 40 && (
      Math.hypot(x - nein.x, y - nein.y) < 110 ||
      (ja && x > ja.x && x < ja.x + ja.w && y > ja.y && y < ja.y + ja.h)
    ));
    nein.x = x; nein.y = y;
    placeNein();
  };

  const sayNo = () => {
    answers.neinVersuche++;
    const n = answers.neinVersuche;
    navigator.vibrate?.(15);
    noMsg.textContent = NO_TEXT[Math.min(n - 1, NO_TEXT.length - 1)];
    noMsg.classList.remove("bump"); void noMsg.offsetWidth; noMsg.classList.add("bump");
    if (n >= JA_AFTER && btnJa.hidden) {
      btnJa.hidden = false;
      noMsg.textContent = "Vielleicht passt dieser hier besser? 👀";
    }
    if (n > JA_AFTER) nein.scale = Math.max(0.55, 1 - (n - JA_AFTER) * 0.1);
    jumpNein();
  };

  // pointerdown statt click: reagiert sofort, ohne Verzögerung beim Tippen
  btnNein.addEventListener("pointerdown", (e) => { e.preventDefault(); sayNo(); });
  btnNein.addEventListener("click", (e) => { if (e.detail === 0) sayNo(); }); // Tastatur
  window.addEventListener("resize", () => { if (!answers1.hidden) jumpNein(); });

  const sayYes = () => {
    rainHearts(18);
    answers1.hidden = true;
    btnNein.hidden = true;
    noMsg.textContent = "";
    answers2.hidden = false;
  };
  btnJa.addEventListener("click", sayYes);

  answers2.querySelectorAll("[data-sure]").forEach((btn) => {
    btn.addEventListener("click", () => {
      answers.sicher = btn.dataset.sure;
      rainHearts(Number(btn.dataset.hearts));
      if (answers.sicher === "Tripple Ja") bunnyParty();
      answers2.querySelectorAll("button").forEach((b) => (b.disabled = true));
      const kal = unlock("kalender");
      setTimeout(() => scrollToEl(kal), 1600);
    });
  });

  /* ---------------------------------------------
     Kalender
     --------------------------------------------- */
  const YEAR = 2026, MONTH = 10; // November (0-basiert)
  const FIRST_DAY = 4, LAST_DAY = 15; // morgen bis Sonntag nächste Woche
  const GRID_START = 2, GRID_END = 15; // Mo 2.11. bis So 15.11.
  const BUSY = [5, 7, 9, 11, 13, 14];
  const HOURS = Array.from({ length: 16 }, (_, i) => String(i + 8).padStart(2, "0")); // 08–23
  const MINUTES = ["00", "15", "30", "45"];
  const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  const cal = document.getElementById("cal");
  const timesBox = document.getElementById("times");
  const sendBtn = document.getElementById("send");
  const status = document.getElementById("status");
  let pickedDay = null;
  const picked = { h: "18", m: "00" };

  WEEKDAYS.forEach((d) => {
    const el = document.createElement("div");
    el.className = "cal-head";
    el.textContent = d;
    cal.appendChild(el);
  });

  for (let d = GRID_START; d <= GRID_END; d++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    btn.textContent = d;
    if (d < FIRST_DAY || d > LAST_DAY) {
      btn.classList.add("past"); btn.disabled = true;
    } else if (BUSY.includes(d)) {
      btn.classList.add("busy"); btn.disabled = true;
      btn.setAttribute("aria-label", `${d}. November – geht leider nicht`);
    } else {
      btn.addEventListener("click", () => {
        cal.querySelectorAll(".day.selected").forEach((x) => x.classList.remove("selected"));
        btn.classList.add("selected");
        pickedDay = d;
        const firstTime = timesBox.hidden;
        timesBox.hidden = false;
        if (firstTime) wheels.forEach((w) => w.jumpTo());
        sendBtn.disabled = false;
      });
    }
    cal.appendChild(btn);
  }

  // Drehrad wie beim iPhone-Wecker
  const makeWheel = (el, values, key) => {
    const ITEM = 44;
    const pad = () => { const d = document.createElement("div"); d.className = "wheel-pad"; return d; };
    el.appendChild(pad());
    const items = values.map((v, i) => {
      const it = document.createElement("div");
      it.className = "wheel-item";
      it.textContent = v;
      it.addEventListener("click", () => el.scrollTo({ top: i * ITEM, behavior: "smooth" }));
      el.appendChild(it);
      return it;
    });
    el.appendChild(pad());

    const update = () => {
      const pos = el.scrollTop / ITEM;
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(pos)));
      items.forEach((it, i) => {
        const d = i - pos;
        it.style.transform = `rotateX(${Math.max(-70, Math.min(70, d * -22))}deg)`;
        it.style.opacity = String(Math.max(0.15, 1 - Math.abs(d) * 0.3));
        it.classList.toggle("active", i === idx);
      });
      picked[key] = values[idx];
    };
    el.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });

    return { jumpTo: () => { el.scrollTop = values.indexOf(picked[key]) * ITEM; update(); } };
  };
  const wheels = [
    makeWheel(document.getElementById("wheel-h"), HOURS, "h"),
    makeWheel(document.getElementById("wheel-m"), MINUTES, "m"),
  ];
  const pickedTime = () => `${picked.h}:${picked.m}`;

  const dayLabel = (d) => {
    const date = new Date(YEAR, MONTH, d);
    return `${DAY_NAMES[date.getDay()]}, ${d}. November`;
  };

  /* ---------------------------------------------
     Absenden über Web3Forms
     --------------------------------------------- */
  sendBtn.addEventListener("click", async () => {
    sendBtn.disabled = true;
    status.textContent = "Wird gesendet …";

    const fd = new FormData(document.getElementById("form"));
    fd.append("subject", `🐰 Alea hat geantwortet: ${dayLabel(pickedDay)}`);
    fd.append("from_name", "Alea-Seite");
    fd.append("Tag", dayLabel(pickedDay));
    fd.append("Uhrzeit", pickedTime());
    fd.append("Wie sicher", answers.sicher);
    fd.append("Nein-Versuche", String(answers.neinVersuche));
    fd.append("Zoom-Klicks", String(answers.zoomKlicks));
    fd.append("Gesendet am", new Date().toLocaleString("de-CH"));

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      document.getElementById("danke-text").textContent = `Bis am ${dayLabel(pickedDay)} um ${pickedTime()} ❤️`;
      const danke = unlock("danke");
      scrollToEl(danke);
      rainHearts(80);
    } catch {
      status.textContent = "Hoppla, das hat nicht geklappt. Bitte nochmals versuchen.";
      sendBtn.disabled = false;
    }
  });
})();
