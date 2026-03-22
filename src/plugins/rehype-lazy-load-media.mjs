import { visit } from "unist-util-visit";

/**
 * Rehype plugin to add lazy loading attributes to images, iframes, and videos.
 * - Adds `loading="lazy"` and `decoding="async"` to <img> tags.
 * - Adds `loading="lazy"` to <iframe> tags.
 * - Adds `preload="none"` and IntersectionObserver-based lazy loading to <video> and <audio> tags.
 */
export function rehypeLazyLoadMedia() {
    return (tree) => {
        let hasLazyMedia = false;

        visit(tree, "element", (node) => {
            if (node.tagName === "img") {
                node.properties = node.properties || {};
                if (!node.properties.loading) {
                    node.properties.loading = "lazy";
                }
                if (!node.properties.decoding) {
                    node.properties.decoding = "async";
                }
            } else if (node.tagName === "iframe") {
                node.properties = node.properties || {};
                if (!node.properties.loading) {
                    node.properties.loading = "lazy";
                }
            } else if (node.tagName === "video" || node.tagName === "audio") {
                node.properties = node.properties || {};
                if (!node.properties.preload) {
                    node.properties.preload = "none";
                }
                node.properties["data-lazy-media"] = "";
                hasLazyMedia = true;
            }
        });

        if (hasLazyMedia) {
            const scriptNode = {
                type: "element",
                tagName: "script",
                properties: { type: "module", "data-lazy-media-init": "" },
                children: [{
                    type: "text",
                    value: `
                    (() => {
                        const mediaElements = document.querySelectorAll('video[data-lazy-media], audio[data-lazy-media]');
                        if (mediaElements.length === 0) return;

                        const lazyLoadMedia = () => {
                            mediaElements.forEach(media => {
                                if (media.dataset.lazyLoaded) return;
                                
                                const observer = new IntersectionObserver((entries) => {
                                    entries.forEach(entry => {
                                        if (entry.isIntersecting) {
                                            media.preload = "metadata";
                                            if (media.tagName === "VIDEO" && media.hasAttribute("poster")) {
                                                media.load();
                                            }
                                            media.dataset.lazyLoaded = "true";
                                            observer.disconnect();
                                        }
                                    });
                                }, { rootMargin: "200px" });

                                observer.observe(media);
                            });
                        };

                        if (document.readyState === "loading") {
                            document.addEventListener("DOMContentLoaded", lazyLoadMedia);
                        } else {
                            lazyLoadMedia();
                        }
                    })();
                    `
                }]
            };

            if (tree.children && tree.children.length > 0) {
                const lastChild = tree.children[tree.children.length - 1];
                if (lastChild.type === "element" && lastChild.tagName === "body") {
                    if (!lastChild.children) lastChild.children = [];
                    lastChild.children.push(scriptNode);
                } else {
                    tree.children.push(scriptNode);
                }
            } else {
                tree.children.push(scriptNode);
            }
        }
    };
}