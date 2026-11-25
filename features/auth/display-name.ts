export const unchosenNames = ["spotter 用户", "spotter用户", "spotter user", "训练搭子用户"];

// Callers use internal SQL column expressions here. Account IDs are still bound by each query.
export function accountName(owner: string, fallback = "NULL") {
  const name = "TRIM(display_account.display_name)";
  const placeholders = unchosenNames.map((value) => `'${value}'`).join(", ");
  return "COALESCE((SELECT CASE WHEN " + name + " <> '' AND LOWER(" + name + ") NOT IN (" + placeholders + ") " +
    "AND INSTR(REPLACE(" + name + ", '＠', '@'), '@') = 0 THEN " + name + " " +
    "ELSE COALESCE(display_handle.username || '#' || display_handle.tag, '训练好友') END " +
    "FROM spotter_access_accounts display_account " +
    "LEFT JOIN spotter_account_handles display_handle ON display_handle.owner = display_account.id " +
    "WHERE display_account.id = " + owner + "), " + fallback + ")";
}
