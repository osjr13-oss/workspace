import SwiftUI

struct SignInView: View {
    @Environment(Session.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var field: Field?

    enum Field { case email, password }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Image("Mark")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 52, height: 52)
                    .padding(.top, 56)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Welcome back.")
                        .font(Theme.display(40))
                        .foregroundStyle(Theme.ink)
                    Text("Your notes, files, calendar and money, with an assistant that remembers.")
                        .font(.system(size: 16))
                        .foregroundStyle(Theme.inkSoft)
                }

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($field, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { field = .password }
                        .modifier(FieldStyle())
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .focused($field, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { Task { await signIn() } }
                        .modifier(FieldStyle())
                }

                if let error {
                    Text(error)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.critical)
                        .transition(.opacity)
                }

                Button {
                    Task { await signIn() }
                } label: {
                    if busy { ProgressView().tint(.white) } else { Text("Sign in") }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy || email.isEmpty || password.isEmpty)
                .opacity(email.isEmpty || password.isEmpty ? 0.6 : 1)

                Text("Selrano is private. Only accounts on its list can sign in. Forgot your password? Reset it on selrano.com.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.paper.ignoresSafeArea())
    }

    private func signIn() async {
        guard !email.isEmpty, !password.isEmpty, !busy else { return }
        busy = true
        defer { busy = false }
        do {
            try await session.signIn(email: email, password: password)
        } catch {
            withAnimation { self.error = error.localizedDescription }
        }
    }
}

struct FieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 16))
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.borderStrong, lineWidth: 1))
    }
}
