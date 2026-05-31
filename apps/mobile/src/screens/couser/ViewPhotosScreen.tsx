import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  Alert,
} from "react-native";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
  AliveEmptyState,
} from "../../motion/primitives";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@memoria/core";
import { reprocessPendingPhotos, reprocessAllPhotos } from "@memoria/core";
import { useAuth } from "@memoria/core";
import { VerificationStatus } from "@memoria/core";
import { usePhotoLightbox, useTapToOpen } from "../../components/usePhotoLightbox";
import Icon, { IconName } from "../../components/Icon";
import { colors, radius, type as typ } from "@memoria/core";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface PhotoItem {
  id: string;
  file_url: string;
  taken_at: string | null;
  verification_status: VerificationStatus;
}

type FilterOption = "all" | "pending" | "verified";

function getStatusBadge(status: VerificationStatus): { name: IconName; color: string } {
  switch (status) {
    case "verified":
      return { name: "check", color: "#1b5e20" };
    case "pending":
      return { name: "pending", color: "#ffab40" };
    case "hidden":
      return { name: "block", color: "#b71c1c" };
    default:
      return { name: "block", color: "#888" };
  }
}

const FILTERS: { key: FilterOption; label: string; icon?: IconName }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending", icon: "pending" },
  { key: "verified", label: "Verified", icon: "check" },
];

export default function ViewPhotosScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retagging, setRetagging] = useState(false);
  const [filter, setFilter] = useState<FilterOption>("all");
  const { open, lightbox } = usePhotoLightbox();

  useEffect(() => {
    loadPhotos();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadPhotos();
    });

    return unsubscribe;
  }, [navigation, userId]);

  async function loadPhotos() {
    if (!userId) return;
    // Exclude hidden media — once the co-user (or repair script) marks
    // a photo `hidden`, it should never appear in this gallery again.
    const { data } = await supabase
      .from("media")
      .select("id, file_url, taken_at, verification_status")
      .eq("user_id", userId)
      .neq("verification_status", "hidden")
      .order("taken_at", { ascending: false });

    setPhotos(data || []);
    setLoading(false);
  }

  async function openPhotoLightbox(photo: PhotoItem) {
    // Lazy-fetch description, tags, and tagged people only on tap to
    // avoid loading full metadata for every grid item upfront.
    const { data: media } = await supabase
      .from("media")
      .select("description, ai_tags")
      .eq("id", photo.id)
      .single();

    const { data: mp } = await supabase
      .from("media_people")
      .select("person_id")
      .eq("media_id", photo.id);

    let peopleNames: string[] | undefined;
    if (mp && mp.length > 0) {
      const ids = mp.map((m: any) => m.person_id);
      const { data: people } = await supabase
        .from("people")
        .select("full_name")
        .in("id", ids);
      peopleNames = (people || []).map((p: any) => p.full_name).filter(Boolean);
    }

    open({
      photoUrl: photo.file_url,
      description: media?.description ?? null,
      tags: media?.ai_tags ?? undefined,
      peopleNames,
    });
  }

  async function handleRetryPending() {
    if (!userId || retrying) return;
    setRetrying(true);
    const { processed, failed } = await reprocessPendingPhotos(userId);
    setRetrying(false);
    await loadPhotos();

    Alert.alert(
      "Retry Complete",
      `Processed: ${processed}\nStill failing: ${failed}\n\nPending photos will appear in Review Queue for manual approval.`
    );
  }

  function confirmRetagAll() {
    Alert.alert(
      "Re-tag all photos?",
      "This resets every photo to pending and re-runs the AI tagger on all of them. This can take several minutes and will use your AI quota. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Re-tag All", style: "destructive", onPress: handleRetagAll },
      ]
    );
  }

  async function handleRetagAll() {
    if (!userId || retagging) return;
    setRetagging(true);
    const { processed, failed } = await reprocessAllPhotos(userId);
    setRetagging(false);
    await loadPhotos();

    Alert.alert(
      "Re-tag Complete",
      `Processed: ${processed}\nStill failing: ${failed}`
    );
  }

  const filteredPhotos = photos.filter((p) => {
    if (filter === "all") return true;
    if (filter === "pending") return p.verification_status === "pending";
    if (filter === "verified") return p.verification_status === "verified";
    return true;
  });

  const pendingCount = photos.filter((p) => p.verification_status === "pending").length;
  const verifiedCount = photos.filter((p) => p.verification_status === "verified").length;

  function filterCount(key: FilterOption): number {
    if (key === "pending") return pendingCount;
    if (key === "verified") return verifiedCount;
    return photos.length;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader caption="Loading photos…" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AnimatedEntrance index={0}>
        <View style={styles.header}>
          <SpringPressable onPress={() => navigation.goBack()}>
            <View style={styles.backRow}>
              <Icon name="back" size={20} color={colors.primarySoft} />
              <Text style={styles.backText}>Back</Text>
            </View>
          </SpringPressable>
          <Text style={styles.title}>Photos</Text>
          <Text style={styles.subtitle}>
            {photos.length} photo{photos.length !== 1 ? "s" : ""} ·{" "}
            {pendingCount} pending review
          </Text>
        </View>
      </AnimatedEntrance>

      {/* Filter pills */}
      <AnimatedEntrance index={1}>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <SpringPressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={styles.filterFlex}
              >
                <View
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  {f.icon ? (
                    <Icon
                      name={f.icon}
                      size={14}
                      color={active ? "#fff" : colors.fgMuted}
                    />
                  ) : null}
                  <Text
                    style={[styles.filterText, active && styles.filterTextActive]}
                  >
                    {f.label} ({filterCount(f.key)})
                  </Text>
                </View>
              </SpringPressable>
            );
          })}
        </View>
      </AnimatedEntrance>

      {pendingCount > 0 && (
        <AnimatedEntrance index={2}>
          <View style={styles.pendingActions}>
            <SpringPressable
              onPress={handleRetryPending}
              disabled={retrying}
              style={[styles.retryButton, retrying && styles.buttonDisabled]}
            >
              {retrying ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.retryButtonText}>
                  Retry AI Processing For Pending Photos
                </Text>
              )}
            </SpringPressable>
            <SpringPressable
              onPress={() => navigation.navigate("FlagQueue")}
              style={styles.reviewQueueButton}
            >
              <Text style={styles.reviewQueueText}>Open Review Queue</Text>
            </SpringPressable>
          </View>
        </AnimatedEntrance>
      )}

      {photos.length > 0 && (
        <AnimatedEntrance index={3}>
          <View style={styles.retagWrapper}>
            <SpringPressable
              onPress={confirmRetagAll}
              disabled={retagging}
              style={[styles.retagButton, retagging && styles.buttonDisabled]}
            >
              {retagging ? (
                <ActivityIndicator color={colors.primarySoft} size="small" />
              ) : (
                <Text style={styles.retagButtonText}>Re-tag All Photos With AI</Text>
              )}
            </SpringPressable>
          </View>
        </AnimatedEntrance>
      )}

      {filteredPhotos.length === 0 ? (
        <AnimatedEntrance index={4}>
          <View style={styles.emptyState}>
            <AliveEmptyState
              message={filter === "all" ? "No photos imported yet" : `No ${filter} photos`}
            />
          </View>
        </AnimatedEntrance>
      ) : (
        <FlatList
          data={filteredPhotos}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item, index }) => (
            <PhotoGridItem
              item={item}
              index={index}
              userId={userId}
              removeFromList={(id) =>
                setPhotos((prev) => prev.filter((p) => p.id !== id))
              }
              onPress={() => openPhotoLightbox(item)}
            />
          )}
        />
      )}

      <SpringPressable
        bigButton
        onPress={() => navigation.navigate("ImportPhotos")}
        style={styles.addButton}
      >
        <View style={styles.addRow}>
          <Icon name="add" size={22} color="#fff" accentColor="#fff" />
          <Text style={styles.addButtonText}>Import More Photos</Text>
        </View>
      </SpringPressable>

      <SpringPressable
        onPress={() => navigation.goBack()}
        style={styles.cancelButton}
      >
        <Text style={styles.cancelText}>Back to Dashboard</Text>
      </SpringPressable>
      {lightbox}
    </View>
  );
}

