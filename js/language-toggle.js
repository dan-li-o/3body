(function () {
  // --- Utilities ------------------------------------------------------------
  function joinPaths() {
    // Joins URL path segments without creating '//' seams
    var parts = Array.from(arguments)
      .filter(Boolean)
      .map(function (s) { return String(s); });
    var out = parts.join("/");
    out = out.replace(/\/{2,}/g, "/");
    if (!out.startsWith("/")) out = "/" + out;
    return out;
  }

  function normalizeRelPath(rel) {
    // Normalize empty/dir paths to index.html for matching
    if (!rel || rel === "/") return "index.html";
    // strip leading slash for "relative to base"
    if (rel.startsWith("/")) rel = rel.slice(1);
    // '/foo/' -> 'foo/index.html'
    if (rel.endsWith("/")) return rel + "index.html";
    return rel;
  }

  function getBasePrefix() {
    // Robust base detection using this script's absolute src
    // Example: /3body/js/lang-toggle.js  => base '/3body/'
    //          /js/lang-toggle.js        => base '/'
    var scriptEl = document.currentScript;
    // Fallback: last script tag if currentScript unavailable
    if (!scriptEl) {
      var scripts = document.getElementsByTagName("script");
      scriptEl = scripts[scripts.length - 1];
    }
    var src = scriptEl && scriptEl.src ? new URL(scriptEl.src, window.location.origin).pathname : null;
    if (!src) return "/";

    var segs = src.split("/").filter(Boolean);
    var jsIdx = segs.lastIndexOf("js");
    if (jsIdx === -1) {
      // If not under /js/, try to infer common prefix with page path
      var pageSegs = window.location.pathname.split("/").filter(Boolean);
      // Find longest common prefix
      var i = 0;
      while (i < segs.length && i < pageSegs.length && segs[i] === pageSegs[i]) i++;
      return "/" + segs.slice(0, i).join("/") + (i ? "/" : "/");
    }
    // base is everything before /js/
    var baseSegs = segs.slice(0, jsIdx);
    return "/" + baseSegs.join("/") + (baseSegs.length ? "/" : "");
  }

  function exists(path) {
    // HEAD check with graceful failure to GET (in case HEAD is blocked)
    return fetch(path, { method: "HEAD" }).then(function (r) {
      if (r.ok) return true;
      // Some static hosts return 405 for HEAD; try GET (no-cors may still 200)
      return fetch(path, { method: "GET", mode: "no-cors" })
        .then(function () { return true; })
        .catch(function () { return false; });
    }).catch(function () { return false; });
  }

  // --- Core toggle ----------------------------------------------------------
  function swapLang(toZh) {
    var base = getBasePrefix();                 // e.g., "/" or "/3body/"
    var fullPath = window.location.pathname;    // e.g., "/3body/chapters/x.html"
    // relative to base:
    var rel = fullPath.startsWith(base) ? fullPath.slice(base.length) : fullPath.slice(1);
    rel = normalizeRelPath(rel);                // "chapters/x.html", "index.html", "zh/chapters/x.html"

    var targetRel;
    if (toZh) {
      targetRel = rel.startsWith("zh/") ? rel : ("zh/" + rel);
    } else {
      targetRel = rel.startsWith("zh/") ? rel.slice(3) : rel; // remove leading "zh/"
      if (!targetRel) targetRel = "index.html";
    }

    var targetAbs = joinPaths(base, targetRel);

    // Try exact counterpart; fallback to language home
    exists(targetAbs).then(function (ok) {
      if (ok) {
        window.location.href = targetAbs;
      } else {
        window.location.href = toZh ? joinPaths(base, "zh/") : base;
      }
    });
  }

  // --- Minimal UI (you can style/relocate later) ----------------------------
  function injectToggleUI() {
    if (document.getElementById("lang-toggle")) return; // avoid duplicates
    var box = document.createElement("div");
    box.id = "lang-toggle";
    box.style.cssText = "position:fixed;top:10px;left:12px;font-size:.9rem;z-index:9999;background:#fff;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.1)";
    box.innerHTML = '<a href="#" id="lang-zh">中文</a> | <a href="#" id="lang-en">EN</a>';
    document.body.appendChild(box);
    document.getElementById("lang-zh").addEventListener("click", function (e) { e.preventDefault(); swapLang(true); });
    document.getElementById("lang-en").addEventListener("click", function (e) { e.preventDefault(); swapLang(false); });
  }

  // Init
  document.addEventListener("DOMContentLoaded", injectToggleUI);
})();
