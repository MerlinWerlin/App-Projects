# iOS character experience — 4 November 2026

Jared corrected the first implementation: the app should open into a highly professional kitty that comes to the user, occupies the screen and feels like a living companion with menus. The dashboard prototype is set aside. **iOS is the current product target.** This brief records the corrected experience; the master atlas Meow Manager row remains the only roadmap. The character appearance and room below are a proposal, not an approved final design.

![Static visual concept: arrival, conversation and a menu](character-direction/ios-character-concept.png)

This is an AI-generated static art-direction study. It is not a running iOS screen, an animation, a rigged 3D model or proof of native rendering quality. The exact built-in imagegen prompt is saved beside it in `character-direction/CONCEPT_PROMPT.txt`.

## The opening moment

The screen is a small world. The kitty is occupied at its desk, notices the user, puts down what it is doing and comes closer. A short greeting combines eye contact, ears, posture, tail movement and a voice/caption. It feels capable and welcoming. The user can speak or open a menu immediately; the arrival never locks out controls. Returning during a session uses a glance or nod rather than replaying an entrance every time.

On a first visit the greeting is an introduction. On a later visit the cat can offer a relevant briefing only from information actually available: an upcoming appointment, an overdue reminder or a task the user asked to revisit. Without that information it asks how it can help. It never invents what it knows about the person's day.

## The cat is the home screen

The proposed character is a distinctive cream/caramel kitty in a tailored waistcoat, with an understated tie and a small folio. Its professional quality comes from competent acting, materials, animation, lighting, voice and useful assistance. Clothing alone will not establish the experience. The concept uses a warm, carefully arranged office; that room and the character styling remain reviewable choices.

The cat occupies most of the screen. The camera and interface respond to its position. A quiet dock offers Today, Talk, Reminders and Menu. Planning, task editing and settings open as native sheets over the room. The cat stays in view, looks toward the sheet or moves aside. Returning to the room feels continuous. Large task lists do not define the first view.

## Conversation has visible acting

| Moment | Acting | Functional behaviour |
|---|---|---|
| Arrival | Notices user, comes forward, greets | Short, interruptible introduction or contextual briefing. |
| Idle | Subtle breathing, occasional blink, ear and tail reactions | Quiet and unobtrusive. Stop unnecessary animation when backgrounded. |
| Listening | Turns toward user, attentive eyes, small nod | Visible microphone state, explicit push-to-talk initially, editable transcript and a text alternative. |
| Thinking | Glances at folio or desk, considers | Shows real pending work. A cancellable action has a cancel control. |
| Speaking | Mouth shapes, brows, gaze and gestures coordinated with voice | Readable captions, replay/mute and speech interruption. No compulsory audio. |
| Offering help | Presents a suggestion, points toward a sheet | Clear proposed task/time/action, editable before a consequential change. |
| Task completed | Brief pleased reaction and a professional acknowledgement | Confirms the actual saved result. |
| Action unavailable | Honest, composed reaction | Explains the failed or unsupported action and offers a useful alternative. |

These states need authored transitions. Replacing a drawing with a large static render or a loop of a bobbing image would not establish the intended character interaction.

## What a useful session feels like

The user opens the app and says, “Tomorrow is a mess. Help me sort it.” The cat listens, checks connected calendar/task information, asks only for a missing fact that matters, and presents a manageable day in a sheet. If asked to book something, it shows the exact proposed action and reports only what a real connector confirms. After the sheet closes, the cat remains there and carries the context of the conversation. The personality connects the assistance into one experience.

Touch reactions, a little humour and an evolving relationship add charm. Essential assistance stays immediate. Hunger, damage, forced mini-games and penalties for time away are outside the current direction. English and Japanese remain desired language support, with fluent-user review still needed.

## Production implications

The next design proof is a short iPhone character scene: arrival, idle, tap reaction, attentive listening, voiced response with captions and a menu opening while the cat remains present. Character acting and continuity are the acceptance criteria before expanding the task screens. This is the current next step in the master roadmap, not a second build schedule.

A genuine 3D direction requires an original model, textures/materials, a body/face rig, authored clips and a tested rendering path. The image here supplies visual direction only. A technical spike must establish iPhone performance, asset size, loading, voice/animation coordination, interruption and reduced-motion behaviour before committing to a renderer. Existing storage and planning logic can be reused after the character experience works. The current App Factory repository, signing and TestFlight infrastructure can remain the release route; the new presentation layer has not been chosen or built.

Technical references checked for possible approaches: [Apple RealityKit](https://developer.apple.com/documentation/realitykit) and [Rive's Apple runtime](https://rive.app/docs/runtimes/apple/apple). These are candidates for evaluation, not integrated dependencies or a promise that either supplies the character assets.
