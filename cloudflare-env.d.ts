declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WHOOP_CLIENT_ID?: string;
    WHOOP_CLIENT_SECRET?: string;
  }
}
