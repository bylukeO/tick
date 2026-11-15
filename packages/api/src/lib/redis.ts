import Redis from "ioredis";

export interface TransferNotificationPayload {
  transferId: string;
  ticketId: string;
  fromEmail: string;
  toEmail: string;
  createdAt: string;
}

type NotificationHandler = (payload: TransferNotificationPayload) => Promise<void>;

class QueueManager {
  private redisClient: Redis | null = null;
  private memoryQueue: TransferNotificationPayload[] = [];
  private handlers: NotificationHandler[] = [];

  constructor() {
    if (process.env.REDIS_URL && process.env.USE_REAL_REDIS === "true") {
      try {
        this.redisClient = new Redis(process.env.REDIS_URL, {
          lazyConnect: true,
          retryStrategy: () => null,
        });
      } catch {
        this.redisClient = null;
      }
    }
  }

  public registerWorker(handler: NotificationHandler): void {
    this.handlers.push(handler);
  }

  public async pushTransferNotification(payload: TransferNotificationPayload): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.rpush("transfers:notify", JSON.stringify(payload));
        return;
      } catch {
        this.redisClient = null;
      }
    }

    this.memoryQueue.push(payload);
    for (const handler of this.handlers) {
      await handler(payload);
    }
  }

  public getPendingMemoryNotifications(): TransferNotificationPayload[] {
    return [...this.memoryQueue];
  }
}

export const queueManager = new QueueManager();
