const ORG = "wearemeatbags";
const HUB_REPO = `${ORG}.github.io`;
const GAME_TOPIC = "meatbags-game";
const GAME_LIST_ID = "game-list";
const MANIFEST_SCHEMA_VERSION = 1;
const MAX_MANIFEST_BYTES = 1_000_000;
const MAX_VERSIONS = 1_000;
const MANIFEST_TIMEOUT_MS = 5_000;
const REPOS_PER_PAGE = 100;
const MAX_REPO_PAGES = 10;
const CURATED_DESCRIPTIONS = Object.freeze({
  boll: "Flick and steer a two-axis paddle to keep a square ball alive.",
  splitbeat: "Dodge space hazards with one hand while answering timed trivia with the other.",
});

const titleForRepo = (name) => name.replaceAll("-", " ").toUpperCase();

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const boundedString = (value, maxLength) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) return null;
  return text;
};

const isValidDate = (value) =>
  typeof value === "string" &&
  value.length <= 40 &&
  /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) &&
  Number.isFinite(Date.parse(value));

const fallbackPlayUrl = (repoName) =>
  `https://${ORG}.github.io/${encodeURIComponent(repoName)}/`;

const normalizeDirectoryUrl = (value, fallback) => {
  try {
    const url = new URL(value || fallback);
    if (url.protocol !== "https:" || url.username || url.password) return fallback;
    url.search = "";
    url.hash = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url.href;
  } catch {
    return fallback;
  }
};