function PhotoGridItem({
  item,
  index,
  userId,
  removeFromList,
  onPress,
}: {
  item: PhotoItem;
  index: number;
  userId: string | null;
  removeFromList: (id: string) => void;
  onPress: () => void;
}) {
  const badge = getStatusBadge(item.verification_status);
  const handlePress = useTapToOpen(onPress);
  const [broken, setBroken] = useState(false);

  if (broken) return null;

  return (
    <AnimatedEntrance index={index} cardMode style={styles.tileEntrance}>
      <SpringPressable cardMode onPress={handlePress} style={styles.photoWrapper}>
        <Image
          source={{ uri: item.file_url }}
          style={styles.photo}
          onError={() => {
            // Hide this tile from the current render only — do NOT
            // permanently mark the DB row hidden. Image loads can fail
            // for transient reasons (network blip, simulator hiccup) and
            // we don't want to nuke a perfectly good photo on the first
            // miss. Real `file://` rows are caught earlier by the
            // `processPhoto` guard and the `repair-broken-photos` script.
            setBroken(true);
          }}
        />
        <View style={[styles.statusBadge, { backgroundColor: badge.color }]}>
          <Icon name={badge.name} size={15} color="#ffffff" />
        </View>
      </SpringPressable>
    </AnimatedEntrance>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 16,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    color: colors.primarySoft,
    fontSize: typ.base,
    fontWeight: typ.weightMedium,
  },
  title: {
    fontSize: typ.title,
    fontWeight: typ.weightBold,
    color: colors.primarySoft,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typ.base,
    color: colors.fgMuted,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 40,
    marginBottom: 12,
    gap: 8,
  },
  filterFlex: {
    flex: 1,
  },
  filterPill: {
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: typ.xs,
    color: colors.fgMuted,
    fontWeight: typ.weightMedium,
  },
  filterTextActive: {
    color: colors.fgStrong,
  },
  emptyState: {
    marginHorizontal: 40,
  },
  pendingActions: {
    marginHorizontal: 40,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: colors.fgStrong,
    fontWeight: typ.weightMedium,
    fontSize: typ.sm,
  },
  reviewQueueButton: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reviewQueueText: {
    color: colors.primarySoft,
    fontWeight: typ.weightMedium,
    fontSize: typ.xs,
  },
  retagWrapper: {
    marginHorizontal: 40,
    marginBottom: 10,
  },
  retagButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retagButtonText: {
    color: colors.primarySoft,
    fontWeight: typ.weightMedium,
    fontSize: typ.xs,
  },
  grid: {
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  tileEntrance: {
    flex: 1,
  },
  photoWrapper: {
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunk,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: radius.sm,
    alignItems: "center",
    marginHorizontal: 40,
    marginTop: 12,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addButtonText: {
    fontSize: typ.lg,
    fontWeight: typ.weightMedium,
    color: "#fff",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 20,
  },
  cancelText: {
    fontSize: typ.base,
    color: colors.fgMuted,
  },
});
