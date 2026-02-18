/**
 * Script to wrap all async Express route handlers with asyncHandler().
 *
 * Transforms:
 *   app.get("/path", async (req, res) => { ... });
 * Into:
 *   app.get("/path", asyncHandler(async (req, res) => { ... }));
 *
 * Also handles middleware chains:
 *   app.post("/path", middleware, async (req, res) => { ... });
 * Into:
 *   app.post("/path", middleware, asyncHandler(async (req, res) => { ... }));
 */

import fs from "fs";
import path from "path";

const serverPath = path.resolve("server.js");
const lines = fs.readFileSync(serverPath, "utf-8").split("\n");

let modified = 0;
const _braceStack = []; // track which lines we wrapped (need to close with extra paren)

// Pass 1: Find and wrap async handler openings
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Skip lines already wrapped with asyncHandler
  if (line.includes("asyncHandler")) continue;

  // Match route definitions with async handlers
  // Pattern: app.(get|post|put|patch|delete)(..., async (req, res
  const routePattern = /^(\s*app\.(get|post|put|patch|delete)\(.+?,\s*)async\s*\(\s*req\s*,\s*res/;
  const match = line.match(routePattern);

  if (match) {
    // Wrap the async with asyncHandler(async
    lines[i] = line.replace(/(\s*)async\s*\(\s*req\s*,\s*res/, "$1asyncHandler(async (req, res");

    // Now find the matching closing }); for this handler
    // Track brace depth starting from this line
    let depth = 0;
    let foundOpen = false;

    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") { depth++; foundOpen = true; }
        if (ch === "}") depth--;
      }

      // When depth returns to 0 after opening, we found the matching close
      if (foundOpen && depth === 0) {
        // Replace }); with }));  or }) with }))
        if (lines[j].match(/\}\s*\)\s*;/)) {
          lines[j] = lines[j].replace(/\}\s*\)\s*;/, "}));");
        } else if (lines[j].match(/\}\s*\)/)) {
          lines[j] = lines[j].replace(/\}\s*\)/, "}))");
        }
        modified++;
        break;
      }
    }
  }
}

fs.writeFileSync(serverPath, lines.join("\n"));
console.log(`Wrapped ${modified} async route handlers with asyncHandler()`);
