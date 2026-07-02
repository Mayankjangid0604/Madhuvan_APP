/**
 * Utility to print content without opening a new window (uses a hidden iframe)
 * This replaces window.open calls for printing.
 */
export const printElement = (content, title = "Print", styles = "") => {
    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>${title}</title>
                <style>${styles}</style>
            </head>
            <body>
                ${content}
                <script>
                    window.onload = () => {
                        window.focus();
                        window.print();
                        setTimeout(() => {
                            window.parent.document.body.removeChild(window.frameElement);
                        }, 500);
                    };
                </script>
            </body>
        </html>
    `);
    doc.close();
};
