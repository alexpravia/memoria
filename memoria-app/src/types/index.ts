export type UserRole = "user" | "co_user";

export type CognitiveLevel = 1 | 2 | 3 | 4 | 5;

export type VerificationStatus = "pending" | "verified" | "hidden";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  date_of_birth: string | null;
  location: string | null;
  photo_url: string | null;
  cognitive_level: CognitiveLevel;
  preferences: {
    audio_speed: number;
    text_size: "small" | "medium" | "large";
    language: string;
  };
}

export interface CoUser {
  id: string;
  email: string;
  full_name: string;
  user_id: string;
  relationship: string;
  role: "family" | "caregiver" | "admin";
}

export interface Person {
  id: string;
  user_id: string;
  full_name: string;
  relationship: string;
  photo_url: string | null;
  contact_info: Record<string, string> | null;
  key_facts: string[];
  emotional_notes: string | null;
  is_sensitive: boolean;
}

export interface Media {
  id: string;
  user_id: string;
  file_url: string;
  file_type: "photo" | "video";
  description: string | null;
  location: string | null;
  taken_at: string | null;
  ai_tags: string[] | null;
  verification_status: VerificationStatus;
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_type: "one_time" | "recurring" | "routine";
  recurrence_rule: string | null;
  is_past: boolean;
  people_involved: string[];
  user_feeling: string | null;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  audio_url: string | null;
  transcription: string | null;
  recorded_at: string;
  entry_type: "moment" | "recall_attempt";
  mood: string | null;
}

export interface DailySummary {
  id: string;
  user_id: string;
  summary_date: string;
  ai_summary: string | null;
  recall_summary: string | null;
  review_status: "pending" | "reviewed" | "edited";
}

export interface PinnedNote {
  id: string;
  user_id: string;
  content: string;
  audio_url: string | null;
  is_active: boolean;
}

export interface SensitivityFilter {
  id: string;
  user_id: string;
  filter_type: "person" | "topic" | "time_period";
  filter_value: string;
  person_id: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

export interface FlagItem {
  id: string;
  user_id: string;
  flag_type: "media" | "person" | "event" | "journal" | "mood";
  reference_id: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "hidden";
}
