export function printHtmlDocument(html, { title = 'Print Preview' } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('title', title);
  frame.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none;'
  );

  const cleanup = () => {
    window.setTimeout(() => {
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    }, 250);
  };

  let hasPrinted = false;

  frame.onload = () => {
    if (hasPrinted) {
      return;
    }

    const frameWindow = frame.contentWindow;
    const frameDocument = frame.contentDocument;
    if (!frameWindow) {
      cleanup();
      return;
    }

    const hasPrintableContent = Boolean(
      frameDocument?.body &&
      (frameDocument.body.childElementCount > 0 || String(frameDocument.body.textContent || '').trim())
    );

    if (!hasPrintableContent) {
      return;
    }

    hasPrinted = true;
    frameWindow.focus();
    frameWindow.print();
    cleanup();
  };

  document.body.appendChild(frame);

  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    cleanup();
    return false;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  return true;
}
