// owner-1102b T280 + T281: widgets that read data from outside the theme (calendar, weather).
// Nested bundle, included from GlazeWidgetsBundle.swift as `GlazeDataWidgetsBundle().body`.
import SwiftUI
import WidgetKit

struct GlazeDataWidgetsBundle: WidgetBundle {
  var body: some Widget {
    CalendarEventWidget()
    WeatherWidget()
  }
}
