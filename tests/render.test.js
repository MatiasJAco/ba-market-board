import { get as httpGet } from "node:http";
import assert from "node:assert/strict";
import test from "node:test";

import { createRenderer } from "../src/public/render.js";
import { createServer } from "../src/server.js";

const WIDGET_KEYS = ["weather", "cedears", "mep"];
const SLOT_SUFFIXES = [
  "loading",
  "value",
  "time",
  "source",
  "error",
  "condition",
  "location",
  "unit",
  "detail",
  "cedear-0-ticker",
  "cedear-0-label",
  "cedear-0-price",
  "cedear-1-ticker",
  "cedear-1-label",
  "cedear-1-price",
  "cedear-2-ticker",
  "cedear-2-label",
  "cedear-2-price",
  "cedear-3-ticker",
  "cedear-3-label",
  "cedear-3-price",
  "cedear-4-ticker",
  "cedear-4-label",
  "cedear-4-price"
];

const CEDEAR_CELLS = ["ticker", "label", "price"];

function createFakeDocument() {
  const elements = new Map();

  for (const key of WIDGET_KEYS) {
    for (const suffix of SLOT_SUFFIXES) {
      elements.set(`${key}-${suffix}`, { textContent: "", hidden: true });
    }
  }

  for (const suffix of SLOT_SUFFIXES) {
    if (suffix.startsWith("cedear-")) {
      elements.set(suffix, { textContent: "", hidden: true });
    }
  }

  return {
    elements,
    getElementById(id) {
      return elements.get(id) ?? null;
    }
  };
}

test("smoke: GET / returns the page containing all three widget regions", async (t) => {
  const upstream = [];
  const server = createServer({
    fetchImpl: (url) => {
      upstream.push(url);

      throw new Error("the smoke test must not reach an upstream source");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  );

  const { port } = server.address();
  const page = await new Promise((resolve, reject) => {
    const request = httpGet(
      { host: "127.0.0.1", port, path: "/", agent: false },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            contentType: response.headers["content-type"],
            html: Buffer.concat(chunks).toString("utf8")
          })
        );
      }
    );

    request.on("error", reject);
    request.setTimeout(5000, () => request.destroy(new Error("smoke request timed out")));
  });

  assert.equal(page.status, 200);
  assert.match(page.contentType, /text\/html/);

  for (const id of ["weather-widget", "cedears-widget", "mep-widget"]) {
    assert.ok(page.html.includes(`id="${id}"`), `GET / is missing the ${id} region`);
  }

  for (const id of ["weather-condition", "weather-location", "mep-unit", "mep-detail"]) {
    assert.ok(page.html.includes(`id="${id}"`), `GET / is missing the ${id} slot`);
    assert.match(
      page.html,
      new RegExp(`<[^>]*id="${id}"[^>]*\\shidden\\s*>`),
      `the ${id} slot is not hidden in the served markup`
    );
  }

  assert.match(page.html, /<table class="board__block__table">/);
  assert.match(page.html, /<thead>/);
  assert.match(page.html, /<tbody>/);

  const thead = /<thead>[\s\S]*?<\/thead>/.exec(page.html);

  assert.ok(thead, "GET / is missing the table header");
  assert.doesNotMatch(
    thead[0],
    /board__block__cell-price/,
    "the table header carries the class the reveal keys off"
  );

  for (let row = 0; row < 5; row += 1) {
    for (const cell of CEDEAR_CELLS) {
      const id = `cedear-${row}-${cell}`;

      assert.ok(page.html.includes(`id="${id}"`), `GET / is missing the ${id} cell`);

      const element = new RegExp(`<[^>]*id="${id}"[^>]*>[^<]*`).exec(page.html);

      assert.ok(element, `GET / is missing the opening tag of ${id}`);
      assert.match(element[0], /\shidden\s*>/, `the ${id} cell is not hidden in the served markup`);
      assert.equal(
        element[0].replace(/^<[^>]*>/, ""),
        "",
        `the ${id} cell ships with text in it instead of being written at runtime`
      );

      if (cell === "price") {
        assert.match(
          element[0],
          /class="[^"]*\bboard__block__cell-price\b/,
          `${id} is not a price cell, so nothing can reveal the table`
        );
      }
    }
  }

  assert.deepEqual(upstream, []);
});

