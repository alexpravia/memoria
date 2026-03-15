import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../../lib/supabase";
import { processPhotos } from "../../../lib/photoProcessing";
import { useAuth } from "../../../context/AuthContext";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface PhotoItem {
  id: string;
  uri: string;
  creationTime: number;
  selected: boolean;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const PHOTO_SIZE = (SCREEN_WIDTH - 80 - 16) / 3; // 3 columns with gaps

export default function ImportPhotosScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [endCursor, setEndCursor] = useState<string | undefined>();

  useEffect(() => {
    loadPhotos();
  }, []);

  async function loadPhotos() {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Needed",
        "We need access to your photos to import them. You can enable this in Settings."
      );
      setLoading(false);
      return;
    }

    await fetchPage();
    setLoading(false);
  }

  async function fetchPage() {
    const result = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      first: 50,
      after: endCursor,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });

    const newPhotos: PhotoItem[] = await Promise.all(
      result.assets.map(async (a) => {
        const info = await MediaLibrary.getAssetInfoAsync(a.id);
        return {
          id: a.id,
          uri: info.localUri || a.uri,
          creationTime: a.creationTime,
          selected: false,
        };
      })
    );

    setPhotos((prev) => [...prev, ...newPhotos]);
    setEndCursor(result.endCursor);
    setHasMore(result.hasNextPage);
  }

  function togglePhoto(id: string) {
    setPhotos(
      photos.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }

  async function handleImport() {
    const selected = photos.filter((p) => p.selected);
    if (selected.length === 0) {
      Alert.alert("Please select at least one photo to import");
      return;
    }

    setImporting(true);
    try {
      const rows = [];

      for (let i = 0; i < selected.length; i++) {
        const p = selected[i];
        setUploadProgress(`Uploading ${i + 1} of ${selected.length}...`);

        // Read local file as blob and upload to Supabase Storage
        const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const storagePath = `${userId}/${filename}`;

        const response = await fetch(p.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(storagePath, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("photos")
          .getPublicUrl(storagePath);

        rows.push({
          user_id: userId,
          file_url: urlData.publicUrl,
          file_type: "photo" as const,
          taken_at: new Date(p.creationTime).toISOString(),
          verification_status: "pending" as const,
        });
      }

      // Insert all uploaded photo records into media table
      const { data: inserted, error } = await supabase
        .from("media")
        .insert(rows)
        .select("id, file_url");
      if (error) throw error;

      // Analyze photos with AI vision (non-blocking on failures)
      if (inserted && inserted.length > 0) {
        setUploadProgress("Analyzing photos...");
        try {
          await processPhotos(
            inserted.map((row) => ({ mediaId: row.id, photoUrl: row.file_url })),
            userId!,
            (current, total) => {
              setUploadProgress(`Analyzing photo ${current} of ${total}...`);
            }
          );
        } catch (err: any) {
          console.warn("Photo processing error:", err.message);
        }
      }

      Alert.alert(
        "Imported!",
        `${selected.length} photo${selected.length > 1 ? "s" : ""} imported and queued for review.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setImporting(false);
      setUploadProgress("");
    }
  }

  const selectedCount = photos.filter((p) => p.selected).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
        <Text style={styles.loadingText}>Loading photos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Import Photos</Text>
        <Text style={styles.subtitle}>
          Select photos to add to your loved one's memories
        </Text>
        <Text style={styles.countText}>{selectedCount} selected</Text>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        onEndReached={() => {
          if (hasMore) fetchPage();
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.photoWrapper,
              item.selected && styles.photoSelected,
            ]}
            onPress={() => togglePhoto(item.id)}
          >
            <Image source={{ uri: item.uri }} style={styles.photo} />
            {item.selected && (
              <View style={styles.checkOverlay}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {selectedCount > 0 && (
        <TouchableOpacity
          style={styles.importButton}
          onPress={handleImport}
          disabled={importing}
        >
          {importing ? (
            <View style={{ alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
              {uploadProgress ? (
                <Text style={{ color: "#fff", fontSize: 14, marginTop: 6 }}>
                  {uploadProgress}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.importButtonText}>
              Import {selectedCount} Photo{selectedCount > 1 ? "s" : ""}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelText}>Cancel</Text>
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
  loadingText: {
    color: "#e0e0e0",
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#e0e0e0",
    marginBottom: 8,
  },
  countText: {
    color: "#888",
    fontSize: 14,
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
  photoSelected: {
    borderWidth: 3,
    borderColor: "#7c4dff",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  checkOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#7c4dff",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  importButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 40,
    marginTop: 12,
  },
  importButtonText: {
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
