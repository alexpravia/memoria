import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as tts from "../../lib/tts";
import { supabase } from "@memoria/core";
import { useAuth } from "@memoria/core";
import { SensitivityFilter } from "@memoria/core";
import { usePhotoLightbox, useTapToOpen } from "../../components/usePhotoLightbox";
import Icon from "../../components/Icon";
import {
  getTodaysBriefing,
  resolveSlidePhotos,
  markDelivered,
  type BriefingSlide as AIBriefingSlide,
} from "@memoria/core";
import {
  BrandLoader,
  AliveEmptyState,
  SpringPressable,
} from "../../motion/primitives";
import { ShimmerButton } from "../../motion/ui";
import { useIntensity } from "../../motion/IntensityContext";
import { colors, radius } from "@memoria/core";

interface BriefingSlide {
  text: string;
  subtitle?: string;
  photoUrl?: string;
  // Optional spoken-text override. Used by the AI path so the model's
  // warmer `tts_text` is read aloud instead of the on-screen body.
  ttsOverride?: string;
}

function mapAISlide(s: AIBriefingSlide): BriefingSlide {
  return {
    text: s.title,
    subtitle: s.body,
    photoUrl: s.photo_url,
    ttsOverride: s.tts_text,
  };
}

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

// ---------- KenBurnsPhoto ----------
// Slow zoom + pan while the slide is displayed. A soft warm light-leak sits
// over the photo (matching the prototype's grain/light overlay). The Ken
// Burns transform resets on every slide change and slowly drifts.

function KenBurnsPhoto({
  uri,
  onTap,
}: {
  uri: string;
  onTap: () => void;
}) {
  const { on, speed } = useIntensity();
  const handlePress = useTapToOpen(onTap);
  const [broken, setBroken] = useState(false);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    tx.value = 0;
    if (!on) return;
    // base 16s / speed, ease-in-out, slow zoom 1 -> ~1.12 with slight pan.
    const dur = 16000 / speed;
    scale.value = withRepeat(
      withTiming(1.12, { duration: dur, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    tx.value = withRepeat(
      withTiming(12, { duration: dur, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(tx);
    };
  }, [uri, on]);

  const kbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: tx.value }],
  }));

  if (broken || !uri || !uri.startsWith("http")) return null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={styles.photoOuter}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, kbStyle]}>
        <Image
          source={{ uri }}
          style={styles.photoInner}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
      </Animated.View>
      {/* soft warm light-leak across the top of the photo */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,240,210,0.22)", "transparent"]}
        start={{ x: 0.7, y: 0 }}
        end={{ x: 0.3, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />
    </TouchableOpacity>
  );
}

// ---------- SpeakingRing ----------
// Two to three staggered pulse rings expand out from the replay button while
// TTS speaks, matching the prototype's soft "speaking" halo.

function PulseRing({ delay, speaking }: { delay: number; speaking: boolean }) {
  const { on, speed } = useIntensity();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!on || !speaking) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
      return;
    }
    // base 2.6s / speed per ring, ease-out, staggered start.
    const dur = 2600 / speed;
    const start = delay / speed;
    scale.value = withDelay(
      start,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1 }),
          withTiming(1.9, { duration: dur, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      start,
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1 }),
          withTiming(0, { duration: dur, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      )
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [speaking, on, speed, delay]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.speakingRing, ringStyle]}
    />
  );
}

function SpeakingRing({ speaking }: { speaking: boolean }) {
  return (
    <>
      <PulseRing delay={0} speaking={speaking} />
      <PulseRing delay={850} speaking={speaking} />
      <PulseRing delay={1700} speaking={speaking} />
    </>
  );
}

// ---------- BriefingScreen ----------

