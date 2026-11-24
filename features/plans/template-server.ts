// Look up only the owner's template. Plans received from a partner keep their shared snapshot.
export const ownTemplateJoin =
  " LEFT JOIN personal_library t ON e.kind = 'plan' AND e.owner = ? AND t.owner = e.owner AND t.kind = 'template'" +
  " AND t.id = json_extract(e.payload, '$.templateId') ";

export function freezeTemplatePlans(db: D1Database, owner: string, templateId: string, now: string) {
  return db.prepare(
    "UPDATE entries AS e SET payload = json_patch(" +
    "json_remove(e.payload, '$.templateId', '$.category', '$.minutes', '$.durationNote', '$.defaultRestSeconds', '$.video', '$.exercises'), " +
    "json_remove(json_extract(t.payload, '$.plan'), '$.title', '$.date', '$.shared', '$.templateId', '$.week', '$.day')" +
    "), updated = ? FROM personal_library t " +
    "WHERE e.owner = ? AND e.kind = 'plan' AND t.owner = e.owner AND t.kind = 'template' AND t.id = ? " +
    "AND t.id = json_extract(e.payload, '$.templateId')"
  ).bind(now, owner, templateId);
}
