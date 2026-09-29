# Selrano & Lumen: Executive Company Roadmap and Technical Timeline

Last updated: September 8, 2026  
Status: Active Strategic Roadmap

---

## 1. Executive Summary

Selrano is a calm, focused materials workspace designed for deep problem-solving, synthesis, and decision-making. **Lumen** is the thinking partner that lives inside Selrano. 

To scale Selrano from an early web platform into an indispensable daily workspace, our technical and product execution is divided into four interdependent pillars:

1. **Model Evolution (Lumen 1 to Lumen 2 to Lumen 3)**: Progressing from orchestrated frontier foundations to specialized fine-tuned weights and proprietary reasoning models.
2. **Client Platforms (Web, Mobile, Desktop)**: Expanding from web into an installable PWA, an iOS/Android native app, and a lightweight desktop companion.
3. **Audio & Proprietary Voice**: Introducing low-latency, natural conversational audio so users can talk through problems on the go.
4. **Knowledge Architecture**: Upgrading from single-project documents into an interconnected, living materials graph.

---

## 2. Model Evolution: From Lumen 1 to Lumen 2

### Current Baseline: Lumen 1 (Shipped)
- **Architecture**: Orchestrated frontier foundation (Claude 3.5 Sonnet / Claude 3.7 with Groq Llama 3.3 70B fallback) wrapped in Selrano's proprietary system framing, anti-slop guidelines, persistent style profile, and content memory.
- **Capabilities**: Project-grounded chat, direct document context injection, web search tool, note creation, and flashcard deck creation.
- **Limitation**: Dependent on general-purpose public model APIs; prompt tokens consume bandwidth to enforce structure and tone.

### The Next Frontier: Lumen 2
- **Objective**: Develop a specialized, domain-tailored model optimized specifically for problem framing, trade-off evaluation, and structured synthesis without prompt bloat.
- **Approach**:
  1. *Curated Distillation & Preference Data*: Capture high-quality trajectories of hard decisions, document breakdowns, and structured revisions.
  2. *Custom Fine-Tuning (SFT + DPO/RLHF)*: Train open weights (e.g. Llama 3 70B / Mistral Large base) on Selrano's decision frameworks, markdown formatting, and zero-slop tone.
  3. *Latency Reduction*: Sub-500ms time-to-first-token, running on dedicated inference endpoints.
- **When to Start**:
  - **Data Collection Pipeline Kickoff**: November 2026
  - **Training & Evaluation**: January to February 2027
  - **Target Launch**: Late Q1 / Early Q2 2027 (March to April 2027)

### Future Horizon: Lumen 3 (Late 2027)
- **Objective**: Fully autonomous workspace synthesis, proactive multi-document cross-referencing, and multimodal reasoning (reading handwritten charts, architectural sketches, and equations natively).

---

## 3. The App Roadmap: Mobile and Desktop

A thinking companion must be accessible at the point of thought: during commutes, meetings, walks, or desk work.

### Phase 1: Progressive Web App (PWA)
- **Timeline**: September 2026 (Immediate)
- **Scope**:
  - Full-screen home screen installation for iOS and Android.
  - Offline asset caching and responsive touch layouts.
  - Instant mobile experience with zero App Store review lag.

### Phase 2: Native Mobile App (iOS & Android)
- **Timeline**: October 2026 to January 2027
  - **Development Kickoff**: October 1, 2026
  - **Internal Dogfooding**: November 15, 2026
  - **Public TestFlight Beta**: December 1, 2026
  - **App Store & Google Play Launch**: January 15, 2027
- **Tech Stack**: React Native / Expo.
  - Reuses Supabase authentication, database schema, and existing Next.js backend API contracts.
- **Key Mobile Features**:
  - *Camera Quick Capture*: Snap photos of textbook pages, physical notes, or whiteboard diagrams and extract text directly into project materials.
  - *Native Share Sheet*: Share articles, PDFs, and web pages from Safari or Chrome straight into Selrano.
  - *Haptic Feedback & Fluid Gestures*: Smooth swiping through thoughts, materials, and decks.

### Phase 3: Desktop Companion (macOS & Windows)
- **Timeline**: February to March 2027
- **Scope**:
  - Lightweight menu bar utility with global keyboard shortcut (`Cmd + Shift + L`).
  - Instant scratchpad to capture thoughts or query Lumen without breaking deep work context.

---

## 4. Proprietary Voice & Ambient Thinking

With generic browser speech synthesis removed, we will implement a dedicated audio pipeline.

- **Timeline**: December 2026 to February 2027
  - **Voice Pipeline Prototype**: December 2026
  - **Conversational Voice Beta (Mobile)**: February 2027
- **Technical Architecture**:
  - Streaming Speech-to-Text (STT) with sub-300ms latency.
  - Expressive, natural, unhurried voice synthesis (custom TTS pipeline).
  - Bidirectional audio session allowing natural interruptions during brainstorming.
- **Use Cases**:
  - "Walk-and-talk" brainstorming sessions where Lumen records, transcribes, and extracts key action items automatically into notes.

---

## 5. Master Company Timeline (2026 to 2027)

| Period | Milestone | Core Deliverables |
| :--- | :--- | :--- |
| **Q3 2026**<br>*(Sep 2026)* | **Web Stabilization & Launch Hardening** | - Lumen 1 model identity standardized<br>- Direct file uploads in chat with citations<br>- Structured response formatting & no AI slop<br>- PWA configuration for instant mobile install |
| **Q4 2026**<br>*(Oct - Dec 2026)* | **Mobile App & Data Pipeline** | - React Native / Expo codebase initialized<br>- Camera capture and share extension integration<br>- Closed TestFlight beta for early adopters<br>- Lumen 2 synthetic dataset curation begins<br>- Low-latency voice prototype |
| **Q1 2027**<br>*(Jan - Mar 2027)* | **App Store Launch & Lumen 2 Training** | - Official iOS and Android App Store launch<br>- Fine-tuning and alignment of Lumen 2 weights<br>- Desktop menu bar companion beta<br>- Conversational voice beta in mobile app |
| **Q2 2027**<br>*(Apr - Jun 2027)* | **Lumen 2 Rollout & Team Workspaces** | - Production migration to Lumen 2 inference<br>- Shared project materials and team collaboration<br>- Enterprise data privacy controls |
| **Q3 - Q4 2027** | **Lumen 3 & Living Materials Graph** | - Proactive cross-document knowledge mapping<br>- Native multimodal reasoning |

---

## 6. Technical Execution Standards

To maintain speed and product quality across all phases:

1. **One Unified Backend**: Web, mobile, and desktop clients all consume the same Supabase database, storage, and API routes.
2. **Zero Feature Bloat**: Every new feature must serve the core mission: turning messy thoughts and private materials into clear decisions.
3. **No AI Slop**: Clean typography, human editorial aesthetics, zero generic emojis, and zero em/en dashes across all platforms.
