'use client';

import { useEffect, useState } from 'react';

import type { ExpressionId } from '@/lib/mascot/engine/expressions';
import { STATE_BY_ID, type StateId } from '@/lib/mascot/engine/states';

/**
 * What the mascot is doing, and why.
 *
 * The panel knows facts — a request is in flight, three steps have streamed, a
 * rule declined the question — and the mascot knows poses. This is the layer
 * between, and keeping it separate is what stops the pose vocabulary leaking into
 * the panel's request handling, where it would end up re-derived at four sites.
 *
 * **Every phase is a short film, not a still.** A phase that can last — a wait, an
 * idle panel — plays a sequence of beats and loops it, because one pose held for
 * thirty seconds stops being a character and becomes a spinner. A phase that is a
 * moment plays its beats once and hands back to rest.
 *
 * ## The one rule these scores follow: the mascot keeps its body
 *
 * `StateDef.baseBody` says whether a state keeps the mascot's own silhouette.
 * Seven of the engine's seventeen do — `idle`, `wink`, `wide`, `notify`, `swirl`,
 * `pondering`, `scanning`. The other ten replace it: `thinking` becomes the middle
 * of three dots, `play` a tumbling triangle, `egg` an egg, `orbit` a triangle
 * relaxing into a ball, `comet` a streak, `burst` a cloud of particles, `sleep` a
 * bobbing dot.
 *
 * These scores used to reach for all seventeen, on the reasoning that a long wait
 * has earned some theatre. That was the wrong reading of what a wait is. A wait is
 * the *only* time anybody looks at this mascot for more than a second, and it spent
 * most of that time not being the mascot — a reader watching for their answer saw a
 * triangle, then an egg, then a comet. Variety was never the problem being solved;
 * it looked like a demo reel of the engine, which is what it was.
 *
 * So a wait now alternates two poses that both keep the face and the ball —
 * `pondering`, which orbits rings around it, and `scanning`, which sweeps its eyes
 * — and the moods carry the rest. `sleep` is the single exception, and it earns it:
 * curling into a dot is *what the pose means*, and it cannot happen until the panel
 * has been abandoned for 45 seconds.
 *
 * The unused states are not dead code — they belong to the vendored engine, not to
 * this file — but nothing here should reach for one again without an answer to
 * "what does the reader learn from the mascot disappearing".
 *
 * **The words stay plain while the motion carries the character.** The product's
 * voice rule is sentence case, operator language, and no exclamation marks, and a
 * chat that answers "Oops, something went wrong!" reads as a toy the third time an
 * operator sees it during service. So the mascot is where the warmth lives — it
 * looks at you, widens its eyes, spins up, frowns, sags when it fails — and the
 * captions say exactly what happened in the same voice as the rest of the product.
 */
export type AgentPhase =
  /** Open, nothing in flight. */
  | 'resting'
  /** Nothing in flight for a long while. */
  | 'dozing'
  /** The composer has something in it. */
  | 'listening'
  /** Sent, no steps back yet. */
  | 'thinking'
  /** Steps are streaming in. */
  | 'working'
  /** The answer is arriving on screen. */
  | 'writing'
  /** The answer just landed. */
  | 'delivered'
  /** A write is held, waiting to be approved. */
  | 'asking'
  /** A write actually ran. */
  | 'completed'
  /** Outside what this assistant does at all. An ordinary boundary. */
  | 'declined'
  /** A security rule said no: a capability not held, an approval not verified. */
  | 'blocked'
  /** The reader stopped it. */
  | 'stopped'
  /** It came back an error. */
  | 'failed';

export interface AgentMood {
  state: StateId;
  /**
   * Only bites on states carrying the resting face — `idle`, `pondering`,
   * `swirl`. Everywhere else the expression *is* the measured animation, which is
   * why a beat on one of those states declares no expression at all and inherits
   * whatever the last beat that cared about it set.
   */
  expression: ExpressionId;
  /** One short line, in the product's voice. Never the whole personality. */
  caption: string;
}

interface Beat {
  state: StateId;
  /** Omitted when the state carries its own measured face and would ignore it. */
  expression?: ExpressionId;
  /** Seconds to hold before the next beat. */
  hold: number;
}

/**
 * A beat, with its hold floored at whatever the state needs to finish saying
 * itself.
 *
 * `StateDef.minDuration` is the date at which an animation resolves, read off the
 * constants in its own pose: `alert` walks its "!" out and back over 2s, `burst`
 * recomposes at 2.4, `orbit` relaxes from a triangle into a ball at 2.5. Cutting
 * any of them early does not read as a change of beat, it reads as a dropped
 * frame. Flooring here rather than trusting the numbers below means a beat cannot
 * be written too short by accident, and a state whose timings are retuned upstream
 * drags its own beats along with it.
 */
