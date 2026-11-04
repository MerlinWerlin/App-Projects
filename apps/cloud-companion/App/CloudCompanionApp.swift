import SwiftUI
import MapKit
import CoreLocation
import WidgetKit

@main
struct CloudCompanionApp: App {
    var body: some Scene { WindowGroup { SkyHome() } }
}

@MainActor
final class SkyModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var preferences: Preferences
    @Published var forecast: Forecast?
    @Published var loading = false
    @Published var message: String?
    let demo = ProcessInfo.processInfo.arguments.contains("--demo")
    private let store = SkyStore.shared
    private let location = CLLocationManager()
    private var requestID = UUID()
    private var wantsLocation = false
    private var loadingPlace: Place?

    override init() {
        preferences = SkyStore.shared.preferences
        super.init()
        location.delegate = self
        if demo { preferences = Preferences(place: .sydney); forecast = .demo() }
        else if let place = preferences.place { forecast = store.cached(for: place) }
    }
    func choose(_ place: Place) {
        guard place.isValid else { return }
        requestID = UUID()
        preferences.place = place
        forecast = demo ? .demo() : store.cached(for: place)
        persist()
        Task { await refresh() }
    }
    func setUnit(_ unit: TemperatureUnit) {
        preferences.unit = unit
        persist()
    }
    private func persist() {
        guard !demo else { return }
        store.preferences = preferences
        WidgetCenter.shared.reloadTimelines(ofKind: "CloudCompanionWeather")
    }
    func refresh() async {
        guard !demo, let place = preferences.place else { return }
        guard !loading || loadingPlace != place else { return }
        let id = UUID()
        requestID = id
        loading = true
        loadingPlace = place
        message = nil
        defer { if requestID == id { loading = false; loadingPlace = nil } }
        do {
            let updated = try await WeatherClient().fetch(for: place)
            guard requestID == id, preferences.place == place else { return }
            forecast = updated
            store.save(updated)
            WidgetCenter.shared.reloadTimelines(ofKind: "CloudCompanionWeather")
        } catch {
            guard requestID == id else { return }
            message = "Couldn't refresh the weather. Check your connection and try again."
        }
    }
    func locate() {
        guard !demo else { return }
        wantsLocation = true
        switch location.authorizationStatus {
        case .notDetermined: location.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse: location.requestLocation()
        default: wantsLocation = false; message = "Location access is off. You can choose a city instead."
        }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard wantsLocation else { return }
        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            manager.requestLocation()
        } else if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted {
            wantsLocation = false
            message = "Location access is off. You can choose a city instead."
        }
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard wantsLocation, let point = locations.last, point.horizontalAccuracy >= 0 else { return }
        wantsLocation = false
        Task {
            let names = try? await CLGeocoder().reverseGeocodeLocation(point)
            choose(Place(name: names?.first?.locality ?? "Current location",
                         latitude: point.coordinate.latitude, longitude: point.coordinate.longitude,
                         timeZoneIdentifier: names?.first?.timeZone?.identifier ?? TimeZone.current.identifier))
        }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        wantsLocation = false
        message = "Couldn't find your location. Choose a city or try again."
    }
}

