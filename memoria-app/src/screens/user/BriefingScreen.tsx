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
import * as tts from "../../lib/tts";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { SensitivityFilter } from "../../types";
import { usePhotoLightbox, useTapToOpen } from "../../components/usePhotoLightbox";
import {
  getTodaysBriefing,
  resolveSlidePhotos,
  markDelivered,
  type BriefingSlide as AIBriefingSlide,
} from "../../lib/briefing";

interface BriefingSlide {
  text: string;
  subtitle?: string;
  photoUrl?: string;
  // Optional spoken-text override. Used by the AI path so the model's
  // warmer `tts_text` is read aloud instead of the on-screen body.
  ttsOverride?: string;
}

// Map an AI-generated slide into the legacy renderer shape so the
// existing animation / navigation pipeline stays untouched. The TTS
// path picks up `ttsOverride` to read the model's narration verbatim.
function mapAISlide(s: AIBriefingSlide): BriefingSlide {
  return {
    text: s.title,
    subtitle: s.body,
    photoUrl: s.photo_url,
    ttsOverride: s.tts_text,
  };
}

// Fill in `photo_url` for slides whose kind suggests a photo
// (greeting / person / memory_photo) but where the AI omitted one or
// where it points at a non-http (file://, etc.) URL we cannot render.
// Pool entries are reused round-robin; if the pool is empty we fall
// back to the user's profile photo. Non-http URLs are stripped so the
// renderer can return null cleanly.
function backfillPhotos(
  slides: AIBriefingSlide[],
  pool: string[],
  userPhoto: string | null
): AIBriefingSlide[] {
  const KINDS_WITH_PHOTO = new Set(["greeting", "person", "memory_photo"]);
  let poolIdx = 0;
  return slides.map((s) => {
    let url = s.photo_url;
    if (url && !url.startsWith("http")) {
      url = undefined;
    }
    if (!url && KINDS_WITH_PHOTO.has(s.kind)) {
      if (pool.length > 0) {
        url = pool[poolIdx % pool.length];
        poolIdx++;
      } else if (userPhoto && userPhoto.startsWith("http")) {
        url = userPhoto;
      }
    }
    if (url && !url.startsWith("http")) {
      url = undefined;
    }
    return { ...s, photo_url: url };
  });
}

