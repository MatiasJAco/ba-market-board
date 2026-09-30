import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_TIMEOUT_MS } from "../src/config.js";
import { createData912CedearsAdapter } from "../src/sources/data912-cedears.js";
import { createDolarApiMepAdapter } from "../src/sources/dolarapi-mep.js";
import { createOpenMeteoAdapter } from "../src/sources/open-meteo.js";

// Inside both the 3-hour weather window and the 7-day market window.
const FIXED_NOW = "2026-09-25T17:45:00.000Z";

test("weather adapter (happy path): a valid current-weather response maps to a Celsius value and a source observation time", async () => {
  const payload = {
    current: {
      // An offset-less wall clock, resolved through parseZonedTimestamp.
      time: "2026-09-25T14:45",
      temperature_2m: 21.4,
      weather_code: 2
    }
  };
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, signal: options?.signal });

    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };

  const adapter = createOpenMeteoAdapter({
    fetchImpl,
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  });

  const result = await adapter.fetchSnapshot();

  assert.equal(result.status, "ok");
  assert.equal(result.source, "Open-Meteo");
  assert.equal(result.retrievedAt, FIXED_NOW);
  assert.equal(result.value.location, "Buenos Aires");
  assert.equal(result.value.temperatureC, 21.4);
  assert.equal(result.value.condition, "Parcialmente nublado");
  assert.doesNotMatch(result.value.condition, /[0-9]/);

  assert.equal(result.value.timestampKind, "source");
  assert.equal(result.value.observedAt, FIXED_NOW);

  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.startsWith("https://"));
  assert.ok(requests[0].url.includes("temperature_unit=celsius"), "Celsius must be requested");
  assert.ok(requests[0].url.includes("timezone=America%2FArgentina%2FBuenos_Aires"));
  assert.ok(requests[0].signal, "the abort-signal timeout must be wired");
});

test("cedears adapter (happy path): a valid quotes response maps to exactly the five fixed tickers in order", async () => {
  // Out of allowlist order, with a decoy `n` field and non-allowlist symbols.
  const payload = [
    { symbol: "NVDA", c: 198000.5, n: 999 },
    { symbol: "TSLA", c: 111111, n: 999 },
    { symbol: "META", c: 152300.25, n: 999 },
    { symbol: "GOOGL", c: 98765.4, n: 999 },
    { symbol: "AAPL", c: 27400.1, n: 999 },
    { symbol: "MSFT", c: 131500.75, n: 999 },
    { symbol: "NFLX", c: 222222, n: 999 }
  ];
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, signal: options?.signal });

    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };

  const adapter = createData912CedearsAdapter({
    fetchImpl,
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  });

  const result = await adapter.fetchSnapshot();

  assert.equal(result.status, "ok");
  assert.equal(result.source, "Data912");
  assert.equal(result.retrievedAt, FIXED_NOW);

  assert.deepEqual(
    result.value.quotes.map((quote) => quote.ticker),
    ["AAPL", "MSFT", "GOOGL", "META", "NVDA"]
  );
  assert.equal(result.value.quotes.length, 5);
  assert.ok(result.value.quotes.every((quote) => Number.isFinite(quote.priceArs) && quote.priceArs > 0));
  assert.equal(result.value.quotes[0].priceArs, 27400.1);
  assert.equal(result.value.quotes[4].priceArs, 198000.5);

  // The source publishes no quote timestamp.
  assert.equal(result.value.timestampKind, "retrieval");
  assert.ok(result.value.quotes.every((quote) => quote.observedAt === null));

  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.startsWith("https://"));
  assert.ok(requests[0].signal, "the abort-signal timeout must be wired");
});

test("fx adapter (happy path): a valid MEP response maps to a two-decimal ARS-per-USD midpoint labeled MEP/bolsa", async () => {
  const payload = {
    compra: 1549.4,
    venta: 1550.894,
    fechaActualizacion: "2026-09-25T14:45:00.000Z",
    valor: 99999
  };
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, signal: options?.signal });

    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };

  const adapter = createDolarApiMepAdapter({
    fetchImpl,
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  });

  const result = await adapter.fetchSnapshot();

  assert.equal(result.status, "ok");
  assert.equal(result.source, "DolarAPI");
  assert.equal(result.retrievedAt, FIXED_NOW);
  assert.equal(result.value.rateType, "MEP/bolsa");
  assert.equal(result.value.buyArs, 1549.4);
  assert.equal(result.value.sellArs, 1550.894);

  assert.equal(result.value.midpointArs, 1550.15);
  assert.notEqual(result.value.midpointArs, 1550.147);
  assert.equal(result.value.midpointArs, Math.round(result.value.midpointArs * 100) / 100);
  assert.equal(result.value.midpointArs.toFixed(2), "1550.15");
  assert.notEqual(result.value.midpointArs, 99999);

  assert.equal(result.value.timestampKind, "source");
  assert.equal(result.value.observedAt, "2026-09-25T14:45:00.000Z");

  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.startsWith("https://"));
  assert.ok(requests[0].url.endsWith("/bolsa"), "the MEP/bolsa quote, not another rate type");
  assert.ok(requests[0].signal, "the abort-signal timeout must be wired");
});

