// swift-tools-version: 5.9
// NOIZY App Intents: Siri and Shortcuts on iPhone 15 Pro Max talk to M2Ultra through NOIZYBRIDGE, over the tailnet.
import PackageDescription

let package = Package(
    name: "NOIZYIntents",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "NOIZYIntents", targets: ["NOIZYIntents"])],
    // To run LUCY and GABRIEL on the iPhone with MLX, add this package in Xcode and uncomment the two lines:
    // dependencies: [.package(url: "https://github.com/ml-explore/mlx-swift-lm", branch: "main")],
    targets: [.target(name: "NOIZYIntents"
        // , dependencies: [.product(name: "MLXLMCommon", package: "mlx-swift-lm"), .product(name: "MLXLLM", package: "mlx-swift-lm")]
    )]
)
