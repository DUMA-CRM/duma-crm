/** Canonical wording; existing suffixes and legacy asterisks are never doubled. */
export function fieldLabel(label: string, required = false, optional = false) {
  const markedRequired = /\s*\*\s*$|\(required\)\s*$/i.test(label);
  const markedOptional = /\(optional\)\s*$/i.test(label);
  const text = label.replace(/\s*(\*|\((optional|required)\))\s*$/i, '').trim();
  const isRequired = required || markedRequired;
  return { text, required: isRequired, optional: !isRequired && (optional || markedOptional) };
}
