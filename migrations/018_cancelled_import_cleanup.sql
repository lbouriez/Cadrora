-- Older cancellation only changed the import row. Fence its unready photos
-- now, then let the existing retryable media-cleanup job remove their D1-owned
-- variants and vectors. This is safe to rerun because of the idempotency key.
UPDATE photos
   SET state = 'deleting', face_state = 'deleting', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE import_id IN (SELECT id FROM imports WHERE state = 'cancelled')
   AND state IN ('pending', 'variants_ready');

INSERT OR IGNORE INTO maintenance_jobs
  (id, kind, state, payload_json, idempotency_key, attempts, available_at, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'delete_photo_media', 'pending',
       json_object('eventId', event_id, 'photoId', id), 'delete-photo:' || id,
       0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM photos
 WHERE import_id IN (SELECT id FROM imports WHERE state = 'cancelled')
   AND state = 'deleting';
