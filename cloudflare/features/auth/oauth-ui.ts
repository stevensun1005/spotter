const notices = {
  linked: "登录方式已绑定。下次可以用任一已绑定的账号登录。",
  "oauth-cancelled": "已取消登录。",
  "oauth-expired": "登录已超时，请重新选择登录方式。",
  "oauth-error": "暂时无法完成登录，请重试。",
  "use-access-code": "这个邮箱已有训练搭子账号。请用原登录方式或访问码进入，再到「设置 → 账号」绑定。",
  "link-cancelled": "已取消绑定。",
  "link-expired": "本次绑定已超时，请重新开始。",
  "link-error": "暂时无法完成绑定，请确认当前账号后重试。",
  "link-conflict": "这个登录方式已绑定到另一个训练搭子账号。",
  "link-already-bound": "当前训练搭子已绑定此平台的另一个账号。",
} as const;

export type OAuthNotice = keyof typeof notices;

export function oauthNotice(value: unknown): OAuthNotice | undefined {
  if (typeof value === "string" && Object.hasOwn(notices, value)) return value as OAuthNotice;
}

export function oauthNoticeText(value: OAuthNotice): string { return notices[value]; }

export function isSpotterApp(userAgent: string) {
  return /(?:^|\s)Spotter(?:OAuth)?\/[\d.]+(?:\s|$)/.test(userAgent);
}

export function supportsNativeOAuth(userAgent: string) {
  return /(?:^|\s)SpotterOAuth\/1(?:\s|$)/.test(userAgent);
}
