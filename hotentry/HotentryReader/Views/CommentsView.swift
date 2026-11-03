import SwiftUI

struct CommentsView: View {
    let entry: Entry

    @State private var bookmarks: [Bookmark] = []
    @State private var totalCount: Int?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @AppStorage("showEmptyComments") private var showEmptyComments = false

    private var visible: [Bookmark] {
        showEmptyComments ? bookmarks : bookmarks.filter { !$0.comment.isEmpty }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorMessage {
                    ContentUnavailableView("読み込めませんでした", systemImage: "wifi.exclamationmark",
                                           description: Text(errorMessage))
                } else if visible.isEmpty {
                    ContentUnavailableView("コメントはまだありません", systemImage: "bubble.left")
                } else {
                    List(visible) { bookmark in
                        CommentRow(bookmark: bookmark)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle(titleText)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Toggle(isOn: $showEmptyComments) {
                        Image(systemName: showEmptyComments ? "text.bubble.fill" : "text.bubble")
                    }
                    .toggleStyle(.button)
                }
            }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private var titleText: String {
        let total = totalCount ?? entry.bookmarkCount
        let comments = bookmarks.filter { !$0.comment.isEmpty }.count
        return "\(total) users・コメント \(comments)"
    }

    private func load() async {
        do {
            let result = try await HatenaAPI.fetchBookmarks(for: entry.link)
            bookmarks = result.bookmarks
            totalCount = result.count
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

struct CommentRow: View {
    let bookmark: Bookmark

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            AsyncImage(url: bookmark.iconURL) { image in
                image.resizable()
            } placeholder: {
                Color.secondary.opacity(0.2)
            }
            .frame(width: 32, height: 32)
            .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(bookmark.user).font(.subheadline.bold())
                    Spacer()
                    Text(bookmark.timestamp).font(.caption2).foregroundStyle(.secondary)
                }
                if !bookmark.comment.isEmpty {
                    Text(bookmark.comment)
                        .font(.callout)
                        .textSelection(.enabled)
                }
                if !bookmark.tags.isEmpty {
                    Text(bookmark.tags.map { "#\($0)" }.joined(separator: " "))
                        .font(.caption)
                        .foregroundStyle(.tint)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
