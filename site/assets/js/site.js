// Ondura website behaviour: screenshot tour and release links.
// release.json is generated at deploy time by scripts/sync-core.sh, so
// visitors never contact the GitHub API directly.

(function () {
  "use strict";

  const RELEASES_URL = "https://github.com/Ondura-Suite/Ondura-Core/releases";

  // ---------- Screenshot tour ----------
  function initTour(root) {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const img = root.querySelector(".tour__img");
    const caption = root.querySelector(".tour__caption");
    if (!tabs.length || !img) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Warm the cache so switching feels instant.
    const warm = () => tabs.forEach((t) => { new Image().src = `assets/screens/${t.dataset.shot}.png`; });
    if ("requestIdleCallback" in window) requestIdleCallback(warm); else setTimeout(warm, 1500);

    function select(tab, focus) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tab.focus();
      tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });

      const src = `assets/screens/${tab.dataset.shot}.png`;
      const alt = `${tab.textContent.trim()} in Ondura`;
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
      return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
    } catch (_) { return ""; }
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    return `${(bytes / 1048576).toLocaleString("de-DE", { maximumFractionDigits: 0 })} MB`;
  }

  async function initRelease() {
    const status = document.querySelector("[data-release-status]");
    let release = null;
    try {
      const res = await fetch("release.json", { cache: "no-cache" });
      if (res.ok) release = await res.json();
    } catch (_) { /* keep the static fallback links */ }

    if (!release || !release.tag) {
      if (status) status.innerHTML = `Es ist noch keine Version veröffentlicht. Neue Versionen erscheinen auf der <a href="${RELEASES_URL}">Release-Seite</a>.`;
      return;
    }

    const version = release.tag.replace(/^v/i, "");
    if (status) {
      const date = release.published_at ? ` vom ${formatDate(release.published_at)}` : "";
      status.textContent = `Version ${version}${date}`;
    }
    document.querySelectorAll("[data-version-label]").forEach((el) => {
      el.textContent = `Version ${version} herunterladen`;
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
