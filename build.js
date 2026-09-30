import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import MarkdownIt from 'markdown-it';
import { createHighlighter } from 'shiki';
import { prerenderComponent } from './prerender.js';
import { SiteHeader } from './shared/site-header.js';
import { SiteFooter } from './shared/site-footer.js';

const root = process.cwd();
const distDir = join(root, 'dist');
const contentDir = join(root, 'vendor/wrium-docs');
const SITE_URL = process.env.SITE_URL || 'https://wrium.dev';

const DOC_DESCRIPTIONS = {
    'introduction': 'Introduction to Wrium: a minimalist JavaScript library for building reactive user interfaces with zero build step.',
    'installation': 'How to install and set up Wrium in your project via npm, CDN, or direct script tag.',
    'core-concepts': 'Learn the core reactivity primitives in Wrium: ref, reactive, computed, and watchEffect.',
    'directives': 'Complete reference of Wrium template directives: v-if, v-for, v-model, v-show, v-bind, and v-on.',
    'components': 'How to create and register reusable reactive components in Wrium using app.component().',
    'plugins': 'Extend Wrium with custom directives and hooks using its plugin architecture.',
    'examples': 'Real-world examples and code recipes built with Wrium.',
    'api-reference': 'Full API reference for Wrium functions, types, and compiler directives.'
};

// Resolved from node_modules via the package's own "exports" map (the
// "import" condition), not a hardcoded path - works the same whether wrium
// is a local sibling checkout or, as here, a real npm dependency.
const wriumBundle = fileURLToPath(import.meta.resolve('@wrium/wrium'));

// The docs repo's own README/LICENSE aren't site pages - only its guide
// pages are, in the reading order set by that repo's own README "Contents".
const DOC_ORDER = [
    'introduction', 'installation', 'core-concepts', 'directives',
    'components', 'plugins', 'examples', 'api-reference'
];

// Syntax highlighting happens once, here, at build time - the highlighted
// HTML ships as-is, so visitors never download a highlighter of their own.
// Themes are picked to match the site's own palette instead of a generic
// default, and cover both the light and dark site themes in one pass.
const highlighter = await createHighlighter({
    themes: ['rose-pine-dawn', 'rose-pine'],
    langs: ['html', 'javascript', 'bash']
});
const highlightHtml = code => highlighter.codeToHtml(code.trimEnd(), {
    lang: 'html',
    themes: { light: 'rose-pine-dawn', dark: 'rose-pine' }
});
// The "This whole Todo list is real code" showcase is a deliberately
// always-dark terminal-style block (a visual break in the page, not part of
// the reading flow that should follow the site's own light/dark theme) - a
// single fixed theme instead of the light/dark pair used everywhere else.
const highlightHtmlDark = code => highlighter.codeToHtml(code.trimEnd(), {
    lang: 'html',
    theme: 'rose-pine'
});

const md = new MarkdownIt({
    html: true,
    highlight: (code, lang) => highlighter.codeToHtml(code, {
        lang: highlighter.getLoadedLanguages().includes(lang) ? lang : 'text',
        themes: { light: 'rose-pine-dawn', dark: 'rose-pine' }
    })
});
const layout = readFileSync(join(root, 'layout.html'), 'utf-8');

mkdirSync(join(distDir, 'docs'), { recursive: true });
mkdirSync(join(distDir, 'vendor'), { recursive: true });

// Wrium itself is the site's only "framework" dependency - vendored straight
// from the sibling library repo's own build output, the same file a real
// `npm install @wrium/wrium` would resolve to.
cpSync(wriumBundle, join(distDir, 'vendor/wrium.es.js'));

mkdirSync(join(distDir, 'shared'), { recursive: true });
cpSync(join(root, 'shared/theme.css'), join(distDir, 'shared/theme.css'));
cpSync(join(root, 'public'), distDir, { recursive: true });

// Every page's footer is identical - render it once and reuse it.
const footerHtml = await prerenderComponent('site-footer', SiteFooter, { version: '1.0.0' });

// The header only varies by which nav link is active, so there are exactly
// two distinct renders needed, not one per page.
const headerHtmlByCurrent = {
    home: await prerenderComponent('site-header', SiteHeader, { current: 'home' }),
    docs: await prerenderComponent('site-header', SiteHeader, { current: 'docs' })
};

const heroCodeHtml = highlightHtml(readFileSync(join(root, 'snippets/hero-demo.html'), 'utf-8'));
const todoCodeHtml = highlightHtmlDark(readFileSync(join(root, 'snippets/todo-example.html'), 'utf-8'));

const indexHtml = readFileSync(join(root, 'index.html'), 'utf-8')
    .replaceAll('{{SITE_URL}}', SITE_URL)
    .replace('{{HEADER_HTML}}', headerHtmlByCurrent.home)
    .replace('{{FOOTER_HTML}}', footerHtml)
    .replace('{{HERO_CODE}}', heroCodeHtml)
    .replace('{{TODO_CODE}}', todoCodeHtml);
