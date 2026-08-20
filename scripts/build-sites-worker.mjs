import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const htmlPath = path.join(dist, "index.html");
const hostingPath = path.join(root, ".openai", "hosting.json");

let html = await readFile(htmlPath, "utf8");

const cssMatches = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)];
for (const match of cssMatches) {
  const assetPath = path.join(dist, match[1].replace(/^\//, ""));
  const css = await readFile(assetPath, "utf8");
  html = html.replace(match[0], `<style>${css}</style>`);
}

const scriptMatches = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/g)];
for (const match of scriptMatches) {
  const assetPath = path.join(dist, match[1].replace(/^\//, ""));
  const js = await readFile(assetPath, "utf8");
  html = html.replace(match[0], `<script type="module">${js}</script>`);
}

await mkdir(path.join(dist, "server"), { recursive: true });
await mkdir(path.join(dist, ".openai"), { recursive: true });
await writeFile(htmlPath, html);

const worker = `const html = ${JSON.stringify(html)};

export default {
  async fetch() {
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
`;

await writeFile(path.join(dist, "server", "index.js"), worker);
await writeFile(path.join(dist, ".openai", "hosting.json"), await readFile(hostingPath, "utf8"));
