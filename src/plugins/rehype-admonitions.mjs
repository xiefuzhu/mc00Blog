import { h } from "hastscript";
import { visit } from "unist-util-visit";


const ADMONITION_TYPES = ["note", "tip", "important", "warning", "caution"];

export function rehypeAdmonitions() {
    return (tree) => {
        visit(tree, "element", (node, index, parent) => {
            if (!ADMONITION_TYPES.includes(node.tagName)) return;
            if (!parent || index === undefined || index === null) return;

            const type = node.tagName;
            const children = [...(node.children || [])];

            let titleChildren;
            const hasDirectiveLabel = node.properties?.hasDirectiveLabel || node.properties?.["has-directive-label"];

            if (hasDirectiveLabel && children.length > 0) {
                const firstChild = children.shift();
                titleChildren = firstChild.children || [];
            } else {
                titleChildren = [{ type: "text", value: type.charAt(0).toUpperCase() + type.slice(1) }];
            }

            const admonition = h("blockquote", {
                class: ["admonition", `bdm-${type}`],
                "data-callout": type,
            }, [
                h("div", { class: "bdm-title" }, titleChildren),
                ...children,
            ]);

            parent.children.splice(index, 1, admonition);
        });
    };
}