test("weather adapter (failure): a non-2xx response yields a typed error and invents no value", async () => {
  // A body that parses cleanly must still yield no value.
  const body = JSON.stringify({
    current: { time: "2026-09-25T14:45", temperature_2m: 99.9, weather_code: 0 },
    upstreamDebug: "SENTINEL-UPSTREAM-TEXT",
    stack: "Error: connect ECONNREFUSED 10.0.0.5:443\n    at fetch (node:internal/deps/undici/undici:1:1)"
  });
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;

    return { ok: false, status: 503, statusText: "Service Unavailable", text: async () => body };
  };

  const adapter = createOpenMeteoAdapter({
    fetchImpl,
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  });

  const result = await adapter.fetchSnapshot();

  assert.equal(result.status, "error");
  assert.equal(result.source, "Open-Meteo");
  assert.equal(result.error.code, "upstream_error");
  assert.equal(calls, 1, "the adapter must not retry");

  assert.equal("value" in result, false, "an error result must carry no value key");
  assert.equal(result.value, undefined);

  const serialized = JSON.stringify(result);
  const { message } = result.error;

  assert.ok(!serialized.includes("99.9"), "an upstream number leaked into the result");
  assert.ok(!serialized.includes("temperatureC"));
  assert.ok(!serialized.includes("SENTINEL-UPSTREAM-TEXT"));
  assert.ok(!serialized.includes("ECONNREFUSED"));
  assert.ok(!serialized.includes("undici"));
  assert.ok(!serialized.includes("Service Unavailable"));
  assert.ok(!serialized.includes("http"), "no URL in the result");

  assert.equal(typeof message, "string");
  assert.ok(message.length > 0 && message.length <= 120, "a short, user-facing message");
  assert.doesNotMatch(message, /https?:\/\//, "no URL in the message");
  assert.doesNotMatch(message, /[\u0000-\u001f\u007f]/, "no stack trace or control characters");
  assert.doesNotMatch(message, /(^|\s)at\s+[\w$.<>]+\s*\(/, "no stack frame in the message");

  // A 200 with no current block must fail, never fabricate a zero.
  const unusable = await createOpenMeteoAdapter({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ detail: "SENTINEL-UPSTREAM-TEXT" })
    }),
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  }).fetchSnapshot();

  assert.equal(unusable.status, "error", "a 200 with no current block must not be a reading");
  assert.equal("value" in unusable, false, "an error result must carry no value key");
  assert.ok(!JSON.stringify(unusable).includes("temperatureC"));
  assert.ok(!JSON.stringify(unusable).includes("SENTINEL-UPSTREAM-TEXT"));

  assert.equal(DEFAULT_TIMEOUT_MS, 15000, "the documented wait budget");

  // No timeoutMs argument at all, so the signal can only come from configuration.
  const seenOptions = [];

  await createOpenMeteoAdapter({
    fetchImpl: async (_url, options) => {
      seenOptions.push(options);

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ current: { time: "2026-09-25T14:45", temperature_2m: 21.4, weather_code: 2 } })
      };
    },
    now: () => Date.parse(FIXED_NOW)
  }).fetchSnapshot();

  assert.equal(seenOptions.length, 1);
  assert.ok(seenOptions[0].signal instanceof AbortSignal, "the default budget is wired, not ignored");

  // Rejects only when the real abort fires, exactly as undici does.
  const expired = await createOpenMeteoAdapter({
    fetchImpl: (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason));
      }),
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: 5
  }).fetchSnapshot();

  assert.equal(expired.error.code, "timeout", "an expired budget is the only timeout notice");

  const aborted = await createOpenMeteoAdapter({
    fetchImpl: async () => {
      throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    },
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  }).fetchSnapshot();

  assert.equal(aborted.error.code, "upstream_error", "a caller abort is not a source timeout");
  assert.notEqual(aborted.error.code, "timeout");
});

