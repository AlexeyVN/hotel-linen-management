/**
 * Мок HTTP-сервиса 1С для проверки адаптера OneCAdapter.
 * Протокол совпадает с тем, что описан в ТЗ v2.3 §8.4.
 * Запуск: node scripts/mock-1c.mjs   (порт 3100)
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_1C_PORT ?? 3100);
const received = [];
let counter = 0;

const ITEMS = [
  { code: "1C-201", name: "Комплект белья 1.5-сп (1С)", unit: "компл", category: "LINEN" },
  { code: "1C-202", name: "Средство для стирки (1С)", unit: "л", category: "CHEMICAL" },
];

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);

  if (request.method === "GET" && url.pathname === "/hs/hotel/ping") {
    json(response, 200, { ok: true, service: "mock-1c" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/hs/hotel/items") {
    json(response, 200, ITEMS);
    return;
  }

  if (request.method === "POST" && url.pathname === "/hs/hotel/operations") {
    const body = await readBody(request);
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      json(response, 400, { ok: false, error: "invalid json" });
      return;
    }
    received.push(payload);
    counter += 1;
    json(response, 200, { ok: true, ref: `1C-OP-${counter}` });
    return;
  }

  if (request.method === "GET" && url.pathname === "/hs/hotel/received") {
    json(response, 200, received);
    return;
  }

  json(response, 404, { ok: false, error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock 1C http service on http://127.0.0.1:${PORT}`);
});
