import { decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

function imageSlot(picture, className, source) {
  const slot = document.createElement('span');
  slot.className = className;
  if (picture) {
    picture.querySelector('img')?.setAttribute('alt', '');
    slot.append(picture);
  }
  if (source) moveInstrumentation(source, slot);
  return slot;
}

/**
 * Product list (Figma i-products: .intact-products-desktop states Default / hover / focus,
 * .intact-products-mobile below 1024).
 * Item cells: pictogram (mobile / tablet), title, reveal group (hover illustration +
 * description, shown on desktop hover / focus), link.
 * @param {Element} block
 */
export default function decorate(block) {
  const list = document.createElement('ul');
  [...block.children].forEach((row) => {
    const [pictoCell, titleCell, revealCell, linkCell] = [...row.children];
    const li = document.createElement('li');
    moveInstrumentation(row, li);

    const href = linkCell?.querySelector('a')?.getAttribute('href');
    const item = document.createElement(href ? 'a' : 'div');
    item.className = 'product-list-item';
    if (href) item.href = href;

    const descSource = [...(revealCell?.children || [])]
      .find((el) => !el.querySelector('picture') && el.tagName !== 'PICTURE');
    const picto = imageSlot(pictoCell?.querySelector('picture'), 'product-list-pictogram', pictoCell);
    const illustration = imageSlot(revealCell?.querySelector('picture'), 'product-list-illustration');

    const title = document.createElement('h3');
    title.className = 'product-list-title';
    title.textContent = titleCell?.textContent.trim() || '';
    if (titleCell) moveInstrumentation(titleCell, title);

    const desc = document.createElement('span');
    desc.className = 'product-list-description';
    const looseText = [...(revealCell?.childNodes || [])]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('');
    desc.textContent = (descSource ? descSource.textContent : looseText).trim();
    if (descSource) moveInstrumentation(descSource, desc);
    if (revealCell) moveInstrumentation(revealCell, illustration);

    const chevron = document.createElement('span');
    chevron.className = 'icon icon-chevron-right product-list-chevron';

    item.append(picto, illustration, title, desc, chevron);
    li.append(item);
    if (linkCell) {
      const link = linkCell.querySelector('a');
      if (link && link.dataset.aueProp) moveInstrumentation(link, item);
      moveInstrumentation(linkCell, item);
    }
    list.append(li);
  });
  decorateIcons(list);
  block.replaceChildren(list);
}
