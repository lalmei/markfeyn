export const SVG_NS = "http://www.w3.org/2000/svg";

export function createSvg(tagName, attributes) {
  const element = document.createElementNS(SVG_NS, tagName);

  Object.entries(attributes || {}).forEach(([name, value]) => {
    element.setAttribute(name, String(value));
  });

  return element;
}

export function round(value) {
  return Math.round(value * 100) / 100;
}
