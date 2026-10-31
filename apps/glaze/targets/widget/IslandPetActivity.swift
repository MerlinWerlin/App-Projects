import ActivityKit
import SwiftUI
import WidgetKit

// T188 (owner-1101 #6): the pet follows its day (src/core/petLife.ts). The app sends a new content
// state only at a state boundary; `until` is the staleDate, and once it passes iOS re-renders the
// activity with `isStale`, so the view shows the next state the app already sent. Between updates
// the only moving part is the system-drawn countdown (Text(timerInterval:)); poses change with
// short opacity / position transitions when the content state changes. No timer, no push.

/// What to draw for one content state.
struct PetLifePose: Equatable {
  let state: String
  let mood: String
  let spot: Int
  let facingLeft: Bool
  let until: Date?

  @available(iOS 16.2, *)
  init(_ s: GlazePetAttributes.ContentState, stale: Bool) {
    // Activities from older builds carry only the three legacy poses.
    let legacy = s.mood == "sleepy" ? "sleeping" : s.mood == "playful" ? "playing" : "happy"
    let now = s.state ?? legacy
    let nowMood = s.lifeMood ?? (s.mood == "happy" ? "happy" : s.mood)
    let nowSpot = s.spot ?? 2
    if stale, let next = s.nextState {
      state = next
      mood = s.nextMood ?? nowMood
      spot = s.nextSpot ?? nowSpot
      facingLeft = spot < nowSpot
      until = nil
    } else {
      state = now
      mood = nowMood
      spot = nowSpot
      facingLeft = (s.nextSpot ?? nowSpot) < nowSpot
      until = s.until
    }
  }
}

private func petStateKey(_ state: String) -> LocalizedStringKey {
  switch state {
  case "sleeping": return "pet.lifeSleeping"
  case "waking": return "pet.lifeWaking"
  case "idle": return "pet.lifeIdle"
  case "eating": return "pet.lifeEating"
  case "playing": return "pet.lifePlaying"
  case "wandering": return "pet.lifeWandering"
  default: return "pet.lifeHappy"
  }
}

private func moodKey(_ mood: String) -> LocalizedStringKey {
  switch mood {
  case "sleepy": return "pet.sleepy"
  case "playful": return "pet.playful"
  case "content": return "pet.content"
  case "hungry": return "pet.hungry"
  default: return "pet.happy"
  }
}

private func stateSymbol(_ state: String) -> String {
  switch state {
  case "sleeping", "waking": return "moon.zzz.fill"
  case "eating": return "fork.knife"
  case "playing": return "sparkles"
  case "wandering": return "pawprint.fill"
  default: return "heart.fill"
  }
}

/// The pet on a short track: wandering moves it between five spots with a gentle ease.
struct PetTrack: View {
  let pet: String
  let pose: PetLifePose
  let size: CGFloat
  let step: CGFloat
  var body: some View {
    ZStack {
      IslandPetArt(pet: pet, mood: pose.mood, state: pose.state, facingLeft: pose.facingLeft)
        .frame(width: size, height: size)
        .offset(x: CGFloat(pose.spot - 2) * step)
        .id(pose.state)
        .transition(.opacity)
    }
    .frame(width: size + step * 4, height: size)
    .animation(.easeInOut(duration: 1.2), value: pose)
  }
}

/// Next-change countdown, drawn and ticked by the system (no app wake-ups).
struct PetUntil: View {
  let until: Date?
  var body: some View {
    if let until, until > Date() {
      Text(timerInterval: Date()...until, countsDown: true, showsHours: true)
        .monospacedDigit()
        .font(.caption2)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.trailing)
    }
  }
}