export default function BriefingScreen({ navigation }: any) {
  const { userId } = useAuth();
  const [slides, setSlides] = useState<BriefingSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const { open: openLightbox, lightbox } = usePhotoLightbox();
  // Track the AI briefing id so we can mark it `delivered` once the
  // user finishes the deck.
  const aiBriefingIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadBriefing();
    return () => {
      tts.stop();
    };
  }, []);

  async function loadBriefing() {
    if (!userId) {
      setLoading(false);
      return;
    }

    // ── AI path ───────────────────────────────────────────────────
    // If a co-user-approved (or already-delivered) briefing exists for
    // today, render it. Otherwise fall back to the procedural builder
    // so the user is never blocked.
    try {
      const ai = await getTodaysBriefing(userId);
      if (ai && ai.slides && ai.slides.length > 0) {
        const resolved = await resolveSlidePhotos(ai.slides);

        // Build a pool of verified, http-prefixed photo URLs to fill
        // slides whose kind implies a photo but where the AI didn't
        // include one. Start from URLs already present on the resolved
        // slides, then top up from recent verified media if needed.
        const verifiedPool: string[] = [];
        for (const s of resolved) {
          const u = s.photo_url;
          if (u && u.startsWith("http") && !verifiedPool.includes(u)) {
            verifiedPool.push(u);
          }
        }
        if (verifiedPool.length < 3) {
          const { data: extra } = await supabase
            .from("media")
            .select("file_url")
            .eq("user_id", userId)
            .eq("verification_status", "verified")
            .not("description", "is", null)
            .order("taken_at", { ascending: false })
            .limit(5);
          for (const row of (extra as Array<{ file_url: string }> | null) ?? []) {
            const u = row.file_url;
            if (u && u.startsWith("http") && !verifiedPool.includes(u)) {
              verifiedPool.push(u);
            }
          }
        }

        // Fetch the user's profile photo as a last-resort fallback.
        const { data: userRow } = await supabase
          .from("users")
          .select("photo_url")
          .eq("id", userId)
          .single();
        const userPhoto =
          (userRow?.photo_url as string | undefined | null) ?? null;

        const patched = backfillPhotos(resolved, verifiedPool, userPhoto);
        const mapped = patched.map(mapAISlide);
        aiBriefingIdRef.current = ai.id;
        setSlides(mapped);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("BriefingScreen: AI path threw, falling back:", err);
    }

    // ── Fallback (procedural) ─────────────────────────────────────
    await buildBriefing();
  }

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
    tts.stop();
    // If the user exits an AI briefing partway through, still mark it
    // delivered so it doesn't keep re-appearing tomorrow as
    // "approved-not-yet-delivered".
    const id = aiBriefingIdRef.current;
    if (id) {
      markDelivered(id);
      aiBriefingIdRef.current = null;
    }
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

    const fallbackPhotoPool: string[] = [];

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
      photoUrl: user.photo_url || undefined,
    });

    // Location
    if (user.location) {
      briefingSlides.push({
        text: `You live in ${user.location}`,
        photoUrl: user.photo_url || undefined,
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
        photoUrl: user.photo_url || undefined,
      });
    }

    // People
    const { data: people } = await supabase
      .from("people")
      .select("*")
      .eq("user_id", userId);

    if (people && people.length > 0) {
      // Fetch fallback photos for people without a photo_url
      const peopleWithoutPhoto = people.filter((p) => !p.photo_url);
      const fallbackPhotoMap: Record<string, string> = {};

      if (peopleWithoutPhoto.length > 0) {
        const { data: mediaPeoplePhotos } = await supabase
          .from("media_people")
          .select("person_id, media(file_url, verification_status)")
          .in(
            "person_id",
            peopleWithoutPhoto.map((p) => p.id)
          )
          .eq("verified", true)
          .gte("ai_confidence", 0.8);

        (mediaPeoplePhotos || []).forEach((mp: any) => {
          if (
            !fallbackPhotoMap[mp.person_id] &&
            mp.media?.file_url &&
            mp.media?.verification_status === "verified"
          ) {
            fallbackPhotoMap[mp.person_id] = mp.media.file_url;
          }
        });
      }

      Object.values(fallbackPhotoMap).forEach((url) => {
        if (url && !fallbackPhotoPool.includes(url)) {
          fallbackPhotoPool.push(url);
        }
      });

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
          photoUrl: person.photo_url || fallbackPhotoMap[person.id] || undefined,
        });
      }
    }

    // Recent memories (verified photos with sensitivity filtering)
    const { data: filtersData } = await supabase
      .from("sensitivity_filters")
      .select("*")
      .eq("user_id", userId);

    const sensitivityFilters: SensitivityFilter[] = filtersData || [];

    const filteredPersonIds = sensitivityFilters
      .filter((f) => f.filter_type === "person" && f.person_id)
      .map((f) => f.person_id);

    const filteredTopics = sensitivityFilters
      .filter((f) => f.filter_type === "topic")
      .map((f) => f.filter_value.toLowerCase());

    const filteredTimePeriods = sensitivityFilters
      .filter((f) => f.filter_type === "time_period")
      .map((f) => ({ start: f.start_date, end: f.end_date }));

    const { data: recentMedia } = await supabase
      .from("media")
      .select("id, file_url, description, taken_at")
      .eq("user_id", userId)
      .eq("verification_status", "verified")
      .not("description", "is", null)
      .order("taken_at", { ascending: false })
      .limit(10);

    if (recentMedia && recentMedia.length > 0) {
      // Fetch tagged people for these photos
      const mediaIds = recentMedia.map((m) => m.id);
      const mediaPersonIds: Record<string, string[]> = {};

      if (mediaIds.length > 0) {
        const { data: mediaPeopleData } = await supabase
          .from("media_people")
          .select("media_id, person_id")
          .in("media_id", mediaIds);

        (mediaPeopleData || []).forEach((mp: any) => {
          if (!mediaPersonIds[mp.media_id]) mediaPersonIds[mp.media_id] = [];
          if (mp.person_id) mediaPersonIds[mp.media_id].push(mp.person_id);
        });
      }

      // Apply sensitivity filters
      const safePhotos = recentMedia.filter((m) => {
        // Exclude photos linked to filtered people
        const personIds = mediaPersonIds[m.id] || [];
        if (personIds.some((pid) => filteredPersonIds.includes(pid))) return false;

        // Exclude photos with descriptions containing filtered topics
        if (m.description && filteredTopics.some((topic) => m.description!.toLowerCase().includes(topic))) return false;

        // Exclude photos taken during filtered time periods
        if (m.taken_at) {
          const photoDate = m.taken_at.split("T")[0];
          if (
            filteredTimePeriods.some((period) => {
              if (!period.start || !period.end) return false;
              return photoDate >= period.start && photoDate <= period.end;
            })
          )
            return false;
        }

        return true;
      });

      const memorySlidePhotos = safePhotos.slice(0, 5);

      if (memorySlidePhotos.length > 0) {
        memorySlidePhotos.forEach((photo) => {
          if (photo.file_url && !fallbackPhotoPool.includes(photo.file_url)) {
            fallbackPhotoPool.push(photo.file_url);
          }
        });

        briefingSlides.push({
          text: "Some memories from your life",
          photoUrl: memorySlidePhotos[0]?.file_url,
        });

        const memoryIntros = [
          "Here's a memory",
          "A moment from your life",
          "Something to remember",
          "A special moment",
          "From your photo collection",
        ];

        memorySlidePhotos.forEach((photo, i) => {
          briefingSlides.push({
            text: memoryIntros[i % memoryIntros.length],
            subtitle: photo.description!,
            photoUrl: photo.file_url,
          });
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
        photoUrl: fallbackPhotoPool[0] || user.photo_url || undefined,
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
        photoUrl: fallbackPhotoPool[1] || fallbackPhotoPool[0] || user.photo_url || undefined,
      });
    }

    // End
    briefingSlides.push({
      text: "That's your briefing for today",
      subtitle: "Have a wonderful day!",
      photoUrl: user.photo_url || undefined,
    });

    // Ensure every applicable slide has a photo when we have one available.
    const normalizedSlides = briefingSlides.map((slide, idx) => {
      if (slide.photoUrl) return slide;

      const poolPhoto = fallbackPhotoPool[idx % (fallbackPhotoPool.length || 1)];
      if (poolPhoto) {
        return { ...slide, photoUrl: poolPhoto };
      }

      if (user.photo_url) {
        return { ...slide, photoUrl: user.photo_url };
      }

      return slide;
    });

    setSlides(normalizedSlides);
    setLoading(false);
  }

  async function speakSlide(slide: BriefingSlide) {
    const fullText = slide.ttsOverride
      ? slide.ttsOverride
      : slide.subtitle
      ? `${slide.text}. ${slide.subtitle}`
      : slide.text;

    setSpeaking(true);
    await tts.speak(fullText, {
      onDone: () => setSpeaking(false),
    });

    // Pre-warm the next slide's audio so navigation feels instant.
    const next = slides[currentSlide + 1];
    if (next) {
      const nextText = next.ttsOverride
        ? next.ttsOverride
        : next.subtitle
        ? `${next.text}. ${next.subtitle}`
        : next.text;
      tts.prewarm(nextText);
    }
  }

  function nextSlide() {
    tts.stop();
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      // Final slide → mark the AI briefing delivered (no-op if we're
      // on the procedural fallback path).
      const id = aiBriefingIdRef.current;
      if (id) {
        markDelivered(id);
        aiBriefingIdRef.current = null;
      }
      navigation.goBack();
    }
  }

  function prevSlide() {
    tts.stop();
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
      <View testID="briefing-loading" style={styles.container}>
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
    <View testID="briefing-screen" style={styles.container}>
      {/* Progress */}
      <View testID="briefing-progress-bar" style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentSlide + 1) / slides.length) * 100}%` },
          ]}
        />
      </View>

      <TouchableOpacity testID="briefing-exit-button" style={styles.exitButton} onPress={handleExit}>
        <Text style={styles.exitButtonText}>✕</Text>
      </TouchableOpacity>

      {/* Content */}
      <View testID="briefing-slide-content" style={styles.slideContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {slide.photoUrl && (
            <BriefingPhoto
              uri={slide.photoUrl}
              style={styles.photo}
              onTap={() => openLightbox({ photoUrl: slide.photoUrl! })}
            />
          )}
          <Text testID="briefing-slide-text" style={styles.mainText}>{slide.text}</Text>
          {slide.subtitle && (
            <Text testID="briefing-slide-subtitle" style={styles.subtitleText}>{slide.subtitle}</Text>
          )}
        </Animated.View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          testID="briefing-prev-button"
          style={[styles.navButton, currentSlide === 0 && styles.navButtonDisabled]}
          onPress={prevSlide}
          disabled={currentSlide === 0}
        >
          <Text style={styles.navButtonText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity testID="briefing-replay-button" style={styles.replayButton} onPress={replaySlide}>
          <Text style={styles.replayButtonText}>🔊</Text>
        </TouchableOpacity>

        <TouchableOpacity testID="briefing-next-button" style={styles.navButton} onPress={nextSlide}>
          <Text style={styles.navButtonText}>
            {currentSlide === slides.length - 1 ? "Done" : "Next →"}
          </Text>
        </TouchableOpacity>
      </View>
      {lightbox}
    </View>
  );
}

function BriefingPhoto({
  uri,
  style,
  onTap,
}: {
  uri: string;
  style: any;
  onTap: () => void;
}) {
  const handlePress = useTapToOpen(onTap);
  const [broken, setBroken] = useState(false);
  if (broken || !uri || !uri.startsWith("http")) {
    return null;
  }
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <Image source={{ uri }} style={style} onError={() => setBroken(true)} />
    </TouchableOpacity>
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
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: "#000",
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
