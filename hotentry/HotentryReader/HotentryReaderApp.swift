import SwiftUI

@main
struct HotentryReaderApp: App {
    var body: some Scene {
        WindowGroup {
            EntryListView()
                .task { await FilterListManager.shared.updateIfNeeded() }
        }
    }
}
