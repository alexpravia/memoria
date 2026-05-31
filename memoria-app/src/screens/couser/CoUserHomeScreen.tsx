import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, border, type } from "../../theme";
import Icon, { IconName } from "../../components/Icon";

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
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID={automationIds.screen}
      accessibilityLabel="Co-user dashboard"
      accessibilityHint="Shows dashboard controls for managing the user's experience"
    >
      <Text style={styles.title}>Helper Dashboard</Text>
      <Text style={styles.subtitle}>
        Managing {userName ? userName + "'s" : "your loved one's"} experience
      </Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("ViewLifeFacts")}
          testID={automationIds.viewLifeFactsCard}
          accessibilityRole="button"
          accessibilityLabel="Life facts overview"
          accessibilityHint="Opens the saved life facts screen"
        >
          <Text style={styles.statNumber}>{stats.lifeFacts}</Text>
          <Text style={styles.statLabel}>Life Facts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("ViewPeople")}
          testID={automationIds.viewPeopleCard}
          accessibilityRole="button"
          accessibilityLabel="People overview"
          accessibilityHint="Opens the saved people screen"
        >
          <Text style={styles.statNumber}>{stats.people}</Text>
          <Text style={styles.statLabel}>People</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("ViewEvents")}
          testID={automationIds.viewEventsCard}
          accessibilityRole="button"
          accessibilityLabel="Events overview"
          accessibilityHint="Opens the saved events screen"
        >
          <Text style={styles.statNumber}>{stats.events}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate("ViewPhotos")}
          testID={automationIds.viewPhotosCard}
          accessibilityRole="button"
          accessibilityLabel="Photos overview"
          accessibilityHint="Opens the saved photos screen"
        >
          <Text style={styles.statNumber}>{stats.photos}</Text>
          <Text style={styles.statLabel}>Photos</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("AddLifeFacts", { userId })}
        testID={automationIds.addLifeFactsButton}
        accessibilityRole="button"
        accessibilityLabel="Add life facts"
        accessibilityHint="Opens the add life facts screen"
      >
        <Text style={styles.actionButtonText}>+ Add Life Facts</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("AddPeople", { userId })}
        testID={automationIds.addPeopleButton}
        accessibilityRole="button"
        accessibilityLabel="Add people"
        accessibilityHint="Opens the add people screen"
      >
        <Text style={styles.actionButtonText}>+ Add People</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("AddEvents", { userId })}
        testID={automationIds.addEventsButton}
        accessibilityRole="button"
        accessibilityLabel="Add events"
        accessibilityHint="Opens the add events screen"
      >
        <Text style={styles.actionButtonText}>+ Add Events</Text>
      </TouchableOpacity>

      {/* Import section */}
      <Text style={styles.sectionTitle}>Import From Device</Text>

      <TouchableOpacity
        style={styles.importButton}
        onPress={() => navigation.navigate("ImportContacts")}
        testID={automationIds.importContactsButton}
        accessibilityRole="button"
        accessibilityLabel="Import contacts"
        accessibilityHint="Opens the contacts import screen"
      >
        <Icon name="contacts" size={18} color={colors.primarySoft} />
          <Text style={styles.actionButtonText}>Import Contacts</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.importButton}
        onPress={() => navigation.navigate("ImportCalendar")}
        testID={automationIds.importCalendarButton}
        accessibilityRole="button"
        accessibilityLabel="Import calendar events"
        accessibilityHint="Opens the calendar import screen"
      >
        <Icon name="calendar" size={18} color={colors.primarySoft} />
          <Text style={styles.actionButtonText}>Import Calendar Events</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.importButton}
        onPress={() => navigation.navigate("ImportPhotos")}
        testID={automationIds.importPhotosButton}
        accessibilityRole="button"
        accessibilityLabel="Import photos"
        accessibilityHint="Opens the photos import screen"
      >
        <Icon name="photos" size={18} color={colors.primarySoft} />
          <Text style={styles.actionButtonText}>Import Photos</Text>
      </TouchableOpacity>

      {/* Safety & Settings */}
      <Text style={styles.sectionTitle}>Safety & Settings</Text>

      <TouchableOpacity
        style={styles.safetyButton}
        onPress={() => navigation.navigate("FlagQueue")}
        testID={automationIds.reviewQueueButton}
        accessibilityRole="button"
        accessibilityLabel="Review queue"
        accessibilityHint="Opens the pending review queue"
      >
        <View style={styles.flagRow}>
          <Icon name="review" size={18} color={colors.danger} />
            <Text style={styles.actionButtonText}>Review Queue</Text>
          {pendingFlags > 0 && (
            <View style={styles.badge} testID={automationIds.pendingFlagsBadge}>
              <Text style={styles.badgeText}>{pendingFlags}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.safetyButton}
        onPress={() => navigation.navigate("SensitivityFilters")}
        testID={automationIds.sensitivityFiltersButton}
        accessibilityRole="button"
        accessibilityLabel="Sensitivity filters"
        accessibilityHint="Opens the sensitivity filters screen"
      >
        <Icon name="safety" size={18} color={colors.danger} />
          <Text style={styles.actionButtonText}>Sensitivity Filters</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.safetyButton}
        onPress={() => navigation.navigate("AIMemory")}
        testID={automationIds.aiMemoryButton}
        accessibilityRole="button"
        accessibilityLabel="Memo's Notes"
        accessibilityHint="Opens what Memo remembers about your loved one"
      >
        <Icon name="notes" size={18} color={colors.danger} />
          <Text style={styles.actionButtonText}>Memo's Notes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.safetyButton}
        onPress={() => navigation.navigate("BriefingPreview")}
        testID={automationIds.briefingPreviewButton}
        accessibilityRole="button"
        accessibilityLabel="Tomorrow's briefing"
        accessibilityHint="Generate, review, and approve tomorrow's morning briefing"
      >
        <Icon name="calendar" size={18} color={colors.danger} />
          <Text style={styles.actionButtonText}>Tomorrow's Briefing</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.safetyButton}
        onPress={() => navigation.navigate("SetupUserLogin")}
        testID={automationIds.setupUserLoginButton}
        accessibilityRole="button"
        accessibilityLabel="User login setup"
        accessibilityHint="Opens the screen to create or update the user's login"
      >
        <Icon name="login" size={18} color={colors.danger} />
        <Text style={styles.actionButtonText}>{hasUserLogin ? "Set Up Another User" : "Set Up Their Login"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.safetyButton}
        onPress={() => navigation.navigate("EmergencyContactSettings")}
        testID={automationIds.emergencyContactSettingsButton}
        accessibilityRole="button"
        accessibilityLabel="Emergency contact settings"
        accessibilityHint="Opens emergency contact settings"
      >
        <Icon name="call" size={18} color={colors.danger} />
          <Text style={styles.actionButtonText}>Emergency Contact Number</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        testID={automationIds.signOutButton}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityHint="Signs out of the co-user account and returns to login"
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 60,
  },
  title: {
    fontSize: type.title,
    fontWeight: type.weightBold,
    color: colors.primarySoft,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: type.lg,
    color: colors.fg,
    marginBottom: 32,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 3,
  },
  statNumber: {
    fontSize: type.h2,
    fontWeight: type.weightBold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: type.xxs,
    color: colors.primarySoft,
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: colors.surface,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: radius.sm,
    marginBottom: 12,
    borderLeftWidth: border.accent,
    borderLeftColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionButtonText: {
    fontSize: type.lg,
    color: colors.fg,
    fontWeight: type.weightMedium,
  },
  signOutButton: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: type.lg,
    fontWeight: type.weightBold,
    color: colors.primarySoft,
    marginTop: 24,
    marginBottom: 12,
  },
  importButton: {
    backgroundColor: colors.surface,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: radius.sm,
    marginBottom: 12,
    borderLeftWidth: border.accent,
    borderLeftColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  safetyButton: {
    backgroundColor: colors.surface,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: radius.sm,
    marginBottom: 12,
    borderLeftWidth: border.accent,
    borderLeftColor: colors.danger,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
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
  signOutText: {
    fontSize: type.base,
    color: colors.danger,
  },
});
