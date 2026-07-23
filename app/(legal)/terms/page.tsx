import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read Selrano's Terms of Service.",
};

export default function TermsPage() {
  return (
    <article className="prose-Selrano">
      <p className="text-sm font-bold text-[var(--muted)]">Last updated: June 1, 2026</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">Terms of Service</h1>
      <p className="mt-4 text-base text-[var(--muted-strong)]">
        Please read these Terms of Service (&quot;Terms&quot;) carefully before using Selrano (&quot;Service&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
      </p>

      <Section title="1. Eligibility">
        <p>You must be at least 18 years old to use Selrano. By using the Service, you represent and warrant that you meet this requirement. We do not knowingly provide services to anyone under 18. If we learn that a user is under 18, we will terminate their account immediately.</p>
      </Section>

      <Section title="2. Account Registration">
        <p>To access Selrano you must register for an account with a valid email address and password. You are responsible for:</p>
        <ul>
          <li>Maintaining the confidentiality of your login credentials.</li>
          <li>All activity that occurs under your account.</li>
          <li>Notifying us immediately at <strong>{brand.emails.hello}</strong> if you suspect unauthorized access.</li>
        </ul>
        <p>You may not share your account, create accounts for others without their consent, or use automated methods to create accounts.</p>
      </Section>

      <Section title="3. Description of Service">
        <p>Selrano is an AI-powered academic workspace that allows users to create projects, write and organize notes, upload files, generate flashcards, and interact with an AI assistant. Features include but are not limited to:</p>
        <ul>
          <li>AI-assisted chat powered by third-party large language model providers.</li>
          <li>Document upload, text extraction, and storage.</li>
          <li>Flashcard generation and spaced-repetition study tools.</li>
          <li>Markdown note editing with AI transformations.</li>
        </ul>
        <p>We reserve the right to modify, suspend, or discontinue any part of the Service at any time with or without notice.</p>
      </Section>

      <Section title="4. Acceptable Use">
        <p>You agree to use Selrano only for lawful purposes. You must not:</p>
        <ul>
          <li>Upload, transmit, or store content that is unlawful, harmful, threatening, abusive, defamatory, obscene, or otherwise objectionable.</li>
          <li>Infringe any intellectual property, privacy, or proprietary right of any third party.</li>
          <li>Use the Service to generate, distribute, or facilitate spam, malware, or phishing content.</li>
          <li>Attempt to probe, scan, or test the vulnerability of the Service or its underlying systems.</li>
          <li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
          <li>Use automated bots, scrapers, or scripts to access the Service without our express written permission.</li>
          <li>Circumvent or attempt to circumvent any authentication or security mechanism.</li>
          <li>Use the AI features to generate academic work intended to deceive educational institutions in violation of their academic integrity policies — we are a study aid, not a cheating tool.</li>
        </ul>
        <p>Violation of this section may result in immediate termination of your account.</p>
      </Section>

      <Section title="5. User Content">
        <p><strong>Ownership.</strong> You retain all ownership rights to the content you create, upload, or store within Selrano (&quot;User Content&quot;), including notes, files, flashcards, and chat messages.</p>
        <p><strong>License to us.</strong> By using the Service, you grant Selrano a limited, non-exclusive, royalty-free license to access, store, process, and transmit your User Content solely as necessary to provide and improve the Service. We do not claim ownership of your content and do not sell it to third parties.</p>
        <p><strong>AI processing.</strong> When you use AI features, your User Content (or relevant portions of it) is transmitted to third-party AI providers (currently Groq, Inc.) for processing. By using AI features, you acknowledge and consent to this transmission. Please do not include sensitive personal information, financial data, passwords, or any information you are obligated to keep confidential in content submitted to AI features.</p>
        <p><strong>Your responsibility.</strong> You are solely responsible for the legality, accuracy, and appropriateness of your User Content. We have no obligation to monitor content but reserve the right to remove any content that violates these Terms.</p>
      </Section>

      <Section title="6. AI-Generated Content Disclaimer">
        <p>Selrano&apos;s AI features are powered by third-party large language models. AI-generated responses are provided for informational and educational purposes only. You acknowledge that:</p>
        <ul>
          <li>AI outputs may be inaccurate, incomplete, outdated, or misleading.</li>
          <li>AI outputs do not constitute professional legal, medical, financial, or academic advice.</li>
          <li>You are solely responsible for verifying and evaluating any AI-generated content before relying on it.</li>
          <li>We make no warranties regarding the accuracy or reliability of AI-generated content.</li>
        </ul>
      </Section>

      <Section title="7. Third-Party Services">
        <p>The Service integrates with and depends on third-party services including:</p>
        <ul>
          <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
          <li><strong>Groq, Inc.</strong> — AI inference for chat and content generation.</li>
          <li><strong>Vercel</strong> — hosting and infrastructure.</li>
        </ul>
        <p>Your use of the Service is also subject to the terms and privacy policies of these third-party providers. We are not responsible for the practices of any third-party service.</p>
      </Section>

      <Section title="8. Intellectual Property">
        <p>All rights in the Selrano platform — including the software, design, branding, logo, and documentation — are owned by or licensed to Selrano. Nothing in these Terms grants you any right to use our trademarks, trade names, or logos without our prior written consent.</p>
      </Section>

      <Section title="9. Privacy">
        <p>Your use of the Service is governed by our <a href="/privacy" className="underline font-bold">Privacy Policy</a>, which is incorporated into these Terms by reference. By using the Service, you consent to the data practices described in the Privacy Policy.</p>
      </Section>

      <Section title="10. Fees and Payment">
        <p>Selrano is currently provided free of charge. We reserve the right to introduce paid plans or features in the future. We will provide advance notice of any pricing changes. If you do not accept new pricing terms, you may terminate your account prior to the effective date.</p>
      </Section>

      <Section title="11. Disclaimers">
        <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR HARMFUL COMPONENTS. YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK.</p>
      </Section>

      <Section title="12. Limitation of Liability">
        <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, Selrano AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES — ARISING FROM OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
        <p>OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO US IN THE TWELVE MONTHS PRIOR TO THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS ($100).</p>
      </Section>

      <Section title="13. Indemnification">
        <p>You agree to defend, indemnify, and hold harmless Selrano and its affiliates from and against any claims, liabilities, damages, losses, and expenses — including reasonable legal fees — arising out of or in any way connected with your access to or use of the Service, your User Content, or your violation of these Terms.</p>
      </Section>

      <Section title="14. Termination">
        <p><strong>By you.</strong> You may delete your account at any time from the Settings page. Upon deletion, your personal data will be removed from our systems in accordance with our Privacy Policy.</p>
        <p><strong>By us.</strong> We may suspend or terminate your account at any time for any reason, including violation of these Terms, with or without notice. Upon termination, your right to use the Service ceases immediately.</p>
      </Section>

      <Section title="15. Changes to These Terms">
        <p>We may update these Terms from time to time. When we do, we will update the &quot;Last updated&quot; date at the top of this page. For material changes, we will provide notice via email or a prominent notice within the Service. Your continued use of the Service after changes become effective constitutes acceptance of the revised Terms.</p>
      </Section>

      <Section title="16. Governing Law and Disputes">
        <p>These Terms are governed by and construed in accordance with the laws of the United States and the state in which Selrano operates, without regard to conflict of law principles. Any dispute arising from these Terms or your use of the Service shall first be attempted to be resolved through good-faith negotiation. If unresolved, disputes shall be submitted to binding arbitration in accordance with the rules of the American Arbitration Association, except that either party may seek injunctive or equitable relief in a court of competent jurisdiction.</p>
      </Section>

      <Section title="17. Contact">
        <p>If you have questions about these Terms, please contact us at:</p>
        <p><strong>Email:</strong> {brand.emails.hello}</p>
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
