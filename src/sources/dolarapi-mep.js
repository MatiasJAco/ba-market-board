import { DEFAULT_TIMEOUT_MS, SOURCE_URLS } from "../config.js";
import { errorResult, okResult } from "../dashboard/normalize.js";
import { fetchJson } from "../lib/json-fetch.js";
import { MARKET_MAX_AGE_MS, isStale, parseTimestamp } from "../lib/time.js";

const SOURCE = "DolarAPI";
const RATE_TYPE = "MEP/bolsa";
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const FAILURE_KEYS = Object.freeze(["code", "message"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFetchFailure(payload) {
  if (!isRecord(payload)) {
    return false;
  }

  const keys = Object.keys(payload);

  return keys.length === FAILURE_KEYS.length && FAILURE_KEYS.every((key) => typeof payload[key] === "string");
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundHalfUp(value) {
  return Math.round(value * 100) / 100;
}

function failure(retrievedAt, code, message) {
  return errorResult(SOURCE, retrievedAt, code, message);
}

export function createDolarApiMepAdapter({
  fetchImpl = globalThis.fetch,
  now = Date.now,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  return Object.freeze({
    async fetchSnapshot() {
      const nowMs = now();
      const retrievedAt = new Date(nowMs).toISOString();
      const payload = await fetchJson(SOURCE_URLS.dolarApi, { fetchImpl, timeoutMs });

      if (isFetchFailure(payload)) {
        return failure(retrievedAt, payload.code, payload.message);
      }

      if (!isRecord(payload)) {
        return failure(retrievedAt, "invalid_schema");
      }

      const buyArs = payload.compra;
      const sellArs = payload.venta;

      if (!isPositiveNumber(buyArs) || !isPositiveNumber(sellArs)) {
        return failure(retrievedAt, "invalid_value");
      }

      const midpointArs = roundHalfUp((buyArs + sellArs) / 2);
      const observedAt = parseTimestamp(payload.fechaActualizacion);

      if (observedAt === null) {
        return okResult(SOURCE, retrievedAt, {
          rateType: RATE_TYPE,
          buyArs,
          sellArs,
          midpointArs,
          observedAt: null,
          timestampKind: "retrieval"
        });
      }

      if (Date.parse(observedAt) - nowMs > CLOCK_SKEW_MS) {
        return failure(retrievedAt, "invalid_value");
      }

      if (isStale(observedAt, nowMs, MARKET_MAX_AGE_MS)) {
        return failure(retrievedAt, "stale");
      }

      return okResult(SOURCE, retrievedAt, {
        rateType: RATE_TYPE,
        buyArs,
        sellArs,
        midpointArs,
        observedAt,
        timestampKind: "source"
      });
    }
  });
}
