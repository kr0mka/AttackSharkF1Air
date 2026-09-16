(() => {
  'use strict';

  // Chromium 150+ on Windows has had a native color-picker/eyedropper
  // regression that can leave the whole browser window unresponsive. The
  // Sensor page creates one color input for every DPI stage, so prevent those
  // native controls from being instantiated at all. The existing save logic
  // only reads .value, therefore a normal #RRGGBB text field is a drop-in
  // replacement and does not change the mouse protocol.
  const content = document.getElementById('content');
  if (!content) return;

  const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!innerHtmlDescriptor?.get || !innerHtmlDescriptor?.set) return;

  const nativeGet = innerHtmlDescriptor.get;
  const nativeSet = innerHtmlDescriptor.set;

  const sanitizeHtml = (html) => String(html).replace(
    /type=(['"])color\1/gi,
    'type="text" data-safe-color="1" inputmode="text" maxlength="7" spellcheck="false"',
  );

  Object.defineProperty(content, 'innerHTML', {
    configurable: true,
    enumerable: false,
    get() {
      return nativeGet.call(this);
    },
    set(value) {
      nativeSet.call(this, sanitizeHtml(value));
    },
  });

  const style = document.createElement('style');
  style.textContent = `
    input[data-safe-color="1"] {
      width: 92px !important;
      min-width: 92px;
      height: 34px;
      padding: 7px 8px !important;
      font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      text-transform: uppercase;
    }
    input[data-safe-color="1"]:invalid {
      border-color: rgba(255, 90, 103, .65);
    }
  `;
  document.head.append(style);

  const lodLevels = [
    { raw: 1, label: '0.7 mm' },
    { raw: 2, label: '0.9 mm' },
    { raw: 3, label: '1.2 mm' },
    { raw: 4, label: '1.4 mm' },
    { raw: 5, label: '1.6 mm' },
  ];

  function enhanceRenderedControls() {
    for (const input of content.querySelectorAll('input[data-safe-color="1"]')) {
      if (input.dataset.safeColorReady === '1') continue;
      input.dataset.safeColorReady = '1';
      input.pattern = '#?[0-9A-Fa-f]{6}';
      input.title = 'DPI color as #RRGGBB. Native Chromium color picker disabled for stability.';
      input.setAttribute('aria-label', input.title);
      input.addEventListener('change', () => {
        let value = input.value.trim();
        if (/^[0-9A-Fa-f]{6}$/.test(value)) value = `#${value}`;
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) input.value = value.toUpperCase();
      });
    }

    const lod = content.querySelector('#lod-raw');
    if (lod && lod.dataset.f1VerifiedLabels !== '1') {
      const current = Number(lod.value);
      lod.replaceChildren(...lodLevels.map(({ raw, label }) => {
        const option = document.createElement('option');
        option.value = String(raw);
        option.textContent = label;
        return option;
      }));
      if (lodLevels.some((level) => level.raw === current)) lod.value = String(current);
      lod.dataset.f1VerifiedLabels = '1';

      const row = lod.closest('.setting-row');
      const title = row?.querySelector('.setting-copy b');
      const copy = row?.querySelector('.setting-copy small');
      if (title) title.textContent = 'LOD';
      if (copy) copy.textContent = 'Hardware-verified F1 AIR PAW3955 lift-off distance.';
    }
  }

  // MutationObserver callbacks run before the browser paints the newly-created
  // subtree. This also catches future re-renders after a setting is written.
  const observer = new MutationObserver(enhanceRenderedControls);
  observer.observe(content, { childList: true, subtree: true });
  queueMicrotask(enhanceRenderedControls);
})();
