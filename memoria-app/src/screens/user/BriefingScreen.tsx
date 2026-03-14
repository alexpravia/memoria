import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Animated,
} from "react-native";
import * as Speech from "expo-speech";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { UserProfile, Person } from "../../types";

interface BriefingSlide {
  text: string;
  subtitle?: string;
  photoUrl?: string;
}

export default function BriefingScreen({ navigation }: any) {
  const { userId } = useAuth();
  const [slides, setSlides] = useState<BriefingSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    buildBriefing();
    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (slides.length > 0 && currentSlide < slides.length) {
      animateSlide();
      speakSlide(slides[currentSlide]);
    }
  }, [currentSlide, slides]);

  function animateSlide() {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handleExit() {
    Speech.stop();
    navigation.goBack();
  }

  async function buildBriefing() {
    if (!userId) return;

    const briefingSlides: BriefingSlide[] = [];

    // Fetch user profile
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!user) {
      setLoading(false);
      return;
    }

    // Greeting
    const today = new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = today.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const hour = today.getHours();
    const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

    briefingSlides.push({
      text: `${greeting}, ${user.full_name}`,
      subtitle: `Today is ${dayName}, ${dateStr}`,
    });

    // Location
    if (user.location) {
      briefingSlides.push({
        text: `You live in ${user.location}`,
      });
    }

    // Life facts
    const { data: facts } = await supabase
      .from("life_facts")
      .select("fact")
      .eq("user_id", userId)
      .order("display_order");

    if (facts && facts.length > 0) {
      briefingSlides.push({
        text: "Here are some things about you",
        subtitle: facts.map((f) => f.fact).join("\n\n"),
      });
    }

    // People
    const { data: people } = await supabase
      .from("people")
      .select("*")
      .eq("user_id", userId);

    if (people && people.length > 0) {
      briefingSlides.push({
        text: "The important people in your life",
      });

      for (const person of people) {
        let subtitle = person.relationship;
        if (person.key_facts && person.key_facts.length > 0) {
          subtitle += "\n\n" + person.key_facts.join("\n");
        }
        briefingSlides.push({
          text: person.full_name,
          subtitle,
          photoUrl: person.photo_url || undefined,
        });
      }
    }

    // Today's events
    const todayStr = today.toISOString().split("T")[0];
    const { data: todayEvents } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .gte("event_date", todayStr)
      .lt("event_date", todayStr + "T23:59:59");

    if (todayEvents && todayEvents.length > 0) {
      briefingSlides.push({
        text: "Here's what's planned for today",
        subtitle: todayEvents.map((e) => e.title + (e.description ? `: ${e.description}` : "")).join("\n\n"),
      });
    }

    // Upcoming events (next 7 days)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0];

    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .gt("event_date", todayStr + "T23:59:59")
      .lte("event_date", nextWeekStr)
      .order("event_date");

    if (upcomingEvents && upcomingEvents.length > 0) {
      briefingSlides.push({
        text: "Coming up this week",
        subtitle: upcomingEvents
          .map((e) => {
            const d = new Date(e.event_date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            });
            return `${d}: ${e.title}`;
          })
          .join("\n\n"),
      });
    }

    // End
    briefingSlides.push({
      text: "That's your briefing for today",
      subtitle: "Have a wonderful day!",
    });

    setSlides(briefingSlides);
    setLoading(false);
  }

  function speakSlide(slide: BriefingSlide) {
    Speech.stop();
    const fullText = slide.subtitle
      ? `${slide.text}. ${slide.subtitle}`
      : slide.text;

    setSpeaking(true);
    Speech.speak(fullText, {
      language: "en",
      rate: 0.85,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    });
  }

  function nextSlide() {
    Speech.stop();
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigation.goBack();
    }
  }

  function prevSlide() {
    Speech.stop();
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  }

  function replaySlide() {
    if (slides[currentSlide]) {
      speakSlide(slides[currentSlide]);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#7c4dff" />
        <Text style={styles.loadingText}>Preparing your briefing...</Text>
      </View>
    );
  }

  if (slides.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.mainText}>No information available yet</Text>
        <Text style={styles.subtitleText}>
          Ask your helper to add some information about you
        </Text>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.goBack()}>
          <Text style={styles.navButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const slide = slides[currentSlide];

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentSlide + 1) / slides.length) * 100}%` },
          ]}
        />
      </View>

      <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
        <Text style={styles.exitButtonText}>✕</Text>
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.slideContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {slide.photoUrl && (
            <Image source={{ uri: slide.photoUrl }} style={styles.photo} />
          )}
          <Text style={styles.mainText}>{slide.text}</Text>
          {slide.subtitle && (
            <Text style={styles.subtitleText}>{slide.subtitle}</Text>
          )}
        </Animated.View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.navButton, currentSlide === 0 && styles.navButtonDisabled]}
          onPress={prevSlide}
          disabled={currentSlide === 0}
        >
          <Text style={styles.navButtonText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.replayButton} onPress={replaySlide}>
          <Text style={styles.replayButtonText}>🔊</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={nextSlide}>
          <Text style={styles.navButtonText}>
            {currentSlide === slides.length - 1 ? "Done" : "Next →"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    color: "#e0e0e0",
    fontSize: 18,
    textAlign: "center",
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#2a2a4a",
    borderRadius: 3,
    position: "absolute",
    top: 60,
    left: 40,
    right: 40,
  },
  progressFill: {
    height: 6,
    backgroundColor: "#7c4dff",
    borderRadius: 3,
  },
  slideContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: "#7c4dff",
  },
  mainText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 16,
  },
  subtitleText: {
    fontSize: 20,
    color: "#b388ff",
    textAlign: "center",
    lineHeight: 30,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 20,
  },
  navButton: {
    backgroundColor: "#2a2a4a",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e0e0e0",
  },
  replayButton: {
    backgroundColor: "#7c4dff",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  replayButtonText: {
    fontSize: 28,
  },
  exitButton: {
    position: "absolute",
    top: 54,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2a2a4a",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  exitButtonText: {
    color: "#ff6b6b",
    fontSize: 20,
    fontWeight: "bold",
  },
});
