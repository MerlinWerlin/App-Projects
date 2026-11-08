// CI host for actual production layouts, all current palettes and important state/locale cases.
import SwiftUI
import UIKit
import CryptoKit

@main
struct DesignedWidgetReviewApp: App {
  var body: some Scene { WindowGroup { Text("Glaze designed widget review").task { await MainActor.run { DesignedWidgetReview.run() } } } }
}

@MainActor
enum DesignedWidgetReview {
  static var started = false
  static func run() {
    guard !started else { return }; started = true
    let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("DesignedWidgetReview")
    do {
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      guard let source = Bundle.main.url(forResource: "designed-widget-fixtures", withExtension: "json"),
        let root = try JSONSerialization.jsonObject(with: Data(contentsOf: source)) as? [String: Any],
        let themes = root["themes"] as? [[String: Any]], themes.count >= 141 else { throw fail("Missing whole-library fixture") }
      var records: [[String: Any]] = [], assertions = 0
      let sizes: [(String, CGFloat, CGFloat)] = [("small",170,170),("medium",364,170),("large",364,382)]
      var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(secondsFromGMT: 0)!; calendar.firstWeekday = 2
      let baseline = calendar.date(from: DateComponents(year: 2026, month: 11, day: 4, hour: 10, minute: 8))!
      guard let alpine = ThemedClockArtwork.alpine(maxPixels: 510)?.cgImage,
        alpine.width == 510 && alpine.height == 510 else { throw fail("Missing or oversized small Alpine clock artwork") }
      assertions += 1

      // Independent Foundation civil-month checks, including century/leap rules, every offset and
      // six-row layouts. These do not call the JS producer or reuse its computed month lengths.
      for year in 2000..<2400 { for month in 1...12 { for first in [1,2,7] {
        var c = calendar; c.firstWeekday = first
        let date = c.date(from: DateComponents(year: year, month: month, day: 15, hour: 12))!
        guard let value = DesignedMonth.make(date: date, calendar: c) else { throw fail("Month parse") }
        let cells = (0..<42).compactMap { value.day(at: $0) }
        let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
        let days = month == 2 ? (leap ? 29 : 28) : [4,6,9,11].contains(month) ? 30 : 31
        guard cells == Array(1...days), value.offset >= 0, value.offset <= 6, value.today == 15 else { throw fail("Month coverage \(year)-\(month)") }
        assertions += 4
      } } }

      for theme in themes {
        guard let id = theme["id"] as? String, let designs = theme["designs"] as? [[String: Any]], designs.count == 3 else { throw fail("Theme data") }
        for raw in designs {
          guard let spec = DesignedWidgetSpec.parse(raw), spec.identity != nil else { throw fail("Theme identity parse \(id)") }
          let live: [String: Any] = ["kind":spec.kind == "calendar" ? "date" : spec.kind,"rect":[0,0,1,1],"shape":"plate","cover":false,"plate":spec.background[0],"ink":spec.ink,"design":raw]
          guard LiveArtSpec.parse(live)?.design?.kind == spec.kind else { throw fail("Native shared spec parse \(id)") }; assertions += 1
          for (size,w,h) in sizes {
            try capture(spec, id: id, size: size, width: w, height: h, state: "default", locale: "en_AU", date: baseline, battery: 73, folder: folder, calendar: calendar, records: &records)
            if spec.kind == "clock" && size == "small" {
              let before = records.last?["sha256"] as? String
              try capture(spec, id: id, size: size, width: w, height: h, state: "one-minute-later", locale: "en_AU", date: baseline.addingTimeInterval(60), battery: 73, folder: folder, calendar: calendar, records: &records)
              guard before != records.last?["sha256"] as? String else { throw fail("Frozen small clock \(id)") }
              assertions += 1
            }
          }
        }
      }

      let subjects = ["alpine-starlight","nebula-veil","rainlight","fern-and-brass","cherry-arcade","porcelain-tide","espresso-hour"]
      for theme in themes where subjects.contains(where: { (theme["id"] as? String ?? "").contains($0) }) {
        let id=theme["id"] as! String
        for raw in theme["designs"] as! [[String:Any]] {
          let spec=DesignedWidgetSpec.parse(raw)!
          for (size,w,h) in sizes {
            for locale in ["ar_SA","de_DE","es_ES","fr_FR","hi_IN","it_IT","ja_JP","ko_KR","pt_BR","zh_Hans"] {
              var c=calendar; c.locale=Locale(identifier:locale); c.firstWeekday=c.locale!.language.languageCode?.identifier == "ar" ? 1 : 2
              try capture(spec,id:id,size:size,width:w,height:h,state:"locale",locale:locale,date:baseline,battery:73,folder:folder,calendar:c,records:&records)
            }
            if spec.kind == "battery" {
              for level in [nil,0,1,5,50,100] as [Int?] {
                try capture(spec,id:id,size:size,width:w,height:h,state:"battery-\(level.map(String.init) ?? "unknown")",locale:"en_AU",date:baseline,battery:level,folder:folder,calendar:calendar,records:&records)
              }
            } else if spec.kind == "calendar" {
              for (year,month,day) in [(2026,8,31),(2028,2,29),(2026,11,1),(2026,12,31)] {
                let date=calendar.date(from:DateComponents(year:year,month:month,day:day,hour:12))!
                try capture(spec,id:id,size:size,width:w,height:h,state:"month-\(year)-\(month)-\(day)",locale:"en_AU",date:date,battery:73,folder:folder,calendar:calendar,records:&records)
              }
            } else {
              var hashes=Set<String>()
              for (hour,minute) in [(0,0),(6,30),(11,59),(23,59)] {
                let date=calendar.date(from:DateComponents(year:2026,month:11,day:4,hour:hour,minute:minute))!
                try capture(spec,id:id,size:size,width:w,height:h,state:"clock-\(hour)-\(minute)",locale:"en_US",date:date,battery:73,folder:folder,calendar:calendar,records:&records)
                hashes.insert(records.last!["sha256"] as! String)
              }
              // Analog small faces intentionally repeat after 12h; all others show the period.
              guard hashes.count >= 3 else { throw fail("Frozen clock \(id)/\(size)") };assertions += 1
            }
          }
        }
      }
      let report: [String:Any] = ["schema":"GLAZE_DESIGNED_WIDGET_REVIEW_V1","sourceSHA":Bundle.main.object(forInfoDictionaryKey:"ReviewSourceSHA") as? String ?? "unknown","themes":themes.count,"catalogueThemes":root["catalogueThemes"] as? Int ?? 0,"baselineLayouts":themes.count*9,"renders":records.count,"assertions":assertions,"records":records,"physicalDeviceTest":false]
      try JSONSerialization.data(withJSONObject: report,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("_SUCCESS.json"))
    } catch { try? String(describing:error).write(to:folder.appendingPathComponent("_ERROR.txt"),atomically:true,encoding:.utf8) }
  }
  static func fail(_ message: String) -> NSError { NSError(domain:"DesignedWidgetReview",code:1,userInfo:[NSLocalizedDescriptionKey:message]) }
  static func capture(_ spec: DesignedWidgetSpec,id:String,size:String,width:CGFloat,height:CGFloat,state:String,locale:String,date:Date,battery:Int?,folder:URL,calendar:Calendar,records:inout [[String:Any]]) throws {
    try autoreleasepool {
      let view=DesignedWidgetContent(spec:spec,date:date,readings:.snapshot(focus:.idle,battery:battery))
        .frame(width:width,height:height).environment(\.locale,Locale(identifier:locale)).environment(\.calendar,calendar).environment(\.timeZone,calendar.timeZone)
        .environment(\.layoutDirection,locale.hasPrefix("ar") ? .rightToLeft : .leftToRight).environment(\.colorScheme,.light)
      let renderer=ImageRenderer(content:view);renderer.scale=2
      guard let image=renderer.uiImage,let data=image.jpegData(compressionQuality:0.94) else {throw fail("Native render \(id)")}
      let file="\(id)_\(spec.kind)_\(size)_\(state)_\(locale).jpg"
      try data.write(to:folder.appendingPathComponent(file),options:.atomic)
      records.append(["theme":id,"kind":spec.kind,"size":size,"state":state,"locale":locale,"file":file,"width":Int(width*2),"height":Int(height*2),"sha256":SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined()])
    }
  }
}
