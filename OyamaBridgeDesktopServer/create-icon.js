// Keep desktop identity aligned with the shared Oyama mountain/sun assets.
// Run from any folder: node OyamaBridgeDesktopServer/create-icon.js
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
for (const [source, target] of [["public/branding/oyama-crm-v2-icon-512.png", "icon.png"], ["public/branding/oyama-crm-v2-icon-192.png", "icon-tray.png"], ["app/favicon.ico", "icon.ico"], ["public/branding/oyama-crm-v2-mark.svg", "oyama-mark.svg"]]) fs.copyFileSync(path.join(root, source), path.join(__dirname, "assets", target));
console.log("Oyama Bridge identity assets refreshed.");
