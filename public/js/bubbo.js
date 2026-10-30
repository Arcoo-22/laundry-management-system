// Bubbo, the laundry assistant mascot (injected on every page by ui.js).
// Chat answers come from POST /api/chat, where the server talks to Groq. No API key lives in the browser.
import { escapeHtml } from "./ui.js";

const bubboSvg = (uid, viewBox = "0 0 140 150") => `<svg class="bubbo-svg" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="bbh${uid}" cx="36%" cy="26%" r="85%"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e6f5ff"/><stop offset="1" stop-color="#b4ddf8"/></radialGradient>
<linearGradient id="bbb${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0faff"/><stop offset="1" stop-color="#bde1f9"/></linearGradient>
<linearGradient id="bbc${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5aa5ff"/><stop offset="1" stop-color="#7569f0"/></linearGradient>
<linearGradient id="bbr${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a7fe6"/><stop offset="1" stop-color="#4b47c4"/></linearGradient>
</defs>
<ellipse cx="70" cy="141" rx="30" ry="5" fill="#3b82f6" opacity=".18"/>
<g class="bb-float" fill="rgba(190,226,255,.35)" stroke="#9fd0f5" stroke-width="1.5"><circle cx="19" cy="58" r="6"/><circle cx="123" cy="126" r="7"/><circle cx="17" cy="124" r="3.5"/><circle cx="120" cy="44" r="3"/></g>
<ellipse cx="61" cy="133" rx="8.5" ry="5" fill="url(#bbb${uid})" stroke="#a6d4f4" stroke-width="1.5"/>
<ellipse cx="79" cy="133" rx="8.5" ry="5" fill="url(#bbb${uid})" stroke="#a6d4f4" stroke-width="1.5"/>
<rect x="52" y="92" width="36" height="40" rx="17" fill="url(#bbb${uid})" stroke="#a6d4f4" stroke-width="1.6"/>
<ellipse cx="46" cy="110" rx="6" ry="10" transform="rotate(14 46 110)" fill="url(#bbb${uid})" stroke="#a6d4f4" stroke-width="1.5"/>
<ellipse cx="94" cy="110" rx="6" ry="10" transform="rotate(-14 94 110)" fill="url(#bbb${uid})" stroke="#a6d4f4" stroke-width="1.5"/>
<circle cx="70" cy="113" r="9.5" fill="#eaf7ff" stroke="#4f9bff" stroke-width="1.8"/>
<path d="M63.5 113q3.2-4.5 6.5 0t6.5 0" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
<ellipse cx="70" cy="64" rx="38" ry="32" fill="url(#bbh${uid})" stroke="#a6d4f4" stroke-width="1.8"/>
<g class="bb-eyes"><circle cx="57" cy="71" r="3.2" fill="#1e2a4a"/><circle cx="83" cy="71" r="3.2" fill="#1e2a4a"/><path d="M60 71H80" stroke="#1e2a4a" stroke-width="1.6" stroke-linecap="round"/></g>
<ellipse cx="47" cy="78" rx="5.5" ry="3.2" fill="#ffb3cf" opacity=".7"/><ellipse cx="93" cy="78" rx="5.5" ry="3.2" fill="#ffb3cf" opacity=".7"/>
<path d="M35 53C35 22 105 22 105 53Z" fill="url(#bbc${uid})"/>
<circle cx="70" cy="26.5" r="3" fill="#3f6fe0"/>
<path d="M30 54C30 47 110 47 110 54C110 63 91 65 70 65C49 65 30 63 30 54Z" fill="url(#bbr${uid})"/>
<path d="M36 55C50 60 90 60 104 55" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.4" stroke-linecap="round"/>
<circle cx="70" cy="40" r="7.5" fill="#fff"/><circle cx="70" cy="40" r="4.6" fill="none" stroke="#4f9bff" stroke-width="1.6"/><circle cx="68.3" cy="38.4" r="1.1" fill="#4f9bff"/>
</svg>`;