const normalizeHttpsUrl = (value, fallback) => {
  try {
    const url = new URL(value || fallback);
    if (url.protocol !== "https:" || url.username || url.password) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
};

const gameFromRepo = (repo) => {
  const fallback = fallbackPlayUrl(repo.name);
  const playUrl = normalizeDirectoryUrl(repo.homepage, fallback);
  const curatedDescription = CURATED_DESCRIPTIONS[repo.name.toLowerCase()];
  return {
    slug: repo.name,
    title: titleForRepo(repo.name),
    description:
      curatedDescription ||
      (typeof repo.description === "string" && repo.description.trim()
        ? repo.description.trim()
        : "Browser game"),
    playUrl,
    sourceUrl: normalizeHttpsUrl(
      repo.html_url,
      `https://github.com/${ORG}/${encodeURIComponent(repo.name)}`,
    ),
    manifestUrl: new URL("versions/index.json", playUrl).href,
  };
};

const fallbackGames = [
  gameFromRepo({
    name: "boll",
    description: "Paddle Juggle",
    homepage: `https://${ORG}.github.io/boll/`,
    html_url: `https://github.com/${ORG}/boll`,
  }),
  gameFromRepo({
    name: "splitbeat",
    description: "Dual-attention rhythm and trivia",
    homepage: `https://${ORG}.github.io/splitbeat/`,
    html_url: `https://github.com/${ORG}/splitbeat`,
  }),
];

const hasGameTopic = (repo) => repo.topics?.includes(GAME_TOPIC);

const isVisibleGameRepo = (repo) =>
  isRecord(repo) &&
  typeof repo.name === "string" &&
  /^[a-z0-9._-]{1,100}$/i.test(repo.name) &&
  repo.name !== HUB_REPO &&
  repo.has_pages === true &&
  !repo.archived &&
  hasGameTopic(repo);

const createLink = (className, href, text) => {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.textContent = text;
  return link;
};

const renderStatus = (list, message) => {
  list.replaceChildren();
  const row = document.createElement("li");
  row.className = "game-row game-row-status";
  row.textContent = message;
  list.append(row);
};

const safeVersionUrl = (rawUrl, versionId, manifestUrl) => {
  const versionsRoot = new URL("./", manifestUrl);
  try {
    const url = new URL(rawUrl, manifestUrl);
    const expected = new URL(`./${encodeURIComponent(versionId)}/`, versionsRoot);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.origin !== versionsRoot.origin ||
      url.search ||
      url.hash ||
      url.href !== expected.href
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
};

const validateVersion = (rawVersion, manifestUrl) => {
  if (!isRecord(rawVersion)) return null;

  const id = boundedString(rawVersion.id, 80);
  const tag = boundedString(rawVersion.tag, 80);
  const label = boundedString(rawVersion.label, 120);
  const commit = boundedString(rawVersion.commit, 64);
  const shortCommit = boundedString(rawVersion.shortCommit, 16);
  const message = boundedString(rawVersion.message, 240);
  if (
    !id ||
    !/^[a-z0-9][a-z0-9._-]*$/i.test(id) ||
    !tag ||
    !/^[a-z0-9][a-z0-9._-]*$/i.test(tag) ||
    !label ||
    !commit ||
    !/^[a-f0-9]{40}$/i.test(commit) ||
    !shortCommit ||
    !/^[a-f0-9]{7,12}$/i.test(shortCommit) ||
    !commit.toLowerCase().startsWith(shortCommit.toLowerCase()) ||
    !isValidDate(rawVersion.date) ||
    !message
  ) {
    return null;
  }

  const url = safeVersionUrl(rawVersion.url, id, manifestUrl);
  if (!url) return null;
  return { id, tag, label, commit, shortCommit, date: rawVersion.date, message, url };
};

const validateLegacyManifest = (rawManifest, game) => {
  if (
    rawManifest.length === 0 ||
    rawManifest.length > MAX_VERSIONS
  ) {
    return null;
  }

  const versions = rawManifest.map((rawVersion, index) => {
    if (!isRecord(rawVersion)) return null;
    const id = boundedString(rawVersion.id, 16);
    const message = boundedString(rawVersion.message, 240);
    if (!id || !/^[a-f0-9]{7,12}$/i.test(id) || !isValidDate(rawVersion.date) || !message) {
      return null;
    }

    const versionNumber = rawManifest.length - index;
    return {
      id,
      tag: null,
      label: `Version ${versionNumber}`,
      commit: id,
      shortCommit: id,
      date: rawVersion.date,
      message,
      url: new URL(`./${encodeURIComponent(id)}/`, game.manifestUrl).href,
    };
  });
  if (versions.some((version) => version === null)) return null;

  const validVersions = versions;
  const ids = new Set(validVersions.map((version) => version.id));
  if (ids.size !== validVersions.length) return null;

  return {
    latest: validVersions[0].id,
    generatedAt: validVersions[0].date,
    versions: validVersions,
  };
};

const validateManifest = (rawManifest, game) => {
  if (Array.isArray(rawManifest)) return validateLegacyManifest(rawManifest, game);
  if (
    !isRecord(rawManifest) ||
    rawManifest.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
    rawManifest.game !== game.slug ||
    !isValidDate(rawManifest.generatedAt) ||
    !Array.isArray(rawManifest.versions) ||
    rawManifest.versions.length === 0 ||
    rawManifest.versions.length > MAX_VERSIONS
  ) {
    return null;
  }

  const latest = boundedString(rawManifest.latest, 80);
  if (!latest) return null;

  const versions = rawManifest.versions.map((version) =>
    validateVersion(version, game.manifestUrl),
  );
  if (versions.some((version) => version === null)) return null;

  const validVersions = versions;
  const ids = new Set(validVersions.map((version) => version.id));
  const tags = new Set(validVersions.map((version) => version.tag));
  const urls = new Set(validVersions.map((version) => version.url));
  if (
    ids.size !== validVersions.length ||
    tags.size !== validVersions.length ||
    urls.size !== validVersions.length ||
    validVersions[0].id !== latest
  ) {
    return null;
  }

  return {
    latest,
    generatedAt: rawManifest.generatedAt,
    versions: validVersions,
  };
};

const fetchVersionManifest = async (game) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const response = await fetch(game.manifestUrl, {
      cache: "no-cache",
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const declaredBytes = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_MANIFEST_BYTES) return null;
    const source = await response.text();
    if (source.length > MAX_MANIFEST_BYTES) return null;
    return validateManifest(JSON.parse(source), game);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const formatDate = (value) => dateFormatter.format(new Date(value));

const displayLabelForVersion = (version) => {
  if (!version.tag) return version.label;
  if (version.label !== version.tag) return version.label;
  const sequentialTag = /^v0\.0\.(\d+)$/.exec(version.tag);
  return sequentialTag ? `Version ${Number(sequentialTag[1])}` : version.label;
};

const createVersionsDisclosure = (game, manifest) => {
  const details = document.createElement("details");
  details.className = "game-versions";
  details.dataset.generatedAt = manifest.generatedAt;

  const summary = document.createElement("summary");
  summary.className = "versions-summary";
  summary.setAttribute("aria-label", `Browse ${game.title} versions`);

  const indicator = document.createElement("span");
  indicator.className = "versions-indicator";
  indicator.setAttribute("aria-hidden", "true");

  const summaryLabel = document.createElement("span");
  summaryLabel.textContent = "Versions";
  const count = document.createElement("span");
  count.className = "versions-count";
  count.textContent = String(manifest.versions.length);
  summary.append(summaryLabel, count, indicator);

  const list = document.createElement("ol");
  list.className = "version-list";
  for (const version of manifest.versions) {
    const item = document.createElement("li");
    item.className = "version-item";

    const displayLabel = displayLabelForVersion(version);
    const tagDescription = version.tag ? `, tag ${version.tag}` : "";
    const link = createLink("version-link", version.url, "");
    link.setAttribute(
      "aria-label",
      `Play ${game.title} ${displayLabel}${tagDescription}, ${formatDate(version.date)}, commit ${version.shortCommit}${version.id === manifest.latest ? ", current version" : ""}: ${version.message}`,
    );

    const identity = document.createElement("span");
    identity.className = "version-identity";
    const label = document.createElement("strong");
    label.className = "version-label";
    label.textContent = displayLabel;
    identity.append(label);
    if (version.tag && version.tag !== displayLabel) {
      const tag = document.createElement("span");
      tag.className = "version-tag";
      tag.textContent = version.tag;
      identity.append(tag);
    }
    if (version.id === manifest.latest) {
      const current = document.createElement("span");
      current.className = "version-current";
      current.textContent = "Latest";
      identity.append(current);
    }

    const meta = document.createElement("span");
    meta.className = "version-meta";
    const date = document.createElement("time");
    date.dateTime = version.date;
    date.textContent = formatDate(version.date);
    const commit = document.createElement("code");
    commit.textContent = version.shortCommit;
    commit.title = version.commit;
    meta.append(date, commit);

    const message = document.createElement("span");
    message.className = "version-message";
    message.textContent = version.message;

    const play = document.createElement("span");
    play.className = "version-play";
    play.textContent = "Play";
    play.setAttribute("aria-hidden", "true");

    link.append(identity, meta, message, play);
    item.append(link);
    list.append(item);
  }

  details.append(summary, list);
  details.addEventListener("toggle", () => {
    if (!details.open) return;
    for (const openDetails of document.querySelectorAll(".game-versions[open]")) {
      if (openDetails !== details) openDetails.open = false;
    }
  });
  details.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !details.open) return;
    event.preventDefault();
    details.open = false;
    summary.focus();
  });
  return details;
};

