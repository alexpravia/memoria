import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
  AliveEmptyState,
} from "../../motion/primitives";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { FlagItem } from "../../types";
import Icon, { IconName } from "../../components/Icon";
import { colors, radius, type } from "../../theme";
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

// Status-fill palette (new hex allowed per spec).
const STATUS_FILL: Record<string, string> = {
  approved: "#1b5e20",
  rejected: "#b71c1c",
  hidden: "#37474f",
  pending: "#ffab40",
};

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

  function getStatusFill(status: string) {
    return STATUS_FILL[status] || STATUS_FILL.pending;
  }

  function getConfidenceLabel(confidence: number) {
    if (confidence >= 0.9) return { text: "High", color: colors.success };
    if (confidence >= 0.7) return { text: "Medium", color: "#ffab40" };
    return { text: "Low", color: colors.danger };
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
        <BrandLoader caption="Loading review queue…" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AnimatedEntrance index={0}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="back" size={22} color={colors.primarySoft} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Review Queue</Text>
        <Text style={styles.subtitle}>
          {pendingFlags.length} item{pendingFlags.length === 1 ? "" : "s"} Memo learned to review
        </Text>
      </AnimatedEntrance>

      {errorMessage ? (
        <AnimatedEntrance index={1}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <SpringPressable onPress={loadFlags} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </SpringPressable>
          </View>
        </AnimatedEntrance>
      ) : null}

      {/* Pending items */}
      {pendingFlags.length === 0 ? (
        <AnimatedEntrance index={1}>
          <View style={styles.emptyContainer}>
            <AliveEmptyState
              drawCheck
              message="All caught up"
              caption="Nothing to review right now."
              tintColor={colors.success}
            />
          </View>
        </AnimatedEntrance>
      ) : (
        <View style={styles.cardList}>
          {pendingFlags.map((flag, index) => (
            <ReviewCard
              key={flag.id}
              index={index}
              category={flag.flag_type.toUpperCase()}
              iconName={getTypeIconName(flag.flag_type)}
              description={flag.description}
              media={renderMediaDetails(flag)}
              onApprove={() => updateFlag(flag, "approved")}
              onReject={() => updateFlag(flag, "rejected")}
              onHide={() => updateFlag(flag, "hidden")}
            />
          ))}
        </View>
      )}

      {/* Reviewed items */}
      {reviewedFlags.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Previously Reviewed ({reviewedFlags.length})
          </Text>
          {reviewedFlags.map((flag) => (
            <View key={flag.id} style={[styles.reviewedCard]}>
              <View style={styles.reviewedHeader}>
                <Icon name={getTypeIconName(flag.flag_type)} size={20} color={colors.primarySoft} />
                <View style={styles.reviewedInfo}>
                  <Text style={styles.reviewedDescription}>{flag.description}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusFill(flag.status) }]}>
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

// ---------------------------------------------------------------------------
// ReviewCard — surface card with uppercase lavender category label, quoted
// content text, and a 3-button action row. On any action the card animates
// OUT (opacity→0, translateX→40, scale→.96, collapse) before the real handler
// runs and removes the row from state.
// ---------------------------------------------------------------------------
function ReviewCard({
  index,
  category,
  iconName,
  description,
  media,
  onApprove,
  onReject,
  onHide,
}: {
  index: number;
  category: string;
  iconName: IconName;
  description: string;
  media: React.ReactNode;
  onApprove: () => void;
  onReject: () => void;
  onHide: () => void;
}) {
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const collapse = useSharedValue(1);

  const exitStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
  }));

  const wrapperStyle = useAnimatedStyle(() => ({
    marginBottom: 14 * collapse.value,
    transform: [{ scaleY: collapse.value }],
  }));

  function runAction(handler: () => void) {
    // m-leave: opacity 1→0, x 0→40, scale 1→.96, collapse, ~460ms.
    const ease = Easing.bezier(0.4, 0, 1, 0.6);
    opacity.value = withTiming(0, { duration: 460, easing: ease });
    translateX.value = withTiming(40, { duration: 460, easing: ease });
    scale.value = withTiming(0.96, { duration: 460, easing: ease });
    collapse.value = withTiming(0, { duration: 460, easing: ease }, (finished) => {
      if (finished) runOnJS(handler)();
    });
  }

  return (
    <AnimatedEntrance index={index} cardMode>
      <Animated.View style={wrapperStyle}>
        <Animated.View style={[styles.reviewCard, exitStyle]}>
          <View style={styles.reviewHeader}>
            <Icon name={iconName} size={18} color={colors.primarySoft} />
            <Text style={styles.reviewCategory}>{category}</Text>
          </View>
          <Text style={styles.reviewText}>“{description}”</Text>
          {media}
          <View style={styles.actionRow}>
            <SpringPressable
              style={[styles.actionButton, { backgroundColor: STATUS_FILL.approved }]}
              onPress={() => runAction(onApprove)}
            >
              <View style={styles.actionInner}>
                <Icon name="check" size={16} color="#ffffff" accentColor="#ffffff" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </View>
            </SpringPressable>
            <SpringPressable
              style={[styles.actionButton, { backgroundColor: STATUS_FILL.rejected }]}
              onPress={() => runAction(onReject)}
            >
              <View style={styles.actionInner}>
                <Icon name="close" size={16} color="#ffffff" accentColor="#ffffff" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </View>
            </SpringPressable>
            <SpringPressable
              style={[styles.actionButton, { backgroundColor: STATUS_FILL.hidden }]}
              onPress={() => runAction(onHide)}
            >
              <View style={styles.actionInner}>
                <Icon name="hide" size={16} color="#ffffff" accentColor="#ffffff" />
                <Text style={styles.actionButtonText}>Hide</Text>
              </View>
            </SpringPressable>
          </View>
        </Animated.View>
      </Animated.View>
    </AnimatedEntrance>
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
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 62,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 18,
  },
  backText: {
    color: colors.primarySoft,
    fontSize: type.base,
  },
  title: {
    fontSize: type.title,
    fontWeight: type.weightBold,
    color: colors.fg,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: type.sm,
    color: colors.fgMuted,
    marginBottom: 18,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: type.lg,
    fontWeight: type.weightBold,
    color: colors.fg,
    marginTop: 32,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    marginVertical: 40,
  },
  cardList: {
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: type.sm,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryText: {
    color: colors.fgStrong,
    fontWeight: type.weightMedium,
    fontSize: type.xs,
  },

  // Review card (pending)
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  reviewCategory: {
    fontSize: type.xxs,
    fontWeight: type.weightBold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.primarySoft,
  },
  reviewText: {
    fontSize: type.base,
    color: colors.fg,
    lineHeight: 24,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  actionInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionButtonText: {
    color: colors.fgStrong,
    fontSize: type.xs,
    fontWeight: type.weightMedium,
  },

  // Media details
  mediaSection: {
    marginTop: -2,
    marginBottom: 12,
  },
  mediaPreview: {
    width: "100%",
    height: 200,
    borderRadius: radius.sm,
    marginBottom: 10,
  },
  mediaPreviewSmall: {
    width: "100%",
    height: 120,
    borderRadius: radius.sm,
    marginTop: 10,
    opacity: 0.8,
  },
  aiDetailRow: {
    marginBottom: 8,
  },
  aiDetailLabel: {
    fontSize: type.xs,
    color: colors.primarySoft,
    fontWeight: type.weightBold,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  aiDetailText: {
    fontSize: type.sm,
    color: colors.fg,
    lineHeight: 20,
  },
  personTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  personName: {
    fontSize: type.sm,
    color: colors.fg,
    marginRight: 8,
  },
  confidenceBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: type.xxs,
    color: colors.fgStrong,
    fontWeight: type.weightMedium,
  },

  // Reviewed (history) card
  reviewedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    opacity: 0.7,
  },
  reviewedHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  reviewedInfo: {
    flex: 1,
  },
  reviewedDescription: {
    fontSize: type.base,
    color: colors.fg,
    lineHeight: 22,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  statusText: {
    color: colors.fgStrong,
    fontSize: type.xs,
    fontWeight: type.weightMedium,
    textTransform: "uppercase",
  },
});
