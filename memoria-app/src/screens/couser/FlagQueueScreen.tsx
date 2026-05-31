import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { FlagItem } from "../../types";
import Icon, { IconName } from "../../components/Icon";
import { colors } from "../../theme";
import { usePhotoLightbox, useTapToOpen } from "../../components/usePhotoLightbox";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { open, lightbox } = usePhotoLightbox();

  useEffect(() => {
    loadFlags();
  }, []);

  async function loadFlags() {
    if (!userId) return;

    setErrorMessage(null);

    const { data, error } = await supabase
      .from("flag_queue")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message || "Failed to load review queue.");
      setLoading(false);
      return;
    }

    if (!data) {
      setLoading(false);
      return;
    }

    // Filter out flags whose referenced media has been hidden so they
    // never resurface in the review queue.
    const mediaFlags = data.filter((f: FlagItem) => f.flag_type === "media");
    const hiddenMediaIds = new Set<string>();
    if (mediaFlags.length > 0) {
      const ids = mediaFlags.map((f: FlagItem) => f.reference_id);
      const { data: mediaRows } = await supabase
        .from("media")
        .select("id, verification_status")
        .in("id", ids)
        .eq("verification_status", "hidden");
      (mediaRows || []).forEach((m: any) => hiddenMediaIds.add(m.id));
    }

    const visible = data.filter(
      (f: FlagItem) =>
        f.flag_type !== "media" || !hiddenMediaIds.has(f.reference_id)
    );

    // Enrich media flags with photo details and tagged people
    const enriched: FlagWithMedia[] = await Promise.all(
      visible.map(async (flag: FlagItem) => {
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
    const { error: flagError } = await supabase
      .from("flag_queue")
      .update({
        status,
        reviewed_by: coUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", flag.id);

    if (flagError) {
      Alert.alert("Error", flagError.message || "Failed to update review item.");
      return;
    }

    // Cascade to media and media_people for media flags
    if (flag.flag_type === "media") {
      if (status === "approved") {
        const { error: mediaError } = await supabase
          .from("media")
          .update({ verification_status: "verified" })
          .eq("id", flag.reference_id);

        if (mediaError) {
          Alert.alert("Error", mediaError.message || "Failed to verify media.");
          return;
        }

        const { error: mediaPeopleError } = await supabase
          .from("media_people")
          .update({ verified: true })
          .eq("media_id", flag.reference_id);

        if (mediaPeopleError) {
          Alert.alert("Error", mediaPeopleError.message || "Failed to verify tagged people.");
          return;
        }
      } else {
        // rejected or hidden
        const { error: mediaError } = await supabase
          .from("media")
          .update({ verification_status: "hidden" })
          .eq("id", flag.reference_id);

        if (mediaError) {
          Alert.alert("Error", mediaError.message || "Failed to hide media.");
          return;
        }
      }
    }

    loadFlags();
  }

  function getTypeIconName(flagType: string): IconName {
    switch (flagType) {
      case "media":   return "photos";
      case "person":  return "addPerson";
      case "event":   return "calendar";
      case "journal": return "notes";
      case "mood":    return "memo";
      default:        return "review";
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

    const peopleNames = flag.taggedPeople?.map((tp) => tp.person_name);
    return (
      <View style={styles.mediaSection}>
        <FlagMediaThumb
          uri={flag.media.file_url}
          style={styles.mediaPreview}
          mediaId={flag.reference_id}
          onBroken={loadFlags}
          onPress={() =>
            open({
              photoUrl: flag.media!.file_url,
              description: flag.media!.description,
              tags: flag.media!.ai_tags ?? undefined,
              peopleNames,
            })
          }
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

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadFlags}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Pending items */}
      {pendingFlags.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Icon name="check" size={48} color={colors.success} />
          </View>
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
                <Icon name={getTypeIconName(flag.flag_type)} size={20} color={colors.primarySoft} />
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
                  <Icon name="check" size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => updateFlag(flag, "rejected")}
                >
                  <Icon name="close" size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.hideButton}
                  onPress={() => updateFlag(flag, "hidden")}
                >
                  <Icon name="hide" size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Hide</Text>
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
                <Icon name={getTypeIconName(flag.flag_type)} size={20} color={colors.primarySoft} />
                <View style={styles.flagInfo}>
                  <Text style={styles.flagDescription}>{flag.description}</Text>
                  <View style={[styles.statusBadge, getStatusStyle(flag.status)]}>
                    <Text style={styles.statusText}>{flag.status}</Text>
                  </View>
                </View>
              </View>
              {flag.flag_type === "media" && flag.media && (
                <FlagMediaThumb
                  uri={flag.media.file_url}
                  style={styles.mediaPreviewSmall}
                  mediaId={flag.reference_id}
                  onBroken={loadFlags}
                  onPress={() =>
                    open({
                      photoUrl: flag.media!.file_url,
                      description: flag.media!.description,
                      tags: flag.media!.ai_tags ?? undefined,
                      peopleNames: flag.taggedPeople?.map((tp) => tp.person_name),
                    })
                  }
                />
              )}
            </View>
          ))}
        </>
      )}
      {lightbox}
    </ScrollView>
  );
}

function FlagMediaThumb({
  uri,
  style,
  onPress,
  mediaId,
  onBroken,
}: {
  uri: string;
  style: any;
  onPress: () => void;
  mediaId: string;
  onBroken: () => void;
}) {
  const handlePress = useTapToOpen(onPress);
  const [broken, setBroken] = useState(false);

  if (broken) return null;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <Image
        source={{ uri }}
        style={style}
        resizeMode="cover"
        onError={() => {
          // Hide this thumbnail from the current render only — do NOT
          // permanently mark the DB row hidden. Image loads can fail
          // for transient reasons (network blip, simulator hiccup);
          // permanent hides would nuke perfectly good photos. Real
          // `file://` rows are caught by the `processPhoto` guard and
          // the `repair-broken-photos` script.
          setBroken(true);
        }}
      />
    </TouchableOpacity>
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
  errorBox: {
    backgroundColor: "#3b1f2a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ff6b6b",
  },
  errorText: {
    color: "#ffd6d6",
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#ff6b6b",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  emptyIcon: {
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#b71c1c",
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  hideButton: {
    flex: 1,
    backgroundColor: "#37474f",
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
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
