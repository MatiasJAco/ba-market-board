const LOADING_PLACEHOLDER = "Cargando…";
const ERROR_PLACEHOLDER = "No se pudo cargar este dato.";
const TIME_PREFIX = "Consultado: ";
const OBSERVED_PREFIX = "Observado: ";
const TEMPERATURE_UNIT = " °C";
const VALUE_SEPARATOR = " · ";
const CURRENCY_UNIT = " ARS";
const RATE_UNIT = "ARS por USD";
const CEDEARS_COUNT_LABEL = " CEDEARs en pesos argentinos";
const TEMPERATURE_FORMAT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const CURRENCY_FORMAT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const RATE_FORMAT = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const SIDES = new Map([
  ["buyArs", "Compra"],
  ["sellArs", "Venta"]
]);

// The CEDEAR table is five rows of three cells, declared statically in the
// markup. A source that ever returns a different number of quotes still has
// somewhere to put the first five; the rest have no cell and are not shown.
const CEDEARS_ROW_COUNT = 5;

// The cells of one row: the suffix the markup names the element with, and the
// field the renderer returns for it. Only the price carries a different name on
// each side, because the contract names the cell `cedear-{n}-price` and the
// value it holds is a formatted peso amount.
const CEDEARS_CELLS = Object.freeze([
  Object.freeze({ suffix: "ticker", field: "ticker" }),
  Object.freeze({ suffix: "label", field: "label" }),
  Object.freeze({ suffix: "price", field: "priceArs" })
]);

// Optional value sub-slots, per widget: the field a value renderer returns for
// one, and, when it is not the `${key}-${field}` element, the id it is written
// to. `row` is the position in the CEDEAR table, and null for a slot that is
// not part of a table.
//
// Every one of them is an independent lookup. A missing element is not an
// error: display() and conceal() already no-op on null, so markup that lags
// behind the renderer degrades to "not shown" rather than throwing.
function subSlot(field, id = null, row = null) {
  return Object.freeze({ field, id, row });
}

// The fifteen CEDEAR cells, row by row. They are declared here rather than in
// the markup so the error path clears exactly the ids the markup declares.
function cedearsSubSlots() {
  const cells = [];

  for (let index = 0; index < CEDEARS_ROW_COUNT; index += 1) {
    for (const cell of CEDEARS_CELLS) {
      cells.push(subSlot(cell.field, `cedear-${index}-${cell.suffix}`, index));
    }
  }

  return Object.freeze(cells);
}

const SUB_SLOT_NAMES = Object.freeze({
  weather: Object.freeze([subSlot("condition"), subSlot("location")]),
  mep: Object.freeze([subSlot("unit"), subSlot("detail")]),
  cedears: cedearsSubSlots()
});

const NO_SUB_SLOTS = Object.freeze([]);
const NO_PARTS = Object.freeze({});

