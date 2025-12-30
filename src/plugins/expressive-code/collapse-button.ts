import { definePlugin } from "@expressive-code/core";
import type { Element } from "hast";

export function pluginCollapseButton() {
    return definePlugin({
        name: "Collapse Button",
        hooks: {
            postprocessRenderedBlock: (context) => {
                // If the code block has a title, we don't add the collapse button
                // as it might conflict with the title bar layout
                const classNames = (context.renderData.blockAst.properties?.className as string[]) || [];
                if (classNames.includes("has-title")) {
                    return;
                }

                function processCodeBlock(node: Element) {
                    // Add classes to the root node to indicate it's collapsible and expanded by default
                    if (!node.properties) node.properties = {};
                    const classNames = (node.properties.className as string[]) || [];
                    if (!classNames.includes("collapsible")) {
                        classNames.push("collapsible");
                    }
                    if (!classNames.includes("expanded")) {
                        classNames.push("expanded");
                    }
                    node.properties.className = classNames;

                    const collapseButton = {
                        type: "element" as const,
                        tagName: "button",
                        properties: {
                            className: [
                                "collapse-btn"
                            ],
                            "aria-label": "Collapse code",
                        },
                        children: [
                            {
                                type: "element" as const,
                                tagName: "div",
                                properties: {
                                    className: [
                                        "collapse-btn-icon",
                                    ],
                                },
                                children: [
                                    {
                                        type: "element" as const,
                                        tagName: "svg",
                                        properties: {
                                            viewBox: "0 0 24 24",
                                            xmlns: "http://www.w3.org/2000/svg",
                                            className: [
                                                "collapse-btn-icon",
                                                "collapse-icon",
                                            ],
                                        },
                                        children: [
                                            {
                                                type: "element" as const,
                                                tagName: "path",
                                                properties: {
                                                    d: "M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"
                                                },
                                                children: [],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    } as Element;
                    if (!node.children) {
                        node.children = [];
                    }
                    node.children.push(collapseButton);
                }

                processCodeBlock(context.renderData.blockAst);
            },
        },
    });
}