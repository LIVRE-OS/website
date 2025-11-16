// scripts/notion-to-github.js
// Create GitHub Issues for Notion Dev Tasks that don't yet have an Issue ID.

const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DEV_TASKS_DB_ID;
const githubToken = process.env.GITHUB_TOKEN;
const repoFull = process.env.GITHUB_REPOSITORY; // e.g. LIVRE-OS/website

if (!notionToken || !databaseId || !githubToken || !repoFull) {
  console.error("Missing NOTION_TOKEN, NOTION_DEV_TASKS_DB_ID, GITHUB_TOKEN, or GITHUB_REPOSITORY env vars");
  process.exit(1);
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function notionFetch(path, options = {}) {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Notion API error:", text);
    throw new Error(`Notion request failed: ${res.status}`);
  }

  return res.json();
}

function getTitleFromPage(page) {
  const titleProp = page.properties?.Name;
  if (!titleProp || !titleProp.title || titleProp.title.length === 0) {
    return "Untitled task";
  }
  return titleProp.title.map(t => t.plain_text).join("");
}

function getStatusFromPage(page) {
  const statusProp = page.properties?.Status;
  if (!statusProp || !statusProp.select) return "Backlog";
  return statusProp.select.name || "Backlog";
}

async function fetchTasksNeedingIssues() {
  const body = {
    filter: {
      property: "GitHub Issue ID",
      number: { is_empty: true },
    },
    page_size: 10, // safety limit per run
  };

  const data = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.results || [];
}

async function createGithubIssue(title, body) {
  const url = `https://api.github.com/repos/${repoFull}/issues`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      "Accept": "application/vnd.github+json",
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("GitHub API error:", text);
    throw new Error(`GitHub request failed: ${res.status}`);
  }

  const data = await res.json();
  return { number: data.number, html_url: data.html_url };
}

async function updateNotionTask(pageId, issueNumber, issueUrl) {
  const body = {
    properties: {
      "GitHub Issue ID": {
        number: Number(issueNumber),
      },
      "GitHub URL": {
        url: issueUrl,
      },
      "Source": {
        select: { name: "GitHub" },
      },
      "Last Synced": {
        date: { start: new Date().toISOString() },
      },
    },
  };

  await notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

(async () => {
  try {
    console.log("Querying Notion for tasks without GitHub Issue ID...");
    const tasks = await fetchTasksNeedingIssues();

    if (!tasks.length) {
      console.log("No tasks need GitHub issues. Done.");
      return;
    }

    console.log(`Found ${tasks.length} task(s) to sync.`);

    for (const page of tasks) {
      const title = getTitleFromPage(page);
      const status = getStatusFromPage(page);
      const notionUrl = page.url;

      const body = `Synced from Notion Dev Tasks.\n\nNotion task: ${notionUrl}\nStatus: ${status}`;

      console.log(`Creating GitHub issue for Notion page ${page.id} with title "${title}"`);
      const { number, html_url } = await createGithubIssue(title, body);

      console.log(`Created GitHub issue #${number} — updating Notion...`);
      await updateNotionTask(page.id, number, html_url);
    }

    console.log("Notion → GitHub sync complete.");
  } catch (err) {
    console.error("Sync error:", err);
    process.exit(1);
  }
})();
