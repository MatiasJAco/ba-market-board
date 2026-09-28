const LOADING_PLACEHOLDER = "Cargando…";
const ERROR_PLACEHOLDER = "No se pudo cargar este dato.";
const TIME_PREFIX = "Consultado: ";
const OBSERVED_PREFIX = "Observado: ";
const TEMPERATURE_UNIT = " °C";
const VALUE_SEPARATOR = " · ";
const TEMPERATURE_FORMAT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

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

function renderWeather(value, result) {
  if (!isRecord(value)) {
    return defaultValueText(value, result);
  }

  const segments = [];
  const temperatureC = value.temperatureC;

  if (typeof temperatureC === "number" && Number.isFinite(temperatureC)) {
    segments.push(`${TEMPERATURE_FORMAT.format(temperatureC)}${TEMPERATURE_UNIT}`);
  }

  if (typeof value.condition === "string" && value.condition !== "") {
    segments.push(value.condition);
  }

  const observedAt = value.observedAt;
  const fromSource = value.timestampKind === "source" && typeof observedAt === "string" && observedAt !== "";

  return {
    text: segments.join(VALUE_SEPARATOR),
    time: fromSource ? observedAt : retrievalTimeOf(result),
    timeKind: fromSource ? "source" : "retrieval"
  };
}

const VALUE_RENDERERS = Object.freeze({
  weather: renderWeather,
  cedears: defaultValueText,
  mep: defaultValueText
});

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

    return {
      loading,
      value,
      error,
      time: doc.getElementById(`${key}-time`),
      source: doc.getElementById(`${key}-source`)
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
    conceal(parts.time);
    conceal(parts.source);

    if (isOkResult(result)) {
      const renderValue = VALUE_RENDERERS[key] ?? defaultValueText;
      const rendered = renderValue(result.value, result);
      const detailed = isRecord(rendered);
      const time = formatTimeText(detailed ? rendered.time : result.retrievedAt);
      const timePrefix = detailed && rendered.timeKind === "source" ? OBSERVED_PREFIX : TIME_PREFIX;

      display(parts.value, detailed ? rendered.text : rendered);
      display(parts.source, typeof result.source === "string" ? result.source : "");
      display(parts.error, "");
      display(parts.time, time === null ? null : `${timePrefix}${time}`);
      return;
    }

    display(parts.error, errorMessageOf(result));
  }

  return Object.freeze({ renderLoading, applyResult });
}
