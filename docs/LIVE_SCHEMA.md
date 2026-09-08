# Selrano 1 storage

Current chat history is stored in the browser under selrano.prototype.conversations.v1. No database is called by the active chat handler. Account storage and cross-device sync are not yet implemented. Existing database migrations must not be replayed or customer data changed without a separately scoped request; historical schema records remain in git history.
