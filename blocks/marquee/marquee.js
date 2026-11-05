import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Marquee (Figma Scroller/Marquee, S08 image strip). Item rows: image.
 * The track is duplicated (aria-hidden) so the CSS animation loops seamlessly.
 * @param {Element} block
 */
export default function decorate(block) {
  const track = document.createElement('ul');
  track.className = 'marquee-track';
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    const img = row.querySelector('picture > img');
    if (img) {
      const picture = createOptimizedPicture(img.src, img.alt, false, [{ width: '720' }]);
      moveInstrumentation(img, picture.querySelector('img'));
      li.append(picture);
    }
    track.append(li);
  });
  const clone = track.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  [clone, ...clone.querySelectorAll('*')].forEach((el) => [...el.attributes].forEach(({ name }) => {
    if (name.startsWith('data-aue-') || name.startsWith('data-richtext-')) el.removeAttribute(name);
  }));
  clone.querySelectorAll('img').forEach((img) => img.setAttribute('alt', ''));
  const viewport = document.createElement('div');
  viewport.className = 'marquee-viewport';
  viewport.append(track, clone);
  block.replaceChildren(viewport);
  const heading = block.closest('.section')?.querySelector('h2');
  block.setAttribute('role', 'region');
  block.setAttribute('tabindex', '0');
  if (heading) block.setAttribute('aria-label', heading.textContent.trim());
}
