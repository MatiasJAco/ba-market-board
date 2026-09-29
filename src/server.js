import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { DASHBOARD_PATH, createDashboardHandler } from "./api/dashboard-route.js";
import { loadConfig } from "./config.js";
import { createDashboardService } from "./dashboard/service.js";
import { createData912CedearsAdapter } from "./sources/data912-cedears.js";
import { createDolarApiMepAdapter } from "./sources/dolarapi-mep.js";
import { createOpenMeteoAdapter } from "./sources/open-meteo.js";

const STATIC_ASSETS = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
  ["/render.js", "render.js"]
]);

const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"]
]);

function contentTypeFor(fileName) {
  return CONTENT_TYPES.get(extname(fileName)) ?? "application/octet-stream";
}

function requestPath(requestUrl) {
  if (typeof requestUrl !== "string" || requestUrl === "") {
    return null;
  }

  const target = requestUrl.split("#")[0].split("?")[0];

  try {
    return decodeURIComponent(target);
  } catch {
    return null;
  }
}

function resolveAsset(requestUrl) {
  if (typeof requestUrl !== "string" || requestUrl === "") {
    return null;
  }

  const target = requestUrl.split("#")[0].split("?")[0];
  const candidates = target === "" ? ["/"] : [target];
  const decoded = requestPath(requestUrl);

  if (decoded !== null) {
    candidates.push(decoded);
  }

  for (const candidate of candidates) {
    const fileName = STATIC_ASSETS.get(candidate);

    if (fileName !== undefined) {
      return fileName;
    }
  }

  return null;
}

function send(response, status, contentType, body, statusMessage) {
  response.writeHead(status, statusMessage, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    Connection: "close"
  });
  response.end(body);
}

function sendText(response, status, body, statusMessage) {
  send(response, status, "text/plain; charset=utf-8", body, statusMessage);
}

export function createServer({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const { publicDir, timeoutMs } = loadConfig();
  const handleDashboard = createDashboardHandler({
    service: createDashboardService({
      adapters: {
        weather: createOpenMeteoAdapter,
        cedears: createData912CedearsAdapter,
        mep: createDolarApiMepAdapter
      },
      now,
      fetchImpl,
      timeoutMs
    })
  });

  return createHttpServer((request, response) => {
    if (requestPath(request.url) === DASHBOARD_PATH) {
      if (request.method !== "GET") {
        sendText(response, 405, "Method Not Allowed", "Method Not Allowed");
        return;
      }

      handleDashboard(request, response);
      return;
    }

    const fileName = resolveAsset(request.url);

    if (fileName === null) {
      sendText(response, 404, "Not Found", "Not Found");
      return;
    }

    if (request.method !== "GET") {
      sendText(response, 405, "Method Not Allowed", "Method Not Allowed");
      return;
    }

    readFile(join(publicDir, fileName)).then(
      (body) => send(response, 200, contentTypeFor(fileName), body),
      () => sendText(response, 404, "Not Found", "Not Found")
    );
  });
}

export function startServer({ env = process.env, fetchImpl, now } = {}) {
  const config = loadConfig(env);
  const server = createServer({ fetchImpl, now });

  return new Promise((resolve, reject) => {
    const onError = (cause) => {
      server.removeListener("listening", onListening);
      reject(cause);
    };

    const onListening = () => {
      server.removeListener("error", onError);
      resolve({ server, host: config.host, port: server.address().port, config });
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(config.port, config.host);
  });
}

const entryPoint = process.argv[1];

if (typeof entryPoint === "string" && import.meta.url === pathToFileURL(entryPoint).href) {
  startServer().then(({ host, port }) => {
    process.stdout.write(`ba-market-board listening on http://${host}:${port}/\n`);
  });
}