function defaultValueText(value) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "";
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function retrievalTimeOf(result) {
  return isRecord(result) ? result.retrievedAt : null;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isText(value) {
  return typeof value === "string" && value !== "";
}

function sourceTimeOf(value, result) {
  const observedAt = isRecord(value) ? value.observedAt : null;
  const fromSource = isRecord(value) && value.timestampKind === "source" && isText(observedAt);

  return {
    time: fromSource ? observedAt : retrievalTimeOf(result),
    timeKind: fromSource ? "source" : "retrieval"
  };
}

function renderWeather(value, result) {
  if (!isRecord(value)) {
    return defaultValueText(value, result);
  }

  const temperatureC = value.temperatureC;
  const observedAt = value.observedAt;
  const fromSource = value.timestampKind === "source" && isText(observedAt);

  // One dominant number plus its supporting lines. A single text node carries
  // one font size, so the parts cannot share an element.
  return {
    hero: isFiniteNumber(temperatureC)
      ? `${TEMPERATURE_FORMAT.format(temperatureC)}${TEMPERATURE_UNIT}`
      : "",
    condition: isText(value.condition) ? value.condition : "",
    location: isText(value.location) ? value.location : "",
    time: fromSource ? observedAt : retrievalTimeOf(result),
    timeKind: fromSource ? "source" : "retrieval"
  };
}

function renderCedears(value, result) {
  if (!isRecord(value) || !Array.isArray(value.quotes)) {
    return defaultValueText(value, result);
  }

  // Row n of the table is written from quote n, so a quote that lacks a field
  // leaves its own cell empty instead of shifting the rows below it. Cells are
  // looked up by id, and a cell with nothing to show is simply left hidden.
  const rows = value.quotes.map((quote) => {
    const record = isRecord(quote) ? quote : {};

    return {
      ticker: isText(record.ticker) ? record.ticker : "",
      label: isText(record.label) ? record.label : "",
      priceArs: isFiniteNumber(record.priceArs)
        ? `${CURRENCY_FORMAT.format(record.priceArs)}${CURRENCY_UNIT}`
        : ""
    };
  });

  return {
    // The count is read from the payload rather than assumed, so the line stays
    // true if the number of instruments the source returns ever changes.
    lede: `${value.quotes.length}${CEDEARS_COUNT_LABEL}`,
    rows,
    time: retrievalTimeOf(result),
    timeKind: "retrieval"
  };
}

function renderMep(value, result) {
  if (!isRecord(value)) {
    return defaultValueText(value, result);
  }

  const sides = [];

  for (const [field, label] of SIDES) {
    if (isFiniteNumber(value[field])) {
      sides.push(`${label} ${CURRENCY_FORMAT.format(value[field])}${CURRENCY_UNIT}`);
    }
  }

  // The midpoint is the dominant number and keeps the element to itself. The
  // rate type is not written here: the block title carries that label, so no
  // string from upstream can put a different rate name on the page.
  return {
    hero: isFiniteNumber(value.midpointArs) ? RATE_FORMAT.format(value.midpointArs) : "",
    unit: RATE_UNIT,
    detail: sides.join(VALUE_SEPARATOR),
    ...sourceTimeOf(value, result)
  };
}

const VALUE_RENDERERS = Object.freeze({
  weather: renderWeather,
  cedears: renderCedears,
  mep: renderMep
});

// The one line the primary element carries: the dominant number where a block
// has one, the whole rendered string where the value is flat, and the lede
// where the numbers live elsewhere, as they do in the CEDEAR table.
function primaryTextOf(rendered) {
  return rendered.hero ?? rendered.text ?? rendered.lede;
}

function formatTimeText(value) {
  if (typeof value !== "string" || value === "") {
    return null;
  }

  const ms = Date.parse(value);

  if (!Number.isFinite(ms)) {
    return null;
  }

  return new Date(ms).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function errorMessageOf(result) {
  const message = result === null || typeof result !== "object" ? null : result.error?.message;

  return typeof message === "string" && message.trim() !== "" ? message : ERROR_PLACEHOLDER;
}

function isOkResult(result) {
  return result !== null && typeof result === "object" && result.status === "ok";
}

export function createRenderer(doc) {
  function slots(key) {
    if (typeof key !== "string" || key === "" || doc === null || typeof doc !== "object") {
      return null;
    }

    const loading = doc.getElementById(`${key}-loading`);
    const value = doc.getElementById(`${key}-value`);
    const error = doc.getElementById(`${key}-error`);

    if (!loading || !value || !error) {
      return null;
    }

    const subslots = [];

    for (const subslot of SUB_SLOT_NAMES[key] ?? NO_SUB_SLOTS) {
      // Most sub-slots follow the `${key}-${field}` rule; the CEDEAR cells name
      // themselves, because the contract calls them `cedear-{n}-{field}`.
      const id = subslot.id ?? `${key}-${subslot.field}`;

      subslots.push({ name: subslot.field, row: subslot.row, element: doc.getElementById(id) });
    }

    return {
      loading,
      value,
      error,
      time: doc.getElementById(`${key}-time`),
      source: doc.getElementById(`${key}-source`),
      subslots
    };
  }

  function clear(element) {
    if (element) {
      element.textContent = "";
    }
  }

  function conceal(element) {
    if (element) {
      element.hidden = true;
      clear(element);
    }
  }

  function display(element, text) {
    if (!element) {
      return;
    }

    const content = typeof text === "string" ? text : "";

    element.textContent = content;
    element.hidden = content === "";
  }

  // Every sub-slot of a widget, hidden or shown. Missing elements are skipped
  // by conceal()/display(), so a block that has not grown a sub-slot yet is not
  // a failure — it just has fewer slots to clear.
  function concealSubslots(parts) {
    for (const subslot of parts.subslots) {
      conceal(subslot.element);
    }
  }

  // What one sub-slot shows: its own field, or its own field of one CEDEAR row.
  // Anything missing reads as "not shown", which is what display() does with a
  // value that is not a string.
  function subSlotText(rendered, subslot) {
    if (subslot.row === null) {
      return rendered[subslot.name];
    }

    return rendered.rows?.[subslot.row]?.[subslot.name];
  }

  function showSubslots(parts, rendered) {
    for (const subslot of parts.subslots) {
      display(subslot.element, subSlotText(rendered, subslot));
    }
  }

  function renderLoading(key) {
    const parts = slots(key);

    if (parts === null) {
      return;
    }

    if (typeof parts.loading.textContent !== "string" || parts.loading.textContent.trim() === "") {
      parts.loading.textContent = LOADING_PLACEHOLDER;
    }

    parts.loading.hidden = false;
    conceal(parts.value);
    concealSubslots(parts);
    conceal(parts.time);
    conceal(parts.source);
    conceal(parts.error);
  }

  function applyResult(key, result) {
    const parts = slots(key);

    if (parts === null) {
      return;
    }

    // Every transition starts from a blank block. A sub-slot forgotten here is
    // a stale value sitting beside an error box, which Constitution VII and
    // FR-012 forbid, so the whole slot list is concealed up front rather than
    // only the parts the current branch happens to write.
    parts.loading.hidden = true;
    conceal(parts.value);
    concealSubslots(parts);
    conceal(parts.time);
    conceal(parts.source);

    if (isOkResult(result)) {
      const renderValue = VALUE_RENDERERS[key] ?? defaultValueText;
      const rendered = renderValue(result.value, result);
      const detailed = isRecord(rendered);
      const time = formatTimeText(detailed ? rendered.time : result.retrievedAt);
      const timePrefix = detailed && rendered.timeKind === "source" ? OBSERVED_PREFIX : TIME_PREFIX;

      // A parts renderer fills the primary element with its dominant part and
      // writes each remaining part to its own slot. The fallback string fills
      // the primary element alone and leaves every sub-slot concealed.
      display(parts.value, detailed ? primaryTextOf(rendered) : rendered);
      showSubslots(parts, detailed ? rendered : NO_PARTS);
      display(parts.source, typeof result.source === "string" ? result.source : "");
      display(parts.error, "");
      display(parts.time, time === null ? null : `${timePrefix}${time}`);
      return;
    }

    display(parts.error, errorMessageOf(result));
  }

  return Object.freeze({ renderLoading, applyResult });
}
