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
