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
 * Between them the scores below use every one of the engine's 17 states and all 16
 * of its expressions, and none of them is decoration: each one is somewhere a
 * reader can tell what it means.
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
   * slow — twenty seconds a beat, and it cannot start until the panel has been left
   * alone. Nobody is watching a dozing mascot; that is what dozing means.
   */
  dozing: {
    loop: true,
    caption: 'Taking a breather',
    beats: [beat('idle', 20, 'somnolent'), beat('sleep', 3), beat('idle', 20, 'somnolent')],
  },

  /** Someone is typing at it. Being looked at while you type is most of the effect. */
  listening: {
    loop: true,
    caption: 'Listening',
    beats: [beat('idle', 0, 'surpris')],
  },

  /**
   * Sent, nothing back yet. Opens on the three dots, because that is the universal
   * "thinking" and worth two seconds of recognition — then hands over to
   * `pondering`, which has a face, well before the mascot has been away long
   * enough to be missed.
   */
  thinking: {
    loop: true,
    caption: 'Thinking',
    beats: [beat('thinking', 2.5), beat('pondering', 3, 'attentif')],
  },

  /**
   * The long wait, and the fullest use of the vocabulary: twelve beats, about
   * thirty seconds, then round again.
   *
   * **The order is the design.** Most requests finish inside ten seconds, so the
   * first four beats are the ones that keep a face and read plainly — rings, dots,
   * eyes sweeping, a puzzled look. The dramatic ones that collapse the body or take
   * the face away (`play`, `egg`, `comet`, `hexagon`, `burst`) sit past the
   * twenty-second mark, where a reader has been waiting long enough that theatre is
   * a reward rather than the mascot going missing mid-sentence.
   */
  working: {
    loop: true,
    caption: 'Working on it',
    beats: [
      beat('pondering', 3, 'attentif'),
      beat('thinking', 2.5),
      beat('scanning', 2.5),
      beat('pondering', 3, 'curieux'),
      beat('orbit', 3.4),
      beat('scanning', 2.5),
      beat('play', 2),
      beat('pondering', 3, 'neutre'),
      beat('egg', 1.8),
      beat('comet', 2.4),
      beat('hexagon', 1.6),
      beat('burst', 2.6),
    ],
  },

  /** The answer is arriving. Eager, and still tracking, so it watches you read. */
  writing: {
    loop: true,
    caption: 'Writing',
    beats: [beat('idle', 3, 'excite'), beat('idle', 2.5, 'hilare'), beat('idle', 3, 'attentif')],
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
   * A write is held, waiting to be approved. Loops, so it keeps at you until you
   * decide: wide measured eyes, then a narrow sideways look. The one moment the
   * mascot should stop being charming and check you meant it.
   */
  asking: {
    loop: true,
    caption: 'Waiting for your go-ahead',
    beats: [beat('wide', 1.8), beat('idle', 3, 'mefiant')],
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
   * The alarm lands, the mascot is cross, and then it is a little sheepish — because
   * the operator has still done nothing wrong personally, and the copy alongside
   * stays plain about what would be needed instead.
   */
  blocked: {
    loop: false,
    caption: 'Blocked by a security rule',
    beats: [beat('exclaim', 1.5), beat('idle', 2.4, 'colere'), beat('idle', 1.6, 'timide')],
  },

  /** Being stopped mid-sentence earns a little dryness. Flat slits. */
  stopped: {
    loop: false,
    caption: 'Stopped',
    beats: [beat('idle', 1.8, 'blase')],
  },

  /**
   * The travelling "!", a startled beat, then downcast. It decays rather than
   * holding, because the error text on screen says what happened and says it better
   * than a sad face can.
   */
  failed: {
    loop: false,
    caption: 'That did not work',
    beats: [beat('alert', 2.2), beat('idle', 1.2, 'effraye'), beat('idle', 2, 'triste')],
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
