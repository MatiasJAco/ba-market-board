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

const CEDEARS_ROW_COUNT = 5;

const CEDEARS_CELLS = Object.freeze([
  Object.freeze({ suffix: "ticker", field: "ticker" }),
  Object.freeze({ suffix: "label", field: "label" }),
  Object.freeze({ suffix: "price", field: "priceArs" })
]);

function subSlot(field, id = null, row = null) {
  return Object.freeze({ field, id, row });
}

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

  function concealSubslots(parts) {
    for (const subslot of parts.subslots) {
      conceal(subslot.element);
    }
  }

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
