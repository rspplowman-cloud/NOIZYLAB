import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif
#if canImport(MLXLMCommon)
import MLXLMCommon
#endif

/// LUCY and GABRIEL on the iPhone itself: small, fast, private. Nothing leaves the phone.
///
/// Two engines, tried in this order:
///   1. MLX (mlx-swift-lm): a small 4-bit open model you choose. Fastest sustained speed on Apple Silicon.
///   2. Apple's on-device model (Foundation Models framework, Apple Intelligence devices: iPhone 15 Pro and later).
/// If neither is available, the caller falls back to M2Ultra through NOIZYBRIDGE.
///
/// The on-device minds ADVISE ONLY. They have no tools and cannot act. Actions go through NOIZYBRIDGE,
/// which checks the key and HALT. Never-to-AI material (consent records, NOIZYKIDZ, family, the vault) is never
/// sent to them by this app.
public enum OnDeviceMind {
    public enum Who: String, Sendable { case lucy = "LUCY", gabriel = "GABRIEL" }

    /// MLX model id. Small on purpose: an iPhone 15 Pro Max has 8 GB of memory, so stay at 1–3 B parameters, 4-bit.
    /// Change it in the NOIZY app's settings. VERIFY the id exists on the Hugging Face Hub before shipping.
    public static var mlxModelID: String {
        UserDefaults.standard.string(forKey: "noizy_mlx_model") ?? "mlx-community/Llama-3.2-1B-Instruct-4bit"
    }

    static func instructions(_ who: Who) -> String {
        let shared = """
        You speak to Robert Stephen Plowman (RSP_001). Answer in at most five short bullet points, plain words, \
        most important first. You only advise: you cannot run, send, change or delete anything. \
        If asked to act, say "queue for GABRIEL on M2Ultra". Never guess facts about his files or drives; \
        say you would need to check M2Ultra. NOIZY is spelled with a Z.
        """
        switch who {
        case .lucy: return "You are LUCY, NOIZY's organizer and memory. Calm, tidy, kind. " + shared
        case .gabriel: return "You are GABRIEL, NOIZY's lead orchestrator. Direct, careful about safety and consent. " + shared
        }
    }

    public enum Failure: LocalizedError {
        case noEngine
        public var errorDescription: String? { "No on-device model is ready on this iPhone." }
    }

    /// One question, one short answer, on the phone.
    public static func ask(_ who: Who, _ question: String) async throws -> (text: String, engine: String) {
        let q = String(question.prefix(1000))
        #if canImport(MLXLMCommon)
        if let text = try? await askMLX(who, q) { return (text, "MLX, on this iPhone") }
        #endif
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *), let text = try? await askApple(who, q) { return (text, "Apple on-device model") }
        #endif
        throw Failure.noEngine
    }

    #if canImport(MLXLMCommon)
    private static var loaded: (id: String, model: ModelContext)?
    private static func askMLX(_ who: Who, _ q: String) async throws -> String {
        // VERIFY against the mlx-swift-lm version you add in Xcode: loadModel(id:) and ChatSession are its simple API.
        if loaded?.id != mlxModelID { loaded = (mlxModelID, try await loadModel(id: mlxModelID)) }
        let session = ChatSession(loaded!.model, instructions: instructions(who))
        return try await session.respond(to: q)
    }
    #endif

    #if canImport(FoundationModels)
    @available(iOS 26.0, macOS 26.0, *)
    private static func askApple(_ who: Who, _ q: String) async throws -> String {
        guard case .available = SystemLanguageModel.default.availability else { throw Failure.noEngine }
        let session = LanguageModelSession(instructions: instructions(who))
        return try await session.respond(to: q).content
    }
    #endif
}
