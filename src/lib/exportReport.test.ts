import { createPrivacySafeExportClone, openNodePrintView } from './exportReport';

describe('privacy-safe report export', () => {
    afterEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    test('removes private and interactive fields without mutating the source node', () => {
        const source = document.createElement('section');
        source.innerHTML = `
            <p data-export-private="true">Synthetic private study sentence</p>
            <input value="synthetic learner note" />
            <a href="https://example.invalid/private">External resource</a>
            <img src="https://example.invalid/private.png" onerror="alert(1)" />
            <span data-summary="true">6 questions completed</span>
        `;

        const clone = createPrivacySafeExportClone(source);

        expect(clone.textContent).not.toContain('Synthetic private study sentence');
        expect(clone.querySelector('input')).toBeNull();
        expect(clone.querySelector('a')).not.toHaveAttribute('href');
        expect(clone.querySelector('img')).not.toHaveAttribute('src');
        expect(clone.querySelector('img')).not.toHaveAttribute('onerror');
        expect(clone.textContent).toContain('6 questions completed');

        expect(source.textContent).toContain('Synthetic private study sentence');
        expect(source.querySelector('input')).not.toBeNull();
    });

    test('prints only the sanitized clone, escaped title, and same-origin stylesheets', () => {
        const source = document.createElement('section');
        source.innerHTML = '<p data-export-private="true">private question</p><p>aggregate evidence</p>';
        const localStyle = document.createElement('link');
        localStyle.rel = 'stylesheet';
        localStyle.href = '/app.css';
        document.head.appendChild(localStyle);
        const externalStyle = document.createElement('link');
        externalStyle.rel = 'stylesheet';
        externalStyle.href = 'https://example.invalid/tracker.css';
        document.head.appendChild(externalStyle);

        const written: string[] = [];
        const printWindow = {
            document: {
                write: (value: string) => written.push(value),
                close: jest.fn()
            },
            focus: jest.fn(),
            print: jest.fn()
        } as unknown as Window;
        jest.spyOn(window, 'open').mockReturnValue(printWindow);
        jest.spyOn(global, 'setTimeout').mockImplementation(((callback: TimerHandler) => {
            if (typeof callback === 'function') callback();
            return 1;
        }) as typeof setTimeout);

        openNodePrintView(source, '<Synthetic & Report>');

        const html = written.join('');
        expect(html).toContain('&lt;Synthetic &amp; Report&gt;');
        expect(html).toContain('aggregate evidence');
        expect(html).not.toContain('private question');
        expect(html).toContain('/app.css');
        expect(html).not.toContain('tracker.css');
        expect(printWindow.print).toHaveBeenCalled();
    });
});
