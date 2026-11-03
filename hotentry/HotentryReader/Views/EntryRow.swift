import SwiftUI

struct EntryRow: View {
    let entry: Entry
    let isRead: Bool

    private static let relative: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "ja_JP")
        f.unitsStyle = .short
        return f
    }()

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(entry.title)
                    .font(.body.weight(.semibold))
                    .lineLimit(3)
                    .foregroundStyle(isRead ? Color.secondary : Color.primary)

                HStack(spacing: 6) {
                    AsyncImage(url: entry.faviconURL) { image in
                        image.resizable()
                    } placeholder: {
                        Color.secondary.opacity(0.2)
                    }
                    .frame(width: 14, height: 14)
                    .clipShape(RoundedRectangle(cornerRadius: 3))

                    Text(entry.domain)
                        .lineLimit(1)
                        .foregroundStyle(.secondary)
                }
                .font(.caption)

                HStack(spacing: 8) {
                    Text("\(entry.bookmarkCount) users")
                        .font(.caption.bold())
                        .foregroundStyle(Color(red: 1.0, green: 0.25, blue: 0.4))
                    if let date = entry.date {
                        Text(Self.relative.localizedString(for: date, relativeTo: .now))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Spacer(minLength: 0)
            if let imageURL = entry.imageURL {
                AsyncImage(url: imageURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.secondary.opacity(0.15)
                }
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .opacity(isRead ? 0.5 : 1)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}
