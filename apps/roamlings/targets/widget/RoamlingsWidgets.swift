// The Roamlings home-screen widget: your buddy, its mood and the egg meter.
// Small: buddy + name + egg meter. Medium: adds today's Spark and Feed / Pet buttons.
// The app writes the images and state (modules/roamlings-widget-bridge); this only reads them.
import AppIntents
import SwiftUI
import WidgetKit

struct BuddyEntry: TimelineEntry {
  let date: Date
  let state: WidgetState?
}

struct BuddyProvider: TimelineProvider {
  func placeholder(in context: Context) -> BuddyEntry { BuddyEntry(date: Date(), state: nil) }

  func getSnapshot(in context: Context, completion: @escaping (BuddyEntry) -> Void) {
    completion(BuddyEntry(date: Date(), state: WidgetState.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BuddyEntry>) -> Void) {
    let state = WidgetState.load()
    let now = Date()
    // One entry every 30 minutes for 6 hours, so the mood drifts as happiness decays.
    let entries = (0..<12).map { i in BuddyEntry(date: now.addingTimeInterval(Double(i) * 1800), state: state) }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

struct EggMeter: View {
  let progress: Double
  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(Color("rlTrack"))
        Capsule().fill(Color("rlSpark")).frame(width: max(6, geo.size.width * progress))
      }
    }
    .frame(height: 8)
  }
}

struct BuddyPicture: View {
  let state: WidgetState
  let date: Date
  var body: some View {
    if let img = BuddyImages.image(named: state.imageName(at: date)) {
      Image(uiImage: img).resizable().scaledToFit()
    } else {
      Image(systemName: "pawprint.fill").resizable().scaledToFit().padding(18).foregroundStyle(Color.accentColor)
    }
  }
}

struct EmptyBuddy: View {
  let state: WidgetState?
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "oval.portrait.fill").font(.system(size: 34)).foregroundStyle(Color("rlSpark"))
      Text(state?.labels.hatch ?? "Roamlings").font(.caption).bold().foregroundStyle(Color("rlInk"))
    }
  }
}

struct BuddySmallView: View {
  let entry: BuddyEntry
  var body: some View {
    if let s = entry.state, s.hasPet {
      VStack(spacing: 4) {
        BuddyPicture(state: s, date: entry.date).frame(maxHeight: .infinity)
        Text(s.name).font(.caption).bold().lineLimit(1).foregroundStyle(Color("rlInk"))
        EggMeter(progress: s.eggProgress)
      }
    } else {
      EmptyBuddy(state: entry.state)
    }
  }
}

struct BuddyMediumView: View {
  let entry: BuddyEntry
  var body: some View {
    if let s = entry.state, s.hasPet {
      HStack(spacing: 12) {
        BuddyPicture(state: s, date: entry.date).frame(width: 120)
        VStack(alignment: .leading, spacing: 6) {
          Text(s.name).font(.headline).lineLimit(1).foregroundStyle(Color("rlInk"))
          if s.eggsReady > 0 {
            Text("\(s.eggsReady) \(s.labels.eggsReady)").font(.caption).bold().foregroundStyle(Color.accentColor)
          } else {
            Text("\(s.labels.egg) \(Int(s.eggSpark))/\(Int(s.eggCost))").font(.caption).foregroundStyle(Color("rlInk2"))
          }
          EggMeter(progress: s.eggProgress)
          Text("\(s.labels.spark) \(Int(s.sparkToday))").font(.caption2).foregroundStyle(Color("rlInk2"))
          HStack(spacing: 8) {
            Button(intent: FeedBuddyIntent()) {
              Label(s.labels.feed, systemImage: "fork.knife").font(.caption).bold()
            }
            .tint(Color.accentColor)
            Button(intent: PetBuddyIntent()) {
              Label(s.labels.pet, systemImage: "heart.fill").font(.caption).bold()
            }
            .tint(Color.accentColor)
          }
        }
      }
    } else {
      EmptyBuddy(state: entry.state)
    }
  }
}

struct BuddyWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: BuddyEntry
  var body: some View {
    Group {
      switch family {
      case .systemMedium: BuddyMediumView(entry: entry)
      default: BuddySmallView(entry: entry)
      }
    }
    .containerBackground(for: .widget) { Color("WidgetBackground") }
  }
}

struct BuddyWidget: Widget {
  let kind = "RoamlingsBuddy"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: BuddyProvider()) { entry in
      BuddyWidgetView(entry: entry)
    }
    .configurationDisplayName("Buddy")
    .description("Your Roamling and its next egg.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct RoamlingsWidgetsBundle: WidgetBundle {
  var body: some Widget {
    BuddyWidget()
  }
}
