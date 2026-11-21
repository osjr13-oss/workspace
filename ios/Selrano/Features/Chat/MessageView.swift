import SwiftUI

struct MessageView: View {
    let message: ChatMessage
    let streaming: Bool
    let onRegenerate: (() -> Void)?
    @Environment(Notices.self) private var notices

    var body: some View {
        if message.isUser {
            HStack {
                Spacer(minLength: 48)
                VStack(alignment: .trailing, spacing: 6) {
                    if !message.attachedFileNames.isEmpty {
                        HStack(spacing: 6) {
                            ForEach(message.attachedFileNames, id: \.self) { name in
                                HStack(spacing: 5) {
                                    Image(systemName: "paperclip")
                                        .font(.system(size: 11, weight: .semibold))
                                    Text(name)
                                        .font(.system(size: 12, weight: .medium))
                                        .lineLimit(1)
                                }
                                .foregroundStyle(Theme.inkSoft)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.border, lineWidth: 1))
                            }
                        }
                    }
                    Text(message.content)
                        .font(.system(size: 16))
                        .foregroundStyle(Theme.ink)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Theme.accentSoftStrong, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .textSelection(.enabled)
                }
            }
        } else if message.id == "error" {
            Label(message.content, systemImage: "exclamationmark.circle")
                .font(.system(size: 15))
                .foregroundStyle(Theme.critical)
        } else {
            VStack(alignment: .leading, spacing: 12) {
                MarkdownView(text: message.content)
                if !message.visibleSources.isEmpty {
                    Sources(sources: message.visibleSources)
                }
                if !streaming {
                    HStack(spacing: 18) {
                        Button {
                            UIPasteboard.general.string = message.content
                            notices.show("Copied")
                        } label: {
                            Image(systemName: "doc.on.doc")
                        }
                        .accessibilityLabel("Copy reply")
                        ShareLink(item: message.content) { Image(systemName: "square.and.arrow.up") }
                            .accessibilityLabel("Share reply")
                        if let onRegenerate {
                            Button(action: onRegenerate) { Image(systemName: "arrow.clockwise") }
                                .accessibilityLabel("Try again")
                        }
                    }
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.muted)
                    .transition(.opacity)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Selrano response")
        }
    }
}

private struct Sources: View {
    let sources: [Citation]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(sources.enumerated()), id: \.offset) { index, source in
                    if let link = source.url, let url = URL(string: link) {
                        Link(destination: url) { chip(index: index, title: source.title ?? url.host() ?? link, icon: "globe") }
                    } else {
                        chip(index: index, title: source.fileName ?? "File", icon: "doc.text")
                    }
                }
            }
        }
    }

    private func chip(index: Int, title: String, icon: String) -> some View {
        HStack(spacing: 6) {
            Text("\(index + 1)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color(hex: 0xFDFBF7))
                .frame(width: 18, height: 18)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 5))
            Image(systemName: icon).font(.system(size: 11)).foregroundStyle(Theme.muted)
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.inkSoft)
                .lineLimit(1)
        }
        .frame(maxWidth: 220, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.border, lineWidth: 1))
    }
}
