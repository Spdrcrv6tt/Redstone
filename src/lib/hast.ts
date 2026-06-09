import type { Element, RootContent, Text } from "hast";

export function hastToText(node: RootContent): string {
  if (node.type === "text") return (node as Text).value;
  if (node.type === "element") {
    return (node as Element).children.map(hastToText).join("");
  }
  return "";
}
