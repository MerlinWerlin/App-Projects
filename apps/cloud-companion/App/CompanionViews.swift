import SwiftUI

struct ForecastDetails: View {
    var forecast: Forecast
    var unit: TemperatureUnit
    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(spacing: 8) {
                if let wind = forecast.windKph { metric("Wind", value: "\(Int(wind.rounded())) km/h", symbol: "wind") }
                if let humidity = forecast.humidity { metric("Humidity", value: "\(Int(humidity.rounded()))%", symbol: "humidity") }
                if let uv = forecast.uvIndex { metric("UV index", value: "\(uv)", symbol: "sun.max") }
            }
            if let days = forecast.days, !days.isEmpty {
                VStack(alignment: .leading, spacing: 15) {
                    Text("THE DAYS AHEAD").font(.system(size: 10, weight: .bold)).tracking(1.8)
                    ForEach(days) { day in
                        HStack(spacing: 12) {
                            Text(dayName(day.date)).font(.system(.subheadline, design: .rounded, weight: .medium)).frame(width: 65, alignment: .leading)
                            Image(systemName: day.symbol).symbolRenderingMode(.hierarchical).frame(width: 28)
                            Text("\(Int(day.rainChance * 100))%").font(.caption).foregroundStyle(.secondary).frame(width: 32, alignment: .trailing)
                            Spacer(minLength: 0)
                            Text(unit.display(day.lowC)).foregroundStyle(.secondary)
                            Capsule().fill(LinearGradient(colors: [SkyPalette.blue, SkyPalette.orange], startPoint: .leading, endPoint: .trailing)).frame(width: 45, height: 4)
                            Text(unit.display(day.highC))
                        }.font(.system(.subheadline, design: .rounded)).accessibilityElement(children: .combine)
                    }
                }.padding(19).background(.white, in: RoundedRectangle(cornerRadius: 24))
            }
        }
    }
    private func metric(_ title: String, value: String, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: symbol).font(.system(size: 17, weight: .light)).foregroundStyle(.secondary)
            Text(value).font(.system(.subheadline, design: .rounded, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
            Text(title).font(.caption2).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(15).background(.white, in: RoundedRectangle(cornerRadius: 20))
    }
    private func dayName(_ date: Date) -> String {
        let formatter = DateFormatter(); formatter.dateFormat = "EEE"
        formatter.timeZone = TimeZone(identifier: forecast.place.timeZoneIdentifier)
        return formatter.string(from: date)
    }
}

struct CloudPlayground: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var motionEnabled: Bool
    var cloudName: String
    @State private var selected = CloudMood.launchChoice
    @State private var delighted = false
    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    VStack(spacing: 7) {
                        Text("A moment with \(cloudName)").font(.system(size: 28, weight: .semibold, design: .rounded))
                        Text("Try a little change in the weather.").font(.subheadline).foregroundStyle(.secondary)
                    }.padding(.top, 16)
                    ZStack {
                        LinearGradient(colors: [SkyPalette.sky(selected), SkyPalette.sky(selected).opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)
                        WeatherScene(mood: selected, motionEnabled: motionEnabled)
                        VStack(spacing: 12) {
                            Button {
                                delighted = true
                                Task { try? await Task.sleep(for: .seconds(1.4)); delighted = false }
                            } label: {
                                CloudArt(mood: selected, animated: motionEnabled, delighted: delighted).frame(width: 270, height: 220)
                            }.buttonStyle(.plain).accessibilityLabel("Say hello to the cloud")
                            Text(delighted ? "Happy to see you, little human." : selected.greeting)
                                .font(.system(.subheadline, design: .rounded, weight: .medium))
                            Text("Tap your cloud to say hello").font(.caption).opacity(0.6)
                        }.padding(.vertical, 32)
                    }.foregroundStyle(selected == .sleepy ? .white : SkyPalette.ink)
                        .clipShape(RoundedRectangle(cornerRadius: 32)).accessibilityIdentifier("scene-\(selected.rawValue)")
                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(CloudMood.allCases, id: \.self) { mood in
                            Button {
                                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.45)) { selected = mood; delighted = false }
                            } label: {
                                VStack(spacing: 8) {
                                    Image(systemName: mood.icon).font(.system(size: 21, weight: .light))
                                    Text(mood.title).font(.system(size: 11, weight: .medium, design: .rounded))
                                }.frame(maxWidth: .infinity).padding(.vertical, 15)
                                    .background(selected == mood ? SkyPalette.blue : .white, in: RoundedRectangle(cornerRadius: 18))
                            }.buttonStyle(.plain).accessibilityIdentifier("mood-\(mood.rawValue)")
                                .accessibilityAddTraits(selected == mood ? .isSelected : [])
                        }
                    }
                    Label("Weather playground · sample conditions", systemImage: "sparkles").font(.caption).foregroundStyle(.secondary)
                    Text("Your real forecast and widgets stay on your saved city.").font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    if reduceMotion || !motionEnabled { Text("Motion is reduced. Cloud expressions and weather choices still work.").font(.caption).foregroundStyle(.secondary) }
                }.padding(22)
            }.background(SkyPalette.paper).foregroundStyle(SkyPalette.ink)
                .navigationTitle("Cloud moments").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }.sensoryFeedback(.selection, trigger: selected)
    }
}

