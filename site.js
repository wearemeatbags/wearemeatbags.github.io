const ORG = "wearemeatbags";
const HUB_REPO = `${ORG}.github.io`;
const GAME_TOPIC = "meatbags-game";
const GAME_LIST_ID = "game-list";

const titleForRepo = (name) => name.replaceAll("-", " ").toUpperCase();

const playUrlForRepo = (repo) =>
  repo.homepage || `https://${ORG}.github.io/${repo.name}/`;

const gameFromRepo = (repo) => ({
  title: titleForRepo(repo.name),
  description: repo.description || "Browser game",
  playUrl: playUrlForRepo(repo),
  sourceUrl: repo.html_url,
});

const hasGameTopic = (repo) => repo.topics?.includes(GAME_TOPIC);

const isVisibleGameRepo = (repo) =>
  repo.name !== HUB_REPO && !repo.archived && hasGameTopic(repo);

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

const renderGames = (list, games) => {
  list.replaceChildren();

  for (const game of games) {
    const row = document.createElement("li");
    row.className = "game-row";

    const title = createLink("game-title", game.playUrl, game.title);

    const description = document.createElement("p");
    description.className = "game-description";
    description.textContent = game.description;

    const actions = document.createElement("nav");
    actions.className = "game-actions";
    actions.setAttribute("aria-label", `${game.title} links`);
    actions.append(
      createLink("", game.playUrl, "Play"),
      createLink("", game.sourceUrl, "Source"),
    );

    row.append(title, description, actions);
    list.append(row);
  }
};

const fetchGameRepos = async () => {
  const params = new URLSearchParams({
    type: "public",
    per_page: "100",
    sort: "updated",
  });
  const response = await fetch(`https://api.github.com/orgs/${ORG}/repos?${params}`);

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}`);
  }

  return response.json();
};

const loadGames = async () => {
  const list = document.getElementById(GAME_LIST_ID);
  if (!list) return;

  try {
    const repos = await fetchGameRepos();
    const games = repos
      .filter(isVisibleGameRepo)
      .map(gameFromRepo)
      .sort((a, b) => a.title.localeCompare(b.title));

    if (games.length === 0) {
      renderStatus(list, "No public games are tagged yet.");
      return;
    }

    renderGames(list, games);
  } catch (error) {
    renderStatus(list, "Games could not be loaded.");
  }
};

loadGames();
