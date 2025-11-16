// scripts/github-to-notion.js
// Sync a single GitHub issue to the Notion "Dev Tasks" database.

const fs = require("fs");

// ENV
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DEV_TASKS_DB_ID;
const githubEventPath = process.env.GITHUB_EVENT_PATH;

if (!notionToken || !databaseId || !githubEventPath) {
  console.error(
    "Missing NOTION_TOKEN, NOTION_DEV_TASKS_DB_ID, or GITHUB_EVENT_PATH env vars"
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

function getTitleFromIssue(issue) {
  return issue.title || "Untitled issue";
}

// Allowed status labels in GitHub (no prefixes)
const STATUS_LABELS = [
  "Backlog",
  "Ready",
  "In Progress",
  "Blocked",
  "Review",
  "Done",
  "Archived",
];

// Map common GitHub type labels → Notion `Type` values
const GITHUB_LABEL_TO_TYPE = {
  bug: "Bug",
  Bug: "Bug",

  enhancement: "Enhancement",
  Enhancement: "Enhancement",

  documentation: "Documentation",
  docs: "Documentation",

  question: "Question",
  "help wanted": "Help Wanted",

  feature: "Feature",
  Feature: "Feature",

  research: "Research",
  Research: "Research",

  improvement: "Improvement",
  Improvement: "Improvement",

  spike: "Spike",
  Spike: "Spike",
};

// Map GitHub Issue → Notion Status
function mapGithubToNotionStatus(issue) {
  const state = issue.state; // "open" or "closed"
  const labels = issue.labels || [];

  // Find first label that matches one of our status names
  let statusLabel = null;
  for (const label of labels) {
    if (label.name && STATUS_LABELS.includes(label.name)) {
      statusLabel = label.name;
      break;
    }
  }

  // If issue is closed → Done or Archived
  if (state === "closed") {
    if (statusLabel === "Archived") return "Archived";
    return "Done";
  }

  // Issue is open → use label if present, otherwise default to Backlog
  if (statusLabel) {
    return statusLabel;
  }

  return "Backlog";
}

// Extract Notion Type values from GitHub labels
function extractTypesFromIssue(issue) {
  const labels = issue.labels || [];
  const types = new Set();

  for (const label of labels) {
    const name = label.name;
    if (!name) continue;

    // Skip status labels
    if (STATUS_LABELS.includes(name)) continue;

    const mapped = GITHUB_LABEL_TO_TYPE[name] || null;
    if (mapped) {
      types.add(mapped);
    }
  }

  return Array.from(types); // array of Notion Type names
}

async function findTaskByIssueNumber(issueNumber) {
  const body = {
    filter: {
      property: "GitHub Issue ID",
      number: { equals: issueNumber },
    },
    page_size: 1,
  };

  const data = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return (data.results && data.results[0]) || null;
}

async function createTaskFromIssue(issue) {
  const title = getTitleFromIssue(issue);
  const status = mapGithubToNotionStatus(issue);
  const types = extractTypesFromIssue(issue);

  const body = {
    parent: { database_id: databaseId },
    properties: {
      Name: {
        title: [{ type: "text", text: { content: title } }],
      },
      Status: {
        select: { name: status },
      },
      Type: {
        multi_select: types.map((t) => ({ name: t })),
      },
      "GitHub Issue ID": {
        number: issue.number,
      },
      "GitHub URL": {
        url: issue.html_url,
      },
      Source: {
        select: { name: "GitHub" },
      },
      "Last Synced": {
        date: { start: new Date().toISOString() },
      },
    },
  };

  await notionFetch(`/pages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function updateTaskFromIssue(pageId, issue) {
  const title = getTitleFromIssue(issue);
  const status = mapGithubToNotionStatus(issue);
  const types = extractTypesFromIssue(issue);

  const body = {
    properties: {
      Name: {
        title: [{ type: "text", text: { content: title } }],
      },
      Status: {
        select: { name: status },
      },
      Type: {
        multi_select: types.map((t) => ({ name: t })),
      },
      "GitHub URL": {
        url: issue.html_url,
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
    const raw = fs.readFileSync(githubEventPath, "utf8");
    const event = JSON.parse(raw);

    const issue = event.issue;
    if (!issue) {
      console.log("No issue in event payload. Nothing to sync.");
      return;
    }

    console.log(`Syncing GitHub issue #${issue.number} → Notion...`);

    const existing = await findTaskByIssueNumber(issue.number);

    if (existing) {
      console.log("Existing Notion task found. Updating...");
      await updateTaskFromIssue(existing.id, issue);
    } else {
      console.log("No Notion task found. Creating...");
      await createTaskFromIssue(issue);
    }

    console.log("GitHub → Notion sync complete.");
  } catch (err) {
    console.error("Sync error:", err);
    process.exit(1);
  }
})();