const CHIPS = ["Services & prices", "Track my order", "How do I pay?", "Pickup or delivery?"];
const MAX_HISTORY = 10;
const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>`;

// Turn the model's plain text into safe HTML: escape first, then allow only **bold**, "- " lists and line breaks
function formatReply(text) {
  let out = "";
  let inList = false;
  for (const raw of escapeHtml(text).split(/\r?\n/)) {
    let line = raw.trim();
    if (/^\|?[\s:|-]+\|?$/.test(line) && line.includes("-")) continue; // markdown table divider
    if (line.startsWith("|")) line = line.split("|").map((c) => c.trim()).filter(Boolean).join(" · ");
    line = line.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^#{1,6}\s+/, "");
    const li = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) {
      if (!inList) { out += "<ul>"; inList = true; }
      out += `<li>${li[1]}</li>`;
    } else {
      if (inList) { out += "</ul>"; inList = false; }
      if (line) out += `<div>${line}</div>`;
    }
  }
  return out + (inList ? "</ul>" : "");
}

// Bubbo carries his own styles, so he looks right even if styles.css is an older copy
const BUBBO_CSS = `
/* ---------- Bubbo, the laundry assistant mascot ---------- */
.bubbo {
  position: fixed;
  right: 24px;
  bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text-main, #1e2a4a);
}
.bubbo [hidden] { display: none !important; }

