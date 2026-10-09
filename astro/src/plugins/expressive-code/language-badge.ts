/**
 * Based on the discussion at https://github.com/expressive-code/expressive-code/issues/153#issuecomment-2282218684
 */
import { definePlugin } from "@expressive-code/core";


export function pluginLanguageBadge() {
    return definePlugin({
        name: "Language Badge",
        hooks: {
            postprocessRenderedBlock: ({ codeBlock, renderData }) => {
                const language = codeBlock.language;
                if (language && renderData.blockAst.properties) {
                    renderData.blockAst.properties["data-language"] = language;
                }
            },
        },
        baseStyles: ({}) => `
            .frame[data-language]:not(.has-title):not(.is-terminal) {
                position: relative;
                
                &::after {
                    pointer-events: none;
                    position: absolute;
                    z-index: 2;
                    right: 0.5rem;
                    top: 0.5rem;
                    content: attr(data-language);
                    font-family: "JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                    font-size: 0.75rem;
                    font-weight: bold;
                    text-transform: uppercase;
                    color: var(--btn-content);
                    background: var(--btn-regular-bg);
                    opacity: 0;
                    transition: opacity 0.3s;
                    padding: 0.1rem 0.5rem;
                    border-radius: 0.5rem;
                }
                
                @media (hover: hover) {
                    &::after {
                        opacity: 1;
                    }
                    &:hover::after {
                        opacity: 0;
                    }
                }
            }
        `,
    });
}