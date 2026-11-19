import app from "./.open-next/worker.js";

const jobs = {
  "0 13 * * *": "/api/cron/grounded-history",
  "0 14 * * *": "/api/cron/lifecycle-emails",
  "0 12 * * *": "/api/cron/plaid-sync"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === "selrano.com") {
      url.hostname = "www.selrano.com";
      return Response.redirect(url.toString(), 308);
    }
    const response = await app.fetch(request, env, ctx);
    // Selrano is private: every response asks search engines not to index it.
    const unlisted = new Response(response.body, response);
    unlisted.headers.set("X-Robots-Tag", "noindex, nofollow");
    return unlisted;
  },
  async scheduled(event, env) {
    const path = jobs[event.cron];
    if (!path || !env.CRON_SECRET) throw new Error("Scheduled job is not configured");
    const response = await env.WORKER_SELF_REFERENCE.fetch(new URL(path, "https://www.selrano.com"), {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` }
    });
    if (!response.ok) throw new Error(`Scheduled job failed with HTTP ${response.status}`);
  }
};
