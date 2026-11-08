// Captures README screenshots of each tab using made-up sample data.
// Run with: npm run screenshots   (writes docs/screenshots/*.png)
//
// Uses a throwaway data folder, so your real saved data is never read or shown.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');
const WIDTH = 1440;
const HEIGHT = 960;

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'myday-screenshots-')));

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};
const atTime = (hours, minutes) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

let nextId = 0;
const task = (text, dayOffset, energyLevel, estimatedPomodoros, completed = false) => ({
  id: `task-${++nextId}`,
  text,
  date: dayKey(addDays(dayOffset)),
  completed,
  energyLevel,
  estimatedPomodoros
});

function sampleState() {
  const tasks = [
    task('Morning stretch', 0, 'low', 1, true),
    task('Write project proposal draft', 0, 'high', 4),
    task('Reply to emails', 0, 'medium', 1, true),
    task('Review pull requests', 0, 'medium', 2),
    task('Evening walk', 0, 'low', 1),
    task('Plan sprint goals', 1, 'high', 3),
    task('Grocery shopping', 1, 'low', 1),
    task('Read a chapter', 2, 'low', 1),
    task('Prepare slides', 3, 'high', 3),
    task('Team retro notes', 3, 'medium', 1),
    task('Call family', 5, 'low', 1)
  ];
  const session = (taskIndex, completedAt, durationMinutes, note) => ({
    id: `session-${++nextId}`,
    taskId: tasks[taskIndex].id,
    taskName: tasks[taskIndex].text,
    completedAt,
    durationMinutes,
    ...(note ? { note } : {})
  });

  return {
    version: 2,
    settings: { theme: 'dark' },
    checkins: {
      water: {
        glasses: 5,
        lastDrink: minutesAgo(25),
        reminderMinutes: 40,
        notify: true,
        goal: 8,
        lastReminderAt: minutesAgo(25),
        date: new Date().toDateString()
      },
      meals: [
        { id: 'meal-1', name: 'Oatmeal with berries', time: atTime(8, 15) },
        { id: 'meal-2', name: 'Veggie wrap', time: atTime(12, 40) }
      ],
      energy: 4,
      feelings: {
        [dayKey(new Date())]: {
          physical: 'Rested after a good night of sleep',
          mental: 'Focused and a little excited'
        }
      },
      mealReminder: { enabled: true, time: '19:00', date: dayKey(new Date()), notified: false }
    },
    work: {
      tasks,
      sessions: [
        session(2, atTime(9, 30), 25),
        session(1, atTime(10, 10), 25, 'Outlined the main sections'),
        session(1, atTime(10, 45), 25),
        session(3, atTime(14, 5), 25)
      ]
    }
  };
}

const shots = [
  { file: 'checkins.png', tab: 'Check-ins' },
  { file: 'work.png', tab: 'Work' },
  { file: 'week.png', tab: 'Week Planner' }
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture() {
  ipcMain.handle('state:read', () => sampleState());
  ipcMain.on('state:write', () => {});
  ipcMain.handle('notification:show', () => true);

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    backgroundColor: '#05030a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // Off-screen rendering keeps repainting without a visible window, so each tab is captured fresh.
      offscreen: true,
      preload: path.join(ROOT, 'src', 'electron', 'preload.cjs')
    }
  });
  win.setContentSize(WIDTH, HEIGHT);

  await win.loadFile(path.join(ROOT, 'src', 'dist', 'index.html'));
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  await wait(1000);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const shot of shots) {
    const clicked = await win.webContents.executeJavaScript(`(() => {
      const button = [...document.querySelectorAll('nav button, button')]
        .find((el) => el.textContent.trim() === ${JSON.stringify(shot.tab)});
      button?.click();
      return Boolean(button);
    })()`);
    if (!clicked) throw new Error(`Tab button not found: ${shot.tab}`);

    await wait(700);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT_DIR, shot.file), image.toPNG());
    console.log(`Saved docs/screenshots/${shot.file}`);
  }
}

app.whenReady()
  .then(capture)
  .then(() => app.exit(0))
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
