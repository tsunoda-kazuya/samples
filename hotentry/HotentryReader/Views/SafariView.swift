import SwiftUI
import SafariServices

/// Safari の閲覧画面。Safari に設定したコンテンツブロッカー (Adblock Plus 等) が効く
struct SafariView: UIViewControllerRepresentable {
    let url: URL
    var reader: Bool = false
    var onFinish: () -> Void = {}

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = reader
        config.barCollapsingEnabled = true
        let vc = SFSafariViewController(url: url, configuration: config)
        vc.dismissButtonStyle = .close
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {
        context.coordinator.onFinish = onFinish
    }

    final class Coordinator: NSObject, SFSafariViewControllerDelegate {
        var onFinish: () -> Void
        init(onFinish: @escaping () -> Void) { self.onFinish = onFinish }
        func safariViewControllerDidFinish(_ controller: SFSafariViewController) { onFinish() }
    }
}

struct IdentifiableURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

/// Safari 表示で記事を開く時の表示内容
struct SafariPresentation: Identifiable {
    let entry: Entry
    let reader: Bool
    var id: String { entry.id + (reader ? "#reader" : "") }
}

/// 記事を Safari 表示 + フローティングのブコメボタンで見る画面
struct SafariArticleScreen: View {
    let presentation: SafariPresentation
    let onClose: () -> Void
    @State private var showComments = false

    var body: some View {
        SafariView(url: presentation.entry.link, reader: presentation.reader, onFinish: onClose)
            .ignoresSafeArea()
            .overlay(alignment: .bottomTrailing) {
                Button {
                    showComments = true
                } label: {
                    Label("\(presentation.entry.bookmarkCount)", systemImage: "bubble.left.and.text.bubble.right.fill")
                        .font(.subheadline.bold())
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(.ultraThinMaterial, in: Capsule())
                        .overlay(Capsule().stroke(Color.accentColor.opacity(0.4)))
                }
                .padding(.trailing, 16)
                .padding(.bottom, 64) // Safari のツールバーに被らない位置
            }
            .sheet(isPresented: $showComments) {
                CommentsView(entry: presentation.entry)
                    .presentationDetents([.fraction(0.45), .large])
                    .presentationBackgroundInteraction(.enabled(upThrough: .fraction(0.45)))
                    .presentationDragIndicator(.visible)
            }
    }
}
