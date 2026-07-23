export const ARCHIVE_POLICY = {
  activityLogRetentionDays: 90,
  stockMovementRetentionDays: 365,
  minimumArchiveRows: 1000,
  archiveFormat: "jsonl.gz",
} as const;

// Archiving is intentionally manual/cron-triggered. It never runs during cashier requests.
