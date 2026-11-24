declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WHOOP_CLIENT_ID?: string;
    WHOOP_CLIENT_SECRET?: string;
    AI_COACH_ENABLED?: string;
    ANTHROPIC_API_KEY?: string;
  }
}
