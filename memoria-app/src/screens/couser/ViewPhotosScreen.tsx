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
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { VerificationStatus } from "../../types";

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

function getStatusBadge(status: VerificationStatus) {
  switch (status) {
    case "verified":
      return { icon: "✓", color: "#1b5e20" };
    case "pending":
      return { icon: "⏳", color: "#ffab40" };
    case "hidden":
      return { icon: "🚫", color: "#b71c1c" };
  }
}

export default function ViewPhotosScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOption>("all");

  useEffect(() => {
    loadPhotos();
  }, []);

  async function loadPhotos() {
    if (!userId) return;
    const { data } = await supabase
      .from("media")
      .select("id, file_url, taken_at, verification_status")
      .eq("user_id", userId)
      .order("taken_at", { ascending: false });

    setPhotos(data || []);
    setLoading(false);
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
          <Text style={[styles.filterText, filter === "pending" && styles.filterTextActive]}>
            ⏳ Pending ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "verified" && styles.filterButtonActive]}
          onPress={() => setFilter("verified")}
        >
          <Text style={[styles.filterText, filter === "verified" && styles.filterTextActive]}>
            ✓ Verified ({verifiedCount})
          </Text>
        </TouchableOpacity>
      </View>

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
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.verification_status);
            return (
              <View style={styles.photoWrapper}>
                <Image source={{ uri: item.file_url }} style={styles.photo} />
                <View style={[styles.statusBadge, { backgroundColor: badge.color }]}>
                  <Text style={styles.statusBadgeText}>{badge.icon}</Text>
                </View>
              </View>
            );
          }}
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
    </View>
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
    alignItems: "center",
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
  statusBadgeText: {
    fontSize: 12,
    color: "#ffffff",
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