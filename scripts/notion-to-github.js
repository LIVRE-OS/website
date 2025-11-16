// scripts/notion-to-github.js
// Sync Notion "Dev Tasks" → GitHub Issues (create + close).

const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DEV_TASKS_DB_ID;
const githubToken = process.env.GITHUB_TOKEN;
const repoFull = process.env.GITHUB_REPOSITORY; // e.g. LIVRE-OS/website

if (!notionToken || !databaseId || !githubToken || !repoFull) {
  console.error(
    "Missing NOTION_TOKEN, NOTION_DEV_TASKS_DB_ID, GITHUB_TOKEN, or GITHUB_REPOSITORY env vars"
  );
  process.exit(1);
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ---------- Notion helpers ----------

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
  return titleProp.title.map((t) => t.plain_text).join("");
}

function getStatusFromPage(page) {
  const statusProp = page.properties?.Status;
  if (!statusProp || !statusProp.select) return "Backlog";
  return statusProp.select.name || "Backlog";
}

// Map Notion Status → GitHub state + status label
function mapNotionStatusToGithubMeta(status) {
  let state = "open";
  let label = "status/backlog";

  switch (status) {
    case "Ready":
      label = "status/ready";
      break;
    case "In Progress":
      label = "status/in-progress";
      break;
    case "Blocked":
      label = "status/blocked";
      break;
    case "Review":
      label = "status/review";
      break;
    case "Done":
      label = "status/done";
      state = "closed";
      break;
    case "Archived":
      label = "status/archived";
      state = "closed";
      break;
    case "Backlog":
    default:
      label = "status/backlog";
      break;
  }

  return {
    state, // "open" or "closed"
    labels: [label],
  };
}

// ---------- GitHub helpers ----------

async function createGithubIssue(title, body, state, labels) {
  const url = `https://api.github.com/repos/${repoFull}/issues`;

  const payload = { title, body, labels };

  if (state === "closed") {
    payload.state = "closed";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("GitHub API error:", text);
    throw new Error(`GitHub request failed: ${res.status}`);
  }

  const data = await res.json();
  return { number: data.number, html_url: data.html_url };
}

async function closeGithubIssue(issueNumber, status) {
  const url = `https://api.github.com/repos/${repoFull}/issues/${issueNumber}`;

  const { labels } = mapNotionStatusToGithubMeta(status);

  const payload = {
    state: "closed",
    labels,
  };

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("GitHub API error (closing issue):", text);
    throw new Error(`GitHub request failed: ${res.status}`);
  }
}

// ---------- Notion queries ----------

// Tasks without GitHub Issue ID → need issues created
async function fetchTasksNeedingIssues() {
  const body = {
    filter: {
      property: "GitHub Issue ID",
      number: { is_empty: true },
    },
    page_size: 10,
  };

  const data = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.results || [];
}

// Tasks with Issue ID and Status Done/Archived → close issues
async function fetchTasksToClose() {
  const body = {
    filter: {
      and: [
        {
          property: "GitHub Issue ID",
          number: { is_not_empty: true },
        },
        {
          or: [
            { property: "Status", select: { equals: "Done" } },
            { property: "Status", select: { equals: "Archived" } },
          ],
        },
      ],
    },
    page_size: 20,
  };

  const data = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.results || [];
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
      Source: {
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

// ---------- Main ----------

(async () => {
  try {
    // 1) Create missing issues
    console.log("Querying Notion for tasks without GitHub Issue ID...");
    const tasks = await fetchTasksNeedingIssues();

    console.log(`Found ${tasks.length} task(s) to sync (create issues).`);

    for (const page of tasks) {
      const title = getTitleFromPage(page);
      const status = getStatusFromPage(page);
      const notionUrl = page.url;

      const { state, labels } = mapNotionStatusToGithubMeta(status);

      const body = `Synced from Notion Dev Tasks.\n\nNotion task: ${notionUrl}\nStatus: ${status}`;

      console.log(
        `Creating GitHub issue for Notion page ${page.id} with title "${title}" and status "${status}"`
      );
      const { number, html_url } = await createGithubIssue(
        title,
        body,
        state,
        labels
      );

      console.log(`Created GitHub issue #${number} — updating Notion...`);
      await updateNotionTask(page.id, number, html_url);
    }

    // 2) Close issues when Notion says Done / Archived
    console.log("Looking for tasks that should close GitHub issues...");
    const toClose = await fetchTasksToClose();

    console.log(`Found ${toClose.length} task(s) that should close issues.`);

    for (const page of toClose) {
      const props = page.properties || {};
      const issueIdProp = props["GitHub Issue ID"];

      if (!issueIdProp || typeof issueIdProp.number !== "number") {
        continue;
      }

      const issueNumber = issueIdProp.number;
      const status = getStatusFromPage(page);

      console.log(
        `Closing GitHub issue #${issueNumber} because Notion status is "${status}".`
      );
      await closeGithubIssue(issueNumber, status);
      await updateNotionTask(page.id, issueNumber, props["GitHub URL"]?.url);
    }

    console.log("Notion → GitHub sync complete.");
  } catch (err) {
    console.error("Sync error:", err);
    process.exit(1);
  }
})();
