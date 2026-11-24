import Foundation

enum SpotterWebAppearance {
    static func liquidGlassScript(trustedOrigin: String) -> String {
        let encoder = JSONEncoder()
        guard let origin = try? encoder.encode(trustedOrigin), let css = try? encoder.encode(liquidGlass) else { return "" }
        return """
        (() => {
          if (window.top !== window || window.location.origin !== \(String(decoding: origin, as: UTF8.self))) return;
          const id = 'spotter-app-liquid-glass';
          if (!document.head || document.getElementById(id)) return;
          const style = document.createElement('style');
          style.id = id;
          style.textContent = \(String(decoding: css, as: UTF8.self));
          document.head.append(style);
        })();
        """
    }

    private static let liquidGlass = """
    .primary-nav > .primary-nav-tabs {
      --glass-solid: #edf2eb;
      --glass-surface: linear-gradient(152deg, #ffffffe0, #e8f0e483 48%, #e8f0e8bb);
      --glass-rim: #ffffffe6;
      --glass-stroke: #81948460;
      --glass-shadow: #253a2c34;
      --glass-lens-solid: #dcead8;
      --glass-lens: linear-gradient(155deg, #fffffff0, #edf6e6d9 41%, #d4e7d2d9);
      --glass-lens-rim: #ffffffee;
      --glass-lens-shadow: #526d5245;
      --glass-selected: #23432b;
      --glass-hover: #ffffff70;
      --glass-focus: #436c45;
      position: relative;
      isolation: isolate;
      border-radius: 999px;
      border-color: var(--glass-stroke);
      background: var(--glass-solid);
      box-shadow: inset 0 1px 0 var(--glass-rim), 0 7px 20px var(--glass-shadow);
    }
    :root[data-spotter-theme="dark"] .primary-nav > .primary-nav-tabs {
      --glass-solid: #26352b;
      --glass-surface: linear-gradient(152deg, #446351b9, #26382be6 48%, #1b2b21d9);
      --glass-rim: #e7fae74d;
      --glass-stroke: #98b9a46b;
      --glass-shadow: #0208048c;
      --glass-lens-solid: #425c4a;
      --glass-lens: linear-gradient(155deg, #496552, #3a5343 44%, #2e4537);
      --glass-lens-rim: #d4efce6b;
      --glass-lens-shadow: #07110a99;
      --glass-selected: #f1f9ec;
      --glass-hover: #c2dfba24;
      --glass-focus: #d0edc4;
    }
    @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
      .primary-nav > .primary-nav-tabs {
        background: var(--glass-surface);
        -webkit-backdrop-filter: blur(18px) saturate(165%);
        backdrop-filter: blur(18px) saturate(165%);
      }
    }
    .primary-nav > .primary-nav-tabs > button {
      position: relative;
      border-radius: 999px;
      transition: color .2s ease, background-color .2s ease, transform .17s ease;
    }
    .primary-nav > .primary-nav-tabs > button:hover { background: var(--glass-hover); }
    .primary-nav > .primary-nav-tabs > button:active { transform: scale(.95); }
    .primary-nav > .primary-nav-tabs > button:focus-visible { outline-color: var(--glass-focus); outline-offset: -3px; }
    .primary-nav > .primary-nav-tabs > button.active {
      background: var(--glass-lens-solid);
      color: var(--glass-selected);
    }

    @supports selector(:has(> button.active)) {
      .primary-nav > .primary-nav-tabs {
        --glass-columns: 3;
        --glass-index: 0;
        --glass-direction: 1;
        /* Use the shared tab row's padding and gaps. */
        --glass-padding: 4px;
        --glass-gap: 2px;
      }
      .primary-nav > .primary-nav-tabs:has(> button:nth-child(4)) { --glass-columns: 4; }
      .primary-nav > .primary-nav-tabs:has(> button:nth-child(2).active) { --glass-index: 1; }
      .primary-nav > .primary-nav-tabs:has(> button:nth-child(3).active) { --glass-index: 2; }
      .primary-nav > .primary-nav-tabs:has(> button:nth-child(4).active) { --glass-index: 3; }
      :root[dir="rtl"] .primary-nav > .primary-nav-tabs { --glass-direction: -1; }
      .primary-nav > .primary-nav-tabs::before {
        content: '';
        position: absolute;
        box-sizing: border-box;
        inset-block: var(--glass-padding);
        inset-inline-start: var(--glass-padding);
        inline-size: calc((100% - 2 * var(--glass-padding) - (var(--glass-columns) - 1) * var(--glass-gap)) / var(--glass-columns));
        transform: translateX(calc((100% + var(--glass-gap)) * var(--glass-index) * var(--glass-direction)));
        border-radius: 999px;
        border: 1px solid var(--glass-lens-rim);
        background: var(--glass-lens);
        box-shadow: 0 2px 7px var(--glass-lens-shadow), inset 0 1px 0 var(--glass-lens-rim);
        opacity: 0;
        pointer-events: none;
        transition: transform .32s cubic-bezier(.2, .75, .3, 1), opacity .18s ease;
      }
      .primary-nav > .primary-nav-tabs:has(> button.active)::before { opacity: 1; }
      .primary-nav > .primary-nav-tabs > button.active { background: transparent; }
    }
    @media (prefers-reduced-motion: reduce) {
      .primary-nav > .primary-nav-tabs::before, .primary-nav > .primary-nav-tabs > button { transition: none; }
      .primary-nav > .primary-nav-tabs > button:active { transform: none; }
    }
    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
      .primary-nav > .primary-nav-tabs {
        background: var(--glass-solid);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
      .primary-nav > .primary-nav-tabs::before { background: var(--glass-lens-solid); }
    }
    """
}
