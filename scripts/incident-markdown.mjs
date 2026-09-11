import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const MARKDOWN_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".mdown",
  ".mkd",
  ".mkdn",
  ".mdwn",
  ".mdtxt",
  ".mdtext",
  ".text",
  ".mdx",
  ".rmd",
]);

const fail = (message) => {
  throw new Error(`Invalid incident Markdown: ${message}`);
};

function parseFrontMatter(source) {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) fail("front matter is required");
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) fail("front matter must end with ---");
  const fields = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator < 1) fail("front matter fields must use key: value");
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || !value || fields[key])
      fail("front matter contains an invalid or duplicate field");
    fields[key] = value;
  }
  return { fields, body: normalized.slice(end + 5).trim() };
}

function parseUpdates(body) {
  const heading = /^##\s+updates\s*$/im.exec(body);
  if (!heading) fail("an Updates heading is required");
  const section = body.slice(heading.index + heading[0].length).trim();
  const matches = [...section.matchAll(/^###\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)\s*$/gm)];
  if (!matches.length) fail("each update needs a level-three UTC timestamp heading");
  const updates = matches.map((match, index) => {
    const at = match[1];
    const next = matches[index + 1]?.index ?? section.length;
    const message = section
      .slice(match.index + match[0].length, next)
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();
    if (!message) fail("each update needs Markdown content");
    return { at, message };
  });
  return updates;
}

export function parseIncidentMarkdown(source) {
  const { fields, body } = parseFrontMatter(source);
  const allowed = new Set([
    "id",
    "title",
    "status",
    "impact",
    "serviceIds",
    "startedAt",
    "resolvedAt",
    "endsAt",
  ]);
  if (Object.keys(fields).some((key) => !allowed.has(key)))
    fail("front matter contains an unsupported field");
  for (const key of ["id", "title", "status", "impact", "serviceIds", "startedAt"])
    if (!fields[key]) fail(`${key} is required`);
  const serviceIds = fields.serviceIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!serviceIds.length) fail("serviceIds must list at least one ID");
  return {
    id: fields.id,
    title: fields.title,
    status: fields.status,
    impact: fields.impact,
    serviceIds,
    startedAt: fields.startedAt,
    ...(fields.resolvedAt ? { resolvedAt: fields.resolvedAt } : {}),
    ...(fields.endsAt ? { endsAt: fields.endsAt } : {}),
    updates: parseUpdates(body),
  };
}

export async function loadIncidentMarkdown(directoryUrl) {
  let entries;
  try {
    entries = await readdir(fileURLToPath(directoryUrl), { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const files = entries
    .filter((entry) => entry.isFile() && MARKDOWN_EXTENSIONS.has(extension(entry.name)))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  return Promise.all(
    files.map(async (name) => {
      try {
        return parseIncidentMarkdown(await readFile(new URL(name, directoryUrl), "utf8"));
      } catch (error) {
        throw new Error(`Incident file ${name}: ${error.message}`);
      }
    }),
  );
}

function extension(name) {
  const match = /\.[^.]+$/.exec(name.toLowerCase());
  return match?.[0] ?? "";
}
