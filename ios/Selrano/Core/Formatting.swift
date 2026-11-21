import Foundation

enum Format {
    static let easternTime = TimeZone(identifier: "America/New_York")!

    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    private static let iso = ISO8601DateFormatter()

    static func date(_ value: String?) -> Date? {
        guard let value else { return nil }
        if let date = isoFractional.date(from: value) ?? iso.date(from: value) { return date }
        // Postgres timestamps can carry microseconds and a +00:00 offset.
        let trimmed = value.replacingOccurrences(of: #"\.(\d{3})\d+"#, with: ".$1", options: .regularExpression)
        return isoFractional.date(from: trimmed) ?? iso.date(from: trimmed)
    }

    static func relative(_ value: String?) -> String {
        guard let date = date(value) else { return "" }
        let seconds = Date().timeIntervalSince(date)
        if seconds < 60 { return "Just now" }
        if seconds < 3600 { return "\(Int(seconds / 60))m ago" }
        if seconds < 86_400 { return "\(Int(seconds / 3600))h ago" }
        if seconds < 7 * 86_400 { return "\(Int(seconds / 86_400))d ago" }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    static func money(_ value: Double) -> String {
        value.formatted(.currency(code: "USD"))
    }

    static func time(_ value: String) -> String {
        guard let date = date(value) else { return "" }
        var style = Date.FormatStyle.dateTime.hour().minute()
        style.timeZone = easternTime
        return date.formatted(style)
    }

    static func fileSize(_ bytes: Int?) -> String {
        guard let bytes else { return "" }
        return ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }

    /// Selrano never shows the em dash character (owner rule); mirror lib/text.ts removeEmDashes.
    static func clean(_ text: String) -> String {
        text.replacingOccurrences(of: "\u{2014}", with: "-")
    }

    static func greeting(name: String, now: Date = Date()) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = easternTime
        let hour = calendar.component(.hour, from: now)
        let part = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
        return name.isEmpty ? "\(part)." : "\(part), \(name)."
    }
}
