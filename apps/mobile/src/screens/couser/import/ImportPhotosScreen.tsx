import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as ImageManipulator from "expo-image-manipulator";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase, processPhotos, useAuth } from "@memoria/core";
import { colors, radius } from "@memoria/core";
import { SpringPressable } from "../../../motion/primitives";
import { ShimmerButton } from "../../../motion/ui";
import Icon from "../../../components/Icon";
import { FlowNav, FlowHeader, MUTE } from "../FlowLayout";

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
const COL_GAP = 8;
const SIDE_PAD = 20;
const PHOTO_SIZE = (SCREEN_WIDTH - SIDE_PAD * 2 - COL_GAP * 2) / 3;

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
    setPhotos((arr) =>
      arr.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }

  async function handleImport() {
    const selected = photos.filter((p) => p.selected);
    if (selected.length === 0) return;

    setImporting(true);
    let failedUploads = 0;
    try {
      const rows: Array<{
        user_id: string;
        file_url: string;
        file_type: "photo";
        taken_at: string;
        verification_status: "pending";
      }> = [];

      for (let i = 0; i < selected.length; i++) {
        const p = selected[i];
        const isHeic = /\.heic($|\?)/i.test(p.uri);
        setUploadProgress(
          `Uploading ${i + 1} of ${selected.length}…${isHeic ? " (converting)" : ""}`
        );

        let uploadUri = p.uri;
        try {
          const manipulated = await ImageManipulator.manipulateAsync(p.uri, [], {
            compress: 0.85,
            format: ImageManipulator.SaveFormat.JPEG,
          });
          uploadUri = manipulated.uri;
        } catch {
          failedUploads += 1;
          continue;
        }

        const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const storagePath = `${userId}/${filename}`;

        let blob: Blob;
        try {
          const response = await fetch(uploadUri);
          blob = await response.blob();
        } catch {
          failedUploads += 1;
          continue;
        }

        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(storagePath, blob, { contentType: "image/jpeg" });
        if (uploadError) {
          failedUploads += 1;
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("photos")
          .getPublicUrl(storagePath);

        if (!urlData?.publicUrl || !urlData.publicUrl.startsWith("http")) {
          failedUploads += 1;
          continue;
        }

        rows.push({
          user_id: userId!,
          file_url: urlData.publicUrl,
          file_type: "photo" as const,
          taken_at: new Date(p.creationTime).toISOString(),
          verification_status: "pending" as const,
        });
      }

      if (rows.length === 0) {
        Alert.alert(
          "Upload Failed",
          `${failedUploads} of ${selected.length} photo${selected.length > 1 ? "s" : ""} failed to upload — check your connection and try again.`
        );
        return;
      }

      const { data: inserted, error } = await supabase
        .from("media")
        .insert(rows)
        .select("id, file_url");
      if (error) throw error;

      let processingFailed = false;
      if (inserted && inserted.length > 0) {
        setUploadProgress("Analyzing photos…");
        try {
          await processPhotos(
            inserted.map((row) => ({ mediaId: row.id, photoUrl: row.file_url })),
            userId!,
            (current, total) => {
              setUploadProgress(`Analyzing photo ${current} of ${total}…`);
            }
          );
        } catch {
          processingFailed = true;
        }
      }

      const successCount = rows.length;
      const hasFailures = failedUploads > 0;
      const title = hasFailures || processingFailed ? "Imported With Warnings" : "Imported!";
      const failureMsg = hasFailures
        ? ` ${failedUploads} photo${failedUploads > 1 ? "s" : ""} failed to upload.`
        : "";
      const baseMsg = processingFailed
        ? `${successCount} photo${successCount > 1 ? "s" : ""} imported, but some AI processing steps failed. Open Photos → Retry AI Processing.`
        : `${successCount} photo${successCount > 1 ? "s" : ""} imported and queued for review.`;

      Alert.alert(title, `${baseMsg}${failureMsg}`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setImporting(false);
      setUploadProgress("");
    }
  }

  const selectedCount = photos.filter((p) => p.selected).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading photos…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed header */}
      <View style={styles.header}>
        <FlowNav
          onBack={() => navigation.goBack()}
          onClose={() => navigation.goBack()}
        />
        <FlowHeader
          title="Import Photos"
          sub="Add photos to their memories"
        />
        <Text style={styles.countText}>{selectedCount} selected</Text>
      </View>

      {/* Photo grid */}
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        onEndReached={() => { if (hasMore) fetchPage(); }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <SpringPressable
            onPress={() => togglePhoto(item.id)}
            style={[
              styles.tileWrap,
              item.selected && styles.tileSelected,
            ]}
          >
            <Image source={{ uri: item.uri }} style={styles.tileImage} />
            {item.selected && (
              <View style={styles.checkOverlay}>
                <Icon name="check" size={14} color="#fff" accentColor="#fff" />
              </View>
            )}
          </SpringPressable>
        )}
      />

      {/* Fixed import button */}
      {selectedCount > 0 && (
        <View style={styles.importWrap}>
          {importing ? (
            <View style={styles.progressWrap}>
              <ActivityIndicator color={colors.primary} />
              {uploadProgress ? (
                <Text style={styles.progressText}>{uploadProgress}</Text>
              ) : null}
            </View>
          ) : (
            <ShimmerButton
              label={`Import ${selectedCount} photo${selectedCount > 1 ? "s" : ""}`}
              onPress={handleImport}
              hero
            />
          )}
        </View>
      )}
    </View>
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
  loadingText: {
    color: colors.fg,
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    paddingHorizontal: SIDE_PAD,
    paddingTop: 72,
    paddingBottom: 12,
  },
  countText: {
    color: MUTE,
    fontSize: 14,
    marginTop: 14,
  },
  grid: {
    paddingHorizontal: SIDE_PAD,
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    gap: COL_GAP,
    marginBottom: COL_GAP,
  },
  tileWrap: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "transparent",
    position: "relative",
  },
  tileSelected: {
    borderColor: colors.primary,
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  checkOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.35,
  },
  importWrap: {
    paddingHorizontal: SIDE_PAD,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: colors.bg,
  },
  progressWrap: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  progressText: {
    color: colors.primarySoft,
    fontSize: 14,
  },
});
