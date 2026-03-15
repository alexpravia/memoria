import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { FlagItem } from "../../types";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface MediaDetail {
  file_url: string;
  description: string | null;
  ai_tags: string[] | null;
}

interface TaggedPerson {
  person_name: string;
  ai_confidence: number;
}

interface FlagWithMedia extends FlagItem {
  media?: MediaDetail;
  taggedPeople?: TaggedPerson[];
}

export default function FlagQueueScreen({ navigation }: Props) {
  const { userId, coUserId } = useAuth();
  const [flags, setFlags] = useState<FlagWithMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlags();
  }, []);

  async function loadFlags() {
    if (!userId) return;

    const { data } = await supabase
      .from("flag_queue")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!data) {
      setLoading(false);
      return;
    }

    // Enrich media flags with photo details and tagged people
    const enriched: FlagWithMedia[] = await Promise.all(
      data.map(async (flag: FlagItem) => {
        if (flag.flag_type !== "media") return flag;

        const enrichedFlag: FlagWithMedia = { ...flag };

        // Fetch media details
        const { data: mediaData } = await supabase
          .from("media")
          .select("file_url, description, ai_tags")
          .eq("id", flag.reference_id)
          .single();

        if (mediaData) {
          enrichedFlag.media = mediaData;
        }

        // Fetch tagged people with names
        const { data: mpData } = await supabase
          .from("media_people")
          .select("ai_confidence, person_id")
          .eq("media_id", flag.reference_id);

        if (mpData && mpData.length > 0) {
          const personIds = mpData.map((mp: any) => mp.person_id);
          const { data: peopleData } = await supabase
            .from("people")
            .select("id, full_name")
            .in("id", personIds);

          enrichedFlag.taggedPeople = mpData.map((mp: any) => {
            const person = peopleData?.find((p: any) => p.id === mp.person_id);
            return {
              person_name: person?.full_name || "Unknown",
              ai_confidence: mp.ai_confidence,
            };
          });
        }

        return enrichedFlag;
      })
    );

    setFlags(enriched);
    setLoading(false);
  }

  async function updateFlag(flag: FlagWithMedia, status: "approved" | "rejected" | "hidden") {
    // Update the flag_queue row
    await supabase
      .from("flag_queue")
      .update({
        status,
        reviewed_by: coUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", flag.id);

    // Cascade to media and media_people for media flags
    if (flag.flag_type === "media") {
      if (status === "approved") {
        await supabase
          .from("media")
          .update({ verification_status: "verified" })
          .eq("id", flag.reference_id);

        await supabase
          .from("media_people")
          .update({ verified: true })
          .eq("media_id", flag.reference_id);
      } else {
        // rejected or hidden
        await supabase
          .from("media")
          .update({ verification_status: "hidden" })
          .eq("id", flag.reference_id);
      }
    }

    loadFlags();
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "media":
        return "📸";
      case "person":
        return "👤";
      case "event":
        return "📅";
      case "journal":
        return "📝";
      case "mood":
        return "💭";
      default:
        return "🚩";
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case "approved":
        return styles.statusApproved;
      case "rejected":
        return styles.statusRejected;
      case "hidden":
        return styles.statusHidden;
      default:
        return styles.statusPending;
    }
  }

  function getConfidenceLabel(confidence: number) {
    if (confidence >= 0.9) return { text: "High", color: "#4caf50" };
    if (confidence >= 0.7) return { text: "Medium", color: "#ffab40" };
    return { text: "Low", color: "#ef5350" };
  }

  function renderMediaDetails(flag: FlagWithMedia) {
    if (flag.flag_type !== "media" || !flag.media) return null;

    return (
      <View style={styles.mediaSection}>
        <Image
          source={{ uri: flag.media.file_url }}
          style={styles.mediaPreview}
          resizeMode="cover"
        />
        {flag.media.description && (
          <View style={styles.aiDetailRow}>
            <Text style={styles.aiDetailLabel}>AI Description</Text>
            <Text style={styles.aiDetailText}>{flag.media.description}</Text>
          </View>
        )}
        {flag.taggedPeople && flag.taggedPeople.length > 0 && (
          <View style={styles.aiDetailRow}>
            <Text style={styles.aiDetailLabel}>Tagged People</Text>
            {flag.taggedPeople.map((tp, idx) => {
              const conf = getConfidenceLabel(tp.ai_confidence);
              return (
                <View key={idx} style={styles.personTag}>
                  <Text style={styles.personName}>{tp.person_name}</Text>
                  <View style={[styles.confidenceBadge, { backgroundColor: conf.color }]}>
                    <Text style={styles.confidenceText}>{conf.text}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  const pendingFlags = flags.filter((f) => f.status === "pending");
  const reviewedFlags = flags.filter((f) => f.status !== "pending");

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Review Queue</Text>
      <Text style={styles.subtitle}>
        Review AI-flagged items before they reach your loved one. Nothing gets through without your approval.
      </Text>

      {/* Pending items */}
      {pendingFlags.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>All caught up! No items to review.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>
            Needs Review ({pendingFlags.length})
          </Text>
          {pendingFlags.map((flag) => (
            <View key={flag.id} style={styles.flagCard}>
              <View style={styles.flagHeader}>
                <Text style={styles.flagIcon}>{getTypeIcon(flag.flag_type)}</Text>
                <View style={styles.flagInfo}>
                  <Text style={styles.flagType}>{flag.flag_type.toUpperCase()}</Text>
                  <Text style={styles.flagDescription}>{flag.description}</Text>
                </View>
              </View>
              {renderMediaDetails(flag)}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => updateFlag(flag, "approved")}
                >
                  <Text style={styles.actionButtonText}>✅ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => updateFlag(flag, "rejected")}
                >
                  <Text style={styles.actionButtonText}>❌ Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.hideButton}
                  onPress={() => updateFlag(flag, "hidden")}
                >
                  <Text style={styles.actionButtonText}>👁️ Hide</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Reviewed items */}
      {reviewedFlags.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 32 }]}>
            Previously Reviewed ({reviewedFlags.length})
          </Text>
          {reviewedFlags.map((flag) => (
            <View key={flag.id} style={[styles.flagCard, styles.flagCardReviewed]}>
              <View style={styles.flagHeader}>
                <Text style={styles.flagIcon}>{getTypeIcon(flag.flag_type)}</Text>
                <View style={styles.flagInfo}>
                  <Text style={styles.flagDescription}>{flag.description}</Text>
                  <View style={[styles.statusBadge, getStatusStyle(flag.status)]}>
                    <Text style={styles.statusText}>{flag.status}</Text>
                  </View>
                </View>
              </View>
              {flag.flag_type === "media" && flag.media && (
                <Image
                  source={{ uri: flag.media.file_url }}
                  style={styles.mediaPreviewSmall}
                  resizeMode="cover"
                />
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  content: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  backText: {
    color: "#b388ff",
    fontSize: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#999",
    marginBottom: 28,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#e0e0e0",
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    marginVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
    textAlign: "center",
  },
  flagCard: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ffab40",
  },
  flagCardReviewed: {
    opacity: 0.7,
    borderLeftColor: "#666",
  },
  flagHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  flagIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  flagInfo: {
    flex: 1,
  },
  flagType: {
    fontSize: 11,
    color: "#ffab40",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  flagDescription: {
    fontSize: 16,
    color: "#e0e0e0",
    lineHeight: 22,
  },
  mediaSection: {
    marginTop: 12,
  },
  mediaPreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  mediaPreviewSmall: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginTop: 10,
    opacity: 0.8,
  },
  aiDetailRow: {
    marginBottom: 8,
  },
  aiDetailLabel: {
    fontSize: 12,
    color: "#b388ff",
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  aiDetailText: {
    fontSize: 14,
    color: "#e0e0e0",
    lineHeight: 20,
  },
  personTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  personName: {
    fontSize: 14,
    color: "#e0e0e0",
    marginRight: 8,
  },
  confidenceBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 8,
  },
  approveButton: {
    flex: 1,
    backgroundColor: "#1b5e20",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#b71c1c",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  hideButton: {
    flex: 1,
    backgroundColor: "#37474f",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  statusPending: {
    backgroundColor: "#ffab40",
  },
  statusApproved: {
    backgroundColor: "#1b5e20",
  },
  statusRejected: {
    backgroundColor: "#b71c1c",
  },
  statusHidden: {
    backgroundColor: "#37474f",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});