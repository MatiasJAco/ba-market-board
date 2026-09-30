import { createRenderer } from "./render.js";

const DASHBOARD_URL = "/api/dashboard";
const WIDGET_KEYS = Object.freeze(["weather", "cedears", "mep"]);
const CLIENT_ERROR = Object.freeze({
  status: "error",
  error: Object.freeze({
    code: "unknown",
    message: "No se pudo cargar el panel. Volvé a cargar la página para intentarlo de nuevo."
  })
});

let started = false;

async function readSnapshot(fetchImpl) {
  // Unsubstituted, the token is not a number, so no deadline is applied.
  const budget = Number.parseInt("__BOARD_BUDGET_MS__", 10);
  const bounded = Number.isFinite(budget) && budget > 0;

  try {
    const response = await fetchImpl(DASHBOARD_URL, {
      headers: { Accept: "application/json" },
      ...(bounded ? { signal: AbortSignal.timeout(budget) } : {})
    });

    if (response === null || typeof response !== "object" || response.ok !== true) {
      return null;
    }

    const payload = await response.json();

    return payload !== null && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export async function start({
  document: doc = globalThis.document,
  fetchImpl = globalThis.fetch
} = {}) {
  if (started) {
    return;
  }

  started = true;

  const renderer = createRenderer(doc);

  for (const key of WIDGET_KEYS) {
    renderer.renderLoading(key);
  }

  const snapshot = await readSnapshot(fetchImpl);

  for (const key of WIDGET_KEYS) {
    renderer.applyResult(key, snapshot === null ? CLIENT_ERROR : snapshot[key]);
  }
}

await start();
