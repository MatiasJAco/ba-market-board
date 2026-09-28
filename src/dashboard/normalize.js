export const ERROR_CODES = new Set([
  "timeout",
  "upstream_error",
  "invalid_json",
  "invalid_schema",
  "missing_ticker",
  "invalid_value",
  "stale",
  "unknown"
]);

export const DEFAULT_MESSAGES = Object.freeze({
  timeout: "La fuente de datos tardó demasiado en responder.",
  upstream_error: "No se pudo consultar la fuente de datos.",
  invalid_json: "La fuente de datos devolvió una respuesta ilegible.",
  invalid_schema: "La fuente de datos devolvió una respuesta inesperada.",
  missing_ticker: "Falta alguno de los valores seleccionados en la respuesta.",
  invalid_value: "La fuente de datos devolvió un valor no utilizable.",
  stale: "El dato disponible es demasiado viejo para mostrarlo.",
  unknown: "No se pudo cargar el dato."
});

const MAX_MESSAGE_LENGTH = 120;
const UNSAFE_MESSAGE_CHARS = /[\n\r(){}\[\]<>"'`\\/|]/;

function isSafeMessage(message) {
  return (
    typeof message === "string" &&
    message.trim().length > 0 &&
    message.length <= MAX_MESSAGE_LENGTH &&
    !UNSAFE_MESSAGE_CHARS.test(message)
  );
}

function safeCode(code) {
  return ERROR_CODES.has(code) ? code : "unknown";
}

export function okResult(source, retrievedAt, value) {
  return { status: "ok", source, retrievedAt, value };
}

export function errorResult(source, retrievedAt, code, message) {
  const safe = safeCode(code);

  return {
    status: "error",
    source,
    retrievedAt,
    error: {
      code: safe,
      message: isSafeMessage(message) ? message : DEFAULT_MESSAGES[safe]
    }
  };
}
