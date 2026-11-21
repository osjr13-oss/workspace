import SwiftUI

/// Selrano's editorial palette (DESIGN_SYSTEM.md): warm paper, ink, and the logo navy
/// as the only accent. The app has one light look, like the website.
enum Theme {
    static let paper = Color(hex: 0xF6F3EC)
    static let paperRaised = Color(hex: 0xFDFBF7)
    static let surface = Color(hex: 0xFFFDF9)
    static let sunken = Color(hex: 0xEFEBE2)
    static let ink = Color(hex: 0x16191F)
    static let inkSoft = Color(hex: 0x3B4048)
    static let muted = Color(hex: 0x676B72)
    static let border = Color(red: 0.16, green: 0.14, blue: 0.11).opacity(0.11)
    static let borderStrong = Color(red: 0.16, green: 0.14, blue: 0.11).opacity(0.2)
    static let accent = Color(hex: 0x1B2D50)
    static let accentSoft = Color(hex: 0x1B2D50).opacity(0.07)
    static let accentSoftStrong = Color(hex: 0x1B2D50).opacity(0.12)
    static let highlight = Color(hex: 0xF4E4B0)
    static let critical = Color(hex: 0xB63B37)
    static let good = Color(hex: 0x2F7A4F)
    static let pending = Color(hex: 0xA4741D)

    /// Page titles and big numbers: the serif (New York) stands in for Newsreader.
    static func display(_ size: CGFloat) -> Font { .system(size: size, weight: .medium, design: .serif) }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// The paper card every section sits on.
struct Card<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.border, lineWidth: 1))
            .shadow(color: Color(red: 0.16, green: 0.14, blue: 0.11).opacity(0.05), radius: 10, y: 4)
    }
}

/// A card heading with an icon and an optional link on the right.
struct CardHeader<Trailing: View>: View {
    let title: String
    let systemImage: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.accent)
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Spacer(minLength: 8)
            trailing
        }
    }
}

extension CardHeader where Trailing == EmptyView {
    init(title: String, systemImage: String) {
        self.init(title: title, systemImage: systemImage) { EmptyView() }
    }
}

/// Shimmering placeholder bars while a card loads.
struct SkeletonLines: View {
    var count = 3
    @State private var phase = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(0..<count, id: \.self) { index in
                RoundedRectangle(cornerRadius: 6)
                    .fill(Theme.sunken)
                    .frame(height: 13)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.trailing, CGFloat(index) * 40)
            }
        }
        .opacity(phase ? 0.55 : 1)
        .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: phase)
        .onAppear { phase = true }
        .accessibilityHidden(true)
    }
}

/// A quiet explanation with an optional action, for empty or not-connected cards.
struct EmptyNote: View {
    let text: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Theme.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(SecondaryButtonStyle())
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.paperRaised, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Color(hex: 0xFDFBF7))
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(Theme.accent.opacity(configuration.isPressed ? 0.85 : 1), in: Capsule())
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 14)
            .frame(minHeight: 36)
            .background(configuration.isPressed ? Theme.sunken : Theme.surface, in: Capsule())
            .overlay(Capsule().stroke(Theme.borderStrong, lineWidth: 1))
    }
}

/// A small notice that slides down from the top after an action ("Note saved").
@Observable
final class Notices {
    struct Notice: Identifiable, Equatable {
        let id = UUID()
        let title: String
        var isError = false
    }

    private(set) var current: Notice?

    func show(_ title: String, error: Bool = false) {
        let notice = Notice(title: title, isError: error)
        withAnimation(.spring(duration: 0.35)) { current = notice }
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(error ? .error : .success)
        Task {
            try? await Task.sleep(for: .seconds(error ? 4 : 2.6))
            if current?.id == notice.id { withAnimation(.easeOut(duration: 0.25)) { current = nil } }
        }
    }
}

struct NoticeBanner: View {
    let notice: Notices.Notice

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: notice.isError ? "exclamationmark" : "checkmark")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color(hex: 0xFDFBF7))
                .frame(width: 24, height: 24)
                .background(notice.isError ? Theme.critical : Theme.accent, in: Circle())
            Text(notice.title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
        }
        .padding(.leading, 10)
        .padding(.trailing, 16)
        .padding(.vertical, 10)
        .background(Theme.surface, in: Capsule())
        .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
        .shadow(color: Theme.accent.opacity(0.18), radius: 18, y: 8)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }
}
