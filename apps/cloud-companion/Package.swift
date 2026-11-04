// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CloudCompanion",
    platforms: [.macOS(.v13)],
    products: [.library(name: "CloudCore", targets: ["CloudCore"])],
    targets: [
        .target(name: "CloudCore", path: "Shared", exclude: ["WeatherClient.swift", "CloudArt.swift", "WidgetCard.swift"], sources: ["Core.swift"]),
        .testTarget(name: "CloudCoreTests", dependencies: ["CloudCore"], path: "Tests")
    ]
)
