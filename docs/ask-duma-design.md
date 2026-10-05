# Ask DUMA surface

## Overview

Ask DUMA extends the incumbent settings interface: calm, compact, and focused on the next useful action. It inherits the application’s semantic colours, typography, buttons, fields, and segmented controls. This document describes this surface only; it does not replace `DESIGN.md` or introduce a new global visual system.

## Colors

Use existing `card`, `field`, `band`, `foreground`, `muted-foreground`, `divider`, and focus tokens. User messages use a quiet band tint; assistant answers sit directly on the panel surface. Exceptions retain the existing exception treatment. The mascot inherits the application palette, with state-dependent happy and angry tints. Its appearance remains part of the settings family.

## Typography

The panel title is compact and semibold. A single muted status line sits beneath it. Answers use readable body text with generous line height; secondary controls, activity, and model information stay smaller and quieter. The welcome question is the largest text, with supporting copy and contextual suggestions beneath it.

## Layout

The hierarchy is header, independently scrolling conversation, then an attached composer. The header contains identity and window controls. The empty state offers one introduction and a short list of suggestions for the current page. Conversations distinguish right-aligned user messages from unboxed assistant answers without repeating the assistant’s identity on every response.

At widths of 640px and above, the panel is a movable, nonmodal 480px window, capped at 720px tall and constrained to the viewport. It makes room for application drawers or minimizes when space is insufficient. Below that breakpoint, the expanded panel fills the viewport and acts as a modal dialog. The minimized view becomes a compact bar. History replaces the conversation area and hides the composer.

The textarea grows to 160px and uses 16px text on narrow screens. Follow-ups wrap, history titles truncate, and scrolling follows incoming content only while the reader remains near the bottom.

## Elevation & Depth

The floating window uses the existing strong shadow to separate it from the application. Inside, dividers, field borders, and light band fills establish hierarchy; small control shadows follow the shared settings controls.

## Shapes

Retain the application’s compact rounded controls and panels. Suggestions are simple rows, history is a divided list, and assistant responses do not acquire additional card containers.

## Components

- **Answer length:** the same `SegmentedControl` appears in the composer and Settings → Ask DUMA, with **Short** and **Detailed** choices. Both read and update the same per-device persisted preference; Short is the default. The selected value travels with the request. This describes the implemented preference, not a verified guarantee of model output length.
- **Composer:** Enter sends; Shift+Enter adds a line. Composition input is respected. Empty messages cannot be sent, and generation replaces Send with Stop. The model selector and “Writes need your approval” reminder sit beneath the input.
- **Sources and activity:** completed evidence and steps are deduplicated and folded into a native disclosure. Copy remains available beside it. While waiting, the current step is readable as text; streaming answer text replaces that trail rather than adding another loading indicator.
- **Private history:** “Your conversations” presents recent chats for the current workspace and location. The query cache includes user, tenant, and location. Opening and deleting expose loading and failure states; deletion requires an inline Delete/Keep choice. “Only you can open them” expresses the intended API-backed privacy contract, which requires authenticated server verification.
- **Mascot:** the character is a soft hexagonal blob with two eyes, state-specific colour, open positive expressions, and an occasional two-part waving hand. Writing holds an attentive face, Answered pops a notification, and Completed uses an open pleased face with the celebration gesture. The hand draws outward from the body before the fingers wave, so it reads as one attached gesture rather than a floating symbol. Settings includes a live state and gesture preview. The user chose [Grokbot animation](https://github.com/iduu/grokbot-animation) as motion inspiration; no reference code is imported. Motion is state-driven, pauses off-screen, and respects reduced-motion preferences.
- **Accessibility:** the dialog has a named heading, icon buttons have accessible names, selected segments expose `aria-pressed`, progress uses polite status announcements, and errors use alerts. Mobile traps Tab within the expanded panel; desktop remains nonmodal. Escape minimizes, closing restores focus to the opener, and desktop movement supports Alt plus arrow keys. Visible focus and reduced-motion support follow shared components.

## Do's and Don'ts

- Do keep identity, request progress, and answer content in distinct places with minimal repetition.
- Do reuse the settings controls and semantic tokens, and keep sources available without leading the answer.
- Do retain explicit loading, empty, error, stop, and approval states.
- Don’t add per-frame React idle rendering, repeated mascot avatars, competing spinners, or another assistant visual language. Keep gestures occasional and tied to a clear event.

**Verification limits:** the primary implementation was visually checked in a local desktop preview and at 390×844. These checks are not a complete accessibility audit or coverage of every device, theme, and browser condition. A real authenticated API/model flow was unavailable; model responses, persisted conversation operations, server-enforced privacy, and write approvals still need end-to-end verification in an authenticated environment.
