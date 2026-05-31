import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import * as tts from "../../lib/tts";
import { useAuth } from "../../context/AuthContext";
import { askAssistant } from "../../lib/assistant";
import { usePhotoLightbox, useTapToOpen } from "../../components/usePhotoLightbox";

// Bounds for chat photo tiles. Width is fixed; height adapts to the
// photo's natural aspect ratio but is clamped so a portrait photo can't
// blow up the bubble (which used to make the chat un-scrollable).
const PHOTO_WIDTH = 200;
const PHOTO_MIN_HEIGHT = 120;
const PHOTO_MAX_HEIGHT = 280;

interface Message {
  role: "user" | "assistant";
  text: string;
  photos?: string[];
}

export default function AssistantScreen({ navigation }: any) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi, I'm Memo. You can ask me anything about yourself, your family, or your schedule.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);
  const { open, lightbox } = usePhotoLightbox();

  async function handleSend() {
    const question = input.trim();
    if (!question || !userId || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);

    const { answer, error, photos, conversationId: nextConvId } = await askAssistant(
      userId,
      question,
      conversationId
    );

    if (nextConvId) {
      setConversationId(nextConvId);
    }

    const responseText = error
      ? "I'm having trouble right now. Please try again in a moment."
      : answer;

    setMessages((prev) => [...prev, {
      role: "assistant",
      text: responseText,
      photos: photos && photos.length > 0 ? photos : undefined,
    }]);
    setLoading(false);

    // Read the answer aloud
    if (!error) {
      await tts.speak(responseText);
    }

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          tts.stop();
          navigation.goBack();
        }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Talk to Memo</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.messageBubble,
              msg.role === "user" ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={[
              styles.messageText,
              msg.role === "user" ? styles.userText : styles.assistantText,
            ]}>
              {msg.text}
            </Text>
            {/* TODO: chat photos arrive as bare URLs, so the lightbox can't
                show description/tags/people without a media-id lookup. Open
                with just the photo for now; a future pass can wire up
                `askAssistant` to return media ids alongside urls so we can
                lazy-fetch metadata here. */}
            {msg.photos && msg.photos.length === 1 && (
              // Single-photo: render in a plain View. An unbounded nested
              // horizontal ScrollView (the previous approach) gets measured
              // taller than its image content and re-measures on every new
              // message append, making the bubble grow each turn.
              <View style={styles.singlePhotoContainer}>
                <ChatPhoto
                  url={msg.photos[0]}
                  onPress={() => open({ photoUrl: msg.photos![0] })}
                />
              </View>
            )}
            {msg.photos && msg.photos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photosScroll}
                contentContainerStyle={styles.photosScrollContent}
              >
                {msg.photos.map((url, j) => (
                  <ChatPhoto
                    key={url}
                    url={url}
                    onPress={() => open({ photoUrl: url })}
                    isLast={j === msg.photos!.length - 1}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        ))}
        {loading && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <ActivityIndicator size="small" color="#7c4dff" />
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask a question..."
          placeholderTextColor="#666"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendButtonText}>→</Text>
        </TouchableOpacity>
      </View>
      {lightbox}
    </KeyboardAvoidingView>
  );
}

function ChatPhoto({
  url,
  onPress,
  isLast = true,
}: {
  url: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const handlePress = useTapToOpen(onPress);
  // Default to a square while we wait for natural dimensions; once loaded,
  // size to the photo's true aspect ratio (clamped) so the bubble wraps
  // tightly around it instead of stretching unbounded.
  const [height, setHeight] = useState<number>(PHOTO_WIDTH);

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      url,
      (w, h) => {
        if (cancelled || !w || !h) return;
        const scaled = (PHOTO_WIDTH * h) / w;
        const clamped = Math.max(PHOTO_MIN_HEIGHT, Math.min(PHOTO_MAX_HEIGHT, scaled));
        setHeight(clamped);
      },
      () => {
        // On failure, leave the default square in place.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <Image
        source={{ uri: url }}
        style={[styles.photoImage, { height }, !isLast && styles.photoGap]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  backText: {
    color: "#b388ff",
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#e0e0e0",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: "#7c4dff",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#2a2a4a",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 18,
    lineHeight: 26,
  },
  userText: {
    color: "#ffffff",
  },
  assistantText: {
    color: "#e0e0e0",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: "#2a2a4a",
    backgroundColor: "#1a1a2e",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#2a2a4a",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 17,
    color: "#e0e0e0",
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: "#7c4dff",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "bold",
  },
  // Single-photo container: a plain View that hugs the photo and stops the
  // bubble from being inflated by a nested scroll viewport.
  singlePhotoContainer: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexGrow: 0,
    flexShrink: 0,
  },
  // Multi-photo horizontal scroller: explicitly non-flex so the bubble
  // wraps tightly to the strip height rather than letting it expand.
  photosScroll: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexGrow: 0,
    flexShrink: 0,
  },
  photosScrollContent: {
    alignItems: "flex-start",
  },
  photoImage: {
    width: PHOTO_WIDTH,
    // `height` is supplied per-photo by <ChatPhoto> based on the image's
    // natural aspect ratio (clamped between PHOTO_MIN/MAX_HEIGHT) so the
    // bubble wraps tightly to the photo and the chat stays scrollable.
    borderRadius: 12,
    backgroundColor: "#1a1a2e",
    resizeMode: "cover",
  },
  photoGap: {
    marginRight: 8,
  },
});