const beat = (state: StateId, hold: number, expression?: ExpressionId): Beat => ({
  state,
  expression,
  hold: Math.max(hold, STATE_BY_ID.get(state)?.minDuration ?? 0),
});

interface Score {
  beats: Beat[];
  /**
   * true = start over after the last beat, for a phase that can last.
   * false = play once, then the phase is spent and the mascot returns to rest — so
   * a moment's dwell is the sum of its beats rather than a second number that has
   * to be kept in step with them by hand.
   */
  loop: boolean;
  caption: string;
}

const SCORES: Record<AgentPhase, Score> = {
  /**
   * One pose, held. An open panel with nothing happening in it stays put.
   *
   * This used to rotate through six moods with a wink in the middle, on the theory
   * that a rotating expression reads as alive. It does not — it reads as the panel
   * doing something when nothing has happened, which is noise in a tool somebody
   * has open while they think about what to type. The mascot is still alive here:
   * the engine breathes it, blinks it on a pre-drawn schedule, and drifts its gaze,
   * and it follows the cursor. That is life without events.
   *
   * `attentif` rather than the measured `neutre`, whose eyes sit up in the corner
   * looking away — faithful to the reference video, and it reads as ignoring you.
   */
  resting: {
    loop: true,
    caption: 'Ready when you are',
    beats: [beat('idle', 0, 'attentif')],
  },

  /**
   * An abandoned panel: 45s of nothing, and then it curls up into a bobbing dot
   * every so often.
   *
   * The only score that changes pose without an event, and it earns it by being
   * slow — twenty-odd seconds of heavy-lidded idle to every three of curling up, and
   * it cannot start until the panel has been left alone. Nobody is watching a dozing
   * mascot; that is what dozing means, and it is also the one place a state that
   * abandons the body is the right pose rather than a lapse.
   *
   * Two beats, not three. The third was a second identical idle, which on a loop only
   * meant the gap between two curls alternated 22s, 44s, 22s for no reason a reader
   * could ever detect.
   */
  dozing: {
    loop: true,
    caption: 'Taking a breather',
    beats: [beat('idle', 22, 'somnolent'), beat('sleep', 3)],
  },

  /**
   * Someone is typing at it. Being looked at while you type is most of the effect,
   * so this is a held pose and the life in it comes from the cursor tracking.
   *
   * `curieux` rather than `surpris`: a tilted, interested head. Surprise is a
   * reaction to something that just happened, and holding it for as long as someone
   * takes to compose a question reads as a mascot permanently startled that anyone
   * would type at it.
   */
  listening: {
    loop: true,
    caption: 'Listening',
    beats: [beat('idle', 0, 'curieux')],
  },

  /**
   * Sent, nothing back yet.
   *
   * It used to open on `thinking` — the engine's own pose, which turns the ball into
   * the middle of three pulsing dots — for the universal recognition. But that spends
   * the first two and a half seconds of every single request with the mascot gone,
   * and those are the seconds a reader is actually watching. `pondering` says the
   * same thing with rings while keeping the face, which is the whole reason it was
   * written; leading with it is just applying that decision at the point it matters.
   */
  thinking: {
    loop: true,
    caption: 'Thinking',
    beats: [beat('pondering', 3.5, 'attentif'), beat('scanning', 2.5)],
  },

  /**
   * The long wait: two poses, four moods, about eighteen seconds, then round again.
   *
   * This was twelve beats and thirty seconds, five of them collapsing the body — see
   * the rule at the top of the file for why that is gone. What is left is the pair
   * that reads as work: rings orbiting a thinking face, and eyes sweeping the width
   * of the ball as though reading something.
   *
   * **The moods are what stops it being a loop.** They go attentive → curious →
   * attentive → level, so the same two silhouettes are never wearing the same face
   * twice running, and the beats lengthen slightly as the wait goes on — a mascot
   * that keeps up its opening tempo through a thirty-second request reads as
   * agitated, and a wait that is genuinely taking a while should settle rather than
   * fidget.
   */
  working: {
    loop: true,
    caption: 'Working on it',
    beats: [
      beat('pondering', 3, 'attentif'),
      beat('scanning', 2.5),
      beat('pondering', 3.5, 'curieux'),
      beat('scanning', 2.5),
      beat('pondering', 4.5, 'attentif'),
      beat('scanning', 3),
      beat('pondering', 5, 'neutre'),
    ],
  },

  /**
   * The answer is arriving. A held pose, and still tracking, so it watches you read.
   *
   * It used to cycle eager → laughing → attentive on eight-second rounds. Two things
   * were wrong with that. The mascot was performing over the top of the one moment
   * the reader's attention is entirely on the text — motion in the corner of the eye
   * while you read is a distraction, not warmth — and `hilare` is a laugh, which is a
   * reaction to something funny and not to a stock report finishing. One warm, calm
   * face held while it writes is both quieter and more like something paying
   * attention.
   */
  writing: {
    loop: true,
    caption: 'Writing',
    beats: [beat('idle', 0, 'heureux')],
  },

  /**
   * "Here you go": the pastille pops on the body's edge, then the mascot is pleased
   * with itself. Two beats because `notify` carries its own measured face and
   * cannot look pleased — the second beat is what puts a mood on it.
   */
  delivered: {
    loop: false,
    caption: 'Done',
    beats: [beat('notify', 1.6), beat('idle', 2, 'heureux')],
  },

  /**
   * A write is held, waiting to be approved. Loops, so it stays with you until you
   * decide: wide measured eyes, then attentive.
   *
   * The second beat was `mefiant`, a narrow suspicious squint, on the reasoning that
   * the mascot should check you meant it. Read again at the moment it actually plays,
   * that is the mascot being suspicious of the one person in the room authorised to
   * approve the write. Waiting attentively is the honest pose: the card beside it
   * already spells out exactly what will happen.
   */
  asking: {
    loop: true,
    caption: 'Waiting for your go-ahead',
    beats: [beat('wide', 1.8), beat('idle', 3.5, 'attentif')],
  },

  /**
   * A write actually ran — not a rehearsal, not a read. The one moment the mascot
   * has something to be pleased with itself about, so it is the only place `fier`
   * appears.
   */
  completed: {
    loop: false,
    caption: 'Done — that went through',
    beats: [beat('notify', 1.6), beat('idle', 2.2, 'fier')],
  },

  /**
   * Outside what this assistant does at all: code, a poem, the weather.
   *
   * Deliberately **not** cross. This is an ordinary boundary and the reader has done
   * nothing wrong — they asked a café operations assistant for something else, and
   * what they need next is the list of what it does, which the answer gives them. A
   * puzzled look says "that is not a thing I do" without any suggestion they should
   * have known.
   */
  declined: {
    loop: false,
    caption: 'Not something I do',
    beats: [beat('idle', 2.2, 'confus'), beat('idle', 1.4, 'attentif')],
  },

  /**
   * A security rule said no: a capability this operator does not hold, or an
   * approval that would not verify. **The only place the mascot is angry.**
   *
   * Reserved for this on purpose. Anger spent on ordinary boundaries is anger nobody
   * reads by the third time, and the two cases are not alike: being told a request
   * is off-topic is information, whereas being stopped by a permission or a failed
   * approval is the product refusing to be talked past, and it should look like it.
   *
   * The alarm lands, the mascot is guarded, and then it settles.
   *
   * The middle beat was `colere` — outright anger — and it was the one place in the
   * product where the interface is cross with the reader. Its own justification said
   * the quiet part out loud: "the operator has still done nothing wrong personally".
   * Something the reader did not do wrong should not be answered with a face aimed at
   * them. `mefiant` is the pose that fits: the product is guarding something, which
   * is what actually happened.
   */
  blocked: {
    loop: false,
    caption: 'Blocked by a security rule',
    beats: [beat('exclaim', 1.5), beat('idle', 2.4, 'mefiant'), beat('idle', 1.6, 'attentif')],
  },

  /** Being stopped mid-sentence earns a little dryness. Flat slits. */
  stopped: {
    loop: false,
    caption: 'Stopped',
    beats: [beat('idle', 1.8, 'blase')],
  },

  /**
   * A startle, then downcast. It decays rather than holding, because the error text
   * on screen says what happened and says it better than a sad face can.
   *
   * It opened on `alert` — the mascot replaced by a travelling "!" for 2.2s. The
   * loud version is kept for `blocked` above, where something is genuinely being
   * refused and being stopped is the message; a request that simply failed does not
   * need the character to leave the screen to say so. `wide` is the same startle with
   * the ball still there.
   */
  failed: {
    loop: false,
    caption: 'That did not work',
    beats: [beat('wide', 1.8), beat('idle', 1.2, 'effraye'), beat('idle', 2, 'triste')],
  },
};

