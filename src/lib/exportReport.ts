const isBrowser = typeof window !== 'undefined';

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
    try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(node, {
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
    }
}

export function openNodePrintView(node: HTMLElement | null, title = 'Word Quest Progress Report') {
    if (!isBrowser || !node) return;
    const html = node.outerHTML;
    const documentStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((styleNode) => styleNode.outerHTML)
        .join('\n');
    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) {
        console.error('Popup blocked while attempting to open print view.');
        return;
    }
    printWindow.document.write(`<!doctype html>
        <html>
            <head>
                <title>${title}</title>
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
