#!/usr/bin/env bash
# Mechanical first pass for the declutter skill. Every hit is a lead to judge,
# not a finding. Usage: scan.sh <path> [<path>…]   (run from the repo root)
set -uo pipefail

if [ $# -eq 0 ]; then
  echo "usage: $0 <path> [<path>…]" >&2
  exit 2
fi

INCLUDES=(--include='*.ts' --include='*.tsx' --include='*.css' --include='*.md' --include='*.mdx')
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.claude)

section() { printf '\n=== %s ===\n' "$1"; }

hits() { # hits <label> <extended-regex> [extra grep flags]
  local label=$1 re=$2; shift 2
  local out
  out=$(grep -rnE "${INCLUDES[@]}" "${EXCLUDES[@]}" "$@" -- "$re" "${TARGETS[@]}" 2>/dev/null)
  [ -z "$out" ] && return
  local n; n=$(printf '%s\n' "$out" | wc -l | tr -d ' ')
  printf -- '-- %s (%s)\n' "$label" "$n"
  # Long lists are usually house style; show a sample and the files they cluster in.
  if [ "$n" -gt "${MAX_HITS:-25}" ]; then
    printf '%s\n' "$out" | head -n 10
    printf '   … by file:\n'
    printf '%s\n' "$out" | cut -d: -f1 | sort | uniq -c | sort -rn | head -n 10
  else
    printf '%s\n' "$out"
  fi
}

TARGETS=("$@")

section "COPY: AI vocabulary"
hits "buzzwords" '\b(delv(e|ing)|tapestry|testament|beacon|realm|elevat(e|es|ing)|empower(s|ing)?|unlock(s|ing)?|unleash|supercharg|revolutioni[sz]|game.?changer|cutting.?edge|state.of.the.art|next.level|world.class|seamless(ly)?|robust|powerful|intuitive|effortless(ly)?|streamlin|leverag|harness|synerg|holistic|multifaceted|comprehensive|pivotal|crucial|intricate|meticulous|vibrant|nestled|boasts?|showcas|foster|underscor|resonat|dependable|all.in.one|one.stop)\b' -i
hits "stock phrases" "(in today's|fast.paced world|navigat(e|ing) the|take .{1,20} to the next level|look no further|say goodbye to|whether you're|plays? a (key|vital|crucial) role|serves as|stands as|at the heart of|the backbone of|not (just|only) .{1,40} but)" -i

section "COPY: filler and chatbot voice"
hits "filler" "\b(simply|easily|effortlessly|in order to|please note|note that|it's important to|make sure to|feel free to|don't worry|allows you to|helps you)\b" -i
hits "chatbot voice" "(Certainly!|Great job|Let's get started|Oops|Awesome!|Woohoo|I hope)" -i
hits "exclamation in strings" "['\">][^'\"<>{}]{3,}![ '\"<]"
hits "emoji" $'[\xF0][\x9F][\x8C-\x9F][\x80-\xBF]|[\xE2][\x9C-\x9E][\x80-\xBF]'

section "VISUAL: decoration"
hits "gradients" '(bg-gradient-|bg-linear-|bg-radial-|linear-gradient\(|radial-gradient\(|\bvia-[a-z]+-[0-9]{2,3})'
hits "blur / glass / glow" '(backdrop-blur|blur-(sm|md|lg|xl|2xl|3xl)|drop-shadow|shadow-\[0_0_|glow)'
hits "heavy shadows (overlays only)" '\bshadow-(lg|xl|2xl)\b'
hits "raw palette colours" '\b(bg|text|border|from|to|via|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b'
hits "hex colours in className" 'className=[^>]*#[0-9a-fA-F]{3,8}\b'
hits "rounded-full (pill check)" '\brounded-full\b'

section "LAYOUT: off-scale values"
hits "arbitrary spacing/size" '\b-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y|w|h|min-w|min-h|max-w|max-h|top|left|right|bottom|inset)-\[[0-9.]+(px|rem|em)\]'
hits "arbitrary text size" '\btext-\[[0-9.]+(px|rem)\]'
hits "odd half steps" '\b(p|px|py|m|mx|my|mt|mb|gap|space-y|space-x)-(0\.5|1\.5|2\.5|3\.5)\b'

section "CODE: placeholders and leftovers"
hits "todo / placeholder data" '(TODO|FIXME|XXX|lorem|ipsum|John Doe|Jane Doe|Acme|example\.com|placeholder data|dummy|mock(ed)? data)' -i
hits "commented-out JSX" '\{/\*\s*<'
hits "vendor icons" "from ['\"](lucide-react|@hugeicons/react|react-icons)"

section "CODE: component files with no importer (verify by hand)"
# Every module specifier imported anywhere, collected once.
IMPORTS=$(grep -rhoE "${EXCLUDES[@]}" --include='*.ts' --include='*.tsx' --include='*.mts' \
  "(from|import\()[[:space:]]*['\"][^'\"]+['\"]" app components lib tests 2>/dev/null \
  | sed -E "s/.*['\"]([^'\"]+)['\"]/\1/" | sed -E 's#.*/##; s#\.(tsx?|mts)$##' | sort -u)
while IFS= read -r f; do
  base=$(basename "$f"); base=${base%.*}
  case "$base" in index|page|layout|route|loading|error|not-found|template|default|opengraph-image|twitter-image|sitemap|robots|manifest|icon) continue;; esac
  printf '%s\n' "$IMPORTS" | grep -qxF "$base" || echo "$f"
done < <(find "${TARGETS[@]}" -type f \( -name '*.tsx' -o -name '*.ts' \) -not -path '*/node_modules/*' 2>/dev/null)

section "ASSETS: public files referenced nowhere (only when public/ is in scope)"
for t in "${TARGETS[@]}"; do
  case "$t" in public*) ;; *) continue;; esac
  while IFS= read -r f; do
    rel=${f#public}
    if ! grep -rqF "${EXCLUDES[@]}" "$rel" app components lib DESIGN.md 2>/dev/null; then
      size=$(du -k "$f" | cut -f1)
      echo "$f (${size} KB)"
    fi
  done < <(find "$t" -type f)
done

echo
echo "Done. Judge every hit in context before it goes in the audit."