/**
 * How long the panel sits untouched before the mascot dozes off.
 *
 * Long enough that it cannot happen while someone is thinking about what to type,
 * short enough to be a discoverable piece of character rather than a rumour.
 * Dozing is also the honest reading of an abandoned panel.
 */
const DOZE_AFTER = 45_000;

/** The mood a beat inherits when no earlier beat in its score declared one. */
const FALLBACK_EXPRESSION: ExpressionId = 'attentif';

/**
 * The expression in force at `index`: the last one any beat asked for.
 *
 * Beats on states with their own measured face — `wink`, `alert`, `orbit`, the
 * rest — declare none, and this carries the previous one through them rather than
 * resetting to a default. Two reasons, the second load-bearing: it keeps the data
 * honest, since an expression written beside a state that ignores it is a lie about
 * what the pose does; and it avoids a spurious morph, because the engine blends the
 * *outgoing* pose too, so flipping the mood on the way out of `idle` would animate
 * a change nobody asked for underneath the change they did.
 */
function expressionAt(beats: Beat[], index: number): ExpressionId {
  for (let i = index; i >= 0; i--) {
    const declared = beats[i]?.expression;
    if (declared) return declared;
  }
  return FALLBACK_EXPRESSION;
}

/**
 * Resolve the panel's facts into a pose.
 *
 * The caller reports what is true and never has to un-report it: a phase whose
 * score does not loop (`delivered`, `failed`, `stopped`, `blocked`) plays out and
 * hands back to rest on its own, so the panel can leave `phase` on `delivered`
 * right up until the next question without the pastille sitting there all session.
 */
