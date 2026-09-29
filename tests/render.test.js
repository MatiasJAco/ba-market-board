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
// The five required suffixes, the four optional value sub-slots added in task 2,
// and the fifteen CEDEAR cells added in task 3. This is a cross product, so only
// weather-condition, weather-location, mep-unit and mep-detail are real elements;
// the remaining combinations are never looked up and stay empty and hidden,
// which is itself worth pinning: the two comparisons below then hold every
// sub-slot of a widget fixed. The CEDEAR cells are the exception — they name
// themselves `cedear-{n}-{cell}` with no widget key, so the loop below also
// registers them under their own ids, and that is the id the renderer reads.
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

// The five rows and the three cells of each, in the order the adapter returns
// them. Row n is written from quote n, so this is also the order the assertions
// in the error-state test read them back in.
const CEDEAR_CELLS = ["ticker", "label", "price"];

function createFakeDocument() {
  const elements = new Map();

  for (const key of WIDGET_KEYS) {
    for (const suffix of SLOT_SUFFIXES) {
      // 72 ids, 3 keys x 24 slots. `${key}-widget` is never looked up by the
      // renderer, so the fake does not need it, and neither `${key}-cedear-n-x`
      // nor `cedear-n-x` is looked up under a key.
      elements.set(`${key}-${suffix}`, { textContent: "", hidden: true });
    }
  }

  // The fifteen cells the renderer actually reads, under the ids the markup
  // declares. Without these the CEDEAR block would render into nothing.
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

  // The optional sub-slots the renderer writes into must exist in the served
  // markup, and each one must start hidden, so that nothing on the page depends
  // on script to become visible.
  for (const id of ["weather-condition", "weather-location", "mep-unit", "mep-detail"]) {
    assert.ok(page.html.includes(`id="${id}"`), `GET / is missing the ${id} slot`);
    assert.match(
      page.html,
      new RegExp(`<[^>]*id="${id}"[^>]*\\shidden\\s*>`),
      `the ${id} slot is not hidden in the served markup`
    );
  }

  // The CEDEAR block is a real table, not a flat string, and its fifteen cells
  // are static markup: the renderer may only write text into ids that already
  // exist, so a missing cell is a silent blank, not a visible one.
  assert.match(page.html, /<table class="board__block__table">/);
  assert.match(page.html, /<thead>/);
  assert.match(page.html, /<tbody>/);

  // The header of that table is the one place where a price class would lie:
  // nothing is written into it at runtime, so a reveal that keyed off it would
  // match in every state and the table would sit on the page as a header over
  // five empty rows whenever the payload was unreadable. The reveal keys off a
  // price cell in the body instead, so the header must not carry the class.
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

      // The opening tag and whatever is written inside it. The id is only half
      // of it: a cell that ships with text in it would put a hardcoded ticker
      // or a hardcoded number on the page (T012), and one that ships visible
      // would make the page depend on script to clear it (the view-slot
      // contract: no element that requires script to be visible).
      const element = new RegExp(`<[^>]*id="${id}"[^>]*>[^<]*`).exec(page.html);

      assert.ok(element, `GET / is missing the opening tag of ${id}`);
      assert.match(element[0], /\shidden\s*>/, `the ${id} cell is not hidden in the served markup`);
      assert.equal(
        element[0].replace(/^<[^>]*>/, ""),
        "",
        `the ${id} cell ships with text in it instead of being written at runtime`
      );

      // Each of the five price cells is the one element the reveal may key off,
      // so each of them has to be a price cell.
      if (cell === "price") {
        assert.match(
          element[0],
          /class="[^"]*\bboard__block__cell-price\b/,
          `${id} is not a price cell, so nothing can reveal the table`
        );
      }
    }
  }

  // Whether the table is shown at all is decided in the stylesheet, and the
  // fake document used by the other test never computes CSS, so the contract is
  // pinned here against the bytes the browser is actually served. Three rules,
  // and every one of them has to survive: hidden by default, shown by a price
  // cell in the body, and forced off by an error or a loading line.
  const stylesheet = await new Promise((resolve, reject) => {
    const request = httpGet({ host: "127.0.0.1", port, path: "/styles.css", agent: false }, (response) => {
      const chunks = [];

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () =>
        resolve({
          status: response.statusCode,
          css: Buffer.concat(chunks).toString("utf8")
        })
      );
    });

    request.on("error", reject);
    request.setTimeout(5000, () => request.destroy(new Error("smoke request timed out")));
  });

  assert.equal(stylesheet.status, 200);
  assert.match(
    stylesheet.css,
    /\.board__block__table \{\s*display: none;/,
    "the table is no longer hidden until something reveals it"
  );
  assert.match(
    stylesheet.css,
    /\.board__block:has\(\.board__block__table tbody \.board__block__cell-price:not\(\[hidden\]\)\) \.board__block__table \{\s*display: table;/,
    "the table is no longer revealed by a price cell in the body"
  );
  assert.match(
    stylesheet.css,
    /\.board__block:has\(\.board__block__error:not\(\[hidden\]\)\) \.board__block__table,\s*\.board__block:has\(\.board__block__loading:not\(\[hidden\]\)\) \.board__block__table \{\s*display: none;/,
    "an error or a loading line no longer forces the table off"
  );

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

  // The dollar block splits one value across a primary element and two
  // supporting ones. The primary element keeps the rate itself — the number it
  // is styled around — and the unit and the bid/ask pair each move to their own
  // slot so they can be sized separately.
  assert.match(siblingsBefore["mep-value"].textContent, /^[0-9.,]+$/);
  assert.equal(siblingsBefore["mep-unit"].textContent, "ARS por USD");
  assert.match(siblingsBefore["mep-detail"].textContent, /Compra .+ · Venta .+/);

  // The failed widget is holding a visible temperature right now, so the error
  // has something real to clear.
  const valueBefore = doc.elements.get("weather-value");

  assert.equal(valueBefore.hidden, false);
  assert.match(valueBefore.textContent, /[0-9]/);
  assert.match(valueBefore.textContent, /^[0-9.,]+ °C$/);
  assert.equal(doc.elements.get("weather-condition").textContent, "Parcialmente nublado");
  assert.equal(doc.elements.get("weather-location").textContent, "Buenos Aires");

  // The five CEDEAR rows: every cell carries its own quote, in the order the
  // adapter returned them, and every price is a formatted peso amount. The
  // positional rule is the fragile part — a renderer that shifted the rows
  // would still show five tickers and five prices, just the wrong pairing.
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

  // A real Open-Meteo payload can arrive with no condition and no city. An
  // absent part must leave its slot hidden rather than show an empty line, so
  // the block never grows a blank grey row on every load.
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

  // The error is visible, and it is the message the result carried rather than a
  // generic placeholder.
  const error = doc.elements.get("weather-error");

  assert.equal(error.textContent, message);
  assert.equal(error.hidden, false);

  // Exactly one visible slot remains, so the region is neither blank nor showing
  // a stale loading, value, source or timestamp line.
  const visible = SLOT_SUFFIXES.filter((suffix) => doc.elements.get(`weather-${suffix}`).hidden === false);

  assert.deepEqual(visible, ["error"]);

  // No sub-slot survives either. The deep equal above is the general rule; this
  // is the case the whole split was risky for, because a forgotten one leaves
  // a condition or a city on screen beside the error box — the apparently
  // healthy page Constitution VII and FR-012 both forbid.
  for (const suffix of ["condition", "location", "unit", "detail"]) {
    const element = doc.elements.get(`weather-${suffix}`);

    assert.equal(element.hidden, true, `weather-${suffix} stayed visible after the error`);
    assert.equal(element.textContent, "", `weather-${suffix} kept its text after the error`);
  }

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

  // The other direction: the same rule in the block that has fifteen cells to
  // clear. Applied last, so the comparison above is still a comparison. A cell
  // the error path forgets leaves a ticker and a peso amount on screen beside
  // the error box, which is the one failure this test exists to catch.
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