test("cedears adapter (failure): a non-2xx response yields a typed error and substitutes no ticker", async () => {
  const body = JSON.stringify([
    { symbol: "AAPL", c: 27400.1 },
    { symbol: "TSLA", c: 111111 },
    { symbol: "debug", note: "SENTINEL-UPSTREAM-TEXT" }
  ]);
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;

    return { ok: false, status: 500, statusText: "Internal Server Error", text: async () => body };
  };

  const adapter = createData912CedearsAdapter({
    fetchImpl,
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  });

  const result = await adapter.fetchSnapshot();

  assert.equal(result.status, "error");
  assert.equal(result.source, "Data912");
  assert.equal(result.error.code, "upstream_error");
  assert.equal(calls, 1, "the adapter must not retry");

  assert.equal("value" in result, false, "an error result must carry no value key");
  assert.equal(result.value, undefined);
  assert.equal(result.quotes, undefined);

  const serialized = JSON.stringify(result);
  const { message } = result.error;

  assert.ok(!serialized.includes("AAPL"), "a substituted ticker leaked into the result");
  assert.ok(!serialized.includes("TSLA"));
  assert.ok(!serialized.includes("27400"));
  assert.ok(!serialized.includes("111111"));
  assert.ok(!serialized.includes("quotes"));
  assert.ok(!serialized.includes("SENTINEL-UPSTREAM-TEXT"));
  assert.ok(!serialized.includes("http"), "no URL in the result");

  assert.equal(typeof message, "string");
  assert.ok(message.length > 0 && message.length <= 120, "a short, user-facing message");
  assert.doesNotMatch(message, /https?:\/\//, "no URL in the message");
  assert.doesNotMatch(message, /[\u0000-\u001f\u007f]/, "no stack trace or control characters");
  assert.doesNotMatch(message, /(^|\s)at\s+[\w$.<>]+\s*\(/, "no stack frame in the message");

  // A partial list must fail the whole widget, never return a short one.
  const unusable = await createData912CedearsAdapter({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([
        { symbol: "AAPL", c: 27400.1 },
        { symbol: "TSLA", c: 111111 }
      ])
    }),
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  }).fetchSnapshot();

  assert.equal(unusable.status, "error", "a partial list must not become a widget value");
  assert.equal("value" in unusable, false, "an error result must carry no value key");
  assert.ok(!JSON.stringify(unusable).includes("TSLA"), "a substituted ticker leaked");
  assert.ok(!JSON.stringify(unusable).includes("111111"));
});

test("fx adapter (failure): a non-2xx response yields a typed error and falls back to no other rate", async () => {
  const body = JSON.stringify({
    compra: 111111,
    venta: 222222,
    fechaActualizacion: "2026-09-25T14:45:00.000Z",
    nombre: "Dólar BNA",
    casa: "CCL",
    tipoCambio: "blue",
    nota: "SENTINEL-UPSTREAM-TEXT"
  });
  const requests = [];
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    requests.push(url);

    return { ok: false, status: 404, statusText: "Not Found", text: async () => body };
  };

  const adapter = createDolarApiMepAdapter({
    fetchImpl,
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  });

  const result = await adapter.fetchSnapshot();

  assert.equal(result.status, "error");
  assert.equal(result.source, "DolarAPI");
  assert.equal(result.error.code, "upstream_error");
  assert.equal(calls, 1, "no retry and no second request to a fallback source");

  assert.equal("value" in result, false, "an error result must carry no value key");
  assert.equal(result.value, undefined);

  const serialized = JSON.stringify(result);
  const { message } = result.error;

  assert.ok(!serialized.includes("BNA"), "a BNA fallback leaked into the result");
  assert.ok(!serialized.includes("CCL"), "a CCL fallback leaked into the result");
  assert.ok(!serialized.includes("blue"), "a blue fallback leaked into the result");
  assert.ok(!serialized.includes("111111"));
  assert.ok(!serialized.includes("222222"));
  assert.ok(!serialized.includes("midpointArs"));
  assert.ok(!serialized.includes("rateType"));
  assert.ok(!serialized.includes("SENTINEL-UPSTREAM-TEXT"));
  assert.ok(!serialized.includes("http"), "no URL in the result");

  assert.equal(requests.length, 1);
  assert.ok(requests[0].startsWith("https://"));
  assert.ok(requests[0].endsWith("/bolsa"));

  assert.equal(typeof message, "string");
  assert.ok(message.length > 0 && message.length <= 120, "a short, user-facing message");
  assert.doesNotMatch(message, /https?:\/\//, "no URL in the message");
  assert.doesNotMatch(message, /[\u0000-\u001f\u007f]/, "no stack trace or control characters");
  assert.doesNotMatch(message, /(^|\s)at\s+[\w$.<>]+\s*\(/, "no stack frame in the message");

  // No compra/venta must fail, never fall back to another rate type.
  const unusable = await createDolarApiMepAdapter({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ nombre: "Dólar BNA", casa: "CCL", tipoCambio: "blue", valor: 99999 })
    }),
    now: () => Date.parse(FIXED_NOW),
    timeoutMs: DEFAULT_TIMEOUT_MS
  }).fetchSnapshot();

  assert.equal(unusable.status, "error", "a missing compra/venta must not become a rate");
  assert.equal("value" in unusable, false, "an error result must carry no value key");

  const unusableText = JSON.stringify(unusable);

  assert.ok(!unusableText.includes("BNA"), "a BNA fallback leaked into the result");
  assert.ok(!unusableText.includes("CCL"), "a CCL fallback leaked into the result");
  assert.ok(!unusableText.includes("blue"), "a blue fallback leaked into the result");
  assert.ok(!unusableText.includes("99999"));
  assert.ok(!unusableText.includes("midpointArs"));
});