struct SkyHome: View {
    @StateObject private var model = SkyModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var showCities = false
    @State private var showWidgets = ProcessInfo.processInfo.arguments.contains("--widget-preview")
    private var validForecast: Forecast? {
        guard let f = model.forecast, Freshness.evaluate(f, at: Date()) != .expired else { return nil }
        return f
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 23) {
                    HStack {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("CLOUD COMPANION").font(.system(size: 10, weight: .bold, design: .rounded)).tracking(2)
                            Text("Your little sky.").font(.system(size: 32, weight: .semibold, design: .rounded))
                        }
                        Spacer()
                        Button { showCities = true } label: {
                            Image(systemName: "location.circle").font(.system(size: 27, weight: .light))
                        }.accessibilityLabel("Choose weather location")
                    }
                    Button { showCities = true } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "location.fill").font(.system(size: 10))
                            Text(model.preferences.place?.name ?? "Choose your city").font(.system(.subheadline, design: .rounded, weight: .medium))
                            Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
                        }
                    }.buttonStyle(.plain)
                    if model.demo {
                        Label("Demo weather · sample forecast", systemImage: "sparkles")
                            .font(.caption).padding(.horizontal, 12).padding(.vertical, 8)
                            .background(SkyPalette.orange.opacity(0.3), in: Capsule())
                    }
                    hero
                    if let message = model.message {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(message).font(.subheadline)
                            Button("Try again") { Task { await model.refresh() } }
                        }.padding().frame(maxWidth: .infinity, alignment: .leading)
                            .background(.white, in: RoundedRectangle(cornerRadius: 20))
                    }
                    if let f = validForecast {
                        hourly(f)
                    } else if model.preferences.place == nil {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("A tiny companion for your everyday weather.").font(.system(.title3, design: .rounded, weight: .medium))
                            Text("Choose a city once. Your home-screen widget will check the weather for you.").font(.subheadline).foregroundStyle(.secondary)
                            Button("Choose a city") { showCities = true }.buttonStyle(.borderedProminent).tint(SkyPalette.ink)
                        }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(.white, in: RoundedRectangle(cornerRadius: 24))
                    }
                    Button { showWidgets = true } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "square.grid.2x2").font(.title2)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("A little sky on your home screen").font(.system(.subheadline, design: .rounded, weight: .semibold))
                                Text("Meet your weather widgets").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "arrow.up.right")
                        }.padding(20).background(SkyPalette.orange.opacity(0.24), in: RoundedRectangle(cornerRadius: 24))
                    }.buttonStyle(.plain)
                    footer
                }.padding(24).frame(maxWidth: 650)
                    .frame(maxWidth: .infinity)
            }.background(SkyPalette.paper).foregroundStyle(SkyPalette.ink)
                .refreshable { await model.refresh() }
                .toolbar(.hidden, for: .navigationBar)
                .task { await model.refresh() }
                .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await model.refresh() } } }
                .sheet(isPresented: $showCities) { CityPicker { model.choose($0) } locate: { model.locate() } }
                .sheet(isPresented: $showWidgets) { WidgetGallery(model: model) }
        }.tint(SkyPalette.ink)
    }
    private var hero: some View {
        let f = validForecast
        let mood = f?.mood ?? .cloudy
        return VStack(spacing: 4) {
            CloudArt(mood: mood).frame(width: 230, height: 180).padding(.top, 15)
            Text(f.map { model.preferences.unit.display($0.temperatureC) } ?? "—")
                .font(.system(size: 77, weight: .light, design: .rounded)).contentTransition(.numericText())
            Text(f?.condition ?? (model.loading ? "Checking your sky…" : "Your sky is waiting"))
                .font(.system(.headline, design: .rounded, weight: .medium))
            if let f {
                HStack(spacing: 12) {
                    Text("Feels like \(model.preferences.unit.display(f.feelsLikeC))")
                    if let high = f.highC, let low = f.lowC {
                        Text("H:\(model.preferences.unit.display(high)) L:\(model.preferences.unit.display(low))")
                    }
                }.font(.caption).opacity(0.8).padding(.top, 4)
                Text(mood.greeting).font(.system(.subheadline, design: .rounded)).padding(.top, 14)
                if !model.demo {
                    HStack(spacing: 3) {
                        Text(Freshness.evaluate(f, at: Date()) == .cached ? "Saved weather · fetched" : "Fetched")
                        Text(f.fetchedAt, style: .relative)
                        Text("ago")
                    }.font(.caption2).opacity(0.8).padding(.top, 6)
                }
            }
        }.frame(maxWidth: .infinity).padding(.bottom, 26)
            .foregroundStyle(mood == .sleepy ? .white : SkyPalette.ink)
            .background(SkyPalette.sky(mood), in: RoundedRectangle(cornerRadius: 34))
    }
    private func hourly(_ f: Forecast) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("THE HOURS AHEAD").font(.system(size: 10, weight: .bold)).tracking(1.8)
                Spacer()
                if model.loading { ProgressView().controlSize(.small) }
            }
            Text(f.rainNote(at: Date())).font(.system(.subheadline, design: .rounded)).foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 23) {
                    ForEach(f.hours.filter { $0.date >= Date() }.prefix(8)) { hour in
                        VStack(spacing: 12) {
                            Text(f.place.timeLabel(hour.date)).font(.caption).foregroundStyle(.secondary)
                            Image(systemName: hour.symbol).symbolRenderingMode(.hierarchical).font(.title3)
                            Text(model.preferences.unit.display(hour.temperatureC)).font(.system(.headline, design: .rounded))
                            Text("\(Int((hour.rainChance * 100).rounded()))%")
                                .font(.system(size: 10)).foregroundStyle(.secondary)
                        }.accessibilityElement(children: .combine)
                    }
                }.padding(.vertical, 4)
            }
        }
    }
    private var footer: some View {
        VStack(spacing: 15) {
            Picker("Temperature unit", selection: Binding(get: { model.preferences.unit }, set: { model.setUnit($0) })) {
                ForEach(TemperatureUnit.allCases, id: \.self) { Text($0.label).tag($0) }
            }.pickerStyle(.segmented).frame(width: 150)
            if let f = validForecast, !model.demo {
                Link(destination: f.attributionURL) {
                    HStack(spacing: 4) { WeatherMark(data: f.attributionMark); Text("· Data sources") }.font(.caption)
                }
            }
            Text("A small forecast. A little company.").font(.system(.caption, design: .rounded)).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity).padding(.vertical, 4)
    }
}

