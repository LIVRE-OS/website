// scripts/github-to-notion.js
// Sync GitHub Issues -> Notion "Dev Tasks" database using the Notion API.

const [, , issueNumber, issueTitle, issueUrl, action] = process.argv;

if (!issueNumber || !issueTitle || !issueUrl || !action) {
  console.error("Missing arguments. Usage: node github-to-notion.js <number> <title> <url> <action>");
  process.exit(1);
}

const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DEV_TASKS_DB_ID;

if (!notionToken || !databaseId) {
  console.error("Missing NOTION_TOKEN or NOTION_DEV_TASKS_DB_ID env vars");
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
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

async function findExistingTask(issueNum) {
  const body = {
    filter: {
      property: "GitHub Issue ID",
      number: { equals: Number(issueNum) },
    },
  };

  const data = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.results?.[0] || null;
}

function getStatusFromAction(action) {
  if (action === "closed") return "Done";
  return "Backlog"; // opened / edited
}

async function createTask(issueNum, title, url, action) {
  const status = getStatusFromAction(action);

  const body = {
    parent: { database_id: databaseId },
    properties: {
      Name: {
        title: [{ text: { content: title } }],
      },
      Status: {
        select: { name: status },
      },
      "GitHub Issue ID": {
        number: Number(issueNum),
      },
      "GitHub URL": {
        url,
      },
      Source: {
        select: { name: "GitHub" },
      },
      "Last Synced": {
        date: { start: new Date().toISOString() },
      },
    },
  };

  await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log("Created Notion task for issue", issueNum);
}

async function updateTask(pageId, issueNum, title, url, action) {
  const status = getStatusFromAction(action);

  const body = {
    properties: {
      Name: {
        title: [{ text: { content: title } }],
      },
      Status: {
        select: { name: status },
      },
      "GitHub URL": {
        url,
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

  console.log("Updated Notion task for issue", issueNum);
}

(async () => {
  try {
    const existing = await findExistingTask(issueNumber);

    if (!existing && action !== "deleted") {
      await createTask(issueNumber, issueTitle, issueUrl, action);
    } else if (existing) {
      await updateTask(existing.id, issueNumber, issueTitle, issueUrl, action);
    } else {
      console.log("Issue deleted and no existing task; nothing to do.");
    }
  } catch (err) {
    console.error("Sync error:", err);
    process.exit(1);
  }
})();
