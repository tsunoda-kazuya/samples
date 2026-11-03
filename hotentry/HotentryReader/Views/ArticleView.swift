import SwiftUI

struct ArticleView: View {
    let entry: Entry

    @StateObject private var web = WebViewModel()
    @State private var showComments = false
    @State private var safariItem: IdentifiableURL?

    @AppStorage("adblockEnabled") private var adblockEnabled = true
    @AppStorage("javascriptEnabled") private var javascriptEnabled = true
    @AppStorage("extraBlockDomains") private var extraBlockDomains = ""

    var body: some View {
        ZStack(alignment: .top) {
            if let webView = web.webView {
                WebView(webView: webView)
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            if web.isLoading {
                ProgressView(value: web.progress)
                    .progressViewStyle(.linear)
                    .tint(.accentColor)
            }
        }
        .navigationTitle(web.title?.isEmpty == false ? web.title! : entry.domain)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        safariItem = IdentifiableURL(url: web.url ?? entry.link)
                    } label: {
                        Label("Safari表示で開く（Adblock Plus有効）", systemImage: "safari")
                    }
                    Button {
                        UIApplication.shared.open(web.url ?? entry.link)
                    } label: {
                        Label("Safariアプリで開く", systemImage: "arrow.up.forward.app")
                    }
                    Button {
                        UIPasteboard.general.url = web.url ?? entry.link
                    } label: {
                        Label("URLをコピー", systemImage: "doc.on.doc")
                    }
                    Button {
                        safariItem = IdentifiableURL(url: entry.hatenaEntryURL)
                    } label: {
                        Label("はてブのページを開く", systemImage: "bookmark")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
            ToolbarItemGroup(placement: .bottomBar) {
                Button(action: web.goBack) { Image(systemName: "chevron.backward") }
                    .disabled(!web.canGoBack)
                Spacer()
                Button(action: web.goForward) { Image(systemName: "chevron.forward") }
                    .disabled(!web.canGoForward)
                Spacer()
                Button {
                    showComments = true
                } label: {
                    Label("\(entry.bookmarkCount)", systemImage: "bubble.left.and.text.bubble.right")
                        .labelStyle(.titleAndIcon)
                }
                Spacer()
                Button(action: web.reload) { Image(systemName: "arrow.clockwise") }
                Spacer()
                ShareLink(item: web.url ?? entry.link) { Image(systemName: "square.and.arrow.up") }
            }
        }
        .toolbar(.visible, for: .bottomBar)
        .task {
            ReadHistory.shared.markRead(entry)
            await web.setup(url: entry.link, options: .init(
                adBlock: adblockEnabled,
                javaScript: javascriptEnabled,
                extraDomains: extraBlockDomains.split(whereSeparator: \.isNewline).map(String.init)
            ))
        }
        .sheet(isPresented: $showComments) {
            CommentsView(entry: entry)
                .presentationDetents([.medium, .large])
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(item: $safariItem) { item in
            SafariView(url: item.url, onFinish: { safariItem = nil })
                .ignoresSafeArea()
        }
    }
}
