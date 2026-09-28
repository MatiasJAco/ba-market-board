import { DEFAULT_MESSAGES } from "../dashboard/normalize.js";

export const DASHBOARD_PATH = "/api/dashboard";

const FAILURE_BODY = JSON.stringify({
  error: { code: "unknown", message: DEFAULT_MESSAGES.unknown }
});

function sendJson(response, status, statusMessage, body) {
  response.writeHead(status, statusMessage, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    Connection: "close"
  });
  response.end(body);
}

async function serializeSnapshot(service) {
  try {
    const body = JSON.stringify(await service.fetchSnapshot());
    return typeof body === "string" ? body : null;
  } catch {
    return null;
  }
}

export function createDashboardHandler({ service }) {
  return async function handleDashboard(request, response) {
    const body = await serializeSnapshot(service);

    if (body === null) {
      sendJson(response, 500, "Internal Server Error", FAILURE_BODY);
      return;
    }

    sendJson(response, 200, "OK", body);
  };
}
