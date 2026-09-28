import { DEFAULT_TIMEOUT_MS } from "../config.js";
import { errorResult } from "./normalize.js";

const WIDGETS = Object.freeze([
  Object.freeze({ key: "weather", source: "Open-Meteo" }),
  Object.freeze({ key: "cedears", source: "Data912" }),
  Object.freeze({ key: "mep", source: "DolarAPI" })
]);

function isWidgetResult(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    (value.status === "ok" || value.status === "error")
  );
}

async function callAdapter(adapter, dependencies) {
  const instance = typeof adapter === "function" ? adapter(dependencies) : adapter;

  return instance.fetchSnapshot();
}

export function createDashboardService({
  adapters = {},
  now = Date.now,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const dependencies = { fetchImpl, now, timeoutMs };

  return Object.freeze({
    async fetchSnapshot() {
      const retrievedAt = new Date(now()).toISOString();
      const settled = await Promise.allSettled(
        WIDGETS.map(({ key }) => callAdapter(adapters[key], dependencies))
      );
      const snapshot = { retrievedAt };

      WIDGETS.forEach(({ key, source }, index) => {
        const outcome = settled[index];

        snapshot[key] =
          outcome.status === "fulfilled" && isWidgetResult(outcome.value)
            ? outcome.value
            : errorResult(source, retrievedAt, "unknown");
      });

      return snapshot;
    }
  });
}
