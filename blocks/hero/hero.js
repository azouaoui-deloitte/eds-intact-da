import { moveInstrumentation } from '../../scripts/scripts.js';

const ON_IMAGE = ['left-on-image', 'center-on-image', 'in-container'];

/**
 * Hero (Figma i-hero > .intact-hero-lockup > i-button-group).
 * Rows: image, tag, text (heading, body, fully bold group label, buttons, phone line).
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  // documents may drop the empty tag row: media, (tag), text
  const [mediaRow, tagRow, textRow] = rows.length === 2 ? [rows[0], null, rows[1]] : rows;
  if (!block.className.match(/\b(left|center|in-container|half|simple)/)) block.classList.add('left-on-image');
  if (ON_IMAGE.some((style) => block.classList.contains(style))) block.classList.add('reversed');

  mediaRow?.classList.add('hero-media');
  if (!mediaRow?.querySelector('picture')) block.classList.add('no-image');
  // AEM drops an empty imageAlt: an image without alternative text is decorative
  mediaRow?.querySelectorAll('img:not([alt])').forEach((img) => img.setAttribute('alt', ''));
  const content = textRow?.firstElementChild;
  if (!content) return;
  textRow.classList.add('hero-lockup');

  const tagText = tagRow?.textContent.trim();
  if (tagText) {
    const tag = document.createElement('p');
    tag.className = 'hero-tag';
    tag.textContent = tagText;
    moveInstrumentation(tagRow.firstElementChild || tagRow, tag);
    content.prepend(tag);
  }
  tagRow?.remove();

  const buttons = [...content.querySelectorAll(':scope > p.button-wrapper')];
  if (buttons.length) {
    const group = document.createElement('div');
    group.className = 'hero-button-group';
    const label = buttons[0].previousElementSibling;
    if (label && label.tagName === 'P' && label.children.length === 1
      && label.firstElementChild.tagName === 'STRONG' && !label.querySelector('a')
      && label.textContent.trim() === label.firstElementChild.textContent.trim()) {
      label.classList.add('hero-group-label');
      group.append(label);
    }
    const row = document.createElement('div');
    row.className = 'hero-buttons';
    buttons[0].before(group);
    row.append(...buttons);
    group.append(row);
    let next = group.nextElementSibling;
    if (next && next.tagName === 'P') {
      next.classList.add('hero-phone');
      next = next.nextElementSibling;
    }
    while (next) {
      if (next.tagName === 'P') next.classList.add('hero-note');
      next = next.nextElementSibling;
    }
  }

  const heading = content.querySelector('h1, h2');
  let body = heading?.nextElementSibling;
  while (body && body.tagName === 'P' && !body.closest('.hero-button-group')) {
    body.classList.add('hero-body');
    body = body.nextElementSibling;
  }
}
