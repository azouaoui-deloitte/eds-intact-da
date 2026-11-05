import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Product list (Figma "product list v2", states Default / hover).
 * Item rows: pictogram, title, description, link.
 * @param {Element} block
 */
export default function decorate(block) {
  const list = document.createElement('ul');
  [...block.children].forEach((row) => {
    const [pictoCell, titleCell, descCell, linkCell] = [...row.children];
    const li = document.createElement('li');
    moveInstrumentation(row, li);

    const href = linkCell?.querySelector('a')?.getAttribute('href');
    const item = document.createElement(href ? 'a' : 'div');
    item.className = 'product-list-item';
    if (href) item.href = href;

    const picto = document.createElement('span');
    picto.className = 'product-list-pictogram';
    const picture = pictoCell?.querySelector('picture');
    if (picture) {
      picture.querySelector('img')?.setAttribute('alt', '');
      picto.append(picture);
    }
    if (pictoCell) moveInstrumentation(pictoCell, picto);

    const title = document.createElement('h3');
    title.className = 'product-list-title';
    title.textContent = titleCell?.textContent.trim() || '';
    if (titleCell) moveInstrumentation(titleCell, title);

    const desc = document.createElement('span');
    desc.className = 'product-list-description';
    desc.textContent = descCell?.textContent.trim() || '';
    if (descCell) moveInstrumentation(descCell, desc);

    item.append(picto, title, desc);
    li.append(item);
    if (linkCell) {
      const link = linkCell.querySelector('a');
      if (link && link.dataset.aueProp) moveInstrumentation(link, item);
      moveInstrumentation(linkCell, item);
    }
    list.append(li);
  });
  block.replaceChildren(list);
}
