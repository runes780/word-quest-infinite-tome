const isBrowser = typeof window !== 'undefined';

export async function downloadNodeAsImage(node: HTMLElement | null, filename = 'word-quest-report.png') {
    if (!isBrowser || !node) return;
    try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(node, {
            pixelRatio: 2,
            cacheBust: true,
            backgroundColor: '#04020f'
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
    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) {
        console.error('Popup blocked while attempting to open print view.');
        return;
    }
    printWindow.document.write(`<!doctype html>
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { background: #0b0618; color: #f8fafc; font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; }
                    .print-card { max-width: 900px; margin: 0 auto; }
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
