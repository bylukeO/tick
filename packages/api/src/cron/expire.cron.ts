import cron from "node-cron";
import { expireOldPendingTransfers } from "../services/transfer.service";

let scheduledTask: cron.ScheduledTask | null = null;

export function startExpiryCron(): cron.ScheduledTask {
  if (scheduledTask) {
    return scheduledTask;
  }

  scheduledTask = cron.schedule("*/60 * * * * *", async () => {
    try {
      await expireOldPendingTransfers(24);
    } catch {
      return;
    }
  });

  return scheduledTask;
}

export function stopExpiryCron(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
