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

function sampleState(theme) {
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
    settings: { theme },
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

const THEMES = ['dark', 'light'];
const FOCUS_TASK = 'Write project proposal draft';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let currentTheme = 'dark';
// Notifications the app actually sends during the run; drawn into the notification screenshot.
let sentNotifications = [];

// Lets the script fast-forward the page's clock so the Pomodoro timer can be shown mid-session and finished.
const CLOCK_SHIM = `(() => {
  if (window.__clockOffset !== undefined) return;
  window.__clockOffset = 0;
  const realNow = Date.now.bind(Date);
  Date.now = () => realNow() + window.__clockOffset;
})()`;

// A generic desktop-notification card. The real look depends on the OS; the text is what the app sent.
const notificationOverlay = (notifications, theme) => `(() => {
  const dark = ${JSON.stringify(theme === 'dark')};
  const stack = document.createElement('div');
  stack.style.cssText = 'position:fixed;top:72px;right:24px;display:flex;flex-direction:column;gap:12px;z-index:99999;width:380px;font-family:system-ui,sans-serif';
  for (const n of ${JSON.stringify(notifications)}) {
    const card = document.createElement('div');
    card.style.cssText = 'display:flex;gap:14px;padding:16px 18px;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.45);' +
      (dark ? 'background:#2b2b30;color:#f2f2f2;border:1px solid #3d3d44' : 'background:#ffffff;color:#1d1d1f;border:1px solid #d9d9de');
    const icon = document.createElement('img');
    icon.src = './icon.png';
    icon.style.cssText = 'width:44px;height:44px;border-radius:10px;flex-shrink:0';
    const text = document.createElement('div');
    text.style.cssText = 'min-width:0';
    const line = (content, css) => {
      const el = document.createElement('div');
      el.style.cssText = css;
      el.textContent = content;
      text.appendChild(el);
    };
    line('MyDay · now', 'font-size:12px;opacity:.65;margin-bottom:3px');
    line(n.title, 'font-weight:600;font-size:15px;margin-bottom:3px');
    line(n.body ?? '', 'font-size:14px;opacity:.85');
    card.append(icon, text);
    stack.appendChild(card);
  }
  document.body.appendChild(stack);
})()`;

async function clickButton(win, { text, label }) {
  const found = await win.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('button')].find((el) =>
      ${JSON.stringify(label ?? null)} !== null
        ? el.getAttribute('aria-label') === ${JSON.stringify(label ?? '')}
        : el.textContent.trim() === ${JSON.stringify(text ?? '')});
    button?.click();
    return Boolean(button);
  })()`);
  if (!found) throw new Error(`Button not found: ${text ?? label}`);
  await wait(700);
}

// Sets a React-controlled field's value the way typing would.
async function typeInto(win, selector, value) {
  const found = await win.webContents.executeJavaScript(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  if (!found) throw new Error(`Field not found: ${selector}`);
  await wait(300);
}

const advanceClock = async (win, minutes) => {
  await win.webContents.executeJavaScript(`window.__clockOffset += ${minutes * 60_000}`);
  await wait(900);
};

async function save(win, name) {
  const file = `${name}-${currentTheme}.png`;
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT_DIR, file), image.toPNG());
  console.log(`Saved docs/screenshots/${file}`);
}

async function capture() {
  ipcMain.handle('state:read', () => sampleState(currentTheme));
  ipcMain.on('state:write', () => {});
  ipcMain.handle('notification:show', (_event, options) => {
    sentNotifications.push({ title: options?.title, body: options?.body });
    return true;
  });

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    backgroundColor: '#05030a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // Off-screen rendering keeps repainting without a visible window, so each view is captured fresh.
      offscreen: true,
      preload: path.join(ROOT, 'src', 'electron', 'preload.cjs')
    }
  });
  win.setContentSize(WIDTH, HEIGHT);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const theme of THEMES) {
    currentTheme = theme;
    sentNotifications = [];

    // A fresh load per theme resets the timer and clock.
    await win.loadFile(path.join(ROOT, 'src', 'dist', 'index.html'));
    await win.webContents.executeJavaScript(CLOCK_SHIM);
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    await wait(1000);

    await clickButton(win, { text: 'Check-ins' });
    await save(win, 'checkins');
    await clickButton(win, { text: 'Week Planner' });
    await save(win, 'week');
    await clickButton(win, { text: 'Work' });
    await save(win, 'work');

    // Mid-session: start a focus session, then jump ahead so the timer shows time already spent.
    await clickButton(win, { label: `Start working on "${FOCUS_TASK}"` });
    await clickButton(win, { text: 'Start' });
    await typeInto(win, 'textarea[placeholder="What are you working on in this pom?"]', 'Drafting the budget and timeline section');
    await advanceClock(win, 10.5);
    await save(win, 'focus');

    // Finish the focus session and the break so the app sends its real notifications.
    await advanceClock(win, 15);
    await clickButton(win, { text: 'Start break' });
    await advanceClock(win, 5.5);
    if (sentNotifications.length === 0) throw new Error('The app sent no notifications to capture');
    await win.webContents.executeJavaScript(notificationOverlay(sentNotifications.slice(-3).reverse(), theme));
    await wait(500);
    await save(win, 'notification');
  }
}

app.whenReady()
  .then(capture)
  .then(() => app.exit(0))
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