test("error state: a failed widget shows its error and no numeric value, leaving siblings untouched", () => {
  const doc = createFakeDocument();
  const renderer = createRenderer(doc);
  const retrievedAt = "2026-09-25T17:45:00.000Z";
  const message = "No se pudo consultar la fuente de datos.";

  const readSlots = (keys) => {
    const snapshot = {};

    for (const key of keys) {
      for (const suffix of SLOT_SUFFIXES) {
        const element = doc.elements.get(`${key}-${suffix}`);

        snapshot[`${key}-${suffix}`] = {
          textContent: element.textContent,
          hidden: element.hidden
        };
      }
    }

    return snapshot;
  };

  for (const key of WIDGET_KEYS) {
    renderer.renderLoading(key);
  }

  renderer.applyResult("weather", {
    status: "ok",
    source: "Open-Meteo",
    retrievedAt,
    value: {
      location: "Buenos Aires",
      temperatureC: 21.4,
      condition: "Parcialmente nublado",
      observedAt: "2026-09-25T14:45:00.000Z",
      timestampKind: "source"
    }
  });

  renderer.applyResult("cedears", {
    status: "ok",
    source: "Data912",
    retrievedAt,
    value: {
      quotes: [
        { ticker: "AAPL", label: "Apple", priceArs: 27400.1, observedAt: null },
        { ticker: "MSFT", label: "Microsoft", priceArs: 552300.55, observedAt: null },
        { ticker: "GOOGL", label: "Alphabet", priceArs: 412900.5, observedAt: null },
        { ticker: "META", label: "Meta Platforms", priceArs: 604100.75, observedAt: null },
        { ticker: "NVDA", label: "Nvidia", priceArs: 198000.5, observedAt: null }
      ],
      timestampKind: "retrieval"
    }
  });

  renderer.applyResult("mep", {
    status: "ok",
    source: "DolarAPI",
    retrievedAt,
    value: {
      rateType: "MEP/bolsa",
      buyArs: 1549.4,
      sellArs: 1550.894,
      midpointArs: 1550.15,
      observedAt: "2026-09-25T14:45:00.000Z",
      timestampKind: "source"
    }
  });

  const siblingsBefore = readSlots(["cedears", "mep"]);

  assert.notEqual(siblingsBefore["cedears-value"].textContent, "");
  assert.notEqual(siblingsBefore["mep-value"].textContent, "");

  assert.match(siblingsBefore["mep-value"].textContent, /^[0-9.,]+$/);
  assert.equal(siblingsBefore["mep-unit"].textContent, "ARS por USD");
  assert.match(siblingsBefore["mep-detail"].textContent, /Compra .+ · Venta .+/);

  const valueBefore = doc.elements.get("weather-value");

  assert.equal(valueBefore.hidden, false);
  assert.match(valueBefore.textContent, /[0-9]/);
  assert.match(valueBefore.textContent, /^[0-9.,]+ °C$/);
  assert.equal(doc.elements.get("weather-condition").textContent, "Parcialmente nublado");
  assert.equal(doc.elements.get("weather-location").textContent, "Buenos Aires");

  const tickers = ["AAPL", "MSFT", "GOOGL", "META", "NVDA"];

  for (let row = 0; row < tickers.length; row += 1) {
    const ticker = doc.elements.get(`cedear-${row}-ticker`);

    assert.equal(ticker.textContent, tickers[row], `row ${row} holds the wrong ticker`);
    assert.equal(ticker.hidden, false, `cedear-${row}-ticker is not shown`);

    const price = doc.elements.get(`cedear-${row}-price`);

    assert.notEqual(price.textContent, "", `cedear-${row}-price is empty`);
    assert.match(price.textContent, /^[0-9.,]+ ARS$/, `cedear-${row}-price is not a peso amount`);
    assert.equal(price.hidden, false, `cedear-${row}-price is not shown`);
  }

  renderer.applyResult("weather", {
    status: "ok",
    source: "Open-Meteo",
    retrievedAt,
    value: {
      location: "",
      temperatureC: 19.8,
      condition: "",
      observedAt: "2026-09-25T14:45:00.000Z",
      timestampKind: "source"
    }
  });

  for (const suffix of ["condition", "location"]) {
    const slot = doc.elements.get(`weather-${suffix}`);

    assert.equal(slot.textContent, "", `an empty weather-${suffix} kept text`);
    assert.equal(slot.hidden, true, `an empty weather-${suffix} was shown`);
  }

  renderer.applyResult("weather", {
    status: "error",
    source: "Open-Meteo",
    retrievedAt,
    error: { code: "upstream_error", message }
  });

  const error = doc.elements.get("weather-error");

  assert.equal(error.textContent, message);
  assert.equal(error.hidden, false);

  const visible = SLOT_SUFFIXES.filter((suffix) => doc.elements.get(`weather-${suffix}`).hidden === false);

  assert.deepEqual(visible, ["error"]);

  for (const suffix of ["condition", "location", "unit", "detail"]) {
    const element = doc.elements.get(`weather-${suffix}`);

    assert.equal(element.hidden, true, `weather-${suffix} stayed visible after the error`);
    assert.equal(element.textContent, "", `weather-${suffix} kept its text after the error`);
  }

  const value = doc.elements.get("weather-value");

  assert.equal(value.textContent, "");
  assert.equal(value.hidden, true);
  assert.notEqual(value.textContent, "0");
  assert.notEqual(value.textContent, "0,00");
  assert.doesNotMatch(error.textContent, /[0-9]/);
  assert.doesNotMatch(error.textContent, /[.,][0-9]{2}/);

  assert.deepEqual(readSlots(["cedears", "mep"]), siblingsBefore);

  renderer.applyResult("cedears", {
    status: "error",
    source: "Data912",
    retrievedAt,
    error: { code: "upstream_error", message }
  });

  for (let row = 0; row < tickers.length; row += 1) {
    for (const cell of CEDEAR_CELLS) {
      const element = doc.elements.get(`cedear-${row}-${cell}`);

      assert.equal(element.hidden, true, `cedear-${row}-${cell} stayed visible after the error`);
      assert.equal(element.textContent, "", `cedear-${row}-${cell} kept its text after the error`);
    }
  }

  const lede = doc.elements.get("cedears-value");

  assert.equal(lede.textContent, "");
  assert.equal(lede.hidden, true);
  assert.equal(doc.elements.get("cedears-error").textContent, message);
  assert.equal(doc.elements.get("cedears-error").hidden, false);
});
