import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, real, uniqueIndex, index, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  nickname: text("nickname"),
  avatar: text("avatar").default(""),
  bio: text("bio").default(""),
  isIdVerified: boolean("is_id_verified").default(false),
  isAgeVerified: boolean("is_age_verified").default(false),
  idDocumentUrl: text("id_document_url").default(""),
  verificationStatus: text("verification_status").default("none"),
  dob: text("dob"),
  email: text("email").notNull().unique(),
  phone: text("phone").default(""),
  country: text("country").default(""),
  city: text("city").default(""),
  address: text("address").default(""),
  latitude: real("latitude"),
  longitude: real("longitude"),
  hostRating: real("host_rating").default(0),
  guestRating: real("guest_rating").default(0),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  darkMode: boolean("dark_mode").default(false),
  searchRadius: integer("search_radius").default(50),
  preferredVibe: text("preferred_vibe").default(""),
  gatheringSizePref: text("gathering_size_pref").default(""),
  hostOrGuest: text("host_or_guest").default(""),
  agreedToTerms: boolean("agreed_to_terms").default(false),
  isBanned: boolean("is_banned").default(false),
  isAdmin: boolean("is_admin").default(false),
  onboardingComplete: boolean("onboarding_complete").default(false),
  oceanOpenness: real("ocean_openness"),
  oceanConscientiousness: real("ocean_conscientiousness"),
  oceanExtraversion: real("ocean_extraversion"),
  oceanAgreeableness: real("ocean_agreeableness"),
  oceanNeuroticism: real("ocean_neuroticism"),
  oceanLastTaken: text("ocean_last_taken"),
  eulaAcceptedAt: text("eula_accepted_at"),
  termsAcceptedAt: text("terms_accepted_at"),
  passwordPepper: text("password_pepper"),
}, (table) => [
  index("users_city_idx").on(table.city),
  index("users_country_idx").on(table.country),
]);

export const parties = pgTable("parties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hostId: varchar("host_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  theme: text("theme").notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  locationName: text("location_name").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  exactAddress: text("exact_address"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  maxGuests: integer("max_guests").notNull(),
  price: integer("price").default(0),
  whatToBring: text("what_to_bring").array().default(sql`'{}'::text[]`),
  imageUrl: text("image_url").default(""),
  galleryUrls: text("gallery_urls").array().default(sql`'{}'::text[]`),
  includesAlcohol: boolean("includes_alcohol").default(false),
  createdAt: text("created_at").default(sql`now()`),
  status: text("status").notNull().default("upcoming"),
  houseRules: text("house_rules").default(""),
  targetGuests: text("target_guests").default(""),
  vibe: text("vibe").default(""),
  coHostIds: text("co_host_ids").array().default(sql`'{}'::text[]`),
  qrToken: text("qr_token"),
}, (table) => [
  index("parties_host_id_idx").on(table.hostId),
  index("parties_city_idx").on(table.city),
  index("parties_status_idx").on(table.status),
  index("parties_date_idx").on(table.date),
]);

export const partyAttendees = pgTable("party_attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partyId: varchar("party_id").notNull().references(() => parties.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  checkedIn: boolean("checked_in").default(false),
  checkedInAt: text("checked_in_at"),
  hostRated: boolean("host_rated").default(false),
  guestRated: boolean("guest_rated").default(false),
}, (table) => [
  uniqueIndex("party_user_unique").on(table.partyId, table.userId),
  index("attendees_party_id_idx").on(table.partyId),
  index("attendees_user_id_idx").on(table.userId),
]);

export const partyRequests = pgTable("party_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partyId: varchar("party_id").notNull().references(() => parties.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").default(""),
  pledgedItems: text("pledged_items").default(""),
  comingWith: text("coming_with").array().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("pending"),
}, (table) => [
  index("requests_party_id_idx").on(table.partyId),
  index("requests_user_id_idx").on(table.userId),
  index("requests_status_idx").on(table.status),
]);

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id),
  targetId: varchar("target_id").notNull().references(() => users.id),
  partyId: varchar("party_id").references(() => parties.id),
  content: text("content").notNull(),
  rating: integer("rating").notNull(),
  type: text("type").notNull(),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("reviews_target_id_idx").on(table.targetId),
  index("reviews_author_id_idx").on(table.authorId),
]);

