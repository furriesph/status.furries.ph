import { readFile } from "node:fs/promises";
import {
  validateServices,
  validateIncidents,
  validateSnapshot,
} from "./status-core.mjs";
import { loadIncidentMarkdown } from "./incident-markdown.mjs";
const read = async (path) =>
  JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const services = validateServices(await read("config/services.json"));
validateIncidents(
  await loadIncidentMarkdown(new URL("../content/incidents/", import.meta.url)),
  services,
);
validateSnapshot(await read("public/status.json"), services);
console.log(
  `Validated ${services.length} services, incident configuration and status snapshot.`,
);
