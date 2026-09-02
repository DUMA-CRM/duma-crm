# The mascot

Ask DUMA's mascot: one filled shape that morphs between poses, with two eyes
punched through it as holes. It is what the assistant looks like — in the header
button, in the panel's badge, and as the greeting on an empty panel.

|                                       |                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `engine/`                             | The animation engine, **vendored** from `bloub`. Do not edit except as noted below. |
| `gaze.ts`                             | Where the mascot looks. Ours, not vendored.                                         |
| `../../components/ai/Mascot.tsx`      | The React client: a clock, the pointer, the DOM.                                    |
| `../../components/ai/useAgentMood.ts` | Chat state → pose. Where the personality is decided.                                |

## The engine is vendored, and that is deliberate

`engine/` is a copy of `src/bot/` from
[bloub](https://github.com/jeremy-prt/bloub) at **0.1.1**,
MIT (`engine/LICENSE`, © 2026 Jérémy Perret). It came across essentially
unchanged because it was already built to: it is framework-free, clock-free, and
imports nothing but its own siblings. `engine.sample(t)` is a pure function of
time, which is what makes a frozen thumbnail, a reduced-motion still and a
DOM-less test all produce the same image as the animation does.

Two files were dropped as unused here — `cycles.ts` (the upstream timeline
editor's montage model) and the `*.test.ts` suite, which needs vitest and this
project runs `node --test`.

**Its constants are measurements, not choices.** They were extracted frame by
frame from a reference video, and rounding them to friendlier numbers breaks the
resemblance that is the only thing the engine is trying to get right. A few are
counter-intuitive enough to be worth knowing before "correcting" one: the eyes
lean `\\` and not `//`; the body is a true circle, not a squircle; transitions
are exponential ease-outs with no overshoot, not springs. Upstream's `docs/`
carries the rest, and the files themselves are heavily commented — in French,
which is also left alone, because translating comments that encode measured
constraints is a good way to lose one.

### The deviations

There are three, each marked `DUMA DEVIATION` in the file it lives in.

`engine/states.ts` adds **two** waiting states, and a wait alternates between them
on each streamed step so that a long request shows real progress rather than a
loop playing.

**`pondering`** is the mascot with rings orbiting it. The engine's own waiting pose,
`thinking`, turns the ball into the middle of three pulsing dots, which means the
mascot stops being a mascot for the whole of the one moment anybody is watching
it. `pondering` is built from `swirl`'s vocabulary instead: `baseBody` and
`baseFace` both true, so the body and the face survive and it can keep tracking
the pointer while it works, and its rings loop rather than fading out the way an
entrance's do. It sits outside `SEQUENCE`, which is upstream's own convention for
a state that serves an interface rather than the reference video — `swirl` is
there for the same reason.

**`scanning`** is the other beat: the eyes sweep the width of the sphere and back,
narrowed, which reads as reading. It keeps `baseBody` but sets `baseFace` false,
because the sweep _is_ the pose — so no resting expression may replace it, and
pointer tracking stands down for it, which is right: the mascot is looking at the
work rather than at you.

Both were bounded by eye **size**, not reach. The eyes are painted on a sphere, so
an eye's apparent area is the z of its own normal, and a wide gaze foreshortens the
far one until the mascot reads as having small eyes. Every swing in the product is
measured against the resting pose and held above roughly 85% of it — the tables are
in `lib/mascot/gaze.ts` (pointer tracking) and beside `scanning`'s `yaw` (the
sweep). Widen either and re-measure.

`engine/decor.ts` remaps the orbit rings' hue wheel onto the arc DUMA's domain
palette occupies, apricot through saffron and team green to periwinkle. Rendered
literally the rings are a rainbow, which would put five colours the product does
not own into the element people look at most. It is written as a lens over the
measured seed data rather than an edit of it — one affine map in `wheel()` —
specifically so the next pull from upstream still diffs cleanly.

`engine/` is also in `.prettierignore`, for the same reason: house style would
rewrite all twelve files and make every future diff unreadable.

## A phase is a short film, not a still

`useAgentMood` maps a chat phase to a **score**: a list of beats, each a state, an
optional expression, and how long to hold it. A phase that can last (a wait, an
idle panel) loops its score; a phase that is a moment plays once and hands back to
rest, so a moment's dwell is the sum of its beats rather than a second number kept
in step with them by hand.

Two rules earn their keep there:

- **Holds are floored at the state's `minDuration`.** That field is the date an
  animation resolves, read off the constants in its own pose — `alert` walks its "!"
  out and back over 2s, `burst` recomposes at 2.4. Cutting one early does not read
  as a change of beat, it reads as a dropped frame. Flooring in the `beat()` factory
  means a beat cannot be written too short by accident.

- **A beat on a state with its own measured face declares no expression**, and
  inherits the last one that was asked for. Writing a mood beside a state that
  ignores it would be a lie about what the pose does, and flipping it would animate
  a change nobody asked for underneath the change they did — the engine blends the
  _outgoing_ pose too.

**An idle panel holds still.** `resting` and `listening` are single-beat scores, so
nothing changes pose while somebody is sitting there deciding what to type — a
rotating expression reads as the panel doing something when nothing has happened.
The mascot is still alive there: the engine breathes it, blinks it on a pre-drawn
schedule, drifts its gaze, and it follows the cursor. Only `dozing` changes pose
without an event, and it earns that by being slow and by only starting once the
panel has been abandoned for 45 seconds.

**Angry is reserved for a security rule.** Two things can decline a request and they
are not alike: `declined` is an ordinary boundary (someone asked a café operations
assistant for a poem) and gets a puzzled look, while `blocked` is a capability the
operator does not hold or an approval that would not verify, and is the only place
the mascot is cross. Both are typed end to end — `AgentRefusal` in
`lib/ai/agent-types.ts`, thrown as `CapabilityError` / `ApprovalError` — rather than
recognised by matching words in a message, so rewording the copy cannot quietly turn
a refusal back into a generic failure.

The `working` score is where the ordering matters. Most requests finish inside ten
seconds, so its first beats are the ones that keep a face and read plainly; the
dramatic ones that collapse the body sit past twenty seconds, where a reader has
waited long enough that theatre is a reward rather than the mascot going missing
mid-sentence.

## The body is a hexagon

`Mascot`'s default `shape` is `hexagone`. The engine handles most of what a
non-circular body implies: the eyes and the notification pastille are refitted to
the real radius in their own direction, and a per-shape corrective
(`engine/eyefit.ts`, solved once at import and merely looked up at runtime) keeps
the eyes off the edge.

The one thing it cannot fix is a **spin**. Eyes travelling right round the sphere
step over a hexagon's flats and corners instead of gliding, so the entrance spin is
gone and `Aim.spin` has to be asked for explicitly — `Mascot` passes it only for a
circular body, so a change of shape cannot quietly reintroduce the stutter. The
arrival is `swirl`'s rings instead, which work on any profile.

## Colours are CSS, not hex

Upstream mixes particle fog in JS and therefore needs hex. `Mascot.tsx` hands
that to `color-mix()` instead, so `ink`, `paper` and `accent` take any CSS
colour — including the `--mascot-*` tokens in `app/globals.css`. The mascot then
follows the theme with no JS reading computed styles and no re-render on a theme
flip, and it inverts at night (bone body, charcoal eye holes), which is the one
element in the product that does.

`paper` has to be **the colour actually behind the mascot**, not one that looks
like it. The eyes are holes, so they show whatever is under the body — and the
back half of the orbit rings is drawn under it on purpose, to be occluded. The
opaque backing path in `paper` is what stops a ring reappearing inside the eyes.

## Cost

Two things were measured and fixed here, so they are worth knowing before
reintroducing either.

`getBoundingClientRect` forces a synchronous layout of the whole document. Calling
it from the pointermove handler — to know where the mascot is, so it can know where
the pointer is _relative_ to it — cost one full page layout per mouse movement and
made the animation stutter exactly while the pointer was moving. The handlers now
only set a flag; the measurement happens at most once per frame inside the rAF
callback, before React writes anything.

A mascot that is only decorating takes **`fps`** rather than being stopped. Because
`sample(t)` is a pure function of time, capping the sample rate is the same animation
with fewer frames drawn — nothing drifts and nothing desyncs — and it cuts the two
costs that matter, the path string and the React commit. The header mascot runs at
20fps at rest and full rate once you reach for it.

That 20 is measured, not chosen: everything the mascot does at rest is slow except
the blink, which lasts 0.18s, and auditing the whole pre-drawn 900-second blink
schedule shows 20fps is the cheapest rate that catches _every_ blink (15 drops 6 of
316, 12 drops 12). A missed blink is not a rough blink — it is one that never
happened, and a mascot that blinks only most of the time reads as one that stutters.

Beyond that, one mascot is one `requestAnimationFrame` loop rebuilding a 64-point
silhouette per frame. That is cheap once and not free on a shop-floor tablet all shift, so:
a mascot that is only decorating passes `paused` and wakes when it has something
to say; every mascot pauses itself off-screen and under
`prefers-reduced-motion`, where it renders a still at its state's most legible
instant instead.