const renderGames = async (list, games) => {
  const catalogEntries = await Promise.all(
    games.map(async (game) => ({ game, manifest: await fetchVersionManifest(game) })),
  );
  list.replaceChildren();

  for (const { game, manifest } of catalogEntries) {
    const row = document.createElement("li");
    row.className = "game-row";

    const title = createLink("game-title", game.playUrl, game.title);

    const description = document.createElement("p");
    description.className = "game-description";
    description.textContent = game.description;

    const actions = document.createElement("nav");
    actions.className = "game-actions";
    actions.setAttribute("aria-label", `${game.title} links`);
    actions.append(createLink("game-play", game.playUrl, "Play"));
    if (manifest) actions.append(createVersionsDisclosure(game, manifest));
    actions.append(createLink("game-source", game.sourceUrl, "Source"));

    row.append(title, description, actions);
    list.append(row);
  }
};

const fetchGameRepos = async () => {
  const repos = [];
  for (let page = 1; page <= MAX_REPO_PAGES; page += 1) {
    const params = new URLSearchParams({
      type: "public",
      per_page: String(REPOS_PER_PAGE),
      page: String(page),
      sort: "updated",
    });
    const response = await fetch(`https://api.github.com/orgs/${ORG}/repos?${params}`);
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

    const pageRepos = await response.json();
    if (!Array.isArray(pageRepos)) throw new Error("GitHub returned an invalid repository list");
    repos.push(...pageRepos);
    if (pageRepos.length < REPOS_PER_PAGE) break;
  }
  return repos;
};

const mergeFallbackGames = (games) => {
  const bySlug = new Map(games.map((game) => [game.slug, game]));
  for (const fallback of fallbackGames) {
    if (!bySlug.has(fallback.slug)) bySlug.set(fallback.slug, fallback);
  }
  return [...bySlug.values()].sort((a, b) => a.title.localeCompare(b.title));
};

const loadGames = async () => {
  const list = document.getElementById(GAME_LIST_ID);
  if (!list) return;

  try {
    const repos = await fetchGameRepos();
    const games = mergeFallbackGames(
      repos.filter(isVisibleGameRepo).map(gameFromRepo),
    );

    if (games.length === 0) {
      renderStatus(list, "No public games are tagged yet.");
      return;
    }

    await renderGames(list, games);
  } catch {
    // Keep the hand-maintained fallback playable when the unauthenticated
    // GitHub API is unavailable, and still attempt its version manifest.
    await renderGames(list, fallbackGames);
  }
};

loadGames();
