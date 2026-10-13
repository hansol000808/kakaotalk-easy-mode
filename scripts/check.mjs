import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const problems = [];
let count = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "output"].includes(entry.name))
        problems.push(`Unwanted folder: ${file}`);
      else await walk(file);
      continue;
    }
    count++;
    if (/\.(pdf|pptx|mp4|db|sqlite|zip|env)$/i.test(entry.name))
      problems.push(`Private or unwanted file: ${entry.name}`);
    if ((await stat(file)).size > 1024 * 1024)
      problems.push(`Review large file: ${entry.name}`);
    const content = await readFile(file, "utf8");
    if (
      /gh[pousr]_[A-Za-z0-9]{20}|github_pat_[A-Za-z0-9_]{20}|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/.test(
        content,
      )
    )
      problems.push(`Potential credential: ${entry.name}`);
    if (/C:\\Users\\|C:\\Codex\\/.test(content))
      problems.push(`Local path in public file: ${entry.name}`);
  }
}
await walk(root);
const html = await readFile(path.join(root, "index.html"), "utf8");
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) {
  try {
    await stat(path.join(root, match[1]));
  } catch {
    problems.push(`Missing asset: ${match[1]}`);
  }
}
for (const icon of ["friends", "chats", "search", "help"]) {
  try {
    const svg = await readFile(
      path.join(root, "assets/icons", icon + ".svg"),
      "utf8",
    );
    if (!svg.includes("<svg") || /<script|onload=|href="https?:/.test(svg))
      problems.push(`Invalid icon: ${icon}`);
  } catch {
    problems.push(`Missing icon: ${icon}`);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Release checks passed (${count} files): local assets, curated file scope, credential patterns.`,
  );
