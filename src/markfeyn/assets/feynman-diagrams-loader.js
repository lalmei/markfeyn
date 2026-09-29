(function () {
  "use strict";

  var loaderSrc = document.currentScript && document.currentScript.src;
  var rendererFile = "__MARKFEYN_RENDERER_FILE__";
  var selector = "code.language-feynman, pre.language-feynman > code";
  var requested = false;

  function rendererUrl() {
    return loaderSrc.slice(0, loaderSrc.lastIndexOf("/") + 1) + rendererFile;
  }

  function hasDiagrams(root) {
    return Boolean(root && root.querySelector && root.querySelector(selector));
  }

  function ensureRenderer() {
    if (requested) {
      return;
    }

    requested = true;

    if (window.FeynmanDiagrams) {
      window.FeynmanDiagrams.renderAll(document);
      return;
    }

    var script = document.createElement("script");
    script.src = rendererUrl();
    script.onerror = function () {
      console.error("MarkFeyn: failed to load renderer from " + script.src);
    };
    document.head.appendChild(script);
  }

  function check() {
    if (hasDiagrams(document)) {
      ensureRenderer();
    }
  }

  if (!loaderSrc) {
    console.error("MarkFeyn: cannot determine the loader script location");
    return;
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(check);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", check);
  } else {
    check();
  }
})();
