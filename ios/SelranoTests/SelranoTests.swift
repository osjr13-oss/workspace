import Testing
@testable import Selrano

struct ChatStreamTests {
    @Test func parsesEveryEventTheServerSends() {
        #expect(ChatStreamEvent.parse(#"{"type":"start","threadId":"t1","questionId":"q1","startedAt":"2026-11-21T00:00:00Z"}"#) == .start(threadId: "t1", questionId: "q1", startedAt: "2026-11-21T00:00:00Z"))
        #expect(ChatStreamEvent.parse(#"{"type":"status","label":"Searching the web"}"#) == .status("Searching the web"))
        #expect(ChatStreamEvent.parse(#"{"type":"status","label":null}"#) == .status(nil))
        #expect(ChatStreamEvent.parse(#"{"type":"text","text":"Hello"}"#) == .text("Hello"))
        #expect(ChatStreamEvent.parse(#"{"type":"action","kind":"note","label":"Note created"}"#) == .action(kind: "note", label: "Note created"))
        #expect(ChatStreamEvent.parse(#"{"type":"error","error":"Busy","restore":true}"#) == .error("Busy"))
        #expect(ChatStreamEvent.parse(#"{"type":"model","provider":"openai","model":"x"}"#) == .other)
        #expect(ChatStreamEvent.parse("not json") == nil)
        #expect(ChatStreamEvent.parse("") == nil)
    }

    @Test func activePathFollowsActiveLeafWithoutShowingOldVersions() {
        let rows = [
            ChatMessage(id: "u1", parent_id: nil, role: "user", content: "First question", created_at: "2026-11-21T00:00:01Z"),
            ChatMessage(id: "a1", parent_id: "u1", role: "assistant", content: "Old answer", created_at: "2026-11-21T00:00:02Z"),
            ChatMessage(id: "a2", parent_id: "u1", role: "assistant", content: "Better answer", created_at: "2026-11-21T00:00:03Z")
        ]
        let path = ChatTree.activePath(rows, leafId: "a2")
        #expect(path.map(\.id) == ["u1", "a2"])
    }
}

struct MarkdownTests {
    @Test func splitsRepliesIntoBlocks() {
        let blocks = MarkdownBlock.parse("""
        ## Plan
        First line
        continues here.

        - one
          - nested
        1. step

        | A | B |
        |---|---|
        | 1 | 2 |
        ```
        code
        ```
        """)
        #expect(blocks == [
            .heading(level: 2, text: "Plan"),
            .paragraph("First line continues here."),
            .bullet("one", depth: 0),
            .bullet("nested", depth: 1),
            .numbered(1, "step"),
            .table([["A", "B"], ["1", "2"]]),
            .code("code")
        ])
    }
}

struct FormatTests {
    @Test func removesEmDashes() {
        #expect(Format.clean("a\u{2014}b") == "a-b")
    }

    @Test func readsDatabaseTimestamps() {
        #expect(Format.date("2026-11-20T15:04:05.123456+00:00") != nil)
        #expect(Format.date("2026-11-20T15:04:05Z") != nil)
    }
}
