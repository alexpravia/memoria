import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, border, type } from "../../theme";
import Icon, { IconName } from "../../components/Icon";
import { AnimatedEntrance, SpringPressable } from "../../motion/primitives";
import { useIntensity } from "../../motion/IntensityContext";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const automationIds = {
  screen: "co-user-home-screen",
  viewLifeFactsCard: "co-user-home-view-life-facts",
  viewPeopleCard: "co-user-home-view-people",
  viewEventsCard: "co-user-home-view-events",
  viewPhotosCard: "co-user-home-view-photos",
  addLifeFactsButton: "co-user-home-add-life-facts",
  addPeopleButton: "co-user-home-add-people",
  addEventsButton: "co-user-home-add-events",
  importContactsButton: "co-user-home-import-contacts",
  importCalendarButton: "co-user-home-import-calendar",
  importPhotosButton: "co-user-home-import-photos",
  reviewQueueButton: "co-user-home-review-queue",
  pendingFlagsBadge: "co-user-home-pending-flags-badge",
  sensitivityFiltersButton: "co-user-home-sensitivity-filters",
  aiMemoryButton: "co-user-home-ai-memory",
  briefingPreviewButton: "co-user-home-briefing-preview",
  setupUserLoginButton: "co-user-home-setup-user-login",
  emergencyContactSettingsButton: "co-user-home-emergency-contact-settings",
  signOutButton: "co-user-home-sign-out",
} as const;

// ---------- BreathingBadge ----------
// Small red count badge that gently breathes (scale 1 ↔ 1.06) when intensity
// is on, otherwise renders static. Used for the Review Queue pending count.
function BreathingBadge({ count, testID }: { count: number; testID: string }) {
  const { on, speed } = useIntensity();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!on) {
      scale.value = 1;
      return;
    }
    const dur = 3000 / speed; // base 3 s half-cycle
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(scale);
  }, [on, speed]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.badge, aStyle]} testID={testID}>
      <Text style={styles.badgeText}>{count}</Text>
    </Animated.View>
  );
}

// ---------- ActionCard ----------
// One full-width nav card: rounded-square icon tile + title + subtitle +
// forward chevron. The hero variant uses a solid purple fill, white text,
// and a purple glow shadow.
interface ActionCardProps {
  icon: IconName;
  label: string;
  subtitle?: string;
  hero?: boolean;
  badge?: number;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
}

function ActionCard({
  icon,
  label,
  subtitle,
  hero = false,
  badge,
  onPress,
  testID,
  accessibilityLabel,
}: ActionCardProps) {
  return (
    <SpringPressable
      cardMode
      onPress={onPress}
      style={[styles.card, hero && styles.cardHero]}
    >
      <View
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.cardInner}
      >
        <View style={[styles.iconTile, hero && styles.iconTileHero]}>
          <Icon
            name={icon}
            size={26}
            color={hero ? colors.fgStrong : colors.primarySoft}
            accentColor={hero ? colors.fgStrong : colors.primary}
          />
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, hero && styles.cardTitleHero]}>
            {label}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.cardSubtitle, hero && styles.cardSubtitleHero]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge !== undefined && badge > 0 ? (
          <BreathingBadge count={badge} testID={automationIds.pendingFlagsBadge} />
        ) : null}
        <Icon
          name="forward"
          size={20}
          color={hero ? colors.fgStrong : colors.fgMuted}
        />
      </View>
    </SpringPressable>
  );
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type BriefingStatus = "draft" | "approved" | "delivered" | "failed" | null;

const BRIEFING_SUBTITLES: Record<NonNullable<BriefingStatus> | "none", string> = {
  draft:     "Ready to review",
  approved:  "Approved ✓",
  delivered: "Delivered ✓",
  failed:    "Generation failed — tap to fix",
  none:      "Generates automatically overnight",
};