export const partyMessages = pgTable("party_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partyId: varchar("party_id").notNull().references(() => parties.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("messages_party_id_idx").on(table.partyId),
  index("messages_sender_id_idx").on(table.senderId),
]);

export const businesses = pgTable("businesses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url").default(""),
  city: text("city").notNull(),
  country: text("country").notNull(),
}, (table) => [
  index("businesses_city_idx").on(table.city),
]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedPartyId: varchar("related_party_id").references(() => parties.id),
  relatedUserId: varchar("related_user_id").references(() => users.id),
  read: boolean("read").default(false),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_read_idx").on(table.read),
]);

export const friends = pgTable("friends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  friendId: varchar("friend_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("friends_user_id_idx").on(table.userId),
  index("friends_friend_id_idx").on(table.friendId),
  index("friends_status_idx").on(table.status),
  uniqueIndex("friends_pair_unique").on(table.userId, table.friendId),
]);

export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id").notNull(),
  reason: text("reason").notNull(),
  description: text("description").default(""),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("reports_reporter_id_idx").on(table.reporterId),
  index("reports_status_idx").on(table.status),
  index("reports_target_type_idx").on(table.targetType),
]);

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  isGroup: boolean("is_group").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("conversations_created_by_idx").on(table.createdBy),
]);

export const conversationParticipants = pgTable("conversation_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
}, (table) => [
  index("conv_participants_conv_idx").on(table.conversationId),
  index("conv_participants_user_idx").on(table.userId),
  uniqueIndex("conv_participant_unique").on(table.conversationId, table.userId),
]);

export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("dm_conversation_idx").on(table.conversationId),
  index("dm_sender_idx").on(table.senderId),
]);

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertPartySchema = createInsertSchema(parties).omit({ id: true, createdAt: true });
export type InsertParty = z.infer<typeof insertPartySchema>;
export type Party = typeof parties.$inferSelect;

export const insertPartyAttendeeSchema = createInsertSchema(partyAttendees).omit({ id: true });
export type InsertPartyAttendee = z.infer<typeof insertPartyAttendeeSchema>;
export type PartyAttendee = typeof partyAttendees.$inferSelect;

export const insertPartyRequestSchema = createInsertSchema(partyRequests).omit({ id: true });
export type InsertPartyRequest = z.infer<typeof insertPartyRequestSchema>;
export type PartyRequest = typeof partyRequests.$inferSelect;

export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export const insertPartyMessageSchema = createInsertSchema(partyMessages).omit({ id: true, createdAt: true });
export type InsertPartyMessage = z.infer<typeof insertPartyMessageSchema>;
export type PartyMessage = typeof partyMessages.$inferSelect;

export const insertBusinessSchema = createInsertSchema(businesses).omit({ id: true });
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businesses.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const insertFriendSchema = createInsertSchema(friends).omit({ id: true, createdAt: true });
export type InsertFriend = z.infer<typeof insertFriendSchema>;
export type Friend = typeof friends.$inferSelect;

export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants).omit({ id: true });
export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({ id: true, createdAt: true });
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

export const updateUserSchema = createInsertSchema(users).omit({ id: true }).partial();
export type UpdateUser = z.infer<typeof updateUserSchema>;

export const updatePartySchema = createInsertSchema(parties).omit({ id: true, createdAt: true }).partial();
export type UpdateParty = z.infer<typeof updatePartySchema>;

export const updateRequestStatusSchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

export const oceanTestSchema = z.object({
  openness: z.number().min(0).max(100),
  conscientiousness: z.number().min(0).max(100),
  extraversion: z.number().min(0).max(100),
  agreeableness: z.number().min(0).max(100),
  neuroticism: z.number().min(0).max(100),
});
