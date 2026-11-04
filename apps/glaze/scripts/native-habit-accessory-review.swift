import SwiftUI
import UIKit
import WidgetKit
import CryptoKit

@main struct NativeHabitAccessoryReview: App {
  var body: some Scene { WindowGroup { Text("Glaze Lock Screen habit review").task { await MainActor.run { HabitAccessoryCapture.run() } } } }
}
@MainActor enum HabitAccessoryCapture {
  static var started = false
  static func run() {
    guard !started else { return }; started = true
    let folder=FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent("GlazeHabitAccessoryReview")
    do {
      try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
      let profiles=try load("native-habit-review-profiles")["themes"] as! [[String:Any]]
      guard profiles.count==105 else {throw failure("105 profiles required")}
      let date=Date(timeIntervalSince1970:1793620800)
      let contrasting:Set<String>=["001-alpine-starlight","005-rainlight","014-frostglass-passage","034-match-point","062-froggy-picnic","063-boba-bear-club"]
      var records:[[String:Any]]=[]
      for p in profiles {
        let id=p["id"] as! String,theme=try JSONDecoder().decode(WidgetTheme.self,from:JSONSerialization.data(withJSONObject:p["nativeTheme"]!))
        for c in p["cases"] as! [[String:Any]] {
          let kind=HabitKindID(rawValue:c["kind"] as! String)!,state=c["state"] as! String
          guard kind.widgetFamilies.count==kind.nativeSizes.count else {throw failure("Native family mapping lost a size")}
          let entry=HabitEntry(date:date,theme:theme,habit:kind,value:(c["value"] as! NSNumber).doubleValue,goal:(c["goal"] as? NSNumber)?.doubleValue,step:(c["step"] as! NSNumber).doubleValue)
          for size in kind.nativeSizes.filter({$0.hasPrefix("accessory")}) {
            let (family,w,h)=dimensions(size)
            for scheme in contrasting.contains(id) ? ["dark","light"] : ["dark"] {
              try autoreleasepool {
                let view=HabitAccessoryView(entry:entry,family:family).frame(width:w,height:h)
                  .environment(\.colorScheme,scheme=="dark" ? .dark : .light)
                  .environment(\.locale,Locale(identifier:"en_US"))
                  .background(scheme=="dark" ? Color.black : Color.white)
                let record=try capture(view,file:"\(id)_\(kind.rawValue)_\(state)_\(size)_\(scheme).png",folder:folder)
                records.append(record.merging(["theme":id,"kind":kind.rawValue,"state":state,"size":size,"scheme":scheme],uniquingKeysWith:{$1}))
              }
            }
          }
        }
      }
      guard records.count==3663 else {throw failure("Expected3663 standard accessory renders")}
      try receipt(records,folder:folder,name:"_ACCESSORY_SUCCESS.json",scope:"Actual production HabitAccessoryView across105 themes, eleven supported kind/size combinations and three values. Six themes also checked on light backgrounds. Native content only; this is not a real Lock Screen or phone tap test.")
      let saved=try load("native-habit-accessory-review")["cases"] as! [[String:Any]]
      guard saved.count==24 else {throw failure("24 real saved accessory designs required")}
      var custom:[[String:Any]]=[]
      for c in saved {
        let theme=try JSONDecoder().decode(WidgetTheme.self,from:JSONSerialization.data(withJSONObject:c["nativeTheme"]!))
        let kind=HabitKindID(rawValue:c["kind"] as! String)!,def=HabitDef.of(kind)
        let design=SavedWidgetDesign(raw:c["raw"] as! [String:Any],texts:c["texts"] as! [String:String])
        guard design.habitTitle==c["expectedTitle"] as? String else {throw failure("Saved title mismatch")}
        let entry=HabitEntry(date:date,theme:theme,habit:kind,value:kind == .mood ? 3 : (def.goal ?? 0)/2,goal:def.goal,step:def.step)
        for scheme in ["dark","light"] {
          let view=HabitAccessoryView(entry:entry,family:.accessoryRectangular,design:design).frame(width:160,height:72)
            .environment(\.colorScheme,scheme=="dark" ? .dark : .light)
            .environment(\.layoutDirection,c["rtl"] as? Bool == true ? .rightToLeft : .leftToRight)
            .background(scheme=="dark" ? Color.black : Color.white)
          let record=try capture(view,file:"\(c["id"]!)_\(scheme).png",folder:folder)
          custom.append(record.merging(["theme":c["theme"]!,"kind":kind.rawValue,"title":c["expectedTitle"]!,"scheme":scheme,"rtl":c["rtl"]!],uniquingKeysWith:{$1}))
        }
      }
      try receipt(custom,folder:folder,name:"_ACCESSORY_SAVED_SUCCESS.json",scope:"48 actual saved accessory readouts, including emoji, Chinese and Arabic custom names. Arabic fixtures use RTL geometry. This does not qualify phone language lookup, SpringBoard links or vibrant/tinted modes.")
    }catch{try? Data(String(describing:error).utf8).write(to:folder.appendingPathComponent("_ERROR.txt"))}
  }
  static func load(_ name:String)throws->[String:Any] {
    guard let url=Bundle.main.url(forResource:name,withExtension:"json") else {throw failure("Missing fixture")}
    return try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
  }
  static func dimensions(_ size:String)->(WidgetFamily,CGFloat,CGFloat){
    switch size {
    case "accessoryCircular":return (.accessoryCircular,72,72)
    case "accessoryRectangular":return (.accessoryRectangular,160,72)
    default:return (.accessoryInline,257,26)
    }
  }
  static func capture<V:View>(_ view:V,file:String,folder:URL)throws->[String:Any] {
    let r=ImageRenderer(content:view);r.scale=2
    guard let im=r.uiImage,let data=im.pngData() else {throw failure("Native accessory image missing")}
    try data.write(to:folder.appendingPathComponent(file),options:.atomic)
    return ["file":file,"width":Int(im.size.width*im.scale),"height":Int(im.size.height*im.scale),"sha256":SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined()]
  }
  static func receipt(_ records:[[String:Any]],folder:URL,name:String,scope:String)throws {
    let r:[String:Any]=["sourceSHA":Bundle.main.object(forInfoDictionaryKey:"ReviewSourceSHA") as? String ?? "unknown","renders":records.count,"records":records,"scope":scope,"physicalDeviceTest":false,"installedWidgetTapTest":false]
    try JSONSerialization.data(withJSONObject:r,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent(name))
  }
  static func failure(_ s:String)->NSError{NSError(domain:"GlazeAccessoryReview",code:1,userInfo:[NSLocalizedDescriptionKey:s])}
}
