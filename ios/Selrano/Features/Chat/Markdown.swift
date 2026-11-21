import SwiftUI

/// The Markdown Selrano writes, split into blocks that SwiftUI can lay out.
enum MarkdownBlock: Equatable {
    case heading(level: Int, text: String)
    case paragraph(String)
    case bullet(String, depth: Int)
    case numbered(Int, String)
    case quote(String)
    case code(String)
    case table([[String]])
    case rule

    static func parse(_ source: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        var paragraph: [String] = []
        var code: [String]?
        var table: [[String]] = []

        func flushParagraph() {
            if !paragraph.isEmpty { blocks.append(.paragraph(paragraph.joined(separator: " "))) }
            paragraph = []
        }
        func flushTable() {
            if !table.isEmpty { blocks.append(.table(table)) }
            table = []
        }

        for rawLine in source.components(separatedBy: "\n") {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("```") {
                if let lines = code {
                    blocks.append(.code(lines.joined(separator: "\n")))
                    code = nil
                } else {
                    flushParagraph(); flushTable()
                    code = []
                }
                continue
            }
            if code != nil { code?.append(rawLine); continue }

            if line.hasPrefix("|") {
                flushParagraph()
                let cells = line.trimmingCharacters(in: CharacterSet(charactersIn: "|")).components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
                // Skip the |---|---| divider row.
                if !cells.allSatisfy({ $0.allSatisfy { "-: ".contains($0) } }) { table.append(cells) }
                continue
            }
            flushTable()

            if line.isEmpty { flushParagraph(); continue }
            if line == "---" || line == "***" { flushParagraph(); blocks.append(.rule); continue }
            if let match = line.firstMatch(of: /^(#{1,6})\s+(.*)$/) {
                flushParagraph()
                blocks.append(.heading(level: match.1.count, text: String(match.2)))
                continue
            }
            if let match = rawLine.firstMatch(of: /^(\s*)[-*+]\s+(.*)$/) {
                flushParagraph()
                blocks.append(.bullet(String(match.2), depth: min(match.1.count / 2, 3)))
                continue
            }
            if let match = line.firstMatch(of: /^(\d+)[.)]\s+(.*)$/) {
                flushParagraph()
                blocks.append(.numbered(Int(match.1) ?? 1, String(match.2)))
                continue
            }
            if line.hasPrefix(">") {
                flushParagraph()
                blocks.append(.quote(String(line.dropFirst()).trimmingCharacters(in: .whitespaces)))
                continue
            }
            paragraph.append(line)
        }
        if let lines = code { blocks.append(.code(lines.joined(separator: "\n"))) }
        flushParagraph()
        flushTable()
        return blocks
    }
}

/// Inline Markdown (bold, italics, links, code) as styled text.
func inline(_ text: String) -> AttributedString {
    var attributed = (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text)
    for run in attributed.runs where run.inlinePresentationIntent?.contains(.code) == true {
        attributed[run.range].font = .system(size: 14, design: .monospaced)
        attributed[run.range].backgroundColor = Theme.sunken
    }
    for run in attributed.runs where run.link != nil {
        attributed[run.range].foregroundColor = Theme.accent
        attributed[run.range].underlineStyle = .single
    }
    return attributed
}

struct MarkdownView: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(MarkdownBlock.parse(text).enumerated()), id: \.offset) { _, block in
                view(for: block)
            }
        }
        .font(.system(size: 16))
        .foregroundStyle(Theme.ink)
        .lineSpacing(3)
        .textSelection(.enabled)
    }

    @ViewBuilder
    private func view(for block: MarkdownBlock) -> some View {
        switch block {
        case .heading(let level, let text):
            Text(inline(text))
                .font(level <= 2 ? Theme.display(21) : .system(size: 17, weight: .semibold))
                .padding(.top, 4)
        case .paragraph(let text):
            Text(inline(text))
        case .bullet(let text, let depth):
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("•").foregroundStyle(Theme.muted)
                Text(inline(text))
            }
            .padding(.leading, CGFloat(depth) * 16)
        case .numbered(let number, let text):
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(number).").monospacedDigit().foregroundStyle(Theme.muted)
                Text(inline(text))
            }
        case .quote(let text):
            Text(inline(text))
                .foregroundStyle(Theme.inkSoft)
                .padding(.leading, 12)
                .overlay(alignment: .leading) { Rectangle().fill(Theme.highlight).frame(width: 3) }
        case .code(let code):
            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.system(size: 13, design: .monospaced))
                    .padding(12)
            }
            .background(Theme.sunken, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        case .table(let rows):
            ScrollView(.horizontal, showsIndicators: false) {
                Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 8) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                        GridRow {
                            ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                                Text(inline(cell))
                                    .font(.system(size: 14, weight: index == 0 ? .semibold : .regular))
                            }
                        }
                        if index == 0 { Divider() }
                    }
                }
                .padding(12)
            }
            .background(Theme.paperRaised, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        case .rule:
            Divider()
        }
    }
}
