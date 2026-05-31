import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { reprocessPendingPhotos, reprocessAllPhotos } from "../../lib/photoProcessing";
import { useAuth } from "../../context/AuthContext";
import { VerificationStatus } from "../../types";
import { usePhotoLightbox, useTapToOpen } from "../../components/usePhotoLightbox";
import Icon, { IconName } from "../../components/Icon";

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

const SCREEN_WIDTH = Dimensions.get("window").width;
const PHOTO_SIZE = (SCREEN_WIDTH - 80 - 16) / 3;

function getStatusBadge(status: VerificationStatus): { name: IconName; color: string } {
  switch (status) {
    case "verified":
      return { name: "check", color: "#1b5e20" };
    case "pending":
      return { name: "pending", color: "#ffab40" };
    case "hidden":
      return { name: "block", color: "#b71c1c" };
  }
}

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Photos</Text>
        <Text style={styles.subtitle}>
          {photos.length} photo{photos.length !== 1 ? "s" : ""} imported
        </Text>
      </View>

      {/* Filter toggles */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, filter === "all" && styles.filterButtonActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
            All ({photos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "pending" && styles.filterButtonActive]}
          onPress={() => setFilter("pending")}
        >
          <Icon name="pending" size={14} color={filter === "pending" ? "#ffffff" : "#888"} />
          <Text style={[styles.filterText, filter === "pending" && styles.filterTextActive]}>
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "verified" && styles.filterButtonActive]}
          onPress={() => setFilter("verified")}
        >
          <Icon name="check" size={14} color={filter === "verified" ? "#ffffff" : "#888"} />
          <Text style={[styles.filterText, filter === "verified" && styles.filterTextActive]}>
            Verified ({verifiedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {pendingCount > 0 && (
        <View style={styles.pendingActions}>
          <TouchableOpacity
            style={[styles.retryButton, retrying && styles.retryButtonDisabled]}
            onPress={handleRetryPending}
            disabled={retrying}
          >
            {retrying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.retryButtonText}>Retry AI Processing For Pending Photos</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reviewQueueButton}
            onPress={() => navigation.navigate("FlagQueue")}
          >
            <Text style={styles.reviewQueueText}>Open Review Queue</Text>
          </TouchableOpacity>
        </View>
      )}

      {photos.length > 0 && (
        <View style={styles.retagWrapper}>
          <TouchableOpacity
            style={[styles.retagButton, retagging && styles.retryButtonDisabled]}
            onPress={confirmRetagAll}
            disabled={retagging}
          >
            {retagging ? (
              <ActivityIndicator color="#b388ff" size="small" />
            ) : (
              <Text style={styles.retagButtonText}>Re-tag All Photos With AI</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {filteredPhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {filter === "all" ? "No photos imported yet" : `No ${filter} photos`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPhotos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <PhotoGridItem
              item={item}
              userId={userId}
              removeFromList={(id) =>
                setPhotos((prev) => prev.filter((p) => p.id !== id))
              }
              onPress={() => openPhotoLightbox(item)}
            />
          )}
        />
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("ImportPhotos")}
      >
        <Text style={styles.addButtonText}>+ Import More Photos</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelText}>Back to Dashboard</Text>
      </TouchableOpacity>
      {lightbox}
    </View>
  );
}

function PhotoGridItem({
  item,
  userId,
  removeFromList,
  onPress,
}: {
  item: PhotoItem;
  userId: string | null;
  removeFromList: (id: string) => void;
  onPress: () => void;
}) {
  const badge = getStatusBadge(item.verification_status);
  const handlePress = useTapToOpen(onPress);
  const [broken, setBroken] = useState(false);

  if (broken) return null;

  return (
    <TouchableOpacity
      style={styles.photoWrapper}
      onPress={handlePress}
      activeOpacity={0.85}
    >
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
        <Icon name={badge.name} size={13} color="#ffffff" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  centered: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 16,
  },
  backText: {
    color: "#b388ff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 40,
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2a2a4a",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  filterButtonActive: {
    backgroundColor: "#7c4dff",
  },
  filterText: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#ffffff",
  },
  emptyState: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginHorizontal: 40,
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
  },
  pendingActions: {
    marginHorizontal: 40,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: "#7c4dff",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  retryButtonDisabled: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  reviewQueueButton: {
    marginTop: 8,
    backgroundColor: "#2a2a4a",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#7c4dff",
  },
  reviewQueueText: {
    color: "#b388ff",
    fontWeight: "600",
    fontSize: 13,
  },
  retagWrapper: {
    marginHorizontal: 40,
    marginBottom: 10,
  },
  retagButton: {
    backgroundColor: "#2a2a4a",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#7c4dff",
  },
  retagButtonText: {
    color: "#b388ff",
    fontWeight: "600",
    fontSize: 13,
  },
  grid: {
    paddingHorizontal: 40,
  },
  row: {
    gap: 8,
    marginBottom: 8,
  },
  photoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: "hidden",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  statusBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 40,
    marginTop: 12,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 20,
  },
  cancelText: {
    fontSize: 16,
    color: "#888",
  },
});
