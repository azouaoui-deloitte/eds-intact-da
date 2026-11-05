import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Accordion (FAQ). Item rows: question, answer (rich text).
 * @param {Element} block
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    const [labelCell, bodyCell] = [...row.children];
    const details = document.createElement('details');
    details.className = 'accordion-item';
    moveInstrumentation(row, details);

    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    const label = document.createElement('span');
    label.textContent = labelCell?.textContent.trim() || '';
    if (labelCell) moveInstrumentation(labelCell, label);
    summary.append(label);

    const body = bodyCell || document.createElement('div');
    body.className = 'accordion-item-body';
    details.append(summary, body);
    row.replaceWith(details);
  });
}
