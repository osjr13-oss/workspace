# Selrano 1

An AI thinking partner for exploring ideas and making decisions. Selrano 1 is a versioned AI system powered by Groq openai/gpt-oss-120b.

## Run

Install with npm ci, set GROQ_API_KEY in .env.local, and run npm run prototype. Open http://127.0.0.1:3210. Public branch previews run on Vercel with GROQ_API_KEY set in Preview environment variables.

Chat streams responses and saves conversations in this browser. Account sync is not implemented. Provider credentials stay on the server.

See [handoff](docs/HANDOFF.md), [implementation](docs/PROTOTYPE.md), and [contributor instructions](AGENTS.md). Current development is on codex/selrano-1-prototype; main is unchanged.
