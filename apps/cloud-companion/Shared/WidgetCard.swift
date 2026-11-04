import SwiftUI

struct WidgetCard: View {
    var moment: SkyMoment
    var place: Place?
    var unit: TemperatureUnit
    var medium = false
    var demo = false

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(place?.name ?? "Your little sky").font(.system(.caption, design: .rounded, weight: .semibold)).lineLimit(1)
                Spacer(minLength: 2)
                if medium { Image(systemName: "location.circle").font(.caption) }
            }
            HStack(spacing: 8) {
                CloudArt(mood: moment.mood).frame(maxWidth: medium ? 120 : 65, maxHeight: medium ? 92 : 58)
                VStack(alignment: .leading, spacing: 2) {
                    Text(moment.temperatureC.map(unit.display) ?? "—")
                        .font(.system(size: medium ? 44 : 35, weight: .medium, design: .rounded)).minimumScaleFactor(0.6).lineLimit(1)
                    Text(moment.isPrediction ? "Forecast" : moment.forecast?.condition ?? "Choose a city in the app")
                        .font(.system(size: 11, weight: .medium, design: .rounded)).lineLimit(2)
                }
                if medium, let f = moment.forecast {
                    Spacer(minLength: 0)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(moment.mood.greeting).font(.system(.caption, design: .rounded, weight: .medium))
                        Text(f.rainNote(at: moment.date)).font(.system(size: 10)).foregroundStyle(.secondary)
                    }.frame(maxWidth: 130, alignment: .leading)
                }
            }.frame(maxHeight: .infinity)
            if demo {
                Text("DEMO WEATHER").font(.system(size: 9, weight: .bold)).tracking(1)
            } else if let f = moment.forecast {
                HStack(spacing: 2) {
                    Text(moment.freshness == .cached ? "Saved · " : "Fetched ")
                    Text(f.fetchedAt, style: .relative)
                    Text(" ago")
                }.font(.system(size: 9)).lineLimit(1).minimumScaleFactor(0.75)
                Link(destination: f.attributionURL) {
                    HStack(spacing: 2) {
                        WeatherMark(data: f.attributionMark)
                        Text("· Data sources")
                    }.font(.system(size: 8))
                }
            } else {
                Text(place == nil ? "Tap to set up" : "Weather unavailable · tap to retry")
                    .font(.system(size: 10)).lineLimit(2)
            }
        }
        .foregroundStyle(moment.mood == .sleepy ? .white : SkyPalette.ink)
        .accessibilityElement(children: .contain)
    }
}

struct WeatherMark: View {
    var data: Data?
    var body: some View {
        if let data, let image = UIImage(data: data) {
            Image(uiImage: image).resizable().renderingMode(.template).scaledToFit()
                .frame(width: 43, height: 10).accessibilityLabel("Apple Weather")
        } else {
            Label("Weather", systemImage: "apple.logo")
        }
    }
}
