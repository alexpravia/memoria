import React, { useState, useRef } from "react";
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
} from "react-native";
import * as Speech from "expo-speech";
import { useAuth } from "../../context/AuthContext";
import { askAssistant } from "../../lib/assistant";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function AssistantScreen({ navigation }: any) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hello! I'm here to help. You can ask me anything about yourself, your family, or your schedule.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function handleSend() {
    const question = input.trim();
    if (!question || !userId || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);

    const { answer, error } = await askAssistant(userId, question);

    const responseText = error
      ? "I'm having trouble right now. Please try again in a moment."
      : answer;

    setMessages((prev) => [...prev, { role: "assistant", text: responseText }]);
    setLoading(false);

    // Read the answer aloud
    if (!error) {
      Speech.speak(responseText, { language: "en", rate: 0.85 });
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
          Speech.stop();
          navigation.goBack();
        }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ask Me Anything</Text>
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
    </KeyboardAvoidingView>
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
});
