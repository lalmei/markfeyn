import { createSvg, round } from "./dom.js";
import { VISUAL_DEFAULTS } from "./visual-defaults.js";

let mathLabelSerial = 0;

export function mathJaxTexToSvgAvailable() {
  return typeof window !== "undefined"
    && window.MathJax
    && typeof window.MathJax.tex2svgPromise === "function";
}

export function whenMathJaxReady() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.MathJax?.startup?.promise) {
    return window.MathJax.startup.promise;
  }

  if (mathJaxTexToSvgAvailable()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (mathJaxTexToSvgAvailable() || attempts++ > 200) {
        window.clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

export function mathJaxDisplayFontSize(className) {
  const base = String(className || "").includes("edge")
    ? VISUAL_DEFAULTS.edgeLabelFontSize
    : VISUAL_DEFAULTS.labelFontSize;

  return base * VISUAL_DEFAULTS.mathLabelFontScale;
}

export function parseMathJaxSvgLength(value, emPixels) {
  if (value == null || value === "") {
    return 0;
  }

  const raw = String(value).trim();
  const match = raw.match(/^([+-]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(ex|em|px)?$/i);

  if (!match) {
    return Number.parseFloat(raw) || 0;
  }

  const amount = Number.parseFloat(match[1]);
  const unit = (match[2] || "px").toLowerCase();

  if (unit === "ex") {
    return amount * emPixels * 0.431;
  }

  if (unit === "em") {
    return amount * emPixels;
  }

  return amount;
}

export async function materializePendingMathLabels(root) {
  if (!root?.querySelectorAll) {
    return;
  }

  const pending = [...root.querySelectorAll("[data-math-tex]")];

  if (!pending.length) {
    return;
  }

  await whenMathJaxReady();

  if (!mathJaxTexToSvgAvailable()) {
    return;
  }

  await Promise.all(pending.map(async (group) => {
    const tex = group.dataset.mathTex;

    if (!tex) {
      return;
    }

    try {
      const fontSize = mathJaxDisplayFontSize(
        group.getAttribute("class")?.replace("feynman-diagram__label--math-pending", "").trim(),
      );
      const mathNode = await window.MathJax.tex2svgPromise(tex, {
        display: false,
        em: fontSize,
        ex: fontSize * 0.431,
      });
      const replacement = embedMathJaxSvgGroup(mathNode, {
        x: Number(group.dataset.labelX),
        y: Number(group.dataset.labelY),
        anchor: group.dataset.labelAnchor || "middle",
        className: group.getAttribute("class")?.replace("feynman-diagram__label--math-pending", "").trim(),
        idPrefix: `feynman-math-${mathLabelSerial += 1}`,
      });

      group.replaceWith(replacement);
    } catch {
      group.removeAttribute("data-math-tex");
      group.classList.remove("feynman-diagram__label--math-pending");
    }
  }));
}

function prefixSvgIds(root, prefix) {
  const idMap = new Map();

  root.querySelectorAll("[id]").forEach((element) => {
    const oldId = element.id;
    const newId = `${prefix}__${oldId}`;

    idMap.set(oldId, newId);
    element.id = newId;
  });

  root.querySelectorAll("[href]").forEach((element) => {
    const href = element.getAttribute("href");

    if (href?.startsWith("#")) {
      const mapped = idMap.get(href.slice(1));

      if (mapped) {
        element.setAttribute("href", `#${mapped}`);
      }
    }
  });

  root.querySelectorAll("*").forEach((element) => {
    const xlinkHref = element.getAttributeNS("http://www.w3.org/1999/xlink", "href");

    if (xlinkHref?.startsWith("#")) {
      const mapped = idMap.get(xlinkHref.slice(1));

      if (mapped) {
        element.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${mapped}`);
      }
    }
  });
}

function embedMathJaxSvgGroup(container, { x, y, anchor, className, idPrefix }) {
  const sourceSvg = container?.querySelector?.("svg");

  if (!sourceSvg) {
    return createSvg("g");
  }

  const emPixels = mathJaxDisplayFontSize(className);
  let width = parseMathJaxSvgLength(sourceSvg.getAttribute("width"), emPixels);
  let height = parseMathJaxSvgLength(sourceSvg.getAttribute("height"), emPixels);

  if (!(width > 0 && height > 0)) {
    width = emPixels * 2.4;
    height = emPixels * 1.05;
  }

  const group = createSvg("g", {
    class: `${className || ""} feynman-diagram__label--mathjax`.trim(),
    transform: `translate(${round(foreignObjectX(x, width, anchor))} ${round(y - height / 2)})`,
  });
  const nested = document.importNode(sourceSvg, true);

  nested.setAttribute("width", width);
  nested.setAttribute("height", height);
  nested.setAttribute("overflow", "visible");
  nested.setAttribute("class", "feynman-diagram__label-math-svg");
  prefixSvgIds(nested, idPrefix);
  group.appendChild(nested);

  return group;
}

function foreignObjectX(x, width, anchor) {
  if (anchor === "start") {
    return x;
  }

  if (anchor === "end") {
    return x - width;
  }

  return x - width / 2;
}