export default function CoUserHomeScreen({ navigation }: Props) {
  const { userId, signOut } = useAuth();
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({
    lifeFacts: 0,
    people: 0,
    events: 0,
    photos: 0,
  });
  const [pendingFlags, setPendingFlags] = useState(0);
  const [hasUserLogin, setHasUserLogin] = useState(false);
  const [briefingStatus, setBriefingStatus] = useState<BriefingStatus>(null);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (userId) loadData();
    });

    return unsubscribe;
  }, [navigation, userId]);

  async function loadData() {
    const { data: user } = await supabase
      .from("users")
      .select("full_name, auth_id")
      .eq("id", userId)
      .single();

    if (user) {
      setUserName(user.full_name);
      setHasUserLogin(!!user.auth_id);
    }

    const { count: lifeFacts } = await supabase
      .from("life_facts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: people } = await supabase
      .from("people")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: events } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: photos } = await supabase
      .from("media")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    setStats({
      lifeFacts: lifeFacts || 0,
      people: people || 0,
      events: events || 0,
      photos: photos || 0,
    });

    const { count: flagCount } = await supabase
      .from("flag_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");

    setPendingFlags(flagCount || 0);

    // Check tomorrow's briefing status so the hero card reflects reality.
    const { data: briefingRow } = await supabase
      .from("briefings")
      .select("status")
      .eq("user_id", userId)
      .eq("briefing_date", tomorrowISO())
      .maybeSingle();

    setBriefingStatus((briefingRow?.status as BriefingStatus) ?? null);
  }

  async function handleSignOut() {
    await signOut();
  }

  // Build the grouped card model from real data. Each entry preserves its
  // existing navigation target, testID, and accessibility label.
  const sections: {
    label: string;
    cards: ActionCardProps[];
  }[] = [
    {
      label: "Main",
      cards: [
        {
          icon: "sparkle",
          label: "Tomorrow's Briefing",
          subtitle: BRIEFING_SUBTITLES[briefingStatus ?? "none"],
          hero: true,
          onPress: () => navigation.navigate("BriefingPreview"),
          testID: automationIds.briefingPreviewButton,
          accessibilityLabel: "Tomorrow's briefing",
        },
        {
          icon: "photos",
          label: "Photos",
          subtitle: `${stats.photos} · ${pendingFlags} pending`,
          onPress: () => navigation.navigate("ViewPhotos"),
          testID: automationIds.viewPhotosCard,
          accessibilityLabel: "Photos overview",
        },
        {
          icon: "contacts",
          label: "People",
          subtitle: `${stats.people} people`,
          onPress: () => navigation.navigate("ViewPeople"),
          testID: automationIds.viewPeopleCard,
          accessibilityLabel: "People overview",
        },
        {
          icon: "calendar",
          label: "Events",
          subtitle: `${stats.events} this week`,
          onPress: () => navigation.navigate("ViewEvents"),
          testID: automationIds.viewEventsCard,
          accessibilityLabel: "Events overview",
        },
        {
          icon: "notes",
          label: "Memo's Notes",
          subtitle: `${stats.lifeFacts} learned facts`,
          onPress: () => navigation.navigate("AIMemory"),
          testID: automationIds.aiMemoryButton,
          accessibilityLabel: "Memo's Notes",
        },
        {
          icon: "review",
          label: "Review Queue",
          subtitle: `${pendingFlags} to review`,
          badge: pendingFlags,
          onPress: () => navigation.navigate("FlagQueue"),
          testID: automationIds.reviewQueueButton,
          accessibilityLabel: "Review queue",
        },
        {
          icon: "safety",
          label: "Safety & Filters",
          subtitle: "Sensitivity settings",
          onPress: () => navigation.navigate("SensitivityFilters"),
          testID: automationIds.sensitivityFiltersButton,
          accessibilityLabel: "Sensitivity filters",
        },
      ],
    },
    {
      label: "Add",
      cards: [
        {
          icon: "add",
          label: "Add Life Facts",
          subtitle: `${stats.lifeFacts} life facts`,
          onPress: () => navigation.navigate("AddLifeFacts", { userId }),
          testID: automationIds.addLifeFactsButton,
          accessibilityLabel: "Add life facts",
        },
        {
          icon: "add",
          label: "Add People",
          subtitle: `${stats.people} people`,
          onPress: () => navigation.navigate("AddPeople", { userId }),
          testID: automationIds.addPeopleButton,
          accessibilityLabel: "Add people",
        },
        {
          icon: "add",
          label: "Add Events",
          subtitle: `${stats.events} events`,
          onPress: () => navigation.navigate("AddEvents", { userId }),
          testID: automationIds.addEventsButton,
          accessibilityLabel: "Add events",
        },
      ],
    },
    {
      label: "Import",
      cards: [
        {
          icon: "contacts",
          label: "Import Contacts",
          subtitle: "From this device",
          onPress: () => navigation.navigate("ImportContacts"),
          testID: automationIds.importContactsButton,
          accessibilityLabel: "Import contacts",
        },
        {
          icon: "calendar",
          label: "Import Calendar",
          subtitle: "From this device",
          onPress: () => navigation.navigate("ImportCalendar"),
          testID: automationIds.importCalendarButton,
          accessibilityLabel: "Import calendar events",
        },
        {
          icon: "photos",
          label: "Import Photos",
          subtitle: "From this device",
          onPress: () => navigation.navigate("ImportPhotos"),
          testID: automationIds.importPhotosButton,
          accessibilityLabel: "Import photos",
        },
      ],
    },
    {
      label: "Settings & Tools",
      cards: [
        {
          icon: "notes",
          label: "Life Facts",
          subtitle: `${stats.lifeFacts} saved`,
          onPress: () => navigation.navigate("ViewLifeFacts"),
          testID: automationIds.viewLifeFactsCard,
          accessibilityLabel: "Life facts overview",
        },
        {
          icon: "login",
          label: hasUserLogin ? "Set Up Another User" : "Set Up Their Login",
          subtitle: hasUserLogin
            ? "Add another user login"
            : "Create a login for them",
          onPress: () => navigation.navigate("SetupUserLogin"),
          testID: automationIds.setupUserLoginButton,
          accessibilityLabel: "User login setup",
        },
        {
          icon: "call",
          label: "Emergency Contact Number",
          subtitle: "Who to call for help",
          onPress: () => navigation.navigate("EmergencyContactSettings"),
          testID: automationIds.emergencyContactSettingsButton,
          accessibilityLabel: "Emergency contact settings",
        },
      ],
    },
  ];

  // Flatten so entrance stagger increments continuously across sections.
  let cardIndex = 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID={automationIds.screen}
      accessibilityLabel="Co-user dashboard"
      accessibilityHint="Shows dashboard controls for managing the user's experience"
    >
      {/* Header */}
      <AnimatedEntrance index={0}>
        <Text style={styles.eyebrow}>Helper dashboard</Text>
        <Text style={styles.title}>
          {userName ? `${userName}'s Memoria` : "Your Memoria"}
        </Text>
      </AnimatedEntrance>

      {sections.map((section) => (
        <View key={section.label} style={styles.section}>
          <AnimatedEntrance index={(cardIndex += 1)} cardMode>
            <Text style={styles.sectionLabel}>{section.label}</Text>
          </AnimatedEntrance>
          {section.cards.map((card) => (
            <AnimatedEntrance
              key={card.testID}
              index={(cardIndex += 1)}
              cardMode
              style={styles.cardSpacing}
            >
              <ActionCard {...card} />
            </AnimatedEntrance>
          ))}
        </View>
      ))}

      {/* Sign out */}
      <AnimatedEntrance index={(cardIndex += 1)} cardMode style={styles.signOutWrap}>
        <SpringPressable onPress={handleSignOut} style={styles.signOutButton}>
          <View
            testID={automationIds.signOutButton}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={styles.signOutInner}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </View>
        </SpringPressable>
      </AnimatedEntrance>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 64,
    paddingBottom: 48,
  },

  // Header
  eyebrow: {
    fontSize: type.sm,
    color: colors.primarySoft,
    fontWeight: type.weightMedium,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: type.title,
    fontWeight: type.weightBold,
    color: colors.fg,
    marginTop: 4,
  },

  // Sections
  section: {
    marginTop: 22,
  },
  sectionLabel: {
    fontSize: type.sm,
    fontWeight: type.weightMedium,
    color: colors.primarySoft,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  cardSpacing: {
    marginBottom: 14,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  cardHero: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.surfaceSunk,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileHero: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: type.lg,
    fontWeight: type.weightMedium,
    color: colors.fg,
  },
  cardTitleHero: {
    color: colors.fgStrong,
  },
  cardSubtitle: {
    fontSize: type.sm,
    color: colors.fgMuted,
    marginTop: 2,
  },
  cardSubtitleHero: {
    color: "rgba(255,255,255,0.8)",
  },

  // Review badge
  badge: {
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    color: colors.fgStrong,
    fontSize: type.xs,
    fontWeight: type.weightBold,
  },

  // Sign out
  signOutWrap: {
    marginTop: 18,
  },
  signOutButton: {
    borderWidth: border.thin,
    borderColor: colors.danger,
    backgroundColor: "transparent",
    borderRadius: radius.lg,
    paddingVertical: 15,
  },
  signOutInner: {
    alignItems: "center",
  },
  signOutText: {
    fontSize: type.md,
    color: colors.danger,
    fontWeight: type.weightMedium,
  },
});
