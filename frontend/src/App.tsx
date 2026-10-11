import { useEffect, useRef, useState } from "react";
import { analyze, health, isMockMode } from "./api/client";
import type { AnalyzeResponse, ChartType } from "./api/types";
import { useAnnounce } from "./components/Announcer";
import AskChat from "./components/AskChat";
import ChartInput from "./components/ChartInput";
import ComparePanel from "./components/ComparePanel";
import DataTable from "./components/DataTable";
import ChartExplorer from "./components/explore/ChartExplorer";
import KeyFacts from "./components/KeyFacts";
import Section from "./components/Section";
import SettingsBar from "./components/SettingsBar";
import SummaryPanel from "./components/SummaryPanel";
import TeamPage from "./components/TeamPage";
import RedrawnChart from "./components/verify/RedrawnChart";
import WarningBanner from "./components/WarningBanner";
import { usePrefs } from "./prefs";

type Page = "home" | "team";
const pageFromHash = (): Page =>
  window.location.hash === "#team" ? "team" : "home";

export default function App() {
  const prefs = usePrefs();
  const [page, setPage] = useState<Page>(pageFromHash);
  const mainRef = useRef<HTMLElement>(null);
  const teamRef = useRef<HTMLHeadingElement>(null);
  const firstPage = useRef(true);
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState<boolean | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(false);

  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const h = await health();
        if (stop) return;
        setModelReady(h.model_loaded);
        if (!h.model_loaded) setTimeout(check, 3000);
      } catch {
        if (!stop) {
          setModelReady(null);
          setTimeout(check, 5000);
        }
      }
    };
    check();
    return () => {
      stop = true;
    };
  }, []);

  // #team shows the team page; anything else is the app. Chart results stay in memory either way.
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title =
      page === "team"
        ? "The team behind ChartVoice"
        : "ChartVoice: hear, read and check the numbers inside a chart";
    if (firstPage.current) {
      firstPage.current = false;
      if (page === "home") return;
    }
    window.scrollTo(0, 0);
    if (page === "team") teamRef.current?.focus();
    else mainRef.current?.focus();
  }, [page]);

  useEffect(() => {
    if (!image) return setImageUrl(null);
    const url = URL.createObjectURL(image);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function startOver() {
    setResult(null);
    setError(null);
    setImage(null);
    startRef.current = true;
    announce("Ready for another chart.");
  }

  useEffect(() => {
    if (!result && startRef.current) {
      startRef.current = false;
      document.querySelector<HTMLElement>(".dropzone")?.focus();
    }
  }, [result]);

  async function run(file: File, chartType: ChartType) {
    setBusy(true);
    setError(null);
    setResult(null);
    setImage(file);
    announce("Reading your chart. This can take a few seconds, or up to a minute and a half when working offline.");
    try {
      const res = await analyze(file, chartType);
      setResult(res);
      const warn = res.warnings.length
        ? ` ${res.warnings.length} warning${res.warnings.length > 1 ? "s" : ""}, please double check.`
        : "";
      announce(`Analysis complete.${warn}`);
      requestAnimationFrame(() => resultsRef.current?.focus());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          // Keep the hash for page routing; just move focus
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to main content
      </a>
      <header className="site-header">
        <div className="wrap header-inner">
          <a href="#" className="brand" aria-label="ChartVoice home">
            <Logo />
            <div>
              <p className="brand-name">ChartVoice</p>
              <p className="tagline">Charts, explained in plain words.</p>
            </div>
          </a>
          <SettingsBar {...prefs} />
        </div>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="wrap"
        aria-busy={busy}
      >
        {page === "team" && <TeamPage ref={teamRef} />}

        <div hidden={page === "team"}>
          <h1 className="sr-only">
            ChartVoice: turn a chart image into words, a table and sound
          </h1>

          {isMockMode && (
            <p className="notice" role="note">
              <strong>Demo mode:</strong> results use sample data.
            </p>
          )}
          {!isMockMode && modelReady === false && (
            <p className="notice" role="status">
              The chart reading model is still loading. Your first chart may
              take a little longer.
            </p>
          )}

          {!result && <ChartInput busy={busy} onAnalyze={run} />}

          {busy && (
            <div className="card loading" aria-hidden="true">
              {imageUrl && (
                <img src={imageUrl} alt="" className="loading-thumb" />
              )}
              <span className="spinner" />
              <span>
                Reading your chart. Usually a few seconds; offline it can take
                up to 90 seconds.
              </span>
            </div>
          )}

          {error && (
            <div
              ref={errorRef}
              tabIndex={-1}
              className="card error-card"
              role="alert"
            >
              <h2>We could not read that chart</h2>
              <p>{error}</p>
              <p>
                Try a clearer image, or set the chart type under Options and try
                again.
              </p>
            </div>
          )}

          {result && image && (
            <div className="results">
              <div className="your-chart">
                {imageUrl && <img src={imageUrl} alt="" />}
                <p>
                  <span className="muted small">Your chart</span>
                  <br />
                  {cap(result.chart_type)} chart, {result.table.rows.length}{" "}
                  data points
                </p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={startOver}
                >
                  Read another chart
                </button>
              </div>

              <h2 ref={resultsRef} tabIndex={-1} className="results-heading">
                <span className="sr-only">Results: </span>
                {result.title}
              </h2>

              <WarningBanner warnings={result.warnings} />

              <Section
                id="summary"
                title="What this chart says"
                className="summary-card"
              >
                <SummaryPanel result={result} />
              </Section>

              <Section
                id="ask"
                title="Ask a question"
                intro="Ask anything about this chart."
              >
                <AskChat result={result} />
              </Section>

              <p className="more-heading">More ways to explore</p>

              <Section
                id="explore"
                title="Listen to the chart"
                intro="Move through the chart one point at a time, or hear its shape as sound."
                collapsible
              >
                <ChartExplorer result={result} />
              </Section>
              <Section
                id="table"
                title="See all the numbers"
                intro="The numbers ChartVoice read from your image."
                collapsible
              >
                <DataTable title={result.title} table={result.table} />
              </Section>
              <Section id="facts" title="All key facts" collapsible>
                <KeyFacts result={result} />
              </Section>
              <Section
                id="verify"
                title="Check against the original"
                intro="Your image next to a chart redrawn from the numbers we read. If they look different, a number was misread. Useful for a sighted helper."
                collapsible
              >
                <div className="verify">
                  <figure>
                    {imageUrl && <img src={imageUrl} alt="" />}
                    <figcaption>Original image</figcaption>
                  </figure>
                  <figure>
                    <RedrawnChart
                      chartType={result.chart_type}
                      title={result.title}
                      table={result.table}
                      theme={prefs.theme}
                    />
                    <figcaption>Redrawn from the numbers</figcaption>
                  </figure>
                </div>
              </Section>
              <Section
                id="compare"
                title="Compare with a generic AI"
                intro="See what a general AI model says about the same image, next to ChartVoice."
                collapsible
              >
                <ComparePanel image={image} result={result} />
              </Section>
            </div>
          )}
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p>
            Numbers are read from the image by an AI model and can be wrong.
            Check the redrawn chart, or ask a sighted helper, before relying on
            them.
          </p>
          <p>
            Built for Banana Hacks 2026 by Inam, Muhammad Talal Jamil and
            Hasnain. <a href="#team">Meet the team</a>
          </p>
        </div>
      </footer>
    </>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Speech bubble holding a rising bar chart: a chart that talks. Colors follow the theme.
function Logo() {
  return (
    <svg
      className="logo"
      viewBox="0 0 64 64"
      width="48"
      height="48"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="15" fill="var(--primary)" />
      <path
        d="M19 11h26a8 8 0 0 1 8 8v17a8 8 0 0 1-8 8H30l-10.5 9.5V44H19a8 8 0 0 1-8-8V19a8 8 0 0 1 8-8z"
        fill="var(--on-primary)"
      />
      <rect x="18" y="29" width="7" height="9" rx="1.5" fill="var(--primary)" />
      <rect
        x="28.5"
        y="23"
        width="7"
        height="15"
        rx="1.5"
        fill="var(--primary)"
      />
      <rect x="39" y="17" width="7" height="21" rx="1.5" fill="var(--accent)" />
    </svg>
  );
}
