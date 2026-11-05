/**
 * Side by side (Figma i-side by side: Type Default / In Container, Order Image Right / Image Left).
 * Rows: image, text (heading, body, CTA).
 * @param {Element} block
 */
export default function decorate(block) {
  const [mediaRow, textRow] = [...block.children];
  mediaRow?.classList.add('side-by-side-media');
  // AEM drops an empty imageAlt: an image without alternative text is decorative
  mediaRow?.querySelectorAll('img:not([alt])').forEach((img) => img.setAttribute('alt', ''));
  textRow?.classList.add('side-by-side-lockup');
  const inner = document.createElement('div');
  inner.className = 'side-by-side-inner';
  inner.append(...[textRow, mediaRow].filter(Boolean));
  block.replaceChildren(inner);
  if (['burgundy', 'teal'].some((theme) => block.classList.contains(theme))) block.classList.add('reversed');
}
