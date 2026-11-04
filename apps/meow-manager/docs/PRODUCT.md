# Product record — 4 November 2026

Jared asked for a little cat personal assistant that both organises the day and helps get things done, using the current app infrastructure and documenting the process. His partner liked the concept. He suggested Japan as a possible market and thought the character would be easy to market. These are the starting hypothesis and owner direction; demand and acquisition costs have not been measured. **Meow Manager** is a working title.

The experience should feel like a small, capable friend: warm, useful and easy to return to. Missed days never harm the cat or trigger guilt. Task completion earns a happy expression and encouragement; it does not gate basic help. An original illustrated cat is the centre of the product. Users can name it and choose gentle or cheeky wording.

## What the first implementation does

| Area | Current behaviour |
|---|---|
| Capture | A brain dump becomes editable task proposals. English/Japanese dates, weekday names, explicit times, relative reminders, duration and priority are recognised by local rules. Every proposal is reviewed before saving. |
| Organise | A day plan fits flexible tasks around today's calendar busy times, preserves fixed times, flags collisions, shows later work and exposes work that will not fit before the chosen day end. Suggested times do not write changes to a calendar. |
| Remember | Users select local phone reminders, request permission in context, and can snooze for 15 minutes. Edits, completion and deletion reconcile scheduled notifications. Tapping a native notification opens its task. |
| Help | Task-specific starter checklists, editable message drafts, explicit web search, a focus timer and the phone's calendar editor. Each action shows its actual result. Android's calendar-editor dismissal is not reported as a confirmed save. |
| Rituals | Simple daily check-ins, with completion retained by the local calendar date. No streak penalties. |
| Personal space | Cat name/personality, optional on-device speech, day-end setting, English/Japanese, backup export and validated restore. |
| Continuity | Tasks, steps, preferences, rituals and the last 100 chat entries persist on the device. Failed loads do not overwrite existing storage. |

## Boundaries of this version

The conversation uses local intent rules and templates. It does not yet provide unrestricted AI conversation, connected email, automatic reservations, purchases or autonomous cross-app execution. A draft is editable text; web search opens a browser; calendar creation opens the operating system editor. No message is sent by this app. The focus timer does not generate a background alarm and is not restored after restarting the app.

The cat's lifecycle is visual: breathing animation honours reduced-motion preferences, and happy expressions reflect progress. It is not a collectible or care game. UI artwork is original code-native SVG, without external art inputs.

English and Japanese cover the complete UI and local capture rules. Japanese copy still needs review by a fluent target-market tester. Prices, positioning, retention and willingness to pay remain untested. No paywall, billing, account or hosted AI spend was introduced. Next build work is maintained only in the master roadmap.
