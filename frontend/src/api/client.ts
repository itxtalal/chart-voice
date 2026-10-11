import type {
  AnalyzeResponse,
  AskRequest,
  AskResponse,
  ChartType,
  CompareResponse,
} from "./types";
import { mockAnalyze, mockAsk, mockCompare } from "./mock";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const BASE = "/api";

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  // 404, 405 and 502 here mean nothing is answering at /api (no backend behind this site).
  let message = [404, 405, 502].includes(res.status)
    ? "Could not reach the ChartVoice server. Check that the backend is running and try again."
    : `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (res.status === 422)
      message =
        "Those details were not accepted. Please check them and try again.";
  } catch {
    // keep the default message
  }
  throw new Error(message);
}

// fetch rejects (instead of returning a status) when the server cannot be reached.
const realFetch = globalThis.fetch.bind(globalThis);
async function fetchApi(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await realFetch(input, init);
  } catch {
    throw new Error(
      "Could not reach the ChartVoice server. Check that the backend is running and try again.",
    );
  }
}

export const isMockMode = USE_MOCK;

export interface Health {
  status: string;
  model_loaded: boolean;
  extractor?: string;
  online?: boolean;
}

export async function health(): Promise<Health> {
  if (USE_MOCK) return { status: "ok", model_loaded: true, online: true };
  return handle(await fetchApi(`${BASE}/health`));
}

export async function analyze(
  image: File,
  chartType: ChartType = "auto",
): Promise<AnalyzeResponse> {
  if (USE_MOCK) return mockAnalyze(image);
  const form = new FormData();
  form.append("image", image);
  form.append("chart_type", chartType);
  const res = await handle<
    Omit<AnalyzeResponse, "title"> & { title: string | null }
  >(await fetchApi(`${BASE}/analyze`, { method: "POST", body: form }));
  // The backend may return no title; the UI always needs something to show and speak.
  return { ...res, title: res.title?.trim() || "Untitled chart" };
}

export async function ask(req: AskRequest): Promise<AskResponse> {
  if (USE_MOCK) return mockAsk(req);
  return handle(
    await fetchApi(`${BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  );
}

export async function compare(image: File): Promise<CompareResponse> {
  if (USE_MOCK) return mockCompare(image);
  const form = new FormData();
  form.append("image", image);
  return handle(
    await fetchApi(`${BASE}/compare`, { method: "POST", body: form }),
  );
}
