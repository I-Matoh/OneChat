/**
 * Text Merge Service with Conflict Detection
 * 
 * Three-way merge algorithm for collaborative text editing.
 * Compares base, current, and incoming versions to detect conflicts.
 * Returns merged content with conflict markers if needed.
 */

/**
 * Merge text with conflict detection.
 * 
 * @param {string} baseText - Common ancestor version
 * @param {string} currentText - Current server state
 * @param {string} incomingText - Incoming client changes
 * @returns {Object} { content, merged, conflict }
 */
function mergeTextWithConflicts(baseText, currentText, incomingText) {
  const base = typeof baseText === 'string' ? baseText : '';
  const current = typeof currentText === 'string' ? currentText : '';
  const incoming = typeof incomingText === 'string' ? incomingText : '';

  if (current === base) return { content: incoming, merged: false, conflict: false };
  if (incoming === base) return { content: current, merged: false, conflict: false };
  if (incoming === current) return { content: current, merged: false, conflict: false };

  const currentLines = current.split('\n');
  const incomingLines = incoming.split('\n');

  const commonPrefix = [];
  let i = 0;
  while (i < currentLines.length && i < incomingLines.length && currentLines[i] === incomingLines[i]) {
    commonPrefix.push(currentLines[i]);
    i += 1;
  }

  const mergedContent = [
    ...commonPrefix,
    '<<<<<<< incoming',
    ...incomingLines.slice(i),
    '=======',
    ...currentLines.slice(i),
    '>>>>>>> current',
  ].join('\n');

  return { content: mergedContent, merged: true, conflict: true };
}

module.exports = { mergeTextWithConflicts };
