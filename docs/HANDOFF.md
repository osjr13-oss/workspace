# Selrano 1 handoff

Selrano is a public AI thinking partner that helps users explore ideas and choose a direction, including when they start with "I don't know." This is the sole current product direction.

## Branch and release

Active checkout: /Users/osmanosman/workspace-prototype. Branch: codex/selrano-1-prototype. Public Vercel branch previews are explicitly authorized. Keep main and its deployment unchanged until requested. Provider keys remain server-side.

Release selrano-1.0.1 uses Groq openai/gpt-oss-120b. Version system instructions, model configuration, settings, and release notes together. Attribute responses to their release. Future fine-tuning is an ambition, not a shipped capability.

## User feedback

The user likes the speed, intelligence, and tone. They strongly dislike the current design; it is not approved. A new visual direction has not been selected. Preserve conversational strengths while improving the interface in the next design iteration.

## Current implementation

Read [PROTOTYPE.md](PROTOTYPE.md) for setup and behavior. Chat supports streaming, stop, retry, new chat, deletion, local history, release attribution, and a Where we are recap. Only the active conversation reaches Groq. Chats are saved in the browser; account storage and cross-device sync are not implemented, not permanently ruled out.

Twenty fictional A/B comparisons exist with an unscored preference target of 15/20. Positive user feedback is not a completed benchmark. Extended real-use evaluation remains open.

All earlier positioning and runbooks are superseded. Historical records remain in git history. Inactive legacy modules must not guide new feature work. Do not migrate or delete existing customer data.
