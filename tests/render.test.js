import { get as httpGet } from "node:http";
import assert from "node:assert/strict";
import test from "node:test";

import { createRenderer } from "../src/public/render.js";
import { createServer } from "../src/server.js";

// Tests 1 and 2 of the 8-test budget in specs/002-dashboard-data-policy/plan.md.
// Test 3 ("Error state") is test 8, and test 1 is the smoke test. Nothing else in
// the product is allowed to add a test file, a fake, or a fixture.

// src/public/render.js deliberately touches nothing except getElementById,
// textContent and hidden, so a Map of plain objects is a faithful stand-in for a
// document. It lives here, inside the one allowed render test file, on purpose:
// there is no tests/helpers/, no document-double module and no fixture.
const WIDGET_KEYS = ["weather", "cedears", "mep"];
const SLOT_SUFFIXES = ["loading", "value", "time", "source", "error"];

function createFakeDocument() {
  const elements = new Map();

  for (const key of WIDGET_KEYS) {
    for (const suffix of SLOT_SUFFIXES) {
      // 15 ids, 3 keys x 5 slots. `${key}-widget` is never looked up by the
      // renderer, so the fake does not need it.
      elements.set(`${key}-${suffix}`, { textContent: "", hidden: true });
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
  // The page shell is static. If anything ever started fetching while serving
  // the HTML, this stub would blow up rather than silently reach the internet.
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

  // Serving the page must not depend on, or trigger, any source adapter.
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

  // Start every widget in its loading state, then give all three real content,
  // so both halves of the assertion are real comparisons: the failed widget
  // genuinely has a visible number to lose, and the siblings are a populated
  // board rather than blanks this file made up.
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

  // The failed widget is holding a visible temperature right now, so the error
  // has something real to clear.
  const valueBefore = doc.elements.get("weather-value");

  assert.equal(valueBefore.hidden, false);
  assert.match(valueBefore.textContent, /[0-9]/);

  renderer.applyResult("weather", {
    status: "error",
    source: "Open-Meteo",
    retrievedAt,
    error: { code: "upstream_error", message }
  });

  // The error is visible, and it is the message the result carried rather than a
  // generic placeholder.
  const error = doc.elements.get("weather-error");

  assert.equal(error.textContent, message);
  assert.equal(error.hidden, false);

  // Exactly one visible slot remains, so the region is neither blank nor showing
  // a stale loading, value, source or timestamp line.
  const visible = SLOT_SUFFIXES.filter((suffix) => doc.elements.get(`weather-${suffix}`).hidden === false);

  assert.deepEqual(visible, ["error"]);

  // No numeric value is rendered: not a zero, not an empty-but-visible region.
  const value = doc.elements.get("weather-value");

  assert.equal(value.textContent, "");
  assert.equal(value.hidden, true);
  assert.notEqual(value.textContent, "0");
  assert.notEqual(value.textContent, "0,00");
  assert.doesNotMatch(error.textContent, /[0-9]/);
  assert.doesNotMatch(error.textContent, /[.,][0-9]{2}/);

  // Siblings are byte-for-byte identical, text and visibility alike.
  assert.deepEqual(readSlots(["cedears", "mep"]), siblingsBefore);
});
