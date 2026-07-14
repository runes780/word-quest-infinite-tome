const isBrowser = typeof window !== 'undefined';

const PRIVATE_EXPORT_SELECTOR = '[data-export-private="true"], input, textarea, select';

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/**
 * Build a detached, inert copy for report export. The source DOM is never
 * mutated, and fields explicitly marked private cannot enter an image/print
 * payload even if a future dashboard change accidentally renders them.
 */
export function createPrivacySafeExportClone(node: HTMLElement) {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(PRIVATE_EXPORT_SELECTOR).forEach((element) => element.remove());
    clone.querySelectorAll<HTMLElement>('*').forEach((element) => {
        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            if (name.startsWith('on') || name === 'contenteditable') {
                element.removeAttribute(attribute.name);
            }
            if ((name === 'src' || name === 'srcset') && !attribute.value.startsWith('data:')) {
                element.removeAttribute(attribute.name);
            }
            if (name === 'href' && !attribute.value.startsWith('#')) {
                element.removeAttribute(attribute.name);
            }
        }
    });
    return clone;
}

function privacySafeDocumentStyles() {
    return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .filter((styleNode) => {
            if (styleNode.tagName.toLowerCase() === 'style') return true;
            const href = (styleNode as HTMLLinkElement).href;
            if (!href) return false;
            try {
                return new URL(href, window.location.href).origin === window.location.origin;
            } catch {
                return false;
            }
        })
        .map((styleNode) => styleNode.outerHTML)
        .join('\n');
}

export interface ExportImageOptions {
    backgroundColor?: string;
    pixelRatio?: number;
}

export async function downloadNodeAsImage(
    node: HTMLElement | null,
    filename = 'word-quest-report.png',
    options: ExportImageOptions = {}
) {
    if (!isBrowser || !node) return;
    const exportNode = createPrivacySafeExportClone(node);
    exportNode.style.position = 'fixed';
    exportNode.style.left = '-100000px';
    exportNode.style.top = '0';
    exportNode.setAttribute('aria-hidden', 'true');
    document.body.appendChild(exportNode);
    try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(exportNode, {
            pixelRatio: options.pixelRatio ?? 2,
            cacheBust: true,
            backgroundColor: options.backgroundColor ?? '#f8fafc'
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.click();
    } catch (error) {
        console.error('downloadNodeAsImage error', error);
        throw error;
    } finally {
        exportNode.remove();
    }
}

export function openNodePrintView(node: HTMLElement | null, title = 'Word Quest Progress Report') {
    if (!isBrowser || !node) return;
    const html = createPrivacySafeExportClone(node).outerHTML;
    const documentStyles = privacySafeDocumentStyles();
    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) {
        console.error('Popup blocked while attempting to open print view.');
        return;
    }
    printWindow.document.write(`<!doctype html>
        <html>
            <head>
                <title>${escapeHtml(title)}</title>
                ${documentStyles}
                <style>
                    @page { margin: 12mm; }
                    html, body { background: #f8fafc; color: #020617; font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; }
                    .print-card { display: grid; min-height: 100vh; place-items: start center; padding: 24px; }
                    @media print {
                        body { background: #f8fafc; }
                        .print-card { min-height: auto; padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="print-card">${html}</div>
            </body>
        </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 300);
}
