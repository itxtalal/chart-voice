// Records the ChartVoice demo: drives the real app with Playwright, shows slides as
// overlays, and logs every narration line, app utterance and tone with its time,
// so assemble.py can rebuild the audio track exactly.
//
// Usage: node record.mjs            (needs the frontend on :5173)
//   1st run with no data/ folder: calls the real backend and saves its responses.
//   Later runs: replays those saved real responses with their measured latency.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, "../Chart-Voice/frontend");
const require = createRequire(path.join(FRONTEND, "package.json"));
const { chromium } = require("playwright");

const APP = process.env.APP_URL ?? "http://localhost:5173/";
const CHART = path.resolve(HERE, "../Chart-Voice/backend/samples/charts/Bar chart.jpeg");
const FONTS = path.join(FRONTEND, "node_modules/@fontsource/atkinson-hyperlegible/files");
const DATA = path.join(HERE, "data");
const OUT = path.join(HERE, "out");
const FRAMES = path.join(OUT, "frames");

const narrDur = JSON.parse(fs.readFileSync(path.join(HERE, "audio/narr/durations.json"), "utf8"));
const narrText = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(HERE, "narration.json"), "utf8")).map((l) => [l.id, l.text]),
);
const appDurFile = path.join(HERE, "audio/app/durations.json");
const appDur = fs.existsSync(appDurFile) ? JSON.parse(fs.readFileSync(appDurFile, "utf8")) : {};
const replay = fs.existsSync(path.join(DATA, "analyze.json"));

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

const events = [];
const log = (e) => events.push({ t: Date.now(), ...e });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1.5,
  reducedMotion: "no-preference",
});
const page = await context.newPage();
await page.exposeBinding("__log", (_src, e) => log(e));

// ---------- page instrumentation ----------
await page.addInitScript(
  ({ appDur }) => {
    localStorage.setItem("cv-theme", "light");
    localStorage.setItem("cv-text", "normal");
    localStorage.setItem("cv-rate", "1");

    // Fake speech engine: same callbacks as the real one, timed to the audio we render later.
    const dur = (text) => appDur[text] ?? Math.max(1.2, text.split(/\s+/).length / 2.6);
    let timer = null;
    let current = null;
    class Utterance {
      constructor(text) {
        this.text = text;
        this.rate = 1;
        this.voice = null;
        this.lang = "en-US";
      }
    }
    const voice = { name: "Samantha", voiceURI: "Samantha", lang: "en-US", localService: true, default: true };
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: () => [voice],
      addEventListener() {},
      removeEventListener() {},
      speak(u) {
        current = u;
        synth.speaking = true;
        window.__log({ type: "speech", text: u.text });
        setTimeout(() => u.onstart?.(), 0);
        timer = setTimeout(() => {
          synth.speaking = false;
          window.__spoken = (window.__spoken ?? 0) + 1;
          u.onend?.();
        }, dur(u.text) * 1000 + 150);
      },
      cancel() {
        clearTimeout(timer);
        if (synth.speaking) window.__log({ type: "speech_cancel" });
        synth.speaking = false;
        current = null;
      },
      pause() {},
      resume() {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = Utterance;

    // Log every tone the app makes (frequency, start delay, stop delay).
    const Ctx = window.AudioContext;
    const orig = Ctx.prototype.createOscillator;
    let n = 0;
    Ctx.prototype.createOscillator = function () {
      const osc = orig.call(this);
      const ctx = this;
      const id = n++;
      const start = osc.start.bind(osc);
      const stop = osc.stop.bind(osc);
      osc.start = (when = 0) => {
        window.__log({ type: "tone", id, freq: osc.frequency.value, delay: Math.max(0, when - ctx.currentTime) });
        start(when);
      };
      osc.stop = (when = 0) => {
        window.__log({ type: "tone_stop", id, delay: Math.max(0, when - ctx.currentTime) });
        stop(when);
      };
      return osc;
    };

    // Screen reader stand-in: log what lands in the assertive live region.
    window.__srOn = false;
    new MutationObserver(() => {
      const el = document.querySelector('[aria-live="assertive"]');
      const text = el?.textContent?.trim();
      if (window.__srOn && text && text !== window.__lastSr) {
        window.__lastSr = text;
        window.__log({ type: "sr", text });
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });

    // Video chrome: cursor, click ripple, key badge, captions, slide overlay.
    addEventListener("DOMContentLoaded", () => {
      const css = document.createElement("style");
      css.textContent = `
        #v-cursor{position:fixed;left:-50px;top:-50px;width:26px;height:26px;z-index:100002;pointer-events:none;
          transition:left .7s cubic-bezier(.4,0,.2,1),top .7s cubic-bezier(.4,0,.2,1)}
        .v-ripple{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:4px solid #e8a33d;
          z-index:100001;pointer-events:none;animation:vr .6s ease-out forwards}
        @keyframes vr{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
        #v-key{position:fixed;right:28px;top:110px;z-index:100002;background:#15181e;color:#fff;font:700 30px/1 "Atkinson Hyperlegible",sans-serif;
          padding:14px 22px;border-radius:12px;opacity:0;transition:opacity .2s;pointer-events:none;border:3px solid #e8a33d}
        #v-cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:86%;z-index:100003;background:rgba(10,12,16,.9);
          color:#fff;font:400 22px/1.35 "Atkinson Hyperlegible",sans-serif;padding:10px 20px;border-radius:10px;text-align:center;
          opacity:0;transition:opacity .25s;pointer-events:none}
        #v-slide{position:fixed;inset:0;z-index:100000;border:0;width:100%;height:100%;opacity:0;transition:opacity .5s;pointer-events:none;background:#f7f5f0}
      `;
      document.head.append(css);
      document.body.insertAdjacentHTML(
        "beforeend",
        `<svg id="v-cursor" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#15181e" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>
         <div id="v-key"></div><div id="v-cap"></div>
         <iframe id="v-slide" src="/__video/slides.html#problem" aria-hidden="true"></iframe>`,
      );
    });
  },
  { appDur },
);

// Slides, chart and fonts are served from the video folder under /__video/.
await page.route("**/__video/**", (route) => {
  const name = new URL(route.request().url()).pathname.split("/").pop();
  const file =
    name === "chart.jpeg" ? CHART
    : name === "font-400.woff2" ? path.join(FONTS, "atkinson-hyperlegible-latin-400-normal.woff2")
    : name === "font-700.woff2" ? path.join(FONTS, "atkinson-hyperlegible-latin-700-normal.woff2")
    : path.join(HERE, "slides", name);
  route.fulfill({ path: file });
});

// Real backend responses: saved on the first run, replayed with their real latency after.
for (const ep of ["analyze", "ask", "compare"]) {
  const file = path.join(DATA, `${ep}.json`);
  await page.route(`**/api/${ep}`, async (route) => {
    if (replay && fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      await wait(saved.ms);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(saved.body) });
    }
    const t = Date.now();
    const res = await route.fetch({ timeout: 120000 });
    const body = await res.json();
    if (res.ok()) fs.writeFileSync(file, JSON.stringify({ ms: Date.now() - t, body }, null, 1));
    route.fulfill({ response: res, json: body });
  });
}

