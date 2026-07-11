import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../site.js", import.meta.url), "utf8");
const context = vm.createContext({
  AbortController,
  Date,
  Intl,
  URL,
  URLSearchParams,
  console,
  document: { getElementById: () => null },
  fetch,
  window: { clearTimeout, setTimeout },
});

new vm.Script(
  `${source}\n;globalThis.__siteTest = { displayLabelForVersion, gameFromRepo, validateManifest };`,
  { filename: "site.js" },
).runInContext(context);

const { displayLabelForVersion, gameFromRepo, validateManifest } = context.__siteTest;
const game = gameFromRepo({
  name: "splitbeat",
  description: "Repository copy that should be overridden",
  homepage: "https://wearemeatbags.github.io/splitbeat/",
  html_url: "https://github.com/wearemeatbags/splitbeat",
});

test("uses curated catalog descriptions", () => {
  assert.equal(
    game.description,
    "Dodge space hazards with one hand while answering timed trivia with the other.",
  );
});

test("maps the legacy newest-first manifest to friendly sequential versions", () => {
  const manifest = validateManifest(
    [
      {
        id: "abcdef0",
        date: "2026-07-11T16:00:00.000Z",
        message: "Release spaceship gameplay",
      },
      {
        id: "4721e08",
        date: "2026-07-10T03:07:27.000Z",
        message: "Release rhythm highway gameplay",
      },
    ],
    game,
  );

  assert.ok(manifest);
  assert.equal(manifest.latest, "abcdef0");
  assert.deepEqual(
    Array.from(manifest.versions, (version) => ({
      id: version.id,
      label: version.label,
      tag: version.tag,
      url: version.url,
    })),
    [
      {
        id: "abcdef0",
        label: "Version 2",
        tag: null,
        url: "https://wearemeatbags.github.io/splitbeat/versions/abcdef0/",
      },
      {
        id: "4721e08",
        label: "Version 1",
        tag: null,
        url: "https://wearemeatbags.github.io/splitbeat/versions/4721e08/",
      },
    ],
  );
});

test("rejects duplicate legacy version identifiers", () => {
  const duplicate = {
    id: "4721e08",
    date: "2026-07-10T03:07:27.000Z",
    message: "Duplicate release",
  };
  assert.equal(validateManifest([duplicate, duplicate], game), null);
});

test("keeps schema-versioned manifests compatible with friendly display labels", () => {
  const manifest = validateManifest(
    {
      schemaVersion: 1,
      game: "splitbeat",
      latest: "v0.0.2",
      generatedAt: "2026-07-11T16:00:00.000Z",
      versions: [
        {
          id: "v0.0.2",
          tag: "v0.0.2",
          label: "v0.0.2",
          commit: "abcdef0123456789abcdef0123456789abcdef01",
          shortCommit: "abcdef0",
          date: "2026-07-11T16:00:00.000Z",
          message: "Release spaceship gameplay",
          url: "./v0.0.2/",
        },
      ],
    },
    game,
  );

  assert.ok(manifest);
  assert.equal(displayLabelForVersion(manifest.versions[0]), "Version 2");
});
