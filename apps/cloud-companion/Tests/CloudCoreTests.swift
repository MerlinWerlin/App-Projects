import XCTest
@testable import CloudCore

final class CloudCoreTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    func testWeatherOverridesSleep() {
        XCTAssertEqual(CloudMood.resolve(symbol: "cloud.bolt.rain.fill", daylight: false), .stormy)
        XCTAssertEqual(CloudMood.resolve(symbol: "cloud.snow.fill", daylight: false), .snowy)
        XCTAssertEqual(CloudMood.resolve(symbol: "cloud.rain.fill", daylight: false), .rainy)
        XCTAssertEqual(CloudMood.resolve(symbol: "moon.stars.fill", daylight: false), .sleepy)
        XCTAssertEqual(CloudMood.resolve(symbol: "sun.max.fill", daylight: true), .sunny)
        XCTAssertEqual(CloudMood.resolve(symbol: "wind", daylight: true), .windy)
        XCTAssertEqual(CloudMood.resolve(symbol: "cloud.fog.fill", daylight: true), .misty)
    }
    func testFreshnessBoundariesUseObservationAndFetchTime() {
        var f = Forecast.demo(at: now)
        XCTAssertEqual(Freshness.evaluate(f, at: now.addingTimeInterval(90 * 60 - 1)), .fresh)
        XCTAssertEqual(Freshness.evaluate(f, at: now.addingTimeInterval(90 * 60)), .cached)
        XCTAssertEqual(Freshness.evaluate(f, at: now.addingTimeInterval(24 * 3600)), .expired)
        f.observedAt = now.addingTimeInterval(-2 * 3600)
        XCTAssertEqual(Freshness.evaluate(f, at: now), .cached)
        f.observedAt = now.addingTimeInterval(-25 * 3600)
        XCTAssertEqual(Freshness.evaluate(f, at: now), .expired)
    }
    func testFutureClockIsNotShownAsFresh() {
        XCTAssertEqual(Freshness.evaluate(.demo(at: now.addingTimeInterval(301)), at: now), .expired)
    }
    func testFreshCurrentDoesNotUseAnOlderHourlyPrediction() {
        var f = Forecast.demo(at: now)
        f.hours.insert(ForecastHour(date: now.addingTimeInterval(-600), temperatureC: 2,
                                   rainChance: 0.5, symbol: "cloud.rain", daylight: true), at: 0)
        let entry = TimelinePolicy.entries(forecast: f, place: .sydney, now: now)[0]
        XCTAssertFalse(entry.isPrediction)
        XCTAssertEqual(entry.temperatureC, 23)
    }
    func testFutureHourlyEntriesAreExplicitPredictions() {
        let f = Forecast.demo(at: now)
        let entries = TimelinePolicy.entries(forecast: f, place: .sydney, now: now)
        XCTAssertFalse(entries[0].isPrediction)
        XCTAssertTrue(entries[1].isPrediction)
        XCTAssertEqual(entries[1].temperatureC, f.hours[0].temperatureC)
        XCTAssertTrue(zip(entries, entries.dropFirst()).allSatisfy { $0.date < $1.date })
        XCTAssertNil(entries.last?.temperatureC)
        XCTAssertEqual(entries.last?.date, now.addingTimeInterval(24 * 3600))
    }
    func testFailedRefreshCanAdvanceToCachedPredictionWithoutFresheningFetchTime() {
        let f = Forecast.demo(at: now)
        let later = f.hours[2].date.addingTimeInterval(60)
        let entry = TimelinePolicy.entries(forecast: f, place: .sydney, now: later)[0]
        XCTAssertTrue(entry.isPrediction)
        XCTAssertEqual(entry.hour, f.hours[2])
        XCTAssertEqual(entry.forecast?.fetchedAt, now)
        XCTAssertEqual(entry.freshness, .cached)
    }
    func testExpiredAndWrongCityNeverDisplayOldTemperature() {
        let f = Forecast.demo(at: now)
        for (city, time) in [(Place.suggestions[2], now), (.sydney, now.addingTimeInterval(24 * 3600))] {
            let entries = TimelinePolicy.entries(forecast: f, place: city, now: time)
            XCTAssertEqual(entries.count, 1)
            XCTAssertNil(entries[0].temperatureC)
        }
        XCTAssertNil(TimelinePolicy.entries(forecast: f, place: nil, now: now)[0].forecast)
    }
    func testNoFabricatedWeatherOnFirstLaunch() {
        XCTAssertNil(TimelinePolicy.entries(forecast: nil, place: .sydney, now: now)[0].temperatureC)
    }
    func testInvalidInputsAreRejected() {
        var f = Forecast.demo(at: now)
        f.temperatureC = .nan
        XCTAssertFalse(f.isValid)
        XCTAssertNil(TimelinePolicy.entries(forecast: f, place: .sydney, now: now)[0].temperatureC)
        f = .demo(at: now); f.hours[0].rainChance = 1.1
        XCTAssertFalse(f.isValid)
        f = .demo(at: now); f.hours.reverse()
        XCTAssertFalse(f.isValid)
        XCTAssertFalse(Place(name: "Bad", latitude: 91, longitude: 0).isValid)
    }
    func testPersistenceRejectsLateCityResponsesAndOlderForecasts() {
        let suite = "cloud-companion-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = SkyStore(defaults: defaults)
        XCTAssertNil(store.preferences.place)
        store.preferences = Preferences(place: .sydney)
        let f = Forecast.demo(at: now)
        store.save(f)
        XCTAssertEqual(store.cached(for: .sydney), f)
        store.save(.demo(at: now.addingTimeInterval(-60)))
        XCTAssertEqual(store.cached(for: .sydney)?.fetchedAt, now)
        let tokyo = Place.suggestions[2]
        store.preferences = Preferences(place: tokyo)
        store.save(.demo(at: now.addingTimeInterval(60)))
        XCTAssertNil(store.cached(for: tokyo))
        XCTAssertEqual(store.cached(for: .sydney)?.fetchedAt, now)
        let reloaded = SkyStore(defaults: defaults)
        XCTAssertEqual(reloaded.preferences.place, tokyo)
    }
    func testCorruptCacheDoesNotCrashOrProduceWeather() {
        let suite = "cloud-companion-corrupt-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set(Data("broken".utf8), forKey: "forecast.v1")
        defaults.set(Data("broken".utf8), forKey: "preferences.v1")
        let store = SkyStore(defaults: defaults)
        XCTAssertNil(store.preferences.place)
        XCTAssertNil(store.cached(for: .sydney))
    }
    func testUnitsAndRefreshBackoff() {
        XCTAssertEqual(TemperatureUnit.fahrenheit.display(0), "32°")
        XCTAssertEqual(TemperatureUnit.celsius.display(-2.4), "-2°")
        XCTAssertEqual(TimelinePolicy.refreshDate(now: now, failed: false).timeIntervalSince(now), 1800)
        XCTAssertEqual(TimelinePolicy.refreshDate(now: now, failed: true).timeIntervalSince(now), 3600)
    }
}
