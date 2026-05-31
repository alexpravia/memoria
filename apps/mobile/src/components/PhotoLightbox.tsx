import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PhotoTagsView from "./PhotoTagsView";

interface PhotoLightboxProps {
  visible: boolean;
  photoUrl: string | null;
  description?: string | null;
  tags?: string[];
  peopleNames?: string[];
  onClose: () => void;
}

/**
 * Full-screen photo viewer. Image-first: the photo fills the screen
 * with `resizeMode='contain'`. AI metadata (description, tags, people)
 * sits in a translucent overlay anchored to the bottom-left and can be
 * toggled via the ⓘ button in the top-left.
 *
 * Tap backdrop or close button to dismiss. Tapping the image or the
 * overlay does NOT dismiss. Pinch-to-zoom is deferred — no
 * `react-native-gesture-handler` dependency yet.
 */
export default function PhotoLightbox({
  visible,
  photoUrl,
  description,
  tags,
  peopleNames,
  onClose,
}: PhotoLightboxProps) {
  const [tagsVisible, setTagsVisible] = useState(true);

  const hasDescription = !!description && description.trim().length > 0;
  const hasTags = !!tags && tags.length > 0;
  const hasPeople = !!peopleNames && peopleNames.length > 0;
  const hasAnyMeta = hasDescription || hasTags || hasPeople;

  return (
    <Modal
      visible={visible && !!photoUrl}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Image — fills the screen. Wrapped in Pressable so taps on
            the image don't bubble up to the backdrop dismiss. */}
        {photoUrl && (
          <Pressable
            style={styles.imageWrapper}
            onPress={() => {
              /* swallow tap */
            }}
          >
            <Image
              source={{ uri: photoUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </Pressable>
        )}

        {/* Info toggle (top-left) — only when there is metadata to show */}
        {hasAnyMeta && (
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => setTagsVisible((v) => !v)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={
              tagsVisible ? "Hide photo details" : "Show photo details"
            }
          >
            <Text style={styles.infoButtonText}>ⓘ</Text>
          </TouchableOpacity>
        )}

        {/* Close button (top-right) */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close photo"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Tag overlay (bottom-left).
            Use a plain View with start-responder=true / move-responder=false
            so taps don't dismiss the modal but the inner ScrollView (tag
            slider) still gets the horizontal pan gesture. A Pressable here
            would steal the pan and kill the slider on iOS. */}
        {hasAnyMeta && tagsVisible && (
          <View
            style={styles.tagOverlay}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => false}
            onResponderRelease={() => {
              /* swallow tap so backdrop press doesn't fire */
            }}
          >
            <PhotoTagsView
              compact
              description={description}
              tags={tags}
              peopleNames={peopleNames}
            />
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  imageWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  image: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  infoButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(42, 42, 74, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  infoButtonText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "bold",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(42, 42, 74, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "bold",
  },
  tagOverlay: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 10,
  },
});
