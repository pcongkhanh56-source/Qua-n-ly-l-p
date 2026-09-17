-- Remove duplicates
DELETE FROM sessions a USING (
    SELECT MIN(id) as id, class_id, session_date, start_time
    FROM sessions 
    GROUP BY class_id, session_date, start_time 
    HAVING COUNT(*) > 1
) b
WHERE a.class_id = b.class_id 
  AND a.session_date = b.session_date 
  AND a.start_time = b.start_time 
  AND a.id <> b.id;

-- Now repeat until all duplicates are removed (just in case there are >2 duplicates)
-- A better query to keep only one:
DELETE FROM sessions
WHERE id NOT IN (
    SELECT MIN(id)
    FROM sessions
    GROUP BY class_id, session_date, start_time
);

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_class_date_time_key;
ALTER TABLE sessions ADD CONSTRAINT sessions_class_date_time_key UNIQUE (class_id, session_date, start_time);
