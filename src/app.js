(function () {
  "use strict";

  const Q = window.QUIZ;
  const $ = (s) => document.querySelector(s);
  const FRAMES = document.querySelectorAll("#frames img");
  const LAST = FRAMES.length - 1;                 // 8
  const TOTAL = Q.facts.filter((f) => f.ok).length;

  let found = 0;
  let finished = false;
  let soundOn = true;

  /* ───────── Звуковые эффекты (синтез, без файлов) ───────── */
  let ac = null;
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === "suspended") ac.resume();
    return ac;
  }
  function noise(a, dur) {
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.18 ? 1 : 0.35);
    const src = a.createBufferSource(); src.buffer = buf; return src;
  }
  function sfxTear() {
    const a = soundOn && ctx(); if (!a) return;
    const t = a.currentTime, src = noise(a, 0.45);
    const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(1800, t); bp.frequency.linearRampToValueAtTime(4200, t + 0.4);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(bp).connect(g).connect(a.destination); src.start(t);
  }
  function sfxStamp() {
    const a = soundOn && ctx(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    const g = a.createGain(); g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.22);
    // «динь» — правильный ответ
    [880, 1318.5].forEach((f, i) => {
      const s = a.createOscillator(); s.type = "triangle"; s.frequency.value = f;
      const sg = a.createGain(), st = t + 0.08 + i * 0.09;
      sg.gain.setValueAtTime(0.0001, st); sg.gain.exponentialRampToValueAtTime(0.18, st + 0.01);
      sg.gain.exponentialRampToValueAtTime(0.0001, st + 0.5);
      s.connect(sg).connect(a.destination); s.start(st); s.stop(st + 0.55);
    });
  }

  /* ───────── Табло с буквами-перевёртышами ───────── */
  const ABC = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789";
  function flipBoard(el, text, whiteWords) {
    el.textContent = "";
    let k = 0;
    text.toUpperCase().split(" ").forEach((w, wi) => {
      const word = document.createElement("span"); word.className = "word";
      [...w].forEach((c) => {
        const ch = document.createElement("span");
        ch.className = "ch" + (whiteWords && whiteWords.includes(wi) ? " white" : "");
        ch.textContent = " ";
        word.appendChild(ch);
        const steps = 6 + k * 1.3 + Math.random() * 4;
        let n = 0;
        const timer = setInterval(() => {
          n++;
          ch.classList.remove("tick"); void ch.offsetWidth; ch.classList.add("tick");
          if (n >= steps) { ch.textContent = c; clearInterval(timer); }
          else ch.textContent = ABC[Math.floor(Math.random() * ABC.length)];
        }, 45);
        k++;
      });
      el.appendChild(word);
    });
  }

  /* ───────── Кадры и маршрут ───────── */
  function frameFor(n) { return Math.round((n / TOTAL) * LAST); }

  function setFrame(i, animate) {
    FRAMES.forEach((img, j) => {
      if (j === i) { img.classList.remove("on"); void img.offsetWidth; img.classList.add("on"); }
      else img.classList.remove("on");
    });
    const cap = $(".caption"), capText = Q.captions[i] || "";
    $("#capText").textContent = capText;
    $("#capStep").textContent = "Старт";
    $("#capStep").hidden = i !== 0;
    cap.hidden = !capText;
    cap.classList.remove("swap"); void cap.offsetWidth; cap.classList.add("swap");

    const pct = (i / LAST) * 100;
    $("#railDone").style.width = pct + "%";
    $("#loco").style.left = pct + "%";
    document.querySelectorAll(".stop").forEach((s, j) => s.classList.toggle("done", j <= i));
    if (animate) {
      const sc = $("#scene"); sc.classList.remove("flash"); void sc.offsetWidth; sc.classList.add("flash");
      const lo = $("#loco"); lo.classList.remove("chug"); void lo.getBoundingClientRect(); lo.classList.add("chug");
    }
  }

  function buildStops() {
    const box = $("#stops"); box.textContent = "";
    for (let i = 0; i <= LAST; i++) {
      const s = document.createElement("span");
      s.className = "stop" + (i === LAST ? " end" : "");
      s.style.left = (i / LAST) * 100 + "%";
      box.appendChild(s);
    }
  }

  /* ───────── Билеты ───────── */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function tearPaths() {
    // Неровная линия разрыва: точки сверху вниз
    const base = 52 + Math.random() * 8, pts = [];
    const n = 12;
    for (let k = 0; k <= n; k++) {
      const y = (k / n) * 100;
      const x = base + (k % 2 ? 1 : -1) * (1 + Math.random() * 2.6) + (Math.random() - 0.5) * 1.5;
      pts.push([x.toFixed(2), y.toFixed(2)]);
    }
    const line = pts.map((p) => p[0] + "% " + p[1] + "%");
    const a = ["0 0", ...line, "0 100%"];
    const b = [...line, "100% 100%", "100% 0"];
    return ["polygon(" + a.join(",") + ")", "polygon(" + b.join(",") + ")"];
  }

  function barcode() {
    let pos = 0, out = [];
    while (pos < 100) {
      const bar = 1.5 + Math.random() * 4, gap = 1.5 + Math.random() * 3;
      out.push(`#1f2228 ${pos}% ${(pos + bar).toFixed(1)}%`, `transparent ${(pos + bar).toFixed(1)}% ${(pos + bar + gap).toFixed(1)}%`);
      pos += bar + gap;
    }
    return "linear-gradient(180deg," + out.join(",") + ")";
  }

  function makeFace(fact, no, bars) {
    const face = document.createElement("span"); face.className = "face";
    face.innerHTML =
      '<span class="stub"><svg><use href="#i-train"/></svg><span class="lines"></span></span>' +
      '<span class="body"><span class="tk-no"></span><span class="tk-text"></span></span>' +
      '<span class="code"><i></i></span>';
    face.querySelector(".tk-no").textContent = "Билет № " + String(no).padStart(2, "0");
    face.querySelector(".tk-text").textContent = fact.text;
    face.querySelector(".code i").style.setProperty("--bars", bars);
    return face;
  }

  function buildTickets() {
    const list = $("#tickets"); list.textContent = "";
    shuffle(Q.facts.slice()).forEach((fact, idx) => {
      const li = document.createElement("li"); li.className = "slot";
      li.style.animationDelay = idx * 45 + "ms";
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "tk";
      btn.setAttribute("aria-label", "Билет: " + fact.text);
      const [ca, cb] = tearPaths(), bars = barcode();

      const a = document.createElement("span"); a.className = "half a"; a.style.setProperty("--clip", ca); a.style.position = "relative";
      a.appendChild(makeFace(fact, idx + 1, bars));
      const bad = document.createElement("span"); bad.className = "stamp bad"; bad.textContent = "Ложь";
      a.appendChild(bad);
      const b = document.createElement("span"); b.className = "half b"; b.style.setProperty("--clip", cb); b.setAttribute("aria-hidden", "true");
      b.appendChild(makeFace(fact, idx + 1, bars));
      const ok = document.createElement("span"); ok.className = "stamp ok"; ok.textContent = "Верно";

      btn.append(a, b, ok);
      btn.addEventListener("click", () => pick(btn, li, fact));
      li.appendChild(btn);
      li._fact = fact; li._btn = btn;
      list.appendChild(li);
    });
  }

  function addNote(li, fact) {
    const n = document.createElement("div");
    n.className = "note " + (fact.ok ? "ok" : "bad");
    const h = document.createElement("b");
    h.textContent = fact.ok ? "✓ Верно!" : "✗ Неправда. Как на самом деле:";
    n.appendChild(h);
    if (fact.note) n.appendChild(document.createTextNode(fact.note));
    li.appendChild(n);
    setTimeout(() => n.scrollIntoView({ block: "nearest", behavior: "smooth" }), 500);
  }

  function tear(btn, li, fact, quiet) {
    btn.disabled = true;
    btn.classList.add("shake");
    setTimeout(() => {
      btn.classList.remove("shake");
      btn.classList.add("is-torn");
      if (!quiet) sfxTear();
      addNote(li, fact);
    }, 330);
  }

  function pick(btn, li, fact) {
    if (btn.disabled || finished) return;
    if (!fact.ok) { tear(btn, li, fact); return; }

    btn.disabled = true;
    btn.classList.add("is-ok");
    sfxStamp();
    addNote(li, fact);
    found++;
    const c = $(".counter"); $("#cnt").textContent = found;
    c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");

    const last = found >= TOTAL;
    if (last) finished = true;        // больше ничего не нажимается, финал запускается один раз
    flyToScene(btn, () => {
      setFrame(frameFor(found), true);
      if (last) finish();
    });
  }

  function flyToScene(btn, done) {
    const r = btn.getBoundingClientRect(), t = $("#scene").getBoundingClientRect();
    const f = document.createElement("div"); f.className = "fly";
    Object.assign(f.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    document.body.appendChild(f);
    const dx = t.left + t.width / 2 - (r.left + r.width / 2);
    const dy = t.top + t.height / 2 - (r.top + r.height / 2);
    if (!f.animate) { f.remove(); done(); return; }
    const anim = f.animate([
      { transform: "none", opacity: 0.95 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(.55) rotate(-10deg)`, opacity: 0.95, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.08) rotate(-24deg)`, opacity: 0.2 }
    ], { duration: 750, easing: "cubic-bezier(.4,0,.6,1)" });
    let fired = false;
    const end = () => { if (fired) return; fired = true; f.remove(); done(); };
    anim.onfinish = end;
    setTimeout(end, 1100);   // страховка, если анимация не доиграет (свёрнутое окно и т.п.)
  }

  /* ───────── Финал ───────── */
  function remainingFalse() {
    return [...document.querySelectorAll(".slot")].filter((li) => !li._fact.ok && !li._btn.disabled);
  }

  function finish() {
    const au = $("#announce");
    if (soundOn) { au.currentTime = 0; const p = au.play(); if (p && p.catch) p.catch(() => {}); }
    setTimeout(() => {
      const fin = $("#final");
      fin.classList.remove("hide"); fin.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => fin.classList.add("show"));
      flipBoard($("#finalBoard"), Q.finalTitle, [1]);
      $("#finalText").textContent = Q.finalText;
      $("#revealBtn").style.display = remainingFalse().length ? "" : "none";
      sparks();
    }, 1800);
  }

  function sparks() {
    const colors = ["#e2231a", "#ffffff", "#ffb51f", "#284b8f"];
    for (let i = 0; i < 70; i++) {
      const s = document.createElement("i"); s.className = "spark";
      s.style.left = Math.random() * 100 + "vw";
      s.style.top = -20 - Math.random() * 30 + "vh";
      s.style.background = colors[i % colors.length];
      s.style.setProperty("--dx", (Math.random() - 0.5) * 30 + "vw");
      s.style.setProperty("--rot", Math.random() * 900 + "deg");
      s.style.animationDuration = 3 + Math.random() * 3 + "s";
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 6500);
    }
  }

  function closeFinal() {
    const fin = $("#final");
    fin.classList.remove("show"); fin.classList.add("hide"); fin.setAttribute("aria-hidden", "true");
  }

  function reset() {
    closeFinal();
    const au = $("#announce"); au.pause(); au.currentTime = 0;
    found = 0; finished = false;
    $("#cnt").textContent = "0";
    buildTickets();
    setFrame(0, false);
  }

  /* ───────── Запуск ───────── */
  $("#title").textContent = Q.title;
  $("#task").textContent = Q.task;
  $("#startTitle").textContent = Q.title;
  $("#startTask").textContent = Q.task;
  $("#final").classList.add("hide");
  buildStops();
  buildTickets();
  setFrame(0, false);
  flipBoard($("#startBoard"), "Посадка открыта");

  $("#goBtn").addEventListener("click", () => {
    ctx();
    // «Разблокируем» аудио на iOS/Safari тихим запуском — сам звук прозвучит только в финале
    const au = $("#announce"); au.muted = true;
    const p = au.play(); if (p && p.then) p.then(() => { au.pause(); au.currentTime = 0; au.muted = false; }).catch(() => { au.muted = false; });
    else { au.pause(); au.muted = false; }
    $("#start").classList.add("hide");
  });
  $("#againBtn").addEventListener("click", reset);
  $("#revealBtn").addEventListener("click", () => {
    closeFinal();
    remainingFalse().forEach((li, i) => setTimeout(() => tear(li._btn, li, li._fact, i > 0), 400 + i * 450));
  });
  $("#soundBtn").addEventListener("click", (e) => {
    soundOn = !soundOn;
    e.currentTarget.setAttribute("aria-pressed", String(soundOn));
    if (!soundOn) $("#announce").pause();
  });
})();
