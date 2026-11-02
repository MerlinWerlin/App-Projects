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
    return ["checks":checks,"focusPersistenceAndTransitions":true,"batteryUnknownHandling":true,"nativeMetadata":true,"realAppGroupTouched":false,"physicalDeviceTest":false]
  }
}
