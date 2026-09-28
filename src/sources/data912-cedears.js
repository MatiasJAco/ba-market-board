import { DEFAULT_TIMEOUT_MS, SOURCE_URLS } from "../config.js";
import { errorResult, okResult } from "../dashboard/normalize.js";
import { fetchJson } from "../lib/json-fetch.js";

const SOURCE = "Data912";
const FAILURE_KEYS = Object.freeze(["code", "message"]);

const ORDER = Object.freeze(["AAPL", "MSFT", "GOOGL", "META", "NVDA"]);

const LABELS = new Map([
  ["AAPL", "Apple"],
  ["MSFT", "Microsoft"],
  ["GOOGL", "Alphabet"],
  ["META", "Meta"],
  ["NVDA", "Nvidia"]
]);

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

function isRepeated(payload) {
  const seen = new Set();

  for (const row of payload) {
    if (!isRecord(row) || !ORDER.includes(row.symbol)) {
      continue;
    }

    if (seen.has(row.symbol)) {
      return true;
    }

    seen.add(row.symbol);
  }

  return false;
}

function priceByTicker(payload) {
  const prices = new Map();

  for (const row of payload) {
    if (!isRecord(row) || !ORDER.includes(row.symbol)) {
      continue;
    }

    if (!prices.has(row.symbol)) {
      prices.set(row.symbol, row.c);
    }
  }

  return prices;
}

function failure(retrievedAt, code, message) {
  return errorResult(SOURCE, retrievedAt, code, message);
}

export function createData912CedearsAdapter({
  fetchImpl = globalThis.fetch,
  now = Date.now,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  return Object.freeze({
    async fetchSnapshot() {
      const nowMs = now();
      const retrievedAt = new Date(nowMs).toISOString();
      const payload = await fetchJson(SOURCE_URLS.data912, { fetchImpl, timeoutMs });

      if (isFetchFailure(payload)) {
        return failure(retrievedAt, payload.code, payload.message);
      }

      if (!Array.isArray(payload)) {
        return failure(retrievedAt, "invalid_schema");
      }

      if (isRepeated(payload)) {
        return failure(retrievedAt, "missing_ticker");
      }

      const prices = priceByTicker(payload);
      const quotes = [];

      for (const ticker of ORDER) {
        if (!prices.has(ticker)) {
          return failure(retrievedAt, "missing_ticker");
        }

        const priceArs = prices.get(ticker);

        if (!isPositiveNumber(priceArs)) {
          return failure(retrievedAt, "invalid_value");
        }

        quotes.push({
          ticker,
          label: LABELS.get(ticker),
          priceArs,
          observedAt: null
        });
      }

      return okResult(SOURCE, retrievedAt, {
        quotes,
        timestampKind: "retrieval"
      });
    }
  });
}
