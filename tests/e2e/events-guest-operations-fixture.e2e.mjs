// Real React components with local API fixtures; never connects to an application database.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { build } = require(createRequire(require.resolve("tsx")).resolve("esbuild"));
const postcss = require(createRequire(require.resolve("@tailwindcss/postcss")).resolve("postcss"));
const tailwind = require("@tailwindcss/postcss");
const root = process.cwd();
const out = path.join(root, "node_modules/.cache/event-guest-operations");
const css = (await postcss([tailwind({ base: root })]).process(await readFile("app/globals.css", "utf8"), { from: path.join(root, "app/globals.css") })).css;
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
    import Guests from './app/events/guests/page'; import Tables from './app/events/tables/page';
    createRoot(document.getElementById('root')).render(location.pathname.endsWith('/tables') ? React.createElement(Tables) : React.createElement(Guests));`,
    resolveDir: root, loader: "tsx" },
  bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env": JSON.stringify({ NODE_ENV: "development", NEXT_PUBLIC_API_URL: "http://localhost:4000" }) },
  plugins: [{ name: "next-fixtures", setup(builder) {
    builder.onResolve({ filter: /^next\/(navigation|link)$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: args.path.endsWith("navigation")
      ? `export const useParams=()=>({eventId:'selected-event'}); export const useSearchParams=()=>new URLSearchParams(); export const usePathname=()=>location.pathname; export const useRouter=()=>({replace:()=>{}});`
      : `import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children)}`, loader: "jsx", resolveDir: root }));
  } }],
});
const server = createServer((req, res) => {
  if (req.url === "/app.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].text); }
  else if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const event = { id: "selected-event", name: "Trivia Night", active: true, startDate: "2026-11-01T18:00:00Z" };
const ticket = { id: "ticket-1", name: "Individual Ticket", price: 25, active: true };
const guests = [{ id: "guest-1", firstName: "Rebecca", lastName: "Haine", checkedIn: false, seatId: "seat-1", tableId: "table-1", event },
  ...Array.from({ length: 4 }, (_, i) => ({ id: `legacy-${i}`, firstName: `Legacy ${i + 1}`, lastName: "Guest", checkedIn: false, seatId: null, tableId: "table-1", event }))];
const table = { id: "table-1", name: "Rebecca Haine", tableNumber: 6, tableUid: "tbl_1", publicCode: "TBL-TEST", capacity: 8, status: "DRAFT", shape: "round", xPosition: 40, yPosition: 40, isSponsored: false };
const tableData = () => ({ ...table, guests: guests.filter((guest) => guest.tableId === table.id), _count: { guests: guests.filter((guest) => guest.tableId === table.id).length },
  seats: Array.from({ length: 8 }, (_, index) => { const guest = guests.find((row) => row.seatId === `seat-${index + 1}`); return { id: `seat-${index + 1}`, seatNumber: index + 1, status: guest ? "CONFIRMED" : "EMPTY", guest }; }), guestInvites: [] });
let tableDeleted = false;
let failTableDelete = false;
let deleteRequests = 0;
let failTicketLoad = false;
let failTicketSave = false;
let legacyTableDetails = false;
const writes = [];
await page.route("**/api/**", async (route) => {
  const request = route.request(); const url = new URL(request.url()); const method = request.method();
  const body = method === "GET" ? {} : request.postDataJSON() ?? {};
  const reply = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
  if (url.pathname === "/api/constituents") return reply({ error: { message: "Constituent access denied" } }, 403);
  if (url.pathname === "/api/events") return reply([{ ...event, id: "first-event", name: "Other Event" }, event]);
  if (url.pathname.endsWith("/ticket-types")) return failTicketLoad ? reply({ error: { message: "Ticket service unavailable" } }, 503) : reply([ticket]);
  if (url.pathname.endsWith("/emails/logs")) return reply([]);
  if (method === "GET" && url.pathname.endsWith("/tables")) return reply(tableDeleted ? [] : [tableData()]);
  if (method === "GET" && url.pathname.endsWith("/tablelink/tbl_1")) {
    const detail = tableData();
    if (legacyTableDetails) { delete detail.guests; delete detail._count; }
    return reply(detail);
  }
  if (method === "GET" && url.pathname.endsWith("/guests")) return reply(guests.map((guest) => ({ ...guest, table: guest.tableId ? { id: table.id, name: table.name } : null })));
  if (method === "POST" && url.pathname.endsWith("/guests")) {
    assert.equal(url.pathname, "/api/events/selected-event/guests");
    const guest = { ...body, id: `manual-${guests.length}`, checkedIn: false, seatId: null, tableId: null, event, ticketType: body.ticketTypeId ? ticket : null };
    writes.push({ method, path: url.pathname, body }); guests.push(guest); return reply(guest, 201);
  }
  if (method === "PATCH" && url.pathname.startsWith("/api/events/guests/")) {
    if (failTicketSave) return reply({ error: { message: "Ticket save failed" } }, 500);
    const guest = guests.find((row) => row.id === url.pathname.split("/").at(-1)); assert.ok(guest);
    guest.ticketType = body.ticketTypeId ? ticket : null; writes.push({ method, path: url.pathname, body }); return reply(guest);
  }
  if (method === "POST" && url.pathname.endsWith("/clear")) {
    const guest = guests.find((row) => row.seatId === url.pathname.split("/").at(-2)); assert.ok(guest);
    guest.seatId = null; guest.tableId = null; return reply({ status: "EMPTY" });
  }
  if (method === "POST" && url.pathname.endsWith("/assign-guest")) {
    const guest = guests.find((row) => row.id === body.guestId); assert.ok(guest);
    guest.seatId = url.pathname.split("/").at(-2); guest.tableId = table.id; return reply({ guest });
  }
  if (method === "DELETE" && url.pathname === "/api/events/tables/table-1") {
    deleteRequests += 1;
    if (failTableDelete) return reply({ error: { message: "Delete failed. Try again." } }, 500);
    for (const guest of guests) { if (guest.tableId === table.id) Object.assign(guest, { tableId: null, seatId: null, seatNumber: null }); }
    tableDeleted = true; return reply({ message: "Table deleted" });
  }
  if (method === "PATCH" && url.pathname === "/api/events/tables/table-1") {
    if ("xPosition" in body) { Object.assign(table, body); return reply(tableData()); }
    assert.deepEqual(Object.keys(body), ["name"]); table.name = body.name; writes.push({ method, path: url.pathname, body }); return reply(tableData());
  }
  throw new Error(`Unhandled fixture request ${method} ${url.pathname}`);
});

try {
  await mkdir(out, { recursive: true });
  await page.goto(`${base}/events/selected-event/guests`);
  await page.getByRole("heading", { name: "Guest List", exact: true }).waitFor();
  await page.getByRole("button", { name: "+ Add Guest", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Constituent lookup is unavailable", { exact: false }).waitFor();
  await dialog.getByRole("combobox", { name: "Ticket Type" }).selectOption("ticket-1");
  await dialog.locator('input[required]').nth(0).fill("Ada");
  await dialog.locator('input[required]').nth(1).fill("Lovelace");
  await dialog.getByRole("button", { name: "Add Guest", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Ada Lovelace" });
  await row.getByText("Individual Ticket", { exact: true }).waitFor();
  assert.equal(writes[0].body.ticketTypeId, "ticket-1");
  await row.getByRole("button", { name: /Change ticket for/ }).click();
  await dialog.getByRole("combobox", { name: "Ticket Type" }).selectOption("");
  failTicketSave = true;
  await dialog.getByRole("button", { name: "Save Ticket" }).click();
  await dialog.getByRole("alert").filter({ hasText: "Ticket save failed" }).waitFor();
  failTicketSave = false;
  await dialog.getByRole("button", { name: "Save Ticket" }).click();
  await row.getByRole("button", { name: /Assign ticket for/ }).waitFor();
  failTicketLoad = true;
  await row.getByRole("button", { name: /Assign ticket for/ }).click();
  await dialog.getByRole("button", { name: "Retry tickets" }).waitFor();
  failTicketLoad = false;
  await dialog.getByRole("button", { name: "Retry tickets" }).click();
  await dialog.getByRole("combobox", { name: "Ticket Type" }).selectOption("ticket-1");
  await dialog.getByRole("button", { name: "Save Ticket" }).click();
  await row.getByText("Individual Ticket", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, "guest-list-desktop.png"), fullPage: true });

  await page.goto(`${base}/events/selected-event/tables`);
  const floorTable = page.getByRole("button", { name: /Rebecca Haine, 1 of 8 seats/ });
  await floorTable.waitFor();
  await floorTable.getByText("1/8 seated · 7 open", { exact: true }).waitFor();
  await floorTable.dblclick();
  const seatRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Seat 1", exact: true }) });
  await seatRow.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByText("0/8 seated · 8 open", { exact: true }).first().waitFor();
  await seatRow.getByRole("combobox").selectOption("guest-1");
  await seatRow.getByRole("button", { name: "Assign", exact: true }).click();
  await seatRow.getByRole("cell", { name: "Rebecca Haine", exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, "table-seating-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Rename Table", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Table name" }).fill("Rebecca’s Team");
  await dialog.getByRole("button", { name: "Save Name" }).click();
  await page.getByRole("button", { name: /Rebecca’s Team, 1 of 8 seats/ }).waitFor();
  assert.equal(table.capacity, 8); assert.equal(guests[0].seatId, "seat-1");
  // Exercise the pre-fix API shape: no top-level guests or _count, only seat.guest.
  legacyTableDetails = true;
  await page.getByRole("button", { name: /Rebecca’s Team, 1 of 8 seats/ }).dblclick();
  await page.getByRole("heading", { name: "Seat Roster Controls", exact: true }).waitFor();
  await page.getByText("1/8 seated · 7 open", { exact: true }).last().waitFor();
  await seatRow.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByText("0/8 seated · 8 open", { exact: true }).last().waitFor();
  await seatRow.getByRole("combobox").selectOption("guest-1");
  await seatRow.getByRole("button", { name: "Assign", exact: true }).click();
  await seatRow.getByRole("cell", { name: "Rebecca Haine", exact: true }).waitFor();
  // A guest unassigned by another workspace must reappear when this tab regains focus.
  guests[0].seatId = null; guests[0].tableId = null;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("button", { name: "Refresh seating", exact: true }).waitFor();
  await seatRow.getByRole("combobox").selectOption("guest-1");
  await seatRow.getByRole("button", { name: "Assign", exact: true }).click();
  await seatRow.getByRole("cell", { name: "Rebecca Haine", exact: true }).waitFor();
  await page.getByRole("button", { name: "Delete table", exact: true }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Delete Table 6?" });
  await deleteDialog.getByRole("button", { name: "Keep table" }).click();
  assert.equal(deleteRequests, 0);
  await page.getByRole("button", { name: "Delete table", exact: true }).click();
  failTableDelete = true;
  await deleteDialog.getByRole("button", { name: "Delete and unassign guests" }).click();
  await deleteDialog.getByRole("alert").waitFor();assert.equal(tableDeleted, false);
  failTableDelete = false;
  const guestCount = guests.length;
  await deleteDialog.getByRole("button", { name: "Delete and unassign guests" }).click();
  await page.getByText("No tables configured yet.", { exact: true }).waitFor();
  assert.equal(await page.getByText("TableLink Studio", { exact: true }).count(), 0);
  assert.equal(guests.length, guestCount);
  assert.ok(guests.every(guest => !guest.tableId && !guest.seatId));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/events/selected-event/guests`);
  await page.getByRole("heading", { name: "Guest List", exact: true }).waitFor();
  await page.getByRole("button", { name: "+ Add Guest", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Ticket Type" }).selectOption("ticket-1");
  await dialog.locator('input[required]').nth(0).fill("Mobile");
  await dialog.locator('input[required]').nth(1).fill("Guest");
  await dialog.getByRole("button", { name: "Add Guest", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "Mobile Guest" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Mobile page should not overflow horizontally");
  await page.screenshot({ path: path.join(out, "guest-list-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS: desktop/mobile registration despite constituent denial; ticket assignment/removal/retry; seat counts; clear/unassigned/reseat with both complete and legacy table-detail responses; rename preserves seating.");
} catch (error) {
  console.error("Browser errors:", errors);
  console.error("Page:", (await page.locator("body").innerText()).slice(0, 5000));
  await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
