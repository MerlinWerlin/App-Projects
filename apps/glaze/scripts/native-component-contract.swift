import Foundation

/// Runs inside the isolated review app; no real App Group state is touched.
enum NativeComponentContract {
  static func verify() throws -> [String: Any] {
    enum Failure: Error { case assertion(String) }
    var checks = 0
    func check(_ value: Bool, _ label: String) throws {
      guard value else { throw Failure.assertion(label) }; checks += 1
    }
    let name="com.glaze.review.focus.\(UUID().uuidString)"
    guard let store=UserDefaults(suiteName:name) else { throw Failure.assertion("test store") }
    defer { store.removePersistentDomain(forName:name) }
    let start=Date(timeIntervalSince1970:1800000000)
    if case .idle=FocusStore.phase(in:store,at:start) { checks+=1 } else { throw Failure.assertion("initial idle") }
    FocusStore.toggle(in:store,now:start)
    if case .running(let end)=FocusStore.phase(in:store,at:start) {
      try check(end.timeIntervalSince(start)==1500,"25minute start")
    } else { throw Failure.assertion("start running") }
    FocusStore.toggle(in:store,now:start.addingTimeInterval(125))
    if case .paused(let remaining)=FocusStore.phase(in:store,at:start.addingTimeInterval(900)) {
      try check(remaining==1375,"pause preserves exact remainder")
    } else { throw Failure.assertion("pause") }
    // A fresh UserDefaults handle sees persisted state; time passing doesn't consume paused time.
    let reopened=UserDefaults(suiteName:name)!
    if case .paused(let remaining)=FocusStore.phase(in:reopened,at:start.addingTimeInterval(2000)) {
      try check(remaining==1375,"persisted paused")
    } else { throw Failure.assertion("reopen paused") }
    FocusStore.toggle(in:reopened,now:start.addingTimeInterval(2000))
    if case .running(let end)=FocusStore.phase(in:reopened,at:start.addingTimeInterval(2000)) {
      try check(end.timeIntervalSince(start)==3375,"resume uses remaining")
    } else { throw Failure.assertion("resume") }
    if case .idle=FocusStore.phase(in:reopened,at:start.addingTimeInterval(3375)) { checks+=1 } else { throw Failure.assertion("completion idle") }
    try check(FocusStore.clock(1375)=="22:55","paused display")
    try check(FocusStore.clock(-10)=="0:00","negative clock clamp")
    try check(FocusStore.clock(.infinity)=="0:00","nonfinite clock safe")
    try check(FocusStore.clock(.nan)=="0:00","NaN clock safe")
    store.set(Double.infinity,forKey:"glaze.focus.v1.end")
    store.set(Double.nan,forKey:"glaze.focus.v1.remaining")
    if case .idle=FocusStore.phase(in:store,at:start) {checks+=1} else {throw Failure.assertion("corrupt focus idle")}
    for (value,expected) in [(Float(0),0),(Float(0.5),50),(Float(1),100)] { try check(LiveBattery.percent(level:value)==expected,"valid battery") }
    for value in [Float(-1),Float(1.1),Float.nan,Float.infinity] { try check(LiveBattery.percent(level:value)==nil,"unknown battery never fabricated") }
    for kind in ["date","focus","battery"] {
      let spec=LiveArtSpec.parse(["kind":kind,"rect":[0.1,0.1,0.8,0.14],"shape":"plate","cleanFace":true,"valueStyle":"compact","ink":"#FFFFFF"])
      try check(spec?.compact==true,"compact native parse \(kind)")
    }
    try check(LiveArtSpec.parse(["kind":"clock","rect":[0,0,1,1],"valueStyle":"compact"])?.compact==false,"clock cannot use value compact")
    for (zone,month,day,hours) in [("America/New_York",3,8,23),("America/New_York",11,1,25),("Australia/Sydney",10,4,23),("Australia/Sydney",4,5,25)] {
      var cal=Calendar(identifier:.gregorian);cal.timeZone=TimeZone(identifier:zone)!
      let midnight=cal.date(from:DateComponents(year:2026,month:month,day:day))!
      let next=LiveArtSchedule.nextMidnight(from:midnight,calendar:cal)
      try check(next.timeIntervalSince(midnight)==Double(hours*3600),"DST midnight \(zone) \(month)")
      try check(cal.component(.hour,from:next)==0,"calendar midnight hour")
    }
    let clockSpec=LiveArtSpec.parse(["kind":"clock","rect":[0,0,1,1]])!
    let scheduled=LiveArtSchedule.plan(spec:clockSpec,from:start.addingTimeInterval(17))
    try check(scheduled.dates.count==61,"clock timeline61 entries")
    try check(zip(scheduled.dates,scheduled.dates.dropFirst()).allSatisfy{$0.0<$0.1},"clock increasing timeline")
    let dateSpec=LiveArtSpec.parse(["kind":"date","rect":[0,0,1,1]])!
    try check(LiveArtSchedule.plan(spec:dateSpec,from:start).dates==[start],"date current entry")
    let utc = TimeZone(secondsFromGMT: 0)!
    var gregorian = Calendar(identifier: .gregorian); gregorian.timeZone = utc
    let boundary = gregorian.date(from: DateComponents(year: 2026,month: 11,day: 2,hour: 0,minute: 15))!
    func text(_ locale: String, _ zone: TimeZone? = nil, _ template: String = "EEE d MMM") -> String {
      LiveDateText.format(boundary,template:template,locale:Locale(identifier:locale),calendar:gregorian,timeZone:zone ?? utc)
    }
    try check(text("en_US").contains("Mon") && text("en_US").contains("Nov"),"English compact date")
    try check(text("fr_FR").contains("lun") && text("fr_FR").contains("nov"),"French compact date")
    try check(text("ja_JP").contains("月") && text("ja_JP").contains("2"),"Japanese compact date")
    try check(text("de_DE").contains("Mo"),"German weekday")
    try check(text("en_US",utc,"d")=="2","UTC day at boundary")
    try check(text("en_US",TimeZone(identifier:"America/Los_Angeles")!,"d")=="1","widget time zone previous day")
    try check(text("ar_SA") != text("en_US"),"Arabic locale is honored")
    try check(LiveArtReadings.snapshot(focus:.idle,battery:-1).battery==nil,"snapshot rejects negative level")
    try check(LiveArtReadings.snapshot(focus:.idle,battery:101).battery==nil,"snapshot rejects oversized level")
    try check(LiveArtReadings.snapshot(focus:.idle,battery:0).battery==0,"empty battery is valid")
    try check(LiveArtReadings.snapshot(focus:.idle,battery:100).battery==100,"full battery is valid")
    return ["checks":checks,"focusPersistenceAndTransitions":true,"batteryUnknownHandling":true,"nativeMetadata":true,"realAppGroupTouched":false,"physicalDeviceTest":false]
  }
}
