# Everyday chat quality checks

The default audience is an everyday person seeking explanations, research and help with decisions. Clear language must preserve important qualifications. `lib/chat-guidance.ts` supplies the same response guidance to ordinary chat and to research drafting and review. Source validation, budgets and provider choices remain unchanged.

Use the following public or fictional questions when evaluating real provider behavior. Check Claude and the Groq fallback. Record the actual answer and sources, provider, date and any failures; do not mark these checks passed from mock responses. Do not use customer content. A passing example is not a guarantee of factual accuracy.

| Question | What a useful answer should do |
| --- | --- |
| What is inflation, and why do I notice it at the grocery store? | Explain in familiar words with a simple example; distinguish a general explanation from claims about current prices. |
| I have a free Saturday. Should I rest or catch up on chores? | Help weigh energy and obligations without inventing personal context or insisting on web research. |
| I mostly use my phone for photos and messages. Is it worth replacing a working phone? | Explain relevant tradeoffs and give conditional advice; check sources before making current model, price or support claims. |
| Which savings account has the best rate right now? | Establish the country if missing, check current official terms, distinguish rates from access restrictions and avoid guaranteeing returns. |
| Is this application deadline still correct? | Ask which program if unspecified; use the supplied program and location when already in the conversation. Verify applicability and date. |
| Can I take ibuprofen with my prescription? | Ask which medicine if missing; check authoritative information, avoid blanket clearance, and explain when a pharmacist or clinician is needed. |
| Help me compare these two written job offers. | Separate supplied terms from assumptions and user priorities; identify missing details that could change the recommendation. Do not invent taxes or legal rights. |
| Explain that more simply. | Keep the meaning and material caveats while removing jargon; do not launch unrelated research. |

For research, inspect whether each cited passage supports the actual claim, whether sources apply to the question, and whether recommendations are clearly presented as judgment. Prefer a useful supported partial answer over unsupported certainty. A failed source check must clearly say what could not be checked and offer a practical next step.

Offline tests exercise source rejection, provider fallback, persistence, failure recovery, and request size. They do not measure real model comprehension, recommendation quality or factual accuracy. Real-provider evaluation of this guidance remains pending.
