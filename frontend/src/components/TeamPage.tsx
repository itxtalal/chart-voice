import { forwardRef } from "react";

interface Member {
  name: string;
  initials: string;
  role: string;
  built: string;
  links: { label: string; href: string; kind: "github" | "web" }[];
}

const TEAM: Member[] = [
  {
    name: "Inam",
    initials: "IN",
    role: "Backend and chart reading",
    built:
      "The API, reading chart images with DePlot, turning its output into clean numbers, the facts and sanity checks, and the evaluation.",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/inamjadoon",
        kind: "github",
      },
    ],
  },
  {
    name: "Muhammad Talal Jamil",
    initials: "MTJ",
    role: "Frontend and accessibility",
    built:
      "The interface you are using: read aloud, the sound explorer, the themes and text sizes, and making all of it work with a keyboard, a screen reader and a phone.",
    links: [
      { label: "talaljamil.com", href: "https://talaljamil.com/", kind: "web" },
    ],
  },
  {
    name: "Hasnain",
    initials: "HA",
    role: "AI summaries and questions",
    built:
      "The language model module: summaries, explanations, answering questions, the number check that stops made-up values, and the generic AI comparison. Also the sample charts and their true data.",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/MuhammadHasnain77",
        kind: "github",
      },
    ],
  },
];

const TeamPage = forwardRef<HTMLHeadingElement>(
  function TeamPage(_, headingRef) {
    return (
      <div className="team-page">
        <a href="#" className="back-link">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            className="icon"
          >
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to ChartVoice
        </a>

        <h1 ref={headingRef} tabIndex={-1} className="team-title">
          The team behind ChartVoice
        </h1>
        <p className="lead team-lead">
          Three of us built ChartVoice in one weekend at Banana Hacks 2026. We
          wanted anyone, including people who can't see a chart, to get the real
          numbers out of one.
        </p>

        <ul className="team-grid">
          {TEAM.map((m) => (
            <li key={m.name} className="card member">
              <div className="member-head">
                <span className="avatar" aria-hidden="true">
                  {m.initials}
                </span>
                <div>
                  <h2 className="member-name">{m.name}</h2>
                  <p className="member-role">{m.role}</p>
                </div>
              </div>
              <p>{m.built}</p>
              <ul className="member-links">
                {m.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="btn btn-ghost">
                      {l.kind === "github" ? <GitHubIcon /> : <GlobeIcon />}
                      {l.label}
                      <span className="sr-only">, {m.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <section className="card" aria-labelledby="project-h">
          <h2 id="project-h">The project</h2>
          <p>
            ChartVoice reads the chart with Google's DePlot model, works out the
            facts in code, and uses a language model on Groq only to put them
            into plain words. The code is open on{" "}
            <a href="https://github.com/inamjadoon/Chart-Voice">GitHub</a>.
          </p>
          <p>
            If you use a screen reader and try ChartVoice, we would love to hear
            what got in your way.{" "}
            <a href="https://github.com/inamjadoon/Chart-Voice/issues">
              Tell us on GitHub
            </a>
            .
          </p>
        </section>
      </div>
    );
  },
);

export default TeamPage;

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className="icon"
    >
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className="icon"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
