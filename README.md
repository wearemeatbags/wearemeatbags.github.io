# Meatbags

Public game hub for Meatbags.

- Site: <https://wearemeatbags.github.io/>

The page is static HTML, CSS, and JavaScript served by GitHub Pages from the
repository root.

## Game discovery

The hub discovers games from public repositories in the `wearemeatbags`
organization. A game appears automatically when its repository:

- is public
- has the `meatbags-game` topic
- has GitHub Pages enabled
- uses its repository homepage as the playable URL

For project pages, the playable URL convention is:

```text
https://wearemeatbags.github.io/<repo-name>/
```

The repository description is used as catalog copy unless `site.js` provides a
short curated description. The hand-maintained fallback list keeps BOLL and
SplitBeat playable when GitHub's unauthenticated API is unavailable.

## Version picker

The main **Play** link always opens the newest build at the game root. For each
game, the hub also requests:

```text
<playable-url>/versions/index.json
```

The current deployment workflow publishes a newest-first array:

```json
[
  {
    "id": "abcdef0",
    "date": "2026-07-11T12:00:00.000Z",
    "message": "Release a new game version"
  }
]
```

The hub derives friendly labels such as **Version 1** and **Version 2** from
the array order and links directly to `versions/<id>/`. It also accepts the
schema-versioned object format reserved for a future deployment migration.
Missing or invalid manifests leave Play and Source intact and simply omit the
Versions control.