struct CloudSettings: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var model: SkyModel
    @State private var name = ""
    var body: some View {
        NavigationStack {
            Form {
                Section("Your companion") {
                    TextField("Cloud's name", text: $name).submitLabel(.done).onSubmit { model.setName(name) }
                    Toggle("Cloud animations", isOn: Binding(get: { model.preferences.motionEnabled }, set: model.setMotion))
                        .accessibilityIdentifier("motion-toggle")
                    Text(model.preferences.motionEnabled ? "Cloud motion is on" : "Cloud motion is off").font(.caption).foregroundStyle(.secondary)
                    Text("Animations also respect your iPhone's Reduce Motion setting.").font(.caption).foregroundStyle(.secondary)
                }
                Section("Weather") {
                    Picker("Temperature", selection: Binding(get: { model.preferences.unit }, set: model.setUnit)) {
                        ForEach(TemperatureUnit.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    if let place = model.preferences.place { LabeledContent("Saved city", value: place.name) }
                    Text("Each widget has its own city and temperature settings. Hold a home-screen widget and choose Edit Widget to change them.").font(.caption).foregroundStyle(.secondary)
                }
                if !model.preferences.savedPlaces.isEmpty {
                    Section("Saved places") {
                        ForEach(model.preferences.savedPlaces) { place in
                            HStack {
                                Text(place.name); Spacer()
                                if place == model.preferences.place { Image(systemName: "checkmark").foregroundStyle(.secondary) }
                            }
                        }.onDelete { indices in
                            let places = indices.map { model.preferences.savedPlaces[$0] }
                            places.forEach(model.removeSaved)
                        }
                    }
                }
                Section("About this prototype") {
                    Text("Cloud Companion 0.2").font(.system(.headline, design: .rounded))
                    Text("Weather is provided by Apple Weather. Your city and preferences are stored on this device. There is no account, advertising or analytics.").font(.subheadline).foregroundStyle(.secondary)
                    Link("Weather data sources", destination: model.forecast?.attributionURL ?? URL(string: "https://weatherkit.apple.com/legal-attribution.html")!)
                }
            }.navigationTitle("Make it yours")
                .onAppear { name = model.preferences.cloudName }
                .onDisappear { model.setName(name) }
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { model.setName(name); dismiss() } } }
        }
    }
}

extension CloudMood {
    static var launchChoice: Self {
        let value = ProcessInfo.processInfo.arguments.first { $0.hasPrefix("--mood=") }
        return value.flatMap { Self(rawValue: String($0.dropFirst(7))) } ?? .cloudy
    }
    var title: String { self == .sleepy ? "Night" : rawValue.capitalized }
    var icon: String {
        switch self {
        case .sunny: return "sun.max"
        case .cloudy: return "cloud"
        case .rainy: return "cloud.rain"
        case .stormy: return "cloud.bolt"
        case .snowy: return "cloud.snow"
        case .misty: return "cloud.fog"
        case .windy: return "wind"
        case .sleepy: return "moon.stars"
        }
    }
}
