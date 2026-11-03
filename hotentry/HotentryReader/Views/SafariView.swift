import SwiftUI
import SafariServices

/// Safari の閲覧画面 (リーダー表示 / Safari に入れたコンテンツブロッカーが効く)
struct SafariView: UIViewControllerRepresentable {
    let url: URL
    var reader: Bool = true

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = reader
        config.barCollapsingEnabled = true
        let vc = SFSafariViewController(url: url, configuration: config)
        vc.dismissButtonStyle = .close
        return vc
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

struct IdentifiableURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
