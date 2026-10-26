import ActivityKit
import SwiftUI
import WidgetKit

struct IslandPetActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: GlazePetAttributes.self) { context in
      HStack(spacing: 16) {
        IslandPetArt(pet: context.attributes.pet, mood: context.state.mood)
          .frame(width: 64, height: 64)
        VStack(alignment: .leading, spacing: 4) {
          Text(context.attributes.name).font(.headline)
          Text(moodKey(context.state.mood)).font(.subheadline)
          Text("pet.open").font(.caption).foregroundStyle(.secondary)
        }
        Spacer(minLength: 0)
        Image(systemName: "heart.fill").foregroundStyle(.pink)
      }
      .padding(16)
      .activityBackgroundTint(Color(red: 0.13, green: 0.10, blue: 0.17))
      .activitySystemActionForegroundColor(.white)
      .foregroundStyle(.white)
      .widgetURL(URL(string: "glaze://pets"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          IslandPetArt(pet: context.attributes.pet, mood: context.state.mood)
            .frame(width: 52, height: 52)
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 4) {
            Text(context.attributes.name).font(.headline)
            Text(moodKey(context.state.mood)).font(.caption).foregroundStyle(.secondary)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text("pet.open").font(.caption).foregroundStyle(.secondary)
        }
      } compactLeading: {
        IslandPetArt(pet: context.attributes.pet, mood: context.state.mood)
          .frame(width: 24, height: 24)
      } compactTrailing: {
        Image(systemName: context.state.mood == "sleepy" ? "moon.fill" : context.state.mood == "playful" ? "sparkles" : "heart.fill")
          .font(.caption).foregroundStyle(.pink)
          .accessibilityLabel(Text(moodKey(context.state.mood)))
      } minimal: {
        IslandPetArt(pet: context.attributes.pet, mood: context.state.mood)
          .frame(width: 22, height: 22)
      }
      .widgetURL(URL(string: "glaze://pets"))
      .keylineTint(.pink)
    }
  }
}

private func moodKey(_ mood: String) -> LocalizedStringKey {
  switch mood {
  case "sleepy": return "pet.sleepy"
  case "playful": return "pet.playful"
  default: return "pet.happy"
  }
}

/// Original pixel art. Updates only when the owner interacts; no perpetual animation or timer.
struct IslandPetArt: View {
  let pet: String
  let mood: String
  var body: some View {
    Canvas { context, size in
      let sprite = IslandPetSprites.pet(pet)
      let unit = min(size.width, size.height) / 16
      let origin = CGPoint(x: (size.width - unit * 16) / 2, y: (size.height - unit * 16) / 2)
      for (y, row) in sprite.rows.enumerated() {
        for (x, pixel) in row.enumerated() where pixel != "." {
          let color: Color = pixel == "#" || pixel == "e" ? Color(red: 0.21, green: 0.16, blue: 0.25) :
            pixel == "w" ? Color(red: 1, green: 0.96, blue: 0.90) : sprite.color
          let sleepyEye = pixel == "e" && mood == "sleepy"
          let rect = CGRect(x: origin.x + Double(x) * unit,
                            y: origin.y + (Double(y) + (sleepyEye ? 0.55 : 0)) * unit,
                            width: unit, height: (sleepyEye ? 0.3 : 1) * unit)
          context.fill(Path(rect), with: .color(color))
        }
      }
      if mood != "sleepy" {
        let mark = Text(Image(systemName: mood == "playful" ? "sparkle" : "heart.fill"))
          .font(.system(size: unit * 3)).foregroundColor(mood == "playful" ? .yellow : .pink)
        context.draw(mark, at: CGPoint(x: size.width - unit * 1.5, y: unit * 2))
      }
    }
    .accessibilityLabel(Text(IslandPetSprites.pet(pet).name))
    .accessibilityValue(Text(moodKey(mood)))
  }
}
