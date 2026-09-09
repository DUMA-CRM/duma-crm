# The mascot

Ask DUMA's mascot: one flat filled ball that morphs between poses, with two eyes
set into it. It is what the assistant looks like — in the header button, in the
panel's badge, and as the greeting on an empty panel.

**Flat, and deliberately.** A shaded version was built — a body gradient lit from
the upper left, a specular blob, a bounce along the lower rim, a catchlight in each
eye — and rejected. The mascot's working size is the 44px header launcher, and at
that size every one of those effects competes with the only two things a reader
needs to resolve: the silhouette and the eyes.

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

`engine/decor.ts` remaps the orbit rings' hue wheel onto one arc of DUMA's palette,
**team green (150°) through teal to periwinkle (232°)**. Rendered literally the
rings are a rainbow, which would put five colours the product does not own into the
element people look at most.

The arc used to start at apricot (17°) and span 170°, chosen to cover the whole
domain palette. That was the right list and the wrong question: these rings only
appear in `pondering`, and `pondering` is now what the mascot does for nearly all of
every wait — so a rare flourish became the animation operators see most, and it was
orbiting a green ball with an apricot ring and a saffron one. Apricot means "measured
value" everywhere else in the product and saffron means stock; neither means
"thinking". The cool half of the same list travels from the mascot's own colour to
the one the product already uses for information.

It is written as a lens over the measured seed data rather than an edit of it — one
affine map in `wheel()` — specifically so the next pull from upstream still diffs
cleanly.

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

**The mascot is never cross with the reader.** Two things can decline a request and
they are not alike: `declined` is an ordinary boundary (someone asked a café
operations assistant for a poem) and gets a puzzled look, while `blocked` is a
capability the operator does not hold or an approval that would not verify — the
loud one, opening on the `exclaim` alarm.

`blocked`'s middle beat was `colere`, outright anger, and it was the one place in the
product where the interface was cross with the person using it. Its own justification
said the quiet part out loud: *"the operator has still done nothing wrong
personally."* It is `mefiant` now — the product guarding something, which is what
actually happened. `colere` is referenced by no score.

Both refusals are typed end to end — `AgentRefusal` in `lib/ai/agent-types.ts`,
thrown as `CapabilityError` / `ApprovalError` — rather than recognised by matching
words in a message, so rewording the copy cannot quietly turn a refusal back into a
generic failure.

### A wait keeps the mascot's body

`StateDef.baseBody` says whether a state keeps the mascot's own silhouette. Seven
of the seventeen do; the other ten replace it — `thinking` with three dots, `play`
with a tumbling triangle, `egg` with an egg, `comet` with a streak, `burst` with a
cloud of particles.

The scores used to reach for all seventeen, putting the theatrical ones past the
twenty-second mark on the reasoning that a long wait has earned some theatre. That
read a wait backwards. A wait is the *only* time anybody looks at this mascot for
more than a second, and it spent most of that time not being the mascot. So a wait
now alternates `pondering` (rings orbiting a live face) with `scanning` (eyes
sweeping the ball) and lets the moods carry the variety. `sleep` is the one
exception, because curling into a dot is what the pose *means* and it cannot happen
until the panel has been abandoned for 45 seconds.

## The body is a ball

`Mascot`'s default `shape` is `cercle`. It was `hexagone`; a ball is the friendlier
silhouette, it is what the engine's constants were measured against — upstream's own
note is that "the body is a true circle, not a squircle" — and it makes
`engine/eyefit.ts` a no-op, since on a circle the corrective profile and the
measured one are the same.

The other shapes still work, and the engine handles most of what a non-circular body
implies: the eyes and the notification pastille are refitted to the real radius in
their own direction, and that per-shape corrective (solved once at import and merely
looked up at runtime) keeps the eyes off the edge.

The one thing it cannot fix is a **spin**. Eyes travelling right round the sphere
step over a hexagon's flats and corners instead of gliding, so `Aim.spin` has to be
asked for explicitly rather than being implied by the shape. **`Mascot` passes 0
even now that the body could take one.** Rounding the body would otherwise have
switched a full 360° eye-spin on for every pointer entry into the header button, as
a side effect of a silhouette change — several times a minute, and a trick rather
than a reaction. The entrance turn (`turn`, an ease-out over `TURN_TIME`) is what
reads as looking up at you, and it stands on its own.

## Any mood is safe while tracking

An expression carries its own head roll — `attentif` -4°, `curieux` -15°, `confus`
+8° — and roll rotates the eye pair about the view axis, so it moves the eyes
vertically. Tracking neutralises yaw and pitch, because those are absolute in
`Look`, but it used to leave roll alone: a change of mood therefore slid the eyes
while they were supposed to be pinned to the cursor.

`gaze.ts` published a `TRACKING_MOODS` allow-list of the eight zero-roll moods to
work around it. That list was imported nowhere, and the resting mood the whole
product wears was not on it, so the defect was live everywhere. `Look` now carries
an absolute `roll` whose target is zero, so **tracking straightens the head** and a
mood change cannot move the eyes at all. Out of tracking the measured roll is
intact, which is where the tilt belongs — it is the character, not the reaction.

## Colours are CSS, not hex

Upstream mixes particle fog in JS and therefore needs hex. `Mascot.tsx` hands
that to `color-mix()` instead, so `ink`, `eye` and `accent` take any CSS colour —
including the `--mascot-*` tokens in `app/globals.css`. The mascot then follows the
theme with no JS reading computed styles and no re-render on a theme flip, and it
inverts at night (light-green body, charcoal eyes), which is the one element in the
product that does.

**They have to go through `style`, never a presentation attribute.** A presentation
attribute is not a CSS declaration, so neither `var()` nor `color-mix()` is
substituted in one: `fill="var(--mascot-ink)"` compiles, renders, and is silently
black. This is the easiest way to break the component — it looks right in the source
and the mascot comes out as a black ball with black eyes.

`eye` is a **material, not a hole**. The eyes are still punched through the body by
the mask — that is what clips them against the outline for free when they slide
towards the edge — but what shows through is an opaque layer painted in `eye`, in the
shape of the body. Two consequences: the eyes are the same colour on any surface, so
callers no longer have to declare what is behind the mascot (the header launcher used
to pass its own plate colour by hand); and that same opaque layer is what stops the
back half of the orbit rings, drawn under the body on purpose to be occluded, from
reappearing inside the eyes.

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
