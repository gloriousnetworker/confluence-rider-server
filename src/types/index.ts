export type UserRole = "rider" | "driver" | "admin";

export type RideType =
  | "bike"
  | "keke"
  | "cab"
  | "shared"
  | "intercity"
  | "campus";

export type BookingStatus =
  | "finding"
  | "negotiating"
  | "accepted"
  | "arriving"
  | "ontrip"
  | "completed"
  | "cancelled";

export type MemberStatus = "bronze" | "silver" | "gold";

export type TransactionType = "debit" | "credit";

export type NotificationType = "promo" | "safety" | "trip" | "rating";

export type ReferralStatus = "pending" | "completed" | "expired";

export type LanguagePref = "english" | "ebira" | "igala" | "yoruba";

export type SavedPlaceLabel = "home" | "work" | "campus" | "other";

export type VehicleType = "bike" | "keke" | "car";

export type VerificationStatus = "pending" | "approved" | "rejected";

export type FareOfferStatus = "pending" | "accepted" | "rejected" | "expired";

export type PaymentMethod = "cash" | "card" | "wallet" | "ussd";

export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export type SosStatus = "active" | "responding" | "resolved" | "false_alarm";
