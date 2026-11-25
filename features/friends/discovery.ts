// Query by a bound account ID twice. The second branch is the default for
// Cloudflare accounts that have never saved an explicit discovery setting.
export const discoverablePerson =
  "SELECT p.owner AS id, p.name FROM friend_profiles p WHERE p.owner = ? AND p.discoverable = 1 " +
  "UNION ALL SELECT h.owner AS id, a.display_name AS name FROM spotter_account_handles h " +
  "JOIN spotter_access_accounts a ON a.id = h.owner WHERE h.owner = ? " +
  "AND NOT EXISTS (SELECT 1 FROM friend_profiles p WHERE p.owner = h.owner)";