export default function BriefingScreen({ navigation }: any) {
  const { userId } = useAuth();
  const { on, speed } = useIntensity();
  const [slides, setSlides] = useState<BriefingSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const { open: openLightbox, lightbox } = usePhotoLightbox();
  const aiBriefingIdRef = useRef<string | null>(null);

  // Cross-dissolve + rise shared values. Reset then settle on each slide.
  const slideOpacity = useSharedValue(0);
  const slideTy = useSharedValue(22);
  const slideScale = useSharedValue(0.985);
  const slideStyle = useAnimatedStyle(() => ({
    opacity: slideOpacity.value,
    transform: [{ translateY: slideTy.value }, { scale: slideScale.value }],
  }));

  // Section tint wash. Fades in per slide change; cycles a calm on-palette hue.
  const tintOpacity = useSharedValue(0);
  const tintStyle = useAnimatedStyle(() => ({ opacity: tintOpacity.value }));

  // Progress bar fill. Springs to width with a purple glow.
  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

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

    try {
      const ai = await getTodaysBriefing(userId);
      if (ai && ai.slides && ai.slides.length > 0) {
        const resolved = await resolveSlidePhotos(ai.slides);

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

        const { data: userRow } = await supabase
          .from("users")
          .select("photo_url")
          .eq("id", userId)
          .single();
        const userPhoto = (userRow?.photo_url as string | undefined | null) ?? null;

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

    await buildBriefing();
  }

  useEffect(() => {
    if (slides.length > 0 && currentSlide < slides.length) {
      animateSlide();
      speakSlide(slides[currentSlide]);
    }
  }, [currentSlide, slides]);

  function animateSlide() {
    // cross-dissolve + rise: opacity 0->1, translateY 22->0, scale .985->1.
    const dur = on ? 650 / speed : 1;
    const ease = Easing.bezier(0.2, 0.7, 0.3, 1);
    slideOpacity.value = 0;
    slideTy.value = on ? 22 : 0;
    slideScale.value = on ? 0.985 : 1;
    slideOpacity.value = withTiming(1, { duration: dur, easing: ease });
    slideTy.value = withTiming(0, { duration: dur, easing: ease });
    slideScale.value = withTiming(1, { duration: dur, easing: ease });

    // section tint wash fades in (base 1.1s).
    tintOpacity.value = 0;
    tintOpacity.value = on
      ? withTiming(0.85, { duration: 1100 / speed, easing: Easing.ease })
      : withTiming(0.85, { duration: 1 });

    // progress bar fills with a spring-ish glide.
    const pct = slides.length > 0 ? (currentSlide + 1) / slides.length : 0;
    progress.value = withTiming(pct, {
      duration: on ? 700 / speed : 1,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }

  function handleExit() {
    tts.stop();
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

    if (user.location) {
      briefingSlides.push({
        text: `You live in ${user.location}`,
        photoUrl: user.photo_url || undefined,
      });
    }

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

    const { data: people } = await supabase
      .from("people")
      .select("*")
      .eq("user_id", userId);

    if (people && people.length > 0) {
      const peopleWithoutPhoto = people.filter((p) => !p.photo_url);
      const fallbackPhotoMap: Record<string, string> = {};

      if (peopleWithoutPhoto.length > 0) {
        const { data: mediaPeoplePhotos } = await supabase
          .from("media_people")
          .select("person_id, media(file_url, verification_status)")
          .in("person_id", peopleWithoutPhoto.map((p) => p.id))
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
        if (url && !fallbackPhotoPool.includes(url)) fallbackPhotoPool.push(url);
      });

      briefingSlides.push({ text: "The important people in your life" });

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

      const safePhotos = recentMedia.filter((m) => {
        const personIds = mediaPersonIds[m.id] || [];
        if (personIds.some((pid) => filteredPersonIds.includes(pid))) return false;
        if (m.description && filteredTopics.some((topic) => m.description!.toLowerCase().includes(topic))) return false;
        if (m.taken_at) {
          const photoDate = m.taken_at.split("T")[0];
          if (filteredTimePeriods.some((period) => {
            if (!period.start || !period.end) return false;
            return photoDate >= period.start && photoDate <= period.end;
          })) return false;
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
        subtitle: upcomingEvents.map((e) => {
          const d = new Date(e.event_date).toLocaleDateString("en-US", {
            weekday: "long", month: "short", day: "numeric",
          });
          return `${d}: ${e.title}`;
        }).join("\n\n"),
        photoUrl: fallbackPhotoPool[1] || fallbackPhotoPool[0] || user.photo_url || undefined,
      });
    }

    briefingSlides.push({
      text: "That's your briefing for today",
      subtitle: "Have a wonderful day!",
      photoUrl: user.photo_url || undefined,
    });

    const normalizedSlides = briefingSlides.map((slide, idx) => {
      if (slide.photoUrl) return slide;
      const poolPhoto = fallbackPhotoPool[idx % (fallbackPhotoPool.length || 1)];
      if (poolPhoto) return { ...slide, photoUrl: poolPhoto };
      if (user.photo_url) return { ...slide, photoUrl: user.photo_url };
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
    await tts.speak(fullText, { onDone: () => setSpeaking(false) });

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
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  }

  function replaySlide() {
    if (slides[currentSlide]) speakSlide(slides[currentSlide]);
  }

  // Per-slide tint wash colors — cycled from the on-palette purple ramp so the
  // section tint shifts gently as in the prototype, without new hardcoded hex.
  const TINT_COLORS = [
    colors.primaryDeep,
    colors.primary,
    colors.surfaceRaised,
    colors.primaryDeep,
  ];
  const tintColor = TINT_COLORS[currentSlide % TINT_COLORS.length];

  // ---------- Render ----------

  if (loading) {
    return (
      <View testID="briefing-loading" style={styles.loadingContainer}>
        <BrandLoader caption="Preparing your briefing…" />
      </View>
    );
  }

  if (slides.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <AliveEmptyState
          message="No information available yet"
          caption="Ask your helper to add some information about you"
        />
        <ShimmerButton
          label="Go Back"
          icon="back"
          hero
          onPress={() => navigation.goBack()}
          style={styles.emptyButton}
        />
      </View>
    );
  }

  const slide = slides[currentSlide];

  return (
    <View testID="briefing-screen" style={styles.container}>
      {/* Section ambient tint wash — fades in on each slide change */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, tintStyle]}
      >
        <LinearGradient
          colors={[tintColor + "66", colors.bg]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.7 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Progress bar */}
      <View testID="briefing-progress-bar" style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            on && styles.progressFillGlow,
            progressStyle,
          ]}
        />
      </View>

      <SpringPressable onPress={handleExit} style={styles.exitButton}>
        <View testID="briefing-exit-button">
          <Icon name="close" size={20} color={colors.danger} />
        </View>
      </SpringPressable>

      {/* Slide content with cross-dissolve + rise */}
      <View testID="briefing-slide-content" style={styles.slideContent}>
        <Animated.View style={[styles.slideInner, slideStyle]}>
          {slide.photoUrl ? (
            <KenBurnsPhoto
              uri={slide.photoUrl}
              onTap={() => openLightbox({ photoUrl: slide.photoUrl! })}
            />
          ) : null}
          <Text testID="briefing-slide-text" style={styles.mainText}>
            {slide.text}
          </Text>
          {slide.subtitle ? (
            <Text testID="briefing-slide-subtitle" style={styles.subtitleText}>
              {slide.subtitle}
            </Text>
          ) : null}
        </Animated.View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <SpringPressable
          disabled={currentSlide === 0}
          onPress={prevSlide}
          style={[styles.navButton, currentSlide === 0 && styles.navButtonDisabled]}
        >
          <View testID="briefing-prev-button" style={styles.navButtonRow}>
            <Icon name="back" size={20} color={colors.fg} />
            <Text style={styles.navButtonText}>Back</Text>
          </View>
        </SpringPressable>

        {/* Replay button with speaking ring */}
        <View style={styles.replayOuter}>
          <SpeakingRing speaking={speaking} />
          <SpringPressable onPress={replaySlide} style={styles.replayButton}>
            <View testID="briefing-replay-button">
              <Icon name="listen" size={26} color={colors.fgStrong} />
            </View>
          </SpringPressable>
        </View>

        <SpringPressable onPress={nextSlide} style={styles.navButton}>
          <View testID="briefing-next-button" style={styles.navButtonRow}>
            <Text style={styles.navButtonText}>
              {currentSlide === slides.length - 1 ? "Done" : "Next"}
            </Text>
            <Icon name="forward" size={20} color={colors.fg} />
          </View>
        </SpringPressable>
      </View>
      {lightbox}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    overflow: "hidden",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: 40,
  },
  emptyButton: {
    marginTop: 28,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    position: "absolute",
    top: 60,
    left: 32,
    right: 32,
    zIndex: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressFillGlow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  exitButton: {
    position: "absolute",
    top: 80,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  slideContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    zIndex: 3,
  },
  slideInner: {
    width: "100%",
    alignItems: "center",
  },
  // Photo container: fixed aspect ratio, clips Ken Burns overflow
  photoOuter: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    marginBottom: 24,
    backgroundColor: "#000",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  photoInner: {
    width: "100%",
    height: "100%",
  },
  mainText: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.fg,
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 38,
  },
  subtitleText: {
    fontSize: 20,
    color: colors.primarySoft,
    textAlign: "center",
    lineHeight: 30,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 28,
    zIndex: 6,
  },
  navButton: {
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: radius.md,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.fg,
  },
  replayOuter: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  replayButton: {
    backgroundColor: colors.primary,
    width: 60,
    height: 60,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  speakingRing: {
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});
