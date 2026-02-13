# DayPilot — Daily Planner

A modern, fully client-side daily planning tool to organize tasks, set priorities, and track your progress throughout the day.

## Key Features

| Feature | Description |
|---|---|
| **Task Management** | Add, complete, and delete tasks with title, priority, and optional notes |
| **Priority System** | High / Medium / Low priorities with color-coded badges |
| **Dashboard** | Live stats — total, completed, pending counts and a progress bar |
| **Filter & Sort** | Filter by All / Active / Completed; sort by Priority or Newest |
| **AI Plan** | Enter your goal and time budget to auto-generate suggested tasks |
| **Persistence** | All tasks saved in `localStorage` — survives page refreshes |
| **Responsive** | Works on desktop and mobile devices |

## How Data Is Stored

Tasks are stored in the browser's **localStorage** under the key `daypilot-tasks` as a JSON array. Each task object contains:

```json
{
  "id": "unique-id",
  "title": "Task title",
  "note": "Optional note",
  "priority": "high | medium | low",
  "completed": false,
  "createdAt": 1707840000000
}
```

No server, no database, no login required. Data stays in your browser.

## Run Locally

1. Clone or download this folder.
2. Open `index.html` directly in your browser, **or** serve it with any static server:

```bash
npx -y serve .
```

3. Visit the URL shown in the terminal (usually `http://localhost:3000`).
