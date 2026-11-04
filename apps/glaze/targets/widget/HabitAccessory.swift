import SwiftUI
import WidgetKit

extension HabitKindID {
  var widgetFamilies: [WidgetFamily] {
    nativeSizes.compactMap {
      switch $0 {
      case "small": return .systemSmall
      case "medium": return .systemMedium
      case "accessoryCircular": return .accessoryCircular
      case "accessoryRectangular": return .accessoryRectangular
      case "accessoryInline": return .accessoryInline
      default: return nil
      }
    }
  }
  var accessorySymbol: String {
    switch self {
    case .water: return "drop.fill"
    case .sleep: return "bed.double.fill"
    case .steps: return "figure.walk"
    case .mood: return "face.smiling"
    }
  }
}

/// Lock Screen readouts use the same persisted tracker entry as the interactive Home Screen widgets.
/// The system supplies monochrome/vibrant presentation; a tap opens the app's habit cards.
struct HabitAccessoryView: View {
  let entry: HabitEntry
  let family: WidgetFamily
  var design: SavedWidgetDesign? = nil

  private var def: HabitDef { HabitDef.of(entry.habit) }
  private var title: String { design?.habitTitle ?? def.name }
  private var value: Double { entry.value.isFinite ? min(def.max, max(0, entry.value)) : 0 }
  private var valueText: String { entry.habit == .mood && value == 0 ? "—" : HabitStore.format(value, decimals: def.decimals) }
  private var fraction: Double {
    let goal = entry.habit == .mood ? 5 : (entry.goal ?? def.goal ?? 1)
    return goal.isFinite && goal > 0 ? min(1, value / goal) : 0
  }
  private var spokenValue: String {
    if entry.habit == .mood { return HabitText.mood(Int(value)) }
    let current = "\(valueText) \(def.unit)"
    guard let goal = entry.goal ?? def.goal, goal.isFinite, goal > 0 else { return current }
    return current + ", " + HabitText.goalOf(HabitStore.format(goal, decimals: def.decimals), unit: def.unit)
  }

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular: circular
      case .accessoryInline:
        Label("\(title): \(valueText) \(def.unit)", systemImage: entry.habit.accessorySymbol)
          .lineLimit(1)
      default: rectangular
      }
    }
    .foregroundStyle(.primary)
    .containerBackground(for: .widget) { Color.clear }
    .widgetURL(URL(string: "glaze://widgets"))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(title))
    .accessibilityValue(Text(spokenValue))
  }

  private var circular: some View {
    ZStack {
      AccessoryWidgetBackground()
      if entry.habit == .mood {
        VStack(spacing: 1) {
          MoodFace(level: value > 0 ? Int(value) : 3, selected: value > 0, theme: entry.theme, monochrome: true)
            .frame(width: 37, height: 37)
          Group {
            if value > 0 {
              HStack(spacing: 2) {
                Text(valueText)
                Text("/")
                Text(HabitStore.format(5, decimals: 0))
              }
              // Keep numerator/denominator in mathematical order in RTL, with native digits.
              .environment(\.layoutDirection, .leftToRight)
            } else { Text("—") }
          }.font(.system(size: 11, weight: .semibold))
        }
      } else {
        Circle().stroke(Color.primary.opacity(0.22), lineWidth: 4)
        Circle().trim(from: 0, to: fraction)
          .stroke(Color.primary, style: StrokeStyle(lineWidth: 4, lineCap: .round))
          .rotationEffect(.degrees(-90))
        VStack(spacing: 0) {
          Image(systemName: entry.habit.accessorySymbol).font(.system(size: 10, weight: .bold))
          Text(valueText).font(entry.theme.typeface(size: 18, weight: .bold))
            .lineLimit(1).minimumScaleFactor(0.45)
          Text(def.unit).font(.system(size: 9, weight: .medium)).lineLimit(1)
        }.padding(5)
      }
    }.padding(3)
  }

  private var rectangular: some View {
    HStack(spacing: 8) {
      if entry.habit == .mood {
        MoodFace(level: value > 0 ? Int(value) : 3, selected: value > 0, theme: entry.theme, monochrome: true)
          .frame(width: 32, height: 32)
      } else {
        Image(systemName: entry.habit.accessorySymbol).font(.system(size: 22, weight: .semibold))
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(title).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.primary.opacity(0.85))
          .lineLimit(1).minimumScaleFactor(0.75)
        if entry.habit == .mood {
          Text(HabitText.mood(Int(value))).font(entry.theme.typeface(size: 16, weight: .bold))
            .lineLimit(1).minimumScaleFactor(0.65)
        } else {
          HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(valueText).font(entry.theme.typeface(size: 21, weight: .bold))
              .lineLimit(1).minimumScaleFactor(0.45)
            Text(def.unit).font(.system(size: 10)).lineLimit(1)
          }
          GeometryReader { g in
            ZStack(alignment: .leading) {
              Capsule().fill(Color.primary.opacity(0.22))
              Capsule().fill(Color.primary).frame(width: g.size.width * fraction)
            }
          }.frame(height: 3)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}
