import { DEFAULT_TIMEOUT_MS } from "../config.js";

const MESSAGES = {
  timeout: "La fuente de datos tardó demasiado en responder.",
  upstream_error: "No se pudo consultar la fuente de datos.",
  invalid_json: "La fuente de datos devolvió una respuesta ilegible.",
  unknown: "No se pudo cargar el dato."
};

function typedError(code) {
  return { code, message: MESSAGES[code] };
}

function isTimeoutCause(cause) {
  return cause?.name === "TimeoutError";
}

export async function fetchJson(
  url,
  { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  let response;

  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (cause) {
    return typedError(isTimeoutCause(cause) ? "timeout" : "upstream_error");
  }

  if (!response.ok) {
    return typedError("upstream_error");
  }

  let body;

  try {
    body = await response.text();
  } catch (cause) {
    return typedError(isTimeoutCause(cause) ? "timeout" : "upstream_error");
  }

  try {
    return JSON.parse(body);
  } catch {
    return typedError("invalid_json");
  }
}
