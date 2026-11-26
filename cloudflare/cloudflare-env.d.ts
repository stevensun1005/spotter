declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WHOOP_CLIENT_ID?: string;
    WHOOP_CLIENT_SECRET?: string;
    AI_COACH_ENABLED?: string;
    ANTHROPIC_API_KEY?: string;
    SPOTTER_OAUTH_ORIGIN?: string;
    GOOGLE_OAUTH_CLIENT_ID?: string;
    GOOGLE_OAUTH_CLIENT_SECRET?: string;
    APPLE_OAUTH_CLIENT_ID?: string;
    APPLE_OAUTH_NATIVE_CLIENT_ID?: string;
    APPLE_OAUTH_TEAM_ID?: string;
    APPLE_OAUTH_KEY_ID?: string;
    APPLE_OAUTH_PRIVATE_KEY?: string;
    SPOTTER_APPLE_TOKEN_KEY?: string;
    SPOTTER_APNS_TEAM_ID?: string;
    SPOTTER_APNS_KEY_ID?: string;
    SPOTTER_APNS_PRIVATE_KEY?: string;
    SPOTTER_NOTIFICATIONS_AUDIENCE?: string;
    SPOTTER_NOTIFICATIONS_ALLOWED_ACCOUNTS?: string;
    SPOTTER_APNS_SANDBOX_KEY_ID?: string;
    SPOTTER_APNS_SANDBOX_PRIVATE_KEY?: string;
  }
}
