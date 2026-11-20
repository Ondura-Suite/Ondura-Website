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
      enlarge: "Bild vergrößern",
      apk: "APK herunterladen",
      available: (v) => `Version ${v} verfügbar`,
      close: "Schließen",
    },
    en: {
      inOndura: (name) => `${name} in Ondura`,
      noRelease: `No version has been released yet. New versions appear on the <a href="${RELEASES_URL}">releases page</a>.`,
      version: (v, date) => `Version ${v}${date ? `, released ${date}` : ""}`,
      downloadVersion: (v) => `Download version ${v}`,
      locale: "en-GB",
      enlarge: "Enlarge image",
      apk: "Download APK",
      available: (v) => `Version ${v} available`,
      close: "Close",
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
    win: [/_x64_Setup\.exe$/i, /setup.*\.exe$/i, /^(?!.*silent).*\.exe$/i],
    mac: [/\.dmg$/i],
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

  // Ondura Mail for Android: the page says "coming soon" until the Android
  // repository publishes a release with an APK.
  async function initAndroid() {
    const link = document.querySelector("[data-android-asset]");
    const badge = document.querySelector("[data-android-badge]");
    if (!link && !badge) return;
    let release = null;
    try {
      const res = await fetch(`${BASE}release-android.json`, { cache: "no-cache" });
      if (res.ok) release = await res.json();
    } catch (_) { return; }
    const apk = release && release.tag && Array.isArray(release.assets)
      ? release.assets.find((a) => /\.apk$/i.test(a.name) && !/debug/i.test(a.name))
      : null;
    if (!apk) return;
    const version = release.tag.replace(/^v/i, "");
    if (link) {
      link.href = apk.url;
      link.textContent = T.apk;
      link.classList.remove("btn--soon");
      const size = formatSize(apk.size);
      if (size) link.title = `${apk.name} (${size})`;
    }
    if (badge) {
      badge.textContent = T.available(version);
      badge.classList.add("badge--live");
    }
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

  // ---------- Image viewer ----------
  // Screenshots outside the tour are small; a click shows them full size.
  function initViewer() {
    const images = document.querySelectorAll(".trio img, .pair img, .wide img, .extra__shot, .download__setup img");
    if (!images.length || typeof HTMLDialogElement === "undefined") return;

    const dialog = document.createElement("dialog");
    dialog.className = "viewer";
    dialog.innerHTML =
      `<button class="viewer__close" type="button" aria-label="${T.close}">×</button>` +
      `<figure class="viewer__figure"><img alt=""><figcaption></figcaption></figure>`;
    document.body.appendChild(dialog);
    const big = dialog.querySelector("img");
    const caption = dialog.querySelector("figcaption");
    let opener = null;

    function open(img) {
      opener = img;
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      const fc = img.closest("figure")?.querySelector("figcaption");
      caption.textContent = fc ? fc.textContent : "";
      caption.hidden = !fc;
      dialog.showModal();
    }

    images.forEach((img) => {
      img.classList.add("zoomable");
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", `${T.enlarge}: ${img.alt}`);
      img.addEventListener("click", () => open(img));
      img.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(img); }
      });
    });

    // Any click inside the dialog closes it; the image is for looking only.
    dialog.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { if (opener) opener.focus(); });
  }

  document.querySelectorAll("[data-tour]").forEach(initTour);
  initViewer();
  initRelease();
  initAndroid();
})();
