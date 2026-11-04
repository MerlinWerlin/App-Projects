import SwiftUI
import UIKit
import WidgetKit
import CryptoKit

@main struct NativeHabitReviewApp: App {
  var body: some Scene { WindowGroup { Text("Glaze habit layout review").task { await MainActor.run { HabitLayoutCapture.run() } } } }
}

@MainActor enum HabitLayoutCapture {
  static var started = false
  static func run() {
    guard !started else { return }; started = true
    let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("GlazeHabitReview")
    do {
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      guard let url=Bundle.main.url(forResource:"native-habit-review-profiles",withExtension:"json"),
            let root=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any],
            let themes=root["themes"] as? [[String:Any]],themes.count==105 else { throw failure("missing105-theme fixture") }
      var records:[[String:Any]]=[]
      let date=Date(timeIntervalSince1970:1793620800)
      for t in themes {
        guard let id=t["id"] as? String,let raw=t["nativeTheme"],let cases=t["cases"] as? [[String:Any]],cases.count==12 else {throw failure("theme fixture")}
        let theme=try JSONDecoder().decode(WidgetTheme.self,from:JSONSerialization.data(withJSONObject:raw))
        for (size,width,family) in [("small",CGFloat(170),WidgetFamily.systemSmall),("medium",CGFloat(364),.systemMedium)] {
          for c in cases {
            try autoreleasepool {
              guard let kind=(c["kind"] as? String).flatMap(HabitKindID.init(rawValue:)),let state=c["state"] as? String,
                    let value=(c["value"] as? NSNumber)?.doubleValue,let step=(c["step"] as? NSNumber)?.doubleValue else {throw failure("entry fixture")}
              let goal=(c["goal"] as? NSNumber)?.doubleValue
              let entry=HabitEntry(date:date,theme:theme,habit:kind,value:value,goal:goal,step:step)
              // WidgetKit supplies content margins on a real Home Screen widget. Model16pt here;
              // the explicit background also paints them in this isolated SwiftUI host.
              let view=HabitWidgetContent(entry:entry,family:family).padding(16).frame(width:width,height:170)
                .background(LinearGradient(colors:theme.backgroundColors,startPoint:.topLeading,endPoint:.bottomTrailing))
                .environment(\.colorScheme,.light).environment(\.locale,Locale(identifier:"en_US"))
              let renderer=ImageRenderer(content:view);renderer.scale=2
              guard let image=renderer.uiImage,let data=image.jpegData(compressionQuality:0.94) else {throw failure("native image")}
              let file="\(id)_\(kind.rawValue)_\(state)_\(size).jpg"
              try data.write(to:folder.appendingPathComponent(file),options:.atomic)
              records.append(["theme":id,"kind":kind.rawValue,"state":state,"size":size,"file":file,"width":Int(image.size.width*image.scale),"height":Int(image.size.height*image.scale),"sha256":SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined()])
            }
          }
        }
      }
      guard records.count==2520 else {throw failure("expected2520 captures")}
      let receipt:[String:Any]=["schema":"GLAZE_NATIVE_HABIT_LAYOUT_V1","sourceSHA":Bundle.main.object(forInfoDictionaryKey:"ReviewSourceSHA") as? String ?? "unknown","themes":105,"renders":records.count,"records":records,"physicalDeviceTest":false,"installedWidgetTapTest":false,"scope":"Actual shared HabitWidgetContent from HabitWidgetView and app-derived theme palettes. Four trackers, two supported Home Screen sizes and three injected value states;16pt content-margin simulation. WidgetKit delivery, touches, Dynamic Type and tinted modes need device checks."]
      try JSONSerialization.data(withJSONObject:receipt,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("_HABIT_SUCCESS.json"))
      guard let savedURL = Bundle.main.url(forResource: "native-habit-saved-review", withExtension: "json"),
            let savedRoot = try JSONSerialization.jsonObject(with: Data(contentsOf: savedURL)) as? [String: Any],
            let savedCases = savedRoot["cases"] as? [[String: Any]], savedCases.count == 48 else { throw failure("missing48 saved editor cases") }
      var savedRecords: [[String: Any]] = []
      for c in savedCases {
        try autoreleasepool {
          guard let id=c["id"] as? String, let kind=(c["kind"] as? String).flatMap(HabitKindID.init(rawValue:)),
                let size=c["size"] as? String, let rawTheme=c["nativeTheme"],
                let raw=c["raw"] as? [String: Any], let texts=c["texts"] as? [String: String],
                let title=c["expectedTitle"] as? String else { throw failure("saved editor fixture") }
          let theme=try JSONDecoder().decode(WidgetTheme.self,from:JSONSerialization.data(withJSONObject:rawTheme))
          let design=SavedWidgetDesign(raw:raw,texts:texts)
          guard design.habitTitle == title else { throw failure("saved title lost") }
          let def=HabitDef.of(kind)
          let entry=HabitEntry(date:date,theme:theme,habit:kind,value:kind == .mood ? 3 : (def.goal ?? 0)/2,goal:def.goal,step:def.step)
          let family: WidgetFamily = size == "medium" ? .systemMedium : .systemSmall
          let view=HabitWidgetContent(entry:entry,family:family,design:design).padding(16)
            .frame(width:size == "medium" ? 364 : 170,height:170).background(SavedWidgetFill(fill:design.background))
            .environment(\.colorScheme,.light).environment(\.locale,Locale(identifier:"en_US"))
          let renderer=ImageRenderer(content:view);renderer.scale=2
          guard let image=renderer.uiImage,let data=image.jpegData(compressionQuality:0.94) else {throw failure("saved native image")}
          let file=id+".jpg";try data.write(to:folder.appendingPathComponent(file),options:.atomic)
          savedRecords.append(["file":file,"theme":c["theme"]!,"kind":kind.rawValue,"size":size,"title":title,"width":Int(image.size.width*image.scale),"height":Int(image.size.height*image.scale),"sha256":SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined()])
        }
      }
      let savedReceipt: [String: Any] = ["sourceSHA":receipt["sourceSHA"]!,"renders":savedRecords.count,"records":savedRecords,"scope":"Actual shared native content with48 real app editor saved designs: custom titles and gradients across six contrasting themes, four trackers and both sizes. No App Group delivery or real widget interaction qualification."]
      try JSONSerialization.data(withJSONObject:savedReceipt,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("_SAVED_HABIT_SUCCESS.json"))
    } catch {try? Data(String(describing:error).utf8).write(to:folder.appendingPathComponent("_ERROR.txt"))}
  }
  static func failure(_ text:String)->NSError {NSError(domain:"GlazeHabitReview",code:1,userInfo:[NSLocalizedDescriptionKey:text])}
}
