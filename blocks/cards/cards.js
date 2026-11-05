import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Cards. Item rows: image, tag (optional), text (rich text with an optional CTA link).
 * Variant "overlay" (Figma S04 image cards): text and CTA over the image.
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    const [imageCell, tagCell, bodyCell] = [...row.children];
    if (imageCell) {
      imageCell.className = 'cards-card-image';
      li.append(imageCell);
    }
    if (tagCell && tagCell.textContent.trim()) {
      const tag = document.createElement('span');
      tag.className = 'cards-card-tag';
      tag.textContent = tagCell.textContent.trim();
      moveInstrumentation(tagCell, tag);
      li.append(tag);
    }
    if (bodyCell) {
      bodyCell.className = 'cards-card-body';
      li.append(bodyCell);
    }
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '800' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  if (block.classList.contains('overlay')) block.classList.add('reversed');
  block.replaceChildren(ul);
}