export function useAgentMood(phase: AgentPhase, { canDoze = false }: { canDoze?: boolean } = {}): AgentMood {
  /**
   * The phase the timers below belong to, so a change of phase can retire them.
   *
   * Compared during render and corrected on the spot, which is React's documented
   * way to adjust state when a prop changes — not reset at the top of an effect.
   * The difference is not stylistic: an effect that resets state runs *after* a
   * render has already gone out with the stale value, so a phase change would paint
   * one frame of the previous pose before correcting itself. Every timer below
   * therefore only ever writes from its own callback.
   */
  const [tracking, setTracking] = useState(phase);
  /** How many beats have elapsed since this phase began. Grows without bound. */
  const [elapsed, setElapsed] = useState(0);
  const [dozing, setDozing] = useState(false);

  /**
   * Tracked separately from the phase, and only `dozing` is cleared with it.
   *
   * Minimising and restoring the panel changes whether it may doze without changing
   * the phase, and a mascot still asleep in a panel you have just deliberately
   * reopened reads as broken rather than as resting.
   */
  const [dozeGate, setDozeGate] = useState(canDoze);

  if (tracking !== phase) {
    setTracking(phase);
    setElapsed(0);
    setDozing(false);
  }

  if (dozeGate !== canDoze) {
    setDozeGate(canDoze);
    setDozing(false);
  }

  const score = SCORES[phase];
  /*
   * A one-shot score that has played out. The beat counter keeps going, and the
   * overflow becomes the index into the resting score — so a `delivered` that has
   * finished does not freeze on its last frame, it carries straight on into idle
   * life at the beat it would have reached anyway.
   */
  const spent = !score.loop && elapsed >= score.beats.length;
  const settled: AgentPhase = dozing ? 'dozing' : spent ? 'resting' : phase;
  const active = SCORES[settled];
  const index = (spent ? elapsed - score.beats.length : elapsed) % active.beats.length;

  useEffect(() => {
    // A looping score with one beat has nowhere to advance to: it is a held pose,
    // and `resting` and `listening` are both that. Without this guard they would
    // wake a timer every few seconds for the life of the panel to re-select the
    // beat they were already on.
    if (active.loop && active.beats.length === 1) return;
    const hold = active.beats[index]?.hold ?? 3;
    const timer = window.setTimeout(() => setElapsed((current) => current + 1), hold * 1_000);
    return () => window.clearTimeout(timer);
  }, [active, index]);

  useEffect(() => {
    if (!canDoze || settled !== 'resting') return;
    const timer = window.setTimeout(() => setDozing(true), DOZE_AFTER);
    return () => window.clearTimeout(timer);
  }, [canDoze, settled]);

  return {
    state: active.beats[index]?.state ?? 'idle',
    expression: expressionAt(active.beats, index),
    caption: active.caption,
  };
}
