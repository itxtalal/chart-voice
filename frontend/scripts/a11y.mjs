// Accessibility check: runs axe (WCAG 2.2 AA) in every theme, before and after
// an analysis, and checks the keyboard explorer announcements.
// Usage: npm run build && npm run preview  (in one terminal)
//        npm run test:a11y                  (in another)
// First time only: npx playwright install chromium
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const URL = process.env.A11Y_URL ?? "http://localhost:4173/";
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
let failures = 0;

async function check(page, label) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of r.violations) {
    failures++;
    console.log(`FAIL ${label}: ${v.id} - ${v.help}`);
    v.nodes.slice(0, 3).forEach((n) => console.log(`     ${n.target}`));
  }
  if (!r.violations.length) console.log(`ok   ${label}`);
}

for (const [theme, size] of [
  ["light", "normal"],
  ["dark", "normal"],
  ["contrast", "xlarge"],
]) {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(
    ([t, s]) => {
      localStorage.setItem("cv-theme", t);
      localStorage.setItem("cv-text", s);
    },
    [theme, size],
  );
  await page.goto(URL);
  await check(page, `${theme} start`);
  await page.getByRole("button", { name: "Settings" }).click();
  await check(page, `${theme} settings open`);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: /Line chart/ }).click();
  await page
    .getByRole("heading", { name: /Results:/ })
    .waitFor({ timeout: 60000 });
  await check(page, `${theme} results, sections closed`);
  for (const name of [
    "Listen to the chart",
    "See all the numbers",
    "All key facts",
    "Check against the original",
    "Compare with a generic AI",
  ])
    await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: /Run comparison/ }).click();
  await page.getByRole("button", { name: /highest value/ }).click();
  await page.locator(".bubble.assistant").waitFor({ timeout: 60000 });
  await check(page, `${theme} results, all open`);
  await page.getByRole("link", { name: "Meet the team" }).click();
  await page
    .getByRole("heading", { name: "The team behind ChartVoice" })
    .waitFor();
  await check(page, `${theme} team page`);
  await page.getByRole("link", { name: "Back to ChartVoice" }).click();
  await page
    .getByRole("heading", { name: /Results:/ })
    .waitFor({ timeout: 5000 });
  console.log(`ok   ${theme} results kept after visiting the team page`);
  await page.close();
}

const page = await (await browser.newContext()).newPage();
await page.goto(URL);
await page.getByRole("button", { name: /Bar chart/ }).click();
await page
  .getByRole("heading", { name: /Results:/ })
  .waitFor({ timeout: 60000 });
await page.getByRole("button", { name: "Listen to the chart" }).click();
await page.locator('[aria-roledescription="chart explorer"]').focus();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(200);
const said = await page.evaluate(() =>
  [...document.querySelectorAll("[aria-live]")]
    .map((e) => e.textContent)
    .filter(Boolean)
    .join(" "),
);
if (/Point 2 of/.test(said)) console.log(`ok   explorer says: "${said}"`);
else {
  failures++;
  console.log(`FAIL explorer announcement: "${said}"`);
}

// Phone: axe at the largest text size, and nothing may scroll sideways
for (const width of [320, 390]) {
  const phone = await (
    await browser.newContext({
      viewport: { width, height: 800 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();
  await phone.addInitScript(() => localStorage.setItem("cv-text", "xlarge"));
  await phone.goto(URL);
  await phone.getByRole("button", { name: /Pie chart/ }).click();
  await phone
    .getByRole("heading", { name: /Results:/ })
    .waitFor({ timeout: 60000 });
  for (const name of [
    "Listen to the chart",
    "See all the numbers",
    "All key facts",
  ])
    await phone.getByRole("button", { name }).click();
  await check(phone, `phone ${width}px results`);
  await phone.getByRole("link", { name: "Meet the team" }).click();
  await phone
    .getByRole("heading", { name: "The team behind ChartVoice" })
    .waitFor();
  await check(phone, `phone ${width}px team page`);
  const extra = await phone.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  if (extra > 0) {
    failures++;
    console.log(`FAIL phone ${width}px scrolls sideways by ${extra}px`);
  } else console.log(`ok   phone ${width}px fits the screen`);
}

await browser.close();
console.log(
  failures
    ? `\n${failures} problem(s) found`
    : "\nAll accessibility checks passed",
);
process.exit(failures ? 1 : 0);
