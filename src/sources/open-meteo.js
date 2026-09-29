import { DEFAULT_TIMEOUT_MS, SOURCE_URLS } from "../config.js";
import { errorResult, okResult } from "../dashboard/normalize.js";
import { fetchJson } from "../lib/json-fetch.js";
import { WEATHER_MAX_AGE_MS, isStale, parseZonedTimestamp } from "../lib/time.js";

const SOURCE = "Open-Meteo";
const LOCATION = "Buenos Aires";
const TIME_ZONE = "America/Argentina/Buenos_Aires";
const LATITUDE = "-34.6037";
const LONGITUDE = "-58.3816";
const CURRENT_FIELDS = "temperature_2m,weather_code";
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const FAILURE_KEYS = Object.freeze(["code", "message"]);

const CONDITIONS = new Map([
  [0, "Cielo despejado"],
  [1, "Mayormente despejado"],
  [2, "Parcialmente nublado"],
  [3, "Nublado"],
  [45, "Niebla"],
  [48, "Niebla con escarcha"],
  [51, "Llovizna ligera"],
  [53, "Llovizna moderada"],
  [55, "Llovizna intensa"],
  [56, "Llovizna helada ligera"],
  [57, "Llovizna helada intensa"],
  [61, "Lluvia ligera"],
  [63, "Lluvia moderada"],
  [65, "Lluvia intensa"],
  [66, "Lluvia helada ligera"],
  [67, "Lluvia helada intensa"],
  [71, "Nevada ligera"],
  [73, "Nevada moderada"],
  [75, "Nevada intensa"],
  [77, "Granos de nieve"],
  [80, "Chubascos ligeros"],
  [81, "Chubascos moderados"],
  [82, "Chubascos violentos"],
  [85, "Chubascos de nieve ligeros"],
  [86, "Chubascos de nieve intensos"],
  [95, "Tormenta"],
  [96, "Tormenta con granizo leve"],
  [99, "Tormenta con granizo fuerte"]
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTransportError(payload) {
  if (!isRecord(payload)) {
    return false;
  }

  const keys = Object.keys(payload);

  return keys.length === FAILURE_KEYS.length && FAILURE_KEYS.every((key) => typeof payload[key] === "string");
}

function buildRequestUrl() {
  const url = new URL(SOURCE_URLS.openMeteo);

  url.searchParams.set("latitude", LATITUDE);
  url.searchParams.set("longitude", LONGITUDE);
  url.searchParams.set("current", CURRENT_FIELDS);
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("timezone", TIME_ZONE);

  return url.href;
}

function failure(retrievedAt, code, message) {
  return errorResult(SOURCE, retrievedAt, code, message);
}

export function createOpenMeteoAdapter({
  fetchImpl = globalThis.fetch,
  now = Date.now,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  return Object.freeze({
    async fetchSnapshot() {
      const nowMs = now();
      const retrievedAt = new Date(nowMs).toISOString();
      const payload = await fetchJson(buildRequestUrl(), { fetchImpl, timeoutMs });

      if (isTransportError(payload)) {
        return failure(retrievedAt, payload.code, payload.message);
      }

      if (!isRecord(payload) || !isRecord(payload.current)) {
        return failure(retrievedAt, "invalid_schema");
      }

      const current = payload.current;
      const temperatureC = current.temperature_2m;

      if (typeof temperatureC !== "number" || !Number.isFinite(temperatureC)) {
        return failure(retrievedAt, "invalid_value");
      }

      const condition = CONDITIONS.get(current.weather_code);

      if (condition === undefined) {
        return failure(retrievedAt, "invalid_value");
      }

      const observedAt = parseZonedTimestamp(current.time, TIME_ZONE);

      if (observedAt === null) {
        return okResult(SOURCE, retrievedAt, {
          location: LOCATION,
          temperatureC,
          condition,
          observedAt: null,
          timestampKind: "retrieval"
        });
      }

      if (Date.parse(observedAt) - nowMs > CLOCK_SKEW_MS) {
        return failure(retrievedAt, "invalid_value");
      }

      if (isStale(observedAt, nowMs, WEATHER_MAX_AGE_MS)) {
        return failure(retrievedAt, "stale");
      }

      return okResult(SOURCE, retrievedAt, {
        location: LOCATION,
        temperatureC,
        condition,
        observedAt,
        timestampKind: "source"
      });
    }
  });
}
