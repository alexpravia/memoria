// Phase B — agentic assistant client.
//
// All intelligence (context selection, tool calling, sensitivity gating)
// lives server-side in the `ask-assistant` Edge Function. This module is
// just a thin invoke + threading helper. The previous keyword-filter
// `getUserContext` and `[PHOTO:url]` regex have been removed; tool
// results returned by the Edge Function are the canonical source of
// photos.

import { supabase } from "./supabase";

export interface AssistantResponse {
  answer: string;
  conversationId: string;
  photos?: string[];
  error?: string;
}

export async function askAssistant(
  userId: string,
  question: string,
  conversationId?: string
): Promise<AssistantResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("ask-assistant", {
      body: { userId, question, conversationId },
    });

    if (error) {
      return {
        answer: "",
        conversationId: conversationId ?? "",
        error: error.message,
      };
    }
    if (!data) {
      return {
        answer: "",
        conversationId: conversationId ?? "",
        error: "No data returned",
      };
    }

    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return {
      answer: parsed.answer || "I'm not sure how to answer that.",
      conversationId: parsed.conversationId ?? conversationId ?? "",
      ...(Array.isArray(parsed.photos) && parsed.photos.length > 0
        ? { photos: parsed.photos as string[] }
        : {}),
    };
  } catch (err: any) {
    return {
      answer: "",
      conversationId: conversationId ?? "",
      error: err?.message ?? "Something went wrong.",
    };
  }
}
