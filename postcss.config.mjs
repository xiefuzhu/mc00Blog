// PostCSS config for CSS imports
// Tailwind v4 is handled by @tailwindcss/vite plugin in astro.config.mjs
import postcssImport from 'postcss-import';


export default {
    plugins: {
        'postcss-import': postcssImport,
    }
};