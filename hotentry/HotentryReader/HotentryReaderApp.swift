import SwiftUI

@main
struct HotentryReaderApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .task { await FilterListManager.shared.updateIfNeeded() }
        }
    }
}
