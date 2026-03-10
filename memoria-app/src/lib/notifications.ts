import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Request permission for push notifications
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

// Schedule reminders for today's events
export async function scheduleEventReminders(userId: string): Promise<number> {
  // Cancel all previously scheduled notifications to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Fetch today's events
  const { data: events } = await supabase
    .from("events")
    .select("id, title, description, event_date")
    .eq("user_id", userId)
    .gte("event_date", todayStr)
    .lt("event_date", todayStr + "T23:59:59")
    .order("event_date");

  if (!events || events.length === 0) return 0;

  let scheduled = 0;

  for (const event of events) {
    const eventTime = new Date(event.event_date);
    // Schedule reminder 1 hour before
    const reminderTime = new Date(eventTime.getTime() - 60 * 60 * 1000);

    // Only schedule if the reminder time is in the future
    if (reminderTime > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Upcoming: " + event.title,
          body: event.description || `You have "${event.title}" coming up in about an hour.`,
          data: { eventId: event.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderTime,
        },
      });
      scheduled++;
    }

    // Also schedule a notification at event time
    if (eventTime > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: event.title,
          body: event.description || `It's time for "${event.title}".`,
          data: { eventId: event.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: eventTime,
        },
      });
      scheduled++;
    }
  }

  return scheduled;
}