struct IslandPetActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: GlazePetAttributes.self) { context in
      let pose = PetLifePose(context.state, stale: context.isStale)
      let name = context.state.name ?? context.attributes.name
      HStack(spacing: 12) {
        PetTrack(pet: context.attributes.pet, pose: pose, size: 56, step: 10)
        VStack(alignment: .leading, spacing: 3) {
          Text(name).font(.headline)
          Text(petStateKey(pose.state)).font(.subheadline)
            .contentTransition(.opacity)
          Text(moodKey(pose.mood)).font(.caption).foregroundStyle(.secondary)
        }
        Spacer(minLength: 0)
        VStack(alignment: .trailing, spacing: 4) {
          Image(systemName: stateSymbol(pose.state))
            .foregroundStyle(.pink)
            .contentTransition(.symbolEffect(.replace))
            .accessibilityHidden(true)
          PetUntil(until: pose.until).frame(maxWidth: 64)
        }
      }
      .padding(16)
      .animation(.easeInOut(duration: 0.8), value: pose)
      .activityBackgroundTint(Color(red: 0.13, green: 0.10, blue: 0.17))
      .activitySystemActionForegroundColor(.white)
      .foregroundStyle(.white)
      .widgetURL(URL(string: "glaze://pets"))
    } dynamicIsland: { context in
      let pose = PetLifePose(context.state, stale: context.isStale)
      let name = context.state.name ?? context.attributes.name
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          PetTrack(pet: context.attributes.pet, pose: pose, size: 48, step: 6)
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 4) {
            Text(name).font(.headline)
            Text(moodKey(pose.mood)).font(.caption).foregroundStyle(.secondary)
            PetUntil(until: pose.until).frame(maxWidth: 64)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(petStateKey(pose.state)).font(.caption)
            .contentTransition(.opacity)
        }
      } compactLeading: {
        IslandPetArt(pet: context.attributes.pet, mood: pose.mood, state: pose.state, facingLeft: pose.facingLeft)
          .frame(width: 24, height: 24)
          .id(pose.state)
          .transition(.opacity)
      } compactTrailing: {
        Image(systemName: stateSymbol(pose.state))
          .font(.caption).foregroundStyle(.pink)
          .contentTransition(.symbolEffect(.replace))
          .accessibilityLabel(Text(petStateKey(pose.state)))
      } minimal: {
        IslandPetArt(pet: context.attributes.pet, mood: pose.mood, state: pose.state, facingLeft: pose.facingLeft)
          .frame(width: 22, height: 22)
      }
      .widgetURL(URL(string: "glaze://pets"))
      .keylineTint(.pink)
    }
  }
}

/// Original pixel art with one pose per petLife frame set (sleep, stretch, sit, eat, play, walk,
/// cheer). Redrawn only when the content state changes; no perpetual animation or timer.
struct IslandPetArt: View {
  let pet: String
  let mood: String
  var state: String = "idle"
  var facingLeft: Bool = false
  var body: some View {
    Canvas { context, size in
      let sprite = IslandPetSprites.pet(pet)
      let unit = min(size.width, size.height) / 16
      let origin = CGPoint(x: (size.width - unit * 16) / 2, y: (size.height - unit * 16) / 2)
      let asleep = state == "sleeping"
      let eyesClosed = asleep || state == "waking" || mood == "sleepy"
      let cheer = state == "happy"
      // Pose: lying lower when asleep, a taller stretch on waking, head dipped while eating.
      let lift: Double = asleep ? 1.5 : state == "eating" ? 0.5 : 0
      let stretch: Double = state == "waking" ? 1.08 : 1
      let tilt = state == "playing" ? Angle.degrees(-6) : .zero
      context.translateBy(x: size.width / 2, y: size.height)
      context.rotate(by: tilt)
      context.scaleBy(x: facingLeft ? -1 : 1, y: stretch)
      context.translateBy(x: -size.width / 2, y: -size.height)
      for (y, row) in sprite.rows.enumerated() {
        for (x, pixel) in row.enumerated() where pixel != "." {
          let color: Color = pixel == "#" || pixel == "e" ? Color(red: 0.21, green: 0.16, blue: 0.25) :
            pixel == "w" ? Color(red: 1, green: 0.96, blue: 0.90) : sprite.color
          let eye = pixel == "e"
          // Closed eyes are a thin low line; cheering eyes are a thin high arc.
          let eyeY: Double = eye && eyesClosed ? 0.55 : eye && cheer ? 0.15 : 0
          let eyeH: Double = eye && (eyesClosed || cheer) ? 0.3 : 1
          let rect = CGRect(x: origin.x + Double(x) * unit,
                            y: origin.y + (Double(y) + lift + eyeY) * unit,
                            width: unit, height: eyeH * unit)
          context.fill(Path(rect), with: .color(color))
        }
      }
    }
    .overlay(alignment: .topTrailing) {
      PetPropMark(state: state, mood: mood)
    }
    .overlay(alignment: .bottomTrailing) {
      if state == "eating" {
        Capsule().fill(Color(red: 0.95, green: 0.76, blue: 0.32))
          .frame(width: 7, height: 3).padding(1)
      } else if state == "playing" {
        Circle().fill(Color(red: 0.89, green: 0.47, blue: 0.65))
          .frame(width: 5, height: 5).padding(1)
      }
    }
    .accessibilityLabel(Text(IslandPetSprites.pet(pet).name))
    .accessibilityValue(Text(petStateKey(state)))
  }
}

/// Small corner mark per pose: z for sleep, a sparkle for play/stretch, a heart for cheer.
struct PetPropMark: View {
  let state: String
  let mood: String
  var body: some View {
    Group {
      switch state {
      case "sleeping": Text("z").font(.system(size: 7, weight: .bold, design: .rounded)).foregroundStyle(Color.white.opacity(0.85))
      case "waking", "playing": Image(systemName: "sparkle").font(.system(size: 6)).foregroundStyle(.yellow)
      case "happy": Image(systemName: "heart.fill").font(.system(size: 6)).foregroundStyle(.pink)
      default: EmptyView()
      }
    }
    .accessibilityHidden(true)
  }
}
