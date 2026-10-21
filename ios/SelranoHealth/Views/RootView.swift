import SwiftUI

/// Pair first, then grant Health access, then the status screen.
struct RootView: View {
    @State private var engine = SyncEngine.shared
    @State private var askedForHealth = Stored.askedForHealthAccess

    var body: some View {
        NavigationStack {
            Group {
                if !engine.isPaired {
                    PairView(engine: engine)
                } else if !askedForHealth {
                    PermissionsView {
                        askedForHealth = true
                    }
                } else {
                    StatusView(engine: engine)
                }
            }
            .navigationTitle("Selrano Health")
        }
        .tint(Palette.ink)
    }
}

enum Palette {
    static let ink = Color(red: 0.08, green: 0.09, blue: 0.12)
    static let muted = Color(red: 0.41, green: 0.44, blue: 0.49)
    static let cream = Color(red: 0.97, green: 0.96, blue: 0.94)
}