writeFileSync(join(distDir, 'index.html'), indexHtml);

const pages = DOC_ORDER.map(slug => {
    const raw = readFileSync(join(contentDir, `${slug}.md`), 'utf-8');
    const titleMatch = raw.match(/^#\s+(.+)$/m);
    return { slug, title: titleMatch ? titleMatch[1] : slug, raw };
});

const sidebarLinks = pages
    .map(p => `<li><a href="/docs/${p.slug}" data-slug="${p.slug}">${p.title}</a></li>`)
    .join('\n');

for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const prevPage = i > 0 ? pages[i - 1] : null;
    const nextPage = i < pages.length - 1 ? pages[i + 1] : null;

    let contentHtml = md.render(page.raw);
    // The docs repo's own pages link to each other as "installation.md" -
    // rewrite those to the built site's actual page paths.
    contentHtml = contentHtml.replace(/href="([a-z0-9-]+)\.md"/g, 'href="/docs/$1"');
    contentHtml = contentHtml
        .replace(/<table>/g, '<div class="table-container"><table>')
        .replace(/<\/table>/g, '</table></div>');

    const paginationHtml = `
<nav class="doc-pagination" aria-label="Documentation pagination">
    ${prevPage ? `<a class="doc-pagination-link prev" href="/docs/${prevPage.slug}">
        <span class="doc-pagination-label">← Previous</span>
        <span class="doc-pagination-title">${prevPage.title}</span>
    </a>` : '<div></div>'}
    ${nextPage ? `<a class="doc-pagination-link next" href="/docs/${nextPage.slug}">
        <span class="doc-pagination-label">Next →</span>
        <span class="doc-pagination-title">${nextPage.title}</span>
    </a>` : '<div></div>'}
</nav>`;

    contentHtml += paginationHtml;

    const sidebarHtml = sidebarLinks.replace(
        `data-slug="${page.slug}">`,
        `data-slug="${page.slug}" class="active">`
    );

    const description = DOC_DESCRIPTIONS[page.slug] || `${page.title} - Official documentation for Wrium.`;
    const canonicalUrl = `${SITE_URL}/docs/${page.slug}`;

    const schemaJson = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'TechArticle',
                '@id': `${canonicalUrl}#article`,
                'headline': `${page.title} · Wrium Documentation`,
                'description': description,
                'url': canonicalUrl,
                'isPartOf': {
                    '@type': 'WebSite',
                    '@id': `${SITE_URL}/#website`,
                    'name': 'Wrium',
                    'url': `${SITE_URL}/`
                }
            },
            {
                '@type': 'BreadcrumbList',
                '@id': `${canonicalUrl}#breadcrumb`,
                'itemListElement': [
                    {
                        '@type': 'ListItem',
                        'position': 1,
                        'name': 'Home',
                        'item': `${SITE_URL}/`
                    },
                    {
                        '@type': 'ListItem',
                        'position': 2,
                        'name': 'Docs',
                        'item': `${SITE_URL}/docs/introduction`
                    },
                    {
                        '@type': 'ListItem',
                        'position': 3,
                        'name': page.title,
                        'item': canonicalUrl
                    }
                ]
            }
        ]
    }, null, 2);

    const schemaTag = `<script type="application/ld+json">\n${schemaJson}\n</script>`;

    const html = layout
        .replaceAll('{{SITE_URL}}', SITE_URL)
        .replaceAll('{{TITLE}}', page.title)
        .replaceAll('{{DESCRIPTION}}', description)
        .replaceAll('{{CANONICAL_URL}}', canonicalUrl)
        .replace('{{SCHEMA_JSON_LD}}', schemaTag)
        .replace('{{HEADER_HTML}}', headerHtmlByCurrent.docs)
        .replace('{{FOOTER_HTML}}', footerHtml)
        .replace('{{SIDEBAR}}', sidebarHtml)
        .replace('{{CONTENT}}', contentHtml);

    writeFileSync(join(distDir, 'docs', `${page.slug}.html`), html);
    console.log(`built docs/${page.slug}.html`);
}

// Sitemap generation
const today = new Date().toISOString().split('T')[0];
const sitemapUrls = [
    `  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`,
    ...pages.map(p => `  <url>
    <loc>${SITE_URL}/docs/${p.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`)
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join('\n')}
</urlset>
`;
writeFileSync(join(distDir, 'sitemap.xml'), sitemapXml);
console.log('built sitemap.xml');

// Robots.txt generation
const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
writeFileSync(join(distDir, 'robots.txt'), robotsTxt);
console.log('built robots.txt');

console.log('built index.html');
console.log('\nDone -> dist/');
