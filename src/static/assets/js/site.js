// Ondura website behaviour: screenshot tour and release links.
// release.json is generated at deploy time by scripts/sync-core.sh, so
// visitors never contact the GitHub API directly.

(function () {
  "use strict";

  const RELEASES_URL = "https://github.com/Ondura-Suite/Ondura-Core/releases";
  const LANG = document.documentElement.lang === "de" ? "de" : "en";
  const BASE = document.documentElement.dataset.base || "";

  const STRINGS = {
    de: {
      inOndura: (name) => `${name} in Ondura`,
      noRelease: `Es ist noch keine Version veröffentlicht. Neue Versionen erscheinen auf der <a href="${RELEASES_URL}">Release-Seite</a>.`,
      version: (v, date) => `Version ${v}${date ? ` vom ${date}` : ""}`,
      downloadVersion: (v) => `Version ${v} herunterladen`,
      locale: "de-DE",
    },
    en: {
      inOndura: (name) => `${name} in Ondura`,
      noRelease: `No version has been released yet. New versions appear on the <a href="${RELEASES_URL}">releases page</a>.`,
      version: (v, date) => `Version ${v}${date ? `, released ${date}` : ""}`,
      downloadVersion: (v) => `Download version ${v}`,
      locale: "en-GB",
    },
  };
  const T = STRINGS[LANG];

  // ---------- Language switcher ----------
  // Remember an explicit choice so the automatic detection in <head>
  // doesn't send the visitor back.
  document.querySelectorAll("[data-set-lang]").forEach((link) => {
    link.addEventListener("click", () => {
      try { localStorage.setItem("ondura-lang", link.dataset.setLang); } catch (_) { /* private mode */ }
      if (location.hash) link.href = link.href.split("#")[0] + location.hash;
    });
  });

  // ---------- Screenshot tour ----------
  function initTour(root) {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const img = root.querySelector(".tour__img");
    const caption = root.querySelector(".tour__caption");
    if (!tabs.length || !img) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Warm the cache so switching feels instant.
    const warm = () => tabs.forEach((t) => { new Image().src = `${BASE}assets/screens/${t.dataset.shot}.png`; });
    if ("requestIdleCallback" in window) requestIdleCallback(warm); else setTimeout(warm, 1500);

    function select(tab, focus) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tab.focus();
      tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });

      const src = `${BASE}assets/screens/${tab.dataset.shot}.png`;
      const alt = T.inOndura(tab.textContent.trim());
      const apply = () => {
        img.src = src;
        img.alt = alt;
        caption.textContent = tab.dataset.caption || "";
      };
      if (reduceMotion) { apply(); return; }
      img.classList.add("is-swapping");
      setTimeout(() => {
        apply();
        const show = () => img.classList.remove("is-swapping");
        if (img.complete) show(); else img.addEventListener("load", show, { once: true });
      }, 160);
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", (e) => {
        let next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
  }

  // ---------- Release links ----------
  const ASSET_PATTERNS = {
    win: [/_x64_Setup\.exe$/i, /setup.*\.exe$/i, /\.exe$/i],
    deb: [/\.deb$/i],
    rpm: [/\.rpm$/i],
    appimage: [/\.AppImage$/i],
  };

  function findAsset(assets, patterns) {
    for (const re of patterns) {
      const hit = assets.find((a) => re.test(a.name));
      if (hit) return hit;
    }
    return null;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(T.locale, { day: "numeric", month: "long", year: "numeric" });
    } catch (_) { return ""; }
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    return `${(bytes / 1048576).toLocaleString(T.locale, { maximumFractionDigits: 0 })} MB`;
  }

  async function initRelease() {
    const status = document.querySelector("[data-release-status]");
    if (!status && !document.querySelector("[data-asset], [data-version-label]")) return;
    let release = null;
    try {
      const res = await fetch(`${BASE}release.json`, { cache: "no-cache" });
      if (res.ok) release = await res.json();
    } catch (_) { /* keep the static fallback links */ }

    if (!release || !release.tag) {
      if (status) status.innerHTML = T.noRelease;
      return;
    }

    const version = release.tag.replace(/^v/i, "");
    if (status) {
      status.textContent = T.version(version, release.published_at ? formatDate(release.published_at) : "");
    }
    document.querySelectorAll("[data-version-label]").forEach((el) => {
      el.textContent = T.downloadVersion(version);
    });

    const assets = Array.isArray(release.assets) ? release.assets : [];
    document.querySelectorAll("[data-asset]").forEach((link) => {
      const asset = findAsset(assets, ASSET_PATTERNS[link.dataset.asset] || []);
      if (asset) {
        link.href = asset.url;
        const size = formatSize(asset.size);
        if (size) link.title = `${asset.name} (${size})`;
      } else {
        link.href = release.html_url || RELEASES_URL;
      }
    });
  }

  document.querySelectorAll("[data-tour]").forEach(initTour);
  initRelease();
})();
