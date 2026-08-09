import { NextResponse } from "next/server";
import { createDeckWithCards, normalizeCards } from "@/lib/flashcards";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";
import { recordFeedDecision } from "@/lib/worker/feedback";

export const runtime = "nodejs";

/**
 * Decide on one feed item.
 *
 * Approve files it into the workspace for real: a flashcard item becomes a deck,
 * a brief becomes a note. Dismiss discards it. Edit supplies corrected content
 * and then files that instead, so the user's correction is what gets saved.
 *
 * Everything runs through the caller's authenticated client, so row level
 * security guarantees a user can only decide on their own items.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body = (await request.json()) as {
      action?: "approve" | "dismiss";
      payload?: { cards?: unknown; body?: unknown; title?: unknown };
    };

    if (body.action !== "approve" && body.action !== "dismiss") {
      return NextResponse.json({ error: "action must be approve or dismiss" }, { status: 400 });
    }

    const { data: item, error: loadError } = await supabase
      .from("feed_items")
      .select("id, action_type, title, payload, status, source_type, source_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!item) return NextResponse.json({ error: "Feed item not found" }, { status: 404 });
    if (item.status !== "pending") {
      return NextResponse.json({ error: "This item was already decided" }, { status: 409 });
    }

    const projectName = await loadProjectName(supabase, user.id, item.source_type, item.source_id);

    if (body.action === "dismiss") {
      const { error } = await supabase
        .from("feed_items")
        .update({ status: "dismissed", decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Closing the loop: the next run reads this back as context.
      await recordFeedDecision(supabase, user.id, "dismissed", {
        actionType: item.action_type,
        title: item.title,
        sourceType: item.source_type,
        projectName,
        edited: false
      });

      return NextResponse.json({ status: "dismissed" });
    }

    // Approving with a payload means the user edited it first; that edited
    // version is what gets filed.
    const payload = (body.payload ?? item.payload) as { cards?: unknown; body?: unknown; title?: unknown };
    const title = removeEmDashes(String(payload.title ?? item.title).trim()).slice(0, 200) || item.title;

    let filedType: string;
    let filedId: string;

    if (item.action_type === "generate_flashcards") {
      const cards = normalizeCards(Array.isArray(payload.cards) ? payload.cards : []);
      if (!cards.length) {
        return NextResponse.json({ error: "This item has no usable cards to file" }, { status: 400 });
      }

      const result = await createDeckWithCards(supabase, {
        userId: user.id,
        projectId: null,
        name: title,
        cards,
        source:
          item.source_type === "note" || item.source_type === "file"
            ? { sourceType: item.source_type, sourceId: item.source_id as string }
            : undefined
      });

      if ("deckError" in result) {
        return NextResponse.json({ error: `Could not create the deck: ${result.deckError}` }, { status: 400 });
      }
      if ("cardsError" in result) {
        return NextResponse.json({ error: `Created the deck, but adding cards failed: ${result.cardsError}` }, { status: 500 });
      }

      filedType = "flashcard_deck";
      filedId = result.deckId;
    } else {
      const content = removeEmDashes(String(payload.body ?? "").trim());
      if (!content) {
        return NextResponse.json({ error: "This brief has no content to file" }, { status: 400 });
      }

      const { data: note, error: noteError } = await supabase
        .from("notes")
        .insert({ user_id: user.id, project_id: null, title, content })
        .select("id")
        .single();

      if (noteError) throw noteError;
      filedType = "note";
      filedId = note.id;
    }

    // An approval that arrived with its own payload is an edit: the user
    // corrected the generated version before filing it.
    const edited = Boolean(body.payload);

    const { error: updateError } = await supabase
      .from("feed_items")
      .update({
        status: "approved",
        decided_at: new Date().toISOString(),
        filed_type: filedType,
        filed_id: filedId,
        edited,
        // Persist the edited version so the feed shows what was actually filed.
        payload,
        title
      })
      .eq("id", id);

    if (updateError) throw updateError;

    await recordFeedDecision(supabase, user.id, "approved", {
      actionType: item.action_type,
      title,
      sourceType: item.source_type,
      projectName,
      edited
    });

    return NextResponse.json({ status: "approved", filedType, filedId });
  } catch (error) {
    const message = serializeError(error);
    console.error("[feed/decide]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Project a feed item's source belongs to, for a more specific observation. */
async function loadProjectName(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  userId: string,
  sourceType: string | null,
  sourceId: string | null
): Promise<string | null> {
  if (!sourceId || (sourceType !== "note" && sourceType !== "file")) return null;

  const { data: source } = await supabase
    .from(sourceType === "note" ? "notes" : "files")
    .select("project_id")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!source?.project_id) return null;

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", source.project_id)
    .eq("user_id", userId)
    .maybeSingle();

  return project?.name ?? null;
}
