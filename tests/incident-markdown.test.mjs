import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKDOWN_EXTENSIONS,
  parseIncidentMarkdown,
} from "../scripts/incident-markdown.mjs";

const source = `---
id: api-delay
title: API request delays
status: investigating
impact: degraded
serviceIds: api, regosite
startedAt: 2026-09-09T12:00:00Z
---

## Updates

### 2026-09-09T12:00:00Z

We are investigating **request delays**. See [status](https://status.furries.ph).

### 2026-09-09T12:05:00Z

- Mitigation is in progress.
- Next update at 12:15 UTC.

#### Affected capabilities

| Capability | State |
| --- | --- |
| Requests | Degraded |

- [x] Mitigation started
[^status]: Additional operator context.
`;

test("incident Markdown produces a validated incident shape and retains Markdown updates", () => {
  const incident = parseIncidentMarkdown(source);
  assert.deepEqual(incident.serviceIds, ["api", "regosite"]);
  assert.equal(incident.updates.length, 2);
  assert.match(incident.updates[0].message, /\*\*request delays\*\*/);
  assert.match(incident.updates[1].message, /^- Mitigation/m);
  assert.match(incident.updates[1].message, /\| Capability \| State \|/);
});

test("all supported Markdown extensions are recognized", () => {
  for (const extension of [".md", ".markdown", ".mdown", ".mkd", ".mkdn", ".mdwn", ".mdtxt", ".mdtext", ".text", ".mdx", ".rmd"])
    assert.ok(MARKDOWN_EXTENSIONS.has(extension));
});

test("incident Markdown rejects missing front matter, updates and empty messages", () => {
  assert.throws(() => parseIncidentMarkdown("# no metadata"));
  assert.throws(() => parseIncidentMarkdown(source.replace("## Updates", "## Notes")));
  assert.throws(() => parseIncidentMarkdown(source.replace("We are investigating **request delays**. See [status](https://status.furries.ph).", "")));
});
