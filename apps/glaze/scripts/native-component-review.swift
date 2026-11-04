import SwiftUI
import UIKit
import CryptoKit

@MainActor
enum NativeComponentCapture {
 static func run(folder:URL) throws {
  let contract=try NativeComponentContract.verify()
  try JSONSerialization.data(withJSONObject:contract,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("_COMPONENT_CONTRACT.json"))
  guard let url=Bundle.main.url(forResource:"themed-component-profiles",withExtension:"json"),
        let root=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any],
        let themes=root["themes"] as? [[String:Any]],themes.count==105 else { throw NSError(domain:"ComponentReview",code:1) }
  var records:[[String:Any]]=[]
  for t in themes {
   guard let id=t["id"] as? String,let bg=t["bg"] as? String,let ink=t["ink"] as? String,
         let filename=t["image"] as? String,let image=UIImage(contentsOfFile:Bundle.main.bundleURL.appendingPathComponent("themed-clock-fixtures").appendingPathComponent(filename).path),
         let components=t["components"] as? [[String:Any]] else { throw NSError(domain:"ComponentReview",code:2) }
   var theme=WidgetTheme();theme.themeId=id;theme.bg=[bg];theme.surface=bg;theme.ink=ink;theme.accent=ink
   let sizes:[(String,CGFloat,CGFloat)]=[("small",170,170),("medium",364,170),("large",364,382)]
   for (size,width,height) in sizes {
    let art=NativeClockArt(image:ClockArtRenderer.render(image:image,width:width*2,height:height*2,colour:bg),width:width,height:height)
    for c in components {
     guard let kind=c["kind"] as? String,let composed=c["composed"] as? [String:Any],let spec=LiveArtSpec.parse(composed[size]) else {throw NSError(domain:"ComponentReview",code:3)}
     for fit in [false,true] {
      try autoreleasepool {
       let date=Calendar.current.date(from:DateComponents(year:2026,month:11,day:2,hour:12))!
       let value=NativeClockComposition(artwork:art,spec:spec,theme:theme,date:date,width:width,height:height,fit:fit).frame(width:width,height:height).background(Color(hex:bg)).environment(\.colorScheme,.light).environment(\.locale,Locale(identifier:"en_US"))
       let renderer=ImageRenderer(content:value);renderer.scale=2
       guard let rendered=renderer.uiImage,let bytes=rendered.jpegData(compressionQuality:0.93) else {throw NSError(domain:"ComponentReview",code:4)}
       let file="\(id)_\(kind)_\(size)_\(fit ? "fit" : "fill").jpg"
       try bytes.write(to:folder.appendingPathComponent(file),options:.atomic)
       records.append(["theme":id,"kind":kind,"size":size,"fit":fit ? "fit" : "fill","file":file,"sha256":SHA256.hash(data:bytes).map{String(format:"%02x",$0)}.joined(),"width":Int(rendered.size.width*rendered.scale),"height":Int(rendered.size.height*rendered.scale)])
      }
     }
    }
   }
  }
  try captureStates(themes: themes, folder: folder)
  let result:[String:Any]=["schema":"GLAZE_NATIVE_COMPONENT_CAPTURE_V1","sourceSHA":Bundle.main.object(forInfoDictionaryKey:"ReviewSourceSHA") as? String ?? "unknown","themes":105,"renders":records.count,"records":records,"physicalDeviceTest":false,"installedWidgetTest":false,"scope":"Actual native date/focus/battery views over original art. Focus idle render; separate isolated transition/persistence contract. Battery uses simulator level or honest dash; no fabricated level."]
  try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("_COMPONENT_SUCCESS.json"))
 }
 static func captureStates(themes: [[String:Any]], folder: URL) throws {
  let selected: Set<String> = ["001-alpine-starlight", "005-rainlight", "017-rosewater-reverie", "021-indigo-current", "025-lavender-nocturne", "030-silver-orchard"]
  let zone = TimeZone(secondsFromGMT: 0)!
  var calendar = Calendar(identifier: .gregorian); calendar.timeZone = zone
  let now = Date()
  let date = calendar.date(from: DateComponents(year: 2026, month: 11, day: 2, hour: 12))!
  var records: [[String:Any]] = []
  for t in themes {
   guard let id=t["id"] as? String, selected.contains(id), let bg=t["bg"] as? String, let ink=t["ink"] as? String,
         let filename=t["image"] as? String, let image=UIImage(contentsOfFile:Bundle.main.bundleURL.appendingPathComponent("themed-clock-fixtures").appendingPathComponent(filename).path),
         let components=t["components"] as? [[String:Any]] else { continue }
   var theme=WidgetTheme();theme.themeId=id;theme.bg=[bg];theme.surface=bg;theme.ink=ink;theme.accent=ink
   var cases: [(String,String,String,LiveArtReadings)] = []
   for locale in ["en_US","fr_FR","de_DE","ar_SA","ja_JP","ko_KR","hi_IN","th_TH"] {
    cases.append(("date",locale,locale,.snapshot(focus:.idle,battery:nil)))
   }
   for (name,phase) in [("idle",GlazeFocusPhase.idle),("running",.running(end:now.addingTimeInterval(1375))),("paused",.paused(remaining:1375)),("last-second",.paused(remaining:1))] {
    cases.append(("focus",name,"en_US",.snapshot(focus:phase,battery:nil)))
   }
   for (name,level) in [("unknown",nil),("empty",0),("low",5),("quarter",25),("half",50),("full",100)] as [(String,Int?)] {
    cases.append(("battery",name,"en_US",.snapshot(focus:.idle,battery:level)))
   }
   for (size,width,height) in [("small",CGFloat(170),CGFloat(170)),("medium",364,170),("large",364,382)] {
    let art=NativeClockArt(image:ClockArtRenderer.render(image:image,width:width*2,height:height*2,colour:bg),width:width,height:height)
    for (kind,state,locale,readings) in cases {
     guard let component=components.first(where:{$0["kind"] as? String == kind}),let composed=component["composed"] as? [String:Any],let spec=LiveArtSpec.parse(composed[size]) else {throw NSError(domain:"StateReview",code:1)}
     for fit in [false,true] {
      try autoreleasepool {
       var cal=Calendar(identifier:locale=="th_TH" ? .buddhist : .gregorian);cal.timeZone=zone
       let view=NativeClockComposition(artwork:art,spec:spec,theme:theme,date:kind=="focus" ? now : date,width:width,height:height,fit:fit,readings:readings)
        .environment(\.colorScheme,.light).environment(\.locale,Locale(identifier:locale)).environment(\.calendar,cal).environment(\.timeZone,zone).environment(\.layoutDirection,locale=="ar_SA" ? .rightToLeft : .leftToRight)
       let renderer=ImageRenderer(content:view);renderer.scale=2
       guard let rendered=renderer.uiImage,let data=rendered.jpegData(compressionQuality:0.93) else {throw NSError(domain:"StateReview",code:2)}
       let file="state_\(id)_\(kind)_\(state)_\(size)_\(fit ? "fit" : "fill").jpg"
       try data.write(to:folder.appendingPathComponent(file),options:.atomic)
       records.append(["theme":id,"kind":kind,"state":state,"locale":locale,"size":size,"layout":fit ? "fit" : "fill","file":file,"sha256":SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined(),"width":Int(rendered.size.width*rendered.scale),"height":Int(rendered.size.height*rendered.scale)])
      }
     }
    }
   }
  }
  guard records.count==648 else {throw NSError(domain:"StateReview",code:3,userInfo:[NSLocalizedDescriptionKey:"Expected648 state frames, got \(records.count)"])}
  let result:[String:Any] = ["schema":"GLAZE_NATIVE_STATE_CAPTURE_V1","sourceSHA":Bundle.main.object(forInfoDictionaryKey:"ReviewSourceSHA") as? String ?? "unknown","themes":6,"renders":records.count,"records":records,"physicalDeviceTest":false,"installedWidgetInteraction":false,"scope":"Actual production SwiftUI layouts with explicitly injected preview readings:8 date locales,4 focus states,6 battery states;3 sizes/FitFill. Injected battery percentages are visual fixtures, never device measurements. No App Group writes."]
  try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("_STATE_SUCCESS.json"))
 }

}
