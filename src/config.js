import { fileURLToPath } from "node:url";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 3000;
export const DEFAULT_TIMEOUT_MS = 15000;

export const SOURCE_URLS = Object.freeze({
  openMeteo: "https://api.open-meteo.com/v1/forecast",
  data912: "https://data912.com/live/arg_cedears",
  dolarApi: "https://dolarapi.com/v1/dolares/bolsa"
});

const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

function readPort(env) {
  const raw = env.PORT;

  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(raw.trim(), 10);

  return port >= 0 && port <= 65535 ? port : DEFAULT_PORT;
}

function readHost(env) {
  const raw = env.HOST;

  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : DEFAULT_HOST;
}

function readTimeoutMs(env) {
  const raw = env.TIMEOUT_MS;

  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) {
    return DEFAULT_TIMEOUT_MS;
  }

  const timeoutMs = Number.parseInt(raw.trim(), 10);

  return timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
}

export function loadConfig(env = process.env) {
  return {
    host: readHost(env),
    port: readPort(env),
    publicDir: PUBLIC_DIR,
    timeoutMs: readTimeoutMs(env),
    sources: { ...SOURCE_URLS }
  };
}
