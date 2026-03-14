import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { ActivityIndicator, View } from "react-native";

// Auth screens
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";

// Co-user screens
import CoUserHomeScreen from "../screens/couser/CoUserHomeScreen";
import CreateUserProfileScreen from "../screens/couser/onboarding/CreateUserProfileScreen";
import AddLifeFactsScreen from "../screens/couser/onboarding/AddLifeFactsScreen";
import AddPeopleScreen from "../screens/couser/onboarding/AddPeopleScreen";
import AddEventsScreen from "../screens/couser/onboarding/AddEventsScreen";
import SetupUserLoginScreen from "../screens/couser/SetupUserLoginScreen";
import ImportContactsScreen from "../screens/couser/import/ImportContactsScreen";
import ImportCalendarScreen from "../screens/couser/import/ImportCalendarScreen";
import ImportPhotosScreen from "../screens/couser/import/ImportPhotosScreen";
import SensitivityFiltersScreen from "../screens/couser/SensitivityFiltersScreen";
import FlagQueueScreen from "../screens/couser/FlagQueueScreen";
import ViewLifeFactsScreen from "../screens/couser/ViewLifeFactsScreen";
import ViewPeopleScreen from "../screens/couser/ViewPeopleScreen";
import ViewEventsScreen from "../screens/couser/ViewEventsScreen";
import ViewPhotosScreen from "../screens/couser/ViewPhotosScreen";

// User screens
import UserHomeScreen from "../screens/user/UserHomeScreen";
import BriefingScreen from "../screens/user/BriefingScreen";
import EmergencyCardScreen from "../screens/user/EmergencyCardScreen";
import AssistantScreen from "../screens/user/AssistantScreen";

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

function CoUserStack() {
  const { userId } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!userId ? (
        // Onboarding - no user profile created yet
        <>
          <Stack.Screen name="CreateUserProfile" component={CreateUserProfileScreen} />
          <Stack.Screen name="AddLifeFacts" component={AddLifeFactsScreen} />
          <Stack.Screen name="AddPeople" component={AddPeopleScreen} />
          <Stack.Screen name="AddEvents" component={AddEventsScreen} />
          <Stack.Screen name="CoUserHome" component={CoUserHomeScreen} />
          <Stack.Screen name="SetupUserLogin" component={SetupUserLoginScreen} />
          <Stack.Screen name="ImportContacts" component={ImportContactsScreen} />
          <Stack.Screen name="ImportCalendar" component={ImportCalendarScreen} />
          <Stack.Screen name="ImportPhotos" component={ImportPhotosScreen} />
          <Stack.Screen name="SensitivityFilters" component={SensitivityFiltersScreen} />
          <Stack.Screen name="FlagQueue" component={FlagQueueScreen} />
          <Stack.Screen name="ViewLifeFacts" component={ViewLifeFactsScreen} />
          <Stack.Screen name="ViewPeople" component={ViewPeopleScreen} />
          <Stack.Screen name="ViewEvents" component={ViewEventsScreen} />
          <Stack.Screen name="ViewPhotos" component={ViewPhotosScreen} />
        </>
      ) : (
        // Dashboard - user profile exists
        <>
          <Stack.Screen name="CoUserHome" component={CoUserHomeScreen} />
          <Stack.Screen name="AddLifeFacts" component={AddLifeFactsScreen} />
          <Stack.Screen name="AddPeople" component={AddPeopleScreen} />
          <Stack.Screen name="AddEvents" component={AddEventsScreen} />
          <Stack.Screen name="SetupUserLogin" component={SetupUserLoginScreen} />
          <Stack.Screen name="ImportContacts" component={ImportContactsScreen} />
          <Stack.Screen name="ImportCalendar" component={ImportCalendarScreen} />
          <Stack.Screen name="ImportPhotos" component={ImportPhotosScreen} />
          <Stack.Screen name="SensitivityFilters" component={SensitivityFiltersScreen} />
          <Stack.Screen name="FlagQueue" component={FlagQueueScreen} />
          <Stack.Screen name="ViewLifeFacts" component={ViewLifeFactsScreen} />
          <Stack.Screen name="ViewPeople" component={ViewPeopleScreen} />
          <Stack.Screen name="ViewEvents" component={ViewEventsScreen} />
          <Stack.Screen name="ViewPhotos" component={ViewPhotosScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

function UserStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UserHome" component={UserHomeScreen} />
      <Stack.Screen name="Briefing" component={BriefingScreen} />
      <Stack.Screen name="EmergencyCard" component={EmergencyCardScreen} />
      <Stack.Screen name="Assistant" component={AssistantScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1a1a2e" }}>
        <ActivityIndicator size="large" color="#7c4dff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!session ? (
        <AuthStack />
      ) : role === "co_user" ? (
        <CoUserStack />
      ) : role === "user" ? (
        <UserStack />
      ) : (
        // Authenticated but no role yet (just signed up as co-user)
        <CoUserStack />
      )}
    </NavigationContainer>
  );
}