.bubbo-greet {
  max-width: 230px;
  padding: 12px 16px;
  border-radius: 20px 20px 6px 20px;
  background: var(--modal-bg, #fff);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.9));
  box-shadow: var(--shadow, 0 10px 30px -8px rgba(99, 102, 241, 0.25));
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1.35;
  cursor: pointer;
  animation: bubbo-pop 0.5s var(--pop, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.bubbo-btn {
  position: relative;
  width: 116px;
  height: 124px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transition: transform 0.25s var(--pop, cubic-bezier(0.34, 1.56, 0.64, 1));
}
.bubbo-btn:hover { transform: scale(1.08) rotate(-2deg); }
.bubbo-btn:active { transform: scale(0.95); }
.bubbo-btn:focus-visible { outline: 3px solid var(--border-focus, #22d3ee); outline-offset: 4px; border-radius: 24px; }

.bubbo-svg { display: block; width: 100%; height: 100%; overflow: visible; }

/* Round bubble badge behind Bubbo so he stands out on any page */
.bubbo-btn::before,
.bubbo-btn::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 108px;
  height: 108px;
  margin-left: -54px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
.bubbo-btn::before {
  background: radial-gradient(circle at 34% 24%, #c4f5ff 0%, #5cc8f5 42%, #3f8cf0 100%);
  border: 4px solid #fff;
  box-shadow: 0 12px 28px -4px rgba(59, 130, 246, 0.55), 0 0 0 7px rgba(255, 255, 255, 0.4);
}
.bubbo-btn::after {
  border: 3px solid rgba(79, 143, 247, 0.6);
  animation: bubbo-ring 2.6s ease-out infinite;
}
.bubbo-btn .bubbo-svg { position: relative; z-index: 1; }
.bubbo-btn .bubbo-svg {
  animation: bubbo-bob 3.2s ease-in-out infinite;
  filter: drop-shadow(0 8px 12px rgba(59, 130, 246, 0.22));
}
.bb-eyes { transform-box: fill-box; transform-origin: center; animation: bubbo-blink 4.8s infinite; }
.bb-float circle { transform-box: fill-box; transform-origin: center; animation: bubbo-drift 3.6s ease-in-out infinite alternate; }
.bb-float circle:nth-child(2) { animation-delay: -1.2s; }
.bb-float circle:nth-child(3) { animation-delay: -2.1s; }
.bb-float circle:nth-child(4) { animation-delay: -0.6s; }

.bubbo-dot {
  position: absolute;
  top: 8px;
  right: 6px;
  z-index: 2;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: #e5484d;
  border: 2px solid #fff;
  animation: bubbo-ping 2.2s infinite;
}

/* Chat panel */
.bubbo-panel {
  width: min(350px, calc(100vw - 32px));
  height: min(480px, calc(100vh - 170px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 26px;
  background: var(--modal-bg, #fff);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.9));
  box-shadow: var(--shadow-xl, 0 30px 60px -15px rgba(60, 50, 150, 0.45));
  transform-origin: bottom right;
  animation: bubbo-pop 0.35s var(--pop, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.bubbo-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  color: #fff;
  background: linear-gradient(120deg, #3b82f6, #a78bfa);
}
.bubbo-avatar { width: 46px; height: 42px; flex: none; border-radius: 14px; background: rgba(255, 255, 255, 0.85); padding: 2px; overflow: hidden; }
.bubbo-avatar .bubbo-svg { overflow: hidden; }
.bubbo-title { flex: 1; font-family: "Fredoka", "Nunito", sans-serif; font-size: 1.1rem; font-weight: 600; line-height: 1.1; }
.bubbo-title small { display: block; font-family: "Nunito", sans-serif; font-size: 0.72rem; font-weight: 700; opacity: 0.9; }
.bubbo-close {
  width: 32px; height: 32px; border: 0; border-radius: 50%;
  background: rgba(255, 255, 255, 0.25); color: #fff; font-size: 1.2rem; line-height: 1; cursor: pointer;
  transition: transform 0.25s var(--pop, cubic-bezier(0.34, 1.56, 0.64, 1)), background 0.2s;
}
.bubbo-close:hover { background: rgba(255, 255, 255, 0.4); transform: rotate(90deg); }

.bubbo-log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.bubbo-msg {
  max-width: 88%;
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.45;
  overflow-wrap: anywhere;
  animation: bubbo-pop 0.3s var(--pop, cubic-bezier(0.34, 1.56, 0.64, 1));
}
.bubbo-msg.bot { align-self: flex-start; border-bottom-left-radius: 6px; background: var(--field-bg, rgba(255, 255, 255, 0.72)); border: 1px solid var(--border-soft, rgba(120, 130, 190, 0.18)); }
.bubbo-msg.me { align-self: flex-end; border-bottom-right-radius: 6px; color: #fff; background: linear-gradient(120deg, #3b82f6, #a78bfa); }
.bubbo-msg ul { margin: 6px 0 0; padding-left: 18px; }
.bubbo-msg li { margin: 2px 0; }
.bubbo-msg b { font-weight: 800; }
.bubbo-typing { display: inline-flex; gap: 4px; padding: 4px 0; }
.bubbo-typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--text-light, #8d99be); animation: bubbo-dots 1s infinite; }
.bubbo-typing i:nth-child(2) { animation-delay: 0.15s; }
.bubbo-typing i:nth-child(3) { animation-delay: 0.3s; }

.bubbo-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 14px 10px; }
.bubbo-chip {
  padding: 7px 13px; border-radius: 9999px; cursor: pointer;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.9));
  background: var(--ghost-bg, rgba(255, 255, 255, 0.6)); color: var(--text-main, #1e2a4a);
  font: 800 0.78rem "Nunito", sans-serif;
  transition: transform 0.25s var(--pop, cubic-bezier(0.34, 1.56, 0.64, 1)), background 0.2s;
}
.bubbo-chip:hover { transform: translateY(-2px) scale(1.04); background: var(--row-hover, rgba(255, 255, 255, 0.9)); }

.bubbo-form { display: flex; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid var(--border-soft, rgba(120, 130, 190, 0.18)); }
.bubbo-form input {
  flex: 1; min-width: 0; padding: 10px 16px; border-radius: 9999px; outline: 0;
  border: 2px solid transparent; background: var(--field-bg, rgba(255, 255, 255, 0.72));
  box-shadow: inset 0 0 0 1px var(--border-soft, rgba(120, 130, 190, 0.18));
  font: 600 0.9rem "Nunito", sans-serif; color: var(--text-main, #1e2a4a);
}
.bubbo-form input:focus { border-color: var(--lilac, #a78bfa); box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.22); }
.bubbo-send {
  width: 40px; height: 40px; flex: none; border: 0; border-radius: 50%; cursor: pointer; color: #fff;
  background: linear-gradient(120deg, #3b82f6, #a78bfa); display: grid; place-items: center;
  transition: transform 0.25s var(--pop, cubic-bezier(0.34, 1.56, 0.64, 1));
}
.bubbo-send:hover { transform: scale(1.1); }
.bubbo-send svg { width: 18px; height: 18px; }

@keyframes bubbo-pop { from { opacity: 0; transform: scale(0.8) translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes bubbo-ring { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.35); opacity: 0; } }
@keyframes bubbo-bob { 50% { transform: translateY(-5px); } }
@keyframes bubbo-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
@keyframes bubbo-drift { to { transform: translate(3px, -7px) scale(1.1); } }
@keyframes bubbo-ping { 0% { box-shadow: 0 0 0 0 rgba(229, 72, 77, 0.55); } 70%, 100% { box-shadow: 0 0 0 10px rgba(229, 72, 77, 0); } }
@keyframes bubbo-dots { 0%, 80%, 100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-4px); opacity: 1; } }

@media (max-width: 600px) { .bubbo { right: 12px; } }
@media (prefers-reduced-motion: reduce) {
  .bubbo *, .bubbo-greet, .bubbo-panel { animation: none !important; }
  .bubbo-btn::after { animation: none !important; opacity: 0; }
}

/* Keep toast notifications above Bubbo instead of covering him */
html #toast-container { bottom: calc(165px + env(safe-area-inset-bottom, 0px)); }
@media (max-width: 600px) { html #toast-container { right: 12px; } }
`;

function injectStyles() {
  if (document.getElementById("bubbo-styles")) return;
  const style = document.createElement("style");
  style.id = "bubbo-styles";
  style.textContent = BUBBO_CSS;
  document.head.appendChild(style);
}

function initBubbo() {
  if (document.getElementById("bubbo")) return;
  injectStyles();

  const root = document.createElement("div");
  root.id = "bubbo";
  root.className = "bubbo";
  root.innerHTML = `
    <section class="bubbo-panel" role="dialog" aria-label="Chat with Bubbo" hidden>
      <header class="bubbo-head">
        <span class="bubbo-avatar">${bubboSvg("h", "26 20 88 80")}</span>
        <div class="bubbo-title">Bubbo<small>Laundry assistant</small></div>
        <button type="button" class="bubbo-close" aria-label="Close chat">&times;</button>
      </header>
      <div class="bubbo-log" aria-live="polite"></div>
      <div class="bubbo-chips"></div>
      <form class="bubbo-form" autocomplete="off">
        <input type="text" placeholder="Ask Bubbo anything…" aria-label="Message Bubbo" maxlength="200">
        <button type="submit" class="bubbo-send" aria-label="Send">${SEND_ICON}</button>
      </form>
    </section>
    <div class="bubbo-greet" hidden>Hi, I am Bubbo! Need help with your laundry?</div>
    <button type="button" class="bubbo-btn" aria-label="Chat with Bubbo">${bubboSvg("b")}<span class="bubbo-dot"></span></button>`;
  document.body.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const panel = $(".bubbo-panel"), greet = $(".bubbo-greet"), btn = $(".bubbo-btn"), dot = $(".bubbo-dot");
  const log = $(".bubbo-log"), chips = $(".bubbo-chips"), form = $(".bubbo-form");
  const input = form.querySelector("input"), sendBtn = $(".bubbo-send");
  const history = []; // { role: "user" | "assistant", content }
  let busy = false, started = false, greetTimer;

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const addMsg = (who, html) => {
    const el = document.createElement("div");
    el.className = `bubbo-msg ${who}`;
    el.innerHTML = html;
    log.appendChild(el);
    scroll();
    return el;
  };
  const setBusy = (v) => {
    busy = v;
    input.disabled = v;
    sendBtn.disabled = v;
    if (!v) input.focus();
  };

  chips.innerHTML = CHIPS.map((c) => `<button type="button" class="bubbo-chip">${escapeHtml(c)}</button>`).join("");

  // Ask the server (which asks Groq) and show the answer
  const ask = async (text) => {
    text = text.trim();
    if (!text || busy) return;
    setBusy(true);
    addMsg("me", escapeHtml(text));
    history.push({ role: "user", content: text });
    const bubble = addMsg("bot", `<span class="bubbo-typing"><i></i><i></i><i></i></span>`);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) throw new Error(data.message || "Bubbo couldn’t answer right now. Please try again.");

      history.push({ role: "assistant", content: data.reply });
      bubble.innerHTML = formatReply(data.reply);
    } catch (err) {
      history.pop(); // drop the unanswered question so a retry starts clean
      bubble.textContent = err instanceof TypeError ? "I can’t reach the server right now. Please check your connection." : err.message;
    } finally {
      scroll();
      setBusy(false);
    }
  };

  chips.addEventListener("click", (e) => {
    const chip = e.target.closest(".bubbo-chip");
    if (chip) ask(chip.textContent);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    ask(v);
  });

  // ---- Open / close ----
  const hideGreet = () => { clearTimeout(greetTimer); greet.hidden = true; };
  const open = () => {
    hideGreet();
    dot.hidden = true;
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    if (!started) {
      started = true;
      addMsg("bot", "Hi, I’m <b>Bubbo</b>! Ask me about services and prices, payments, pickup or delivery, or give me an order number and I’ll check its status.");
    }
    input.focus();
  };
  const close = () => {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    btn.focus();
  };
  btn.addEventListener("click", () => (panel.hidden ? open() : close()));
  greet.addEventListener("click", open);
  $(".bubbo-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });

  // Friendly hello once per browser session
  let greeted = false;
  try { greeted = sessionStorage.getItem("bubbo-greeted") === "1"; } catch {}
  if (greeted) {
    dot.hidden = true;
  } else {
    setTimeout(() => {
      if (!panel.hidden) return;
      greet.hidden = false;
      try { sessionStorage.setItem("bubbo-greeted", "1"); } catch {}
      greetTimer = setTimeout(() => { greet.hidden = true; }, 9000);
    }, 1200);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBubbo);
} else {
  initBubbo();
}