struct CityPicker: View {
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [Place] = []
    @State private var searching = false
    @State private var error: String?
    var choose: (Place) -> Void
    var locate: () -> Void
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button { locate(); dismiss() } label: { Label("Use current location", systemImage: "location") }
                } footer: { Text("The widget uses the city you save. It doesn't track you as you travel.") }
                if searching { ProgressView("Finding cities…") }
                if let error { Text(error).foregroundStyle(.secondary) }
                Section(query.isEmpty ? "A few places to start" : "Search results") {
                    ForEach(query.isEmpty ? Place.suggestions : results) { place in
                        Button(place.name) { choose(place); dismiss() }
                    }
                }
            }.navigationTitle("Find your sky")
                .searchable(text: $query, prompt: "Search for a city")
                .task(id: query) { await search() }
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
    private func search() async {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        results = []; error = nil
        guard !term.isEmpty else { searching = false; return }
        searching = true
        do {
            try await Task.sleep(for: .milliseconds(350))
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = term
            request.resultTypes = .address
            let response = try await MKLocalSearch(request: request).start()
            guard !Task.isCancelled, term == query.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
            var seen = Set<String>()
            results = response.mapItems.compactMap { item in
                let name = [item.placemark.locality ?? item.name, item.placemark.country].compactMap { $0 }.joined(separator: ", ")
                let place = Place(name: name, latitude: item.placemark.coordinate.latitude, longitude: item.placemark.coordinate.longitude,
                                  timeZoneIdentifier: item.placemark.timeZone?.identifier ?? TimeZone.current.identifier)
                return place.isValid && seen.insert(place.id).inserted ? place : nil
            }
            if results.isEmpty { error = "No city found. Try a city and country." }
        } catch {
            if !Task.isCancelled { error = "City search is unavailable. Choose a suggested city or try again." }
        }
        if !Task.isCancelled { searching = false }
    }
}

struct WidgetGallery: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var model: SkyModel
    var body: some View {
        let moment = TimelinePolicy.entries(forecast: model.forecast, place: model.preferences.place, now: Date())[0]
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("Your sky, without opening the app.").font(.system(.title, design: .rounded, weight: .semibold))
                    Text("Small").font(.caption).foregroundStyle(.secondary)
                    WidgetCard(moment: moment, place: model.preferences.place, unit: model.preferences.unit, demo: model.demo)
                        .padding(15).frame(width: 170, height: 170).background(SkyPalette.sky(moment.mood), in: RoundedRectangle(cornerRadius: 24))
                    Text("Medium").font(.caption).foregroundStyle(.secondary)
                    WidgetCard(moment: moment, place: model.preferences.place, unit: model.preferences.unit, medium: true, demo: model.demo)
                        .padding(15).frame(height: 170).background(SkyPalette.sky(moment.mood), in: RoundedRectangle(cornerRadius: 24))
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Make room for a little cloud").font(.system(.headline, design: .rounded))
                        Text("1. Touch and hold your home screen.\n2. Choose Edit, then Add Widget.\n3. Find Cloud Companion and choose a size.")
                            .font(.subheadline).lineSpacing(7)
                        Text("Weather refreshes automatically when iOS allows. Forecast changes are scheduled ahead; an exact update time isn't guaranteed.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }.padding(24)
            }.background(SkyPalette.paper).foregroundStyle(SkyPalette.ink)
                .navigationTitle("Weather widgets").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
