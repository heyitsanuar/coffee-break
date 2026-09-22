# Design guidelines

Coffee Break uses a warm, contemporary office-inspired interface. Application chrome stays restrained so the future Phaser office remains the visual focus.

## Application tokens

Tokens use role-based names so components express intent rather than a particular shade. The initial application palette is:

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#F5F1E9` | Desktop canvas |
| `--color-surface` | `#FFFCF7` | Panels and application surfaces |
| `--color-ink` | `#302B29` | Primary text |
| `--color-ink-muted` | `#625A56` | Secondary text |
| `--color-coffee` | `#A56B46` | Warm decorative emphasis |
| `--color-sage` | `#77917A` | Calm decorative emphasis |

Typography uses the native system sans-serif stack. Body text starts at `1rem`; display text uses a fluid title token so it scales down with the window. Spacing tokens follow a small `0.5rem`, `0.75rem`, `1.5rem`, and `2rem` scale. Radius tokens cover panels and fully round marks.

## Layout and components

The React application shell owns desktop layout and application surfaces. Content should reflow within the supported `760 × 540` minimum window, use a readable maximum width, and keep essential content visible without horizontal scrolling. The welcome screen demonstrates the shell, surface, type hierarchy, spacing, and radius conventions.

Components must use shared tokens for colors and repeated, semantic spacing. Isolated component-specific dimensions and decorative geometry may use local literal values when a reusable token would add no value. Add a primitive only when a current screen needs it. Interactive controls must have visible keyboard focus, clear hover and pressed feedback, and accessible names.

## Agent status proposal

Future agent status UI should combine a text label with a shape or icon; color alone must never carry status. Use sage for available or completed states, coffee for active work, and neutral ink treatments for waiting or offline states. Error and warning colors will be chosen when those states are implemented and can be checked in context. Status transitions and animation are deferred.

## Phaser boundary

These CSS tokens belong to React application UI. Phaser scenes and art assets will keep their own palette and rendering rules in EP-02; do not import application CSS into Phaser or treat these tokens as game-state contracts.
