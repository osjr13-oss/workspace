import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read Selrano's Privacy Policy.",
};

export default function PrivacyPage() {
  return (
    <article className="prose-selrano">
      <p className="text-sm font-bold text-[var(--muted)]">Last updated: October 8, 2026</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">Privacy Policy</h1>
      <p className="mt-4 text-base text-[var(--muted-strong)]">
        This Privacy Policy explains how Selrano (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, stores, and shares information about you when you use our Service. We take your privacy seriously. We will never sell your personal data.
      </p>

      <Section title="1. Information We Collect">
        <h3 className="font-extrabold text-[var(--text)]">a. Information you provide directly</h3>
        <ul>
          <li><strong>Account information:</strong> your email address and password (stored securely via Supabase Auth with hashed passwords).</li>
          <li><strong>Profile information:</strong> your full name, if you choose to provide it.</li>
          <li><strong>User content:</strong> notes, uploaded files (PDFs, DOCX, TXT), flashcards, flashcard decks, project names and descriptions, and chat messages you create within the Service.</li>
        </ul>

        <h3 className="mt-4 font-extrabold text-[var(--text)]">b. Information collected automatically</h3>
        <ul>
          <li><strong>Usage data:</strong> basic interaction logs such as which features you use, collected to improve the Service.</li>
          <li><strong>Technical data:</strong> IP address, browser type, and device information transmitted as part of standard web requests and handled by our infrastructure provider (Vercel).</li>
        </ul>

        <h3 className="mt-4 font-extrabold text-[var(--text)]">c. Information we do NOT collect</h3>
        <ul>
          <li>We do not collect payment information (no paid features currently exist).</li>
          <li>We do not use tracking cookies or third-party advertising trackers.</li>
          <li>We do not build advertising profiles or sell data to data brokers.</li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, operate, and maintain the Service.</li>
          <li>Authenticate your identity and secure your account.</li>
          <li>Process and display your User Content within your workspace.</li>
          <li>Send transactional emails such as password reset requests.</li>
          <li>Improve and develop new features of the Service.</li>
          <li>Respond to your support requests and communications.</li>
          <li>Detect and prevent fraud, abuse, and security incidents.</li>
          <li>Comply with legal obligations.</li>
        </ul>
        <p>We do not use your content to train AI models. Your notes, files, and chats are not used for any purpose other than delivering the Service to you.</p>
      </Section>

      <Section title="3. AI Processing and Third-Party AI Providers">
        <p>When you use AI features (chat, flashcard generation, text transformations), relevant portions of your User Content may be transmitted to <strong>Groq, Inc.</strong> for AI inference. When web search is needed, your query may be sent to <strong>Tavily</strong>. This processing is necessary to generate responses and retrieve current sources.</p>
        <ul>
          <li>Data sent to Groq is governed by <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline">Groq&apos;s Privacy Policy</a>.</li>
          <li>Data sent to Tavily is governed by <a href="https://www.tavily.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">Tavily&apos;s Privacy Policy</a>.</li>
          <li>We transmit only the content necessary for the specific AI request (e.g., relevant notes or file excerpts for context).</li>
          <li>We recommend you do not submit sensitive personal information, passwords, financial data, or confidential third-party data through AI features.</li>
        </ul>
      </Section>

      <Section title="4. How We Share Your Information">
        <p>We do not sell, rent, or trade your personal information. We share your information only in the following limited circumstances:</p>
        <ul>
          <li><strong>Infrastructure providers:</strong> Supabase (database, authentication, file storage), Vercel (hosting), Anthropic and Groq (AI inference), and Tavily (optional web search) receive data as necessary to operate the Service. Each is bound by their own privacy and data processing terms.</li>
          <li><strong>Legal compliance:</strong> We may disclose your information if required by law, subpoena, court order, or other governmental request, or if we believe in good faith that disclosure is necessary to protect our rights, your safety, or the safety of others.</li>
          <li><strong>Business transfers:</strong> If Selrano is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you via email and/or a prominent notice on the Service before your data is transferred and becomes subject to a different privacy policy.</li>
        </ul>
      </Section>

      <Section title="5. Data Storage and Security">
        <p>Your data is stored securely on Supabase&apos;s infrastructure (PostgreSQL database and private object storage). We implement the following safeguards:</p>
        <ul>
          <li><strong>Row-level security (RLS):</strong> database policies ensure each user can only access their own data. Your data is never accessible to other users.</li>
          <li><strong>Encrypted storage:</strong> all data is encrypted at rest and in transit (HTTPS/TLS).</li>
          <li><strong>Private file storage:</strong> uploaded files are stored in a private bucket accessible only to your account.</li>
          <li><strong>Hashed passwords:</strong> passwords are never stored in plain text.</li>
        </ul>
        <p>Despite these measures, no system is 100% secure. We cannot guarantee absolute security of your data. In the event of a data breach that affects your rights and freedoms, we will notify you as required by applicable law.</p>
      </Section>

      <Section title="6. Data Retention">
        <p>We retain your personal data for as long as your account is active or as necessary to provide the Service.</p>
        <ul>
          <li>When you delete your account, we will delete your personal data, User Content, and files from our systems within 30 days, except where we are required to retain it by law.</li>
          <li>Aggregate, anonymized data that cannot identify you may be retained indefinitely for analytical purposes.</li>
          <li>Backups may retain data for up to 90 days following deletion before being purged.</li>
        </ul>
      </Section>

      <Section title="7. Your Rights and Choices">
        <p>Depending on your location, you may have the following rights regarding your personal data:</p>
        <ul>
          <li><strong>Access:</strong> request a copy of the personal data we hold about you.</li>
          <li><strong>Correction:</strong> request correction of inaccurate or incomplete data.</li>
          <li><strong>Deletion:</strong> request deletion of your data. You can delete your account at any time from the Settings page.</li>
          <li><strong>Portability:</strong> request your data in a portable, machine-readable format.</li>
          <li><strong>Objection:</strong> object to certain uses of your data.</li>
        </ul>
        <p>You can exercise most of these rights directly in the app: delete your account and data, and manage email preferences, from the Settings page.</p>
        <p><strong>California residents:</strong> under the California Consumer Privacy Act (CCPA), you have the right to know what personal information we collect, request deletion, and opt out of any sale of personal information (we do not sell personal information). To submit a CCPA request, contact us at the email above.</p>
      </Section>

      <Section title="8. Cookies">
        <p>Selrano uses only essential cookies necessary to operate the Service, specifically session authentication cookies set by Supabase to keep you logged in. We do not use advertising cookies, tracking pixels, or analytics cookies from third parties.</p>
        <p>You can disable cookies in your browser settings, but doing so will prevent you from logging in to the Service.</p>
      </Section>

      <Section title="9. Children&apos;s Privacy">
        <p>Selrano is intended for users who are 18 years of age or older. We do not knowingly collect personal information from anyone under 18. If you are a parent or guardian and believe your child has provided us with personal information, please delete the account from Settings and we will remove that information.</p>
      </Section>

      <Section title="10. Links to Third-Party Sites">
        <p>The Service may contain links to external websites. We are not responsible for the privacy practices of those sites. We encourage you to review the privacy policies of any third-party sites you visit.</p>
      </Section>

      <Section title="11. Changes to This Privacy Policy">
        <p>We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will update the &quot;Last updated&quot; date at the top of this page. For material changes, we will notify you by email or by posting a prominent notice within the Service before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the revised policy.</p>
      </Section>

      <Section title="12. Contact Us">
        <p>Selrano does not currently offer a public email address. For privacy requests, use the account controls in Settings. We will publish a contact channel here as soon as one is available.</p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--muted-strong)]">{children}</div>
    </section>
  );
}