// ---------- helpers ----------
const slide = (fn, arg) =>
  page.evaluate(([fn, arg]) => document.getElementById("v-slide").contentWindow[fn](arg), [fn, arg]);
async function slideIn(name) {
  await slide("show", name);
  await page.evaluate(() => {
    document.getElementById("v-slide").style.opacity = "1";
    document.getElementById("v-cursor").style.opacity = "0";
  });
  await wait(550);
}
async function slideOut() {
  await page.evaluate(() => {
    document.getElementById("v-slide").style.opacity = "0";
    document.getElementById("v-cursor").style.opacity = "1";
  });
  await wait(550);
}
const caption = (text) =>
  page.evaluate((text) => {
    const c = document.getElementById("v-cap");
    if (text) c.textContent = text;
    c.style.opacity = text ? "1" : "0";
  }, text);

// Narration line: logged for the audio track, captioned on screen, waits for it unless told not to.
async function say(id, { wait: block = true } = {}) {
  log({ type: "narr", id });
  await caption(narrText[id]);
  const done = wait(narrDur[id] * 1000 + 250).then(() => caption(""));
  if (block) await done;
  return done;
}

async function moveTo(locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  const x = b.x + Math.min(b.width / 2, 60);
  const y = b.y + b.height / 2;
  await page.evaluate(([x, y]) => {
    const c = document.getElementById("v-cursor");
    c.style.left = x + "px";
    c.style.top = y + "px";
  }, [x, y]);
  await wait(750);
  return [x, y];
}
async function click(locator) {
  const [x, y] = await moveTo(locator);
  await page.evaluate(([x, y]) => {
    const r = document.createElement("div");
    r.className = "v-ripple";
    r.style.left = x + "px";
    r.style.top = y + "px";
    document.body.append(r);
    setTimeout(() => r.remove(), 700);
  }, [x, y]);
  await locator.click();
}
async function key(k, label) {
  await page.evaluate((label) => {
    const el = document.getElementById("v-key");
    el.textContent = label;
    el.style.opacity = "1";
    clearTimeout(window.__keyT);
    window.__keyT = setTimeout(() => (el.style.opacity = "0"), 900);
  }, label);
  await page.keyboard.press(k);
}
// Smoothly scroll so an element sits near the top of the viewport.
async function scrollTo(locator, offset = 90) {
  await locator.evaluate((el, offset) => {
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, offset);
  await wait(900);
}
const sectionToggle = (name) => page.getByRole("button", { name, exact: true });

// ---------- recording ----------
await page.goto(APP);
await page.waitForSelector("#v-slide");
await page.evaluate(() => (document.getElementById("v-slide").style.transition = "none"));
await slide("show", "problem");
await page.evaluate(() => (document.getElementById("v-slide").style.opacity = "1"));
await wait(800);
await page.evaluate(() => {
  document.getElementById("v-slide").style.transition = "";
  document.getElementById("v-cursor").style.opacity = "0";
});

const cdp = await context.newCDPSession(page);
const frames = [];
cdp.on("Page.screencastFrame", async ({ data, sessionId }) => {
  const i = frames.length;
  frames.push(Date.now());
  fs.writeFile(path.join(FRAMES, `${String(i).padStart(6, "0")}.jpg`), Buffer.from(data, "base64"), () => {});
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
await wait(300);
log({ type: "start" });

// 1. Problem
await say("p1");
await slide("step", 1);
log({ type: "sr", text: "Image." });
await wait(1400);
await slide("step", 2);
await say("p2");

// 2. Title
await slide("show", "title");
await say("t1");

// 3. Upload a real chart, read live by the image AI
await slideOut();
const u1 = say("u1", { wait: false });
await wait(1200);
const chooser = page.waitForEvent("filechooser");
await click(page.locator(".dropzone"));
await (await chooser).setFiles(CHART);
await page.getByRole("heading", { name: /Results:/ }).waitFor({ timeout: 120000 });
await wait(400);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await u1;

// 4. Summary + read aloud
await scrollTo(page.locator(".results-heading"), 20);
await say("s1");
await click(page.getByRole("button", { name: "Read summary aloud" }));
await page.waitForFunction(() => (window.__spoken ?? 0) >= 2, null, { timeout: 60000 });
await click(page.getByRole("button", { name: "Stop", exact: true }));
await wait(500);

// 5. Listen: sound + keyboard explorer
await click(sectionToggle("Listen to the chart"));
await scrollTo(page.locator("#explore"));
await say("l1");
const nPoints = await page.locator(".strip li").count();
await click(page.getByRole("button", { name: "Play chart as sound" }));
await wait(nPoints * 350 + 700);
await say("l2");
await moveTo(page.locator(".explorer-pad"));
await page.locator(".explorer-pad").focus();
await page.evaluate(() => (window.__srOn = true));
for (const [k, label] of [["Home", "Home"], ["ArrowRight", "→"], ["ArrowRight", "→"]]) {
  await key(k, label);
  await wait(150);
  const last = await page.evaluate(() => window.__lastSr ?? "");
  await wait(((appDur[last] ?? 2.5) + 0.35) * 1000);
}
await page.evaluate(() => (window.__srOn = false));

// 6. Ask a question
await scrollTo(page.locator("#ask"));
const a1 = say("a1", { wait: false });
await wait(1500);
await click(page.getByRole("button", { name: "What is the highest value?" }));
await page.locator(".bubble.assistant").waitFor({ timeout: 60000 });
await page.locator(".bubble.assistant").scrollIntoViewIfNeeded();
await a1;
await wait(1500);

// 7. How it works
await slideIn("pipeline");
await slide("step", 1);
await say("h1");
await slide("step", 2);
await say("h2");
await slideOut();

// 8. Check its work: redraw, table, compare
await click(sectionToggle("Check against the original"));
await scrollTo(page.locator("#verify"));
await say("v1");
const v2 = say("v2", { wait: false });
await click(sectionToggle("See all the numbers"));
await scrollTo(page.locator("#table"));
await wait(2500);
await click(sectionToggle("Compare with a generic AI"));
await scrollTo(page.locator("#compare"));
await click(page.getByRole("button", { name: "Run comparison" }));
await page.getByRole("button", { name: "Run comparison again" }).waitFor({ timeout: 90000 });
await scrollTo(page.locator("#compare"));
await v2;
await wait(1200);

// 9. Results
await slideIn("results");
await say("e1");

// 10. Accessibility + close
await slideOut();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
const c1 = say("c1", { wait: false });
await click(page.getByRole("button", { name: "Settings" }));
await wait(500);
await click(page.getByRole("radio", { name: "High contrast" }));
await wait(700);
await click(page.getByRole("radio", { name: "Extra large" }));
await wait(700);
await click(page.getByRole("button", { name: "Settings" }));
await page.evaluate(() => window.scrollTo({ top: 0 }));
await wait(600);
await scrollTo(page.locator(".results-heading"), 20);
await c1;
await slideIn("close");
await say("c2");
await wait(1000);
log({ type: "end" });

await cdp.send("Page.stopScreencast");
await wait(300);
fs.writeFileSync(path.join(OUT, "events.json"), JSON.stringify({ frames, events }, null, 1));
await browser.close();
const s = (events.at(-1).t - events.find((e) => e.type === "start").t) / 1000;
console.log(`${replay ? "replay" : "live"} run: ${frames.length} frames, ${s.toFixed(1)} s`);
