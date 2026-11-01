const ALLOWED_TAGS = new Set([
  "P",
  "DIV",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "UL",
  "OL",
  "LI",
  "H2",
  "H3",
]);

const DISCARDED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "MATH",
]);

export function sanitizeProductDescription(value: unknown): string {
  const template = document.createElement("template");
  template.innerHTML = String(value ?? "");

  const cleanNode = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        if (child.nodeType !== Node.TEXT_NODE) child.remove();
        continue;
      }

      const element = child as Element;
      if (DISCARDED_TAGS.has(element.tagName)) {
        element.remove();
        continue;
      }

      cleanNode(element);
      if (!ALLOWED_TAGS.has(element.tagName)) {
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }

      for (const attribute of Array.from(element.attributes)) {
        const alignment = attribute.value.match(
          /^text-align:\s*(left|center|right|justify)\s*;?$/i,
        );
        if (
          attribute.name !== "style" ||
          !alignment ||
          !["P", "DIV", "H2", "H3"].includes(element.tagName)
        ) {
          element.removeAttribute(attribute.name);
        } else {
          element.setAttribute("style", `text-align: ${alignment[1].toLowerCase()}`);
        }
      }
    }
  };

  cleanNode(template.content);
  return template.innerHTML;
}
