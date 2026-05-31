// Generates app/tokens.css from @memoria/core theme tokens.
// Run: npx tsx scripts/gen-tokens.ts
import { colors, radius, border, type as typeScale } from "../../../packages/core/src/theme";
import { writeFileSync } from "fs";
import { join } from "path";

function camel(s: string) {
  return s.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

const lines: string[] = [":root {"];

// Colors
for (const [k, v] of Object.entries(colors)) {
  lines.push(`  --color-${camel(k)}: ${v};`);
}

// Radius (px)
for (const [k, v] of Object.entries(radius)) {
  lines.push(`  --radius-${k}: ${v}px;`);
}

// Border widths (px)
for (const [k, v] of Object.entries(border)) {
  lines.push(`  --border-${k}: ${v}px;`);
}

// Type scale (px for font sizes, unitless for weights/tracking)
for (const [k, v] of Object.entries(typeScale)) {
  if (typeof v === "number") {
    const prop = k.startsWith("weight") || k === "trackingLabel"
      ? `--type-${camel(k)}`
      : `--type-${camel(k)}`;
    const unit = k.startsWith("weight") || k === "trackingLabel" ? "" : "px";
    lines.push(`  ${prop}: ${v}${unit};`);
  } else {
    lines.push(`  --type-${camel(k)}: ${v};`);
  }
}

lines.push("}");

const out = lines.join("\n") + "\n";
const dest = join(__dirname, "../app/tokens.css");
writeFileSync(dest, out);
console.log("tokens.css written →", dest);
