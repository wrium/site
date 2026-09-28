import { JSDOM } from 'jsdom';

// Renders a wrium component to a plain HTML string at build time, so the
// static page ships real content instead of an empty custom-element tag
// that only fills in once the client-side script loads and mounts. When
// wrium mounts for real in the browser, it overwrites this markup with an
// identical result (same component, same props) - no visible flash, no
// layout shift, and no changes needed to wrium's own compiler.
//
// wrium's compiler reads a single global `document` (only hit here by the
// component-expansion path itself, not by v-if/v-for, which these simple
// components don't use) - a fresh JSDOM document is installed there for
// the duration of each render and nothing else is touched.
export async function prerenderComponent(tagName, componentDef, staticProps) {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');
    const previousDocument = globalThis.document;
    globalThis.document = dom.window.document;

    try {
        // Node caches this module across calls, so the component registry
        // accumulates registrations from earlier calls too - harmless, since
        // each call only mounts the one tag it cares about, and re-registering
        // the same name/def is idempotent.
        const { createApp } = await import('@wrium/wrium');

        const el = dom.window.document.createElement(tagName);
        for (const [key, value] of Object.entries(staticProps)) {
            el.setAttribute(key, value);
        }

        createApp(() => ({}))
            .component(tagName, componentDef)
            .mount(el);

        return el.innerHTML;
    } finally {
        globalThis.document = previousDocument;
    }
}
