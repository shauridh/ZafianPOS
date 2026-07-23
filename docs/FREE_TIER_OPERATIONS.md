# Free-tier operating policy

## Database

- Keep the cashier path to one transaction write plus one stock RPC.
- Query active rows only and cap list screens to 250 rows.
- Use indexed `outlet_id`, `created_at`, `is_active`, and foreign-key columns.
- Store quantities as `numeric`; round only for display.
- Do not subscribe every screen to realtime. Subscribe only to active cashier stock when needed.

## Images

- Compress item images in the browser before upload.
- Target WebP/JPEG below 250 KB; reject files above 2 MB.
- Store one current image per item and delete the replaced object.
- Never store image binaries in PostgreSQL.

## Archive

- Activity logs: keep 90 days online once volume becomes meaningful.
- Stock movements: keep at least 365 days online.
- Archive only when a table has at least 1,000 eligible rows.
- Run `npm run archive` first. This uploads a private gzip archive without deleting data.
- Verify the archive, then run `ARCHIVE_CONFIRM=<outlet-id> npm run archive:prune`.
- Never run archive work during cashier requests. Use a manual monthly job or scheduled CI.

## Backups

- Supabase remains the operational database, not the only backup.
- Download or upload a monthly logical backup outside the same project.
- Keep at least three monthly copies.
- Test restoration before enabling pruning.

## Vercel

- Use the Singapore region to stay close to the Supabase region.
- Keep API responses small and avoid long-running functions.
- Archive scripts run outside Vercel because its filesystem is ephemeral.
