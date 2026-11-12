// swift-tools-version: 5.9
// NOIZY App Intents: Siri and Shortcuts on iPhone 15 Pro Max talk to M2Ultra through NOIZYBRIDGE, over the tailnet.
import PackageDescription

let package = Package(
    name: "NOIZYIntents",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "NOIZYIntents", targets: ["NOIZYIntents"])],
    targets: [.target(name: "NOIZYIntents")]
)
