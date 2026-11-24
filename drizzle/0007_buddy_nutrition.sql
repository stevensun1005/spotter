ALTER TABLE `members` ADD `share_nutrition` integer DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE members AS m SET share_nutrition = COALESCE((
  SELECT CASE WHEN f.first_id = m.user
    THEN COALESCE(f.first_nutrition_status, f.first_nutrition)
    ELSE COALESCE(f.second_nutrition_status, f.second_nutrition) END
  FROM members p JOIN friend_links f
    ON f.first_id = MIN(m.user, p.user) AND f.second_id = MAX(m.user, p.user)
  WHERE p.room = m.room AND p.user <> m.user
), 1);
