interface AppNotification {
  title: string;
  body?: string;
}

export async function showAppNotification({ title, body }: AppNotification) {
  if (window.myDay?.notify) {
    const wasShown = await window.myDay.notify({ title, body });

    if (wasShown) return;
  }

  if (typeof Notification === 'undefined') return;

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission !== 'granted') return;

  new Notification(title, {
    body,
    icon: './icon.png'
  });
}
