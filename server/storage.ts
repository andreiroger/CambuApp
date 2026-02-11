import {
  type User, type InsertUser,
  type Party, type InsertParty,
  type PartyAttendee, type InsertPartyAttendee,
  type PartyRequest, type InsertPartyRequest,
  type Review, type InsertReview,
  type PartyMessage, type InsertPartyMessage,
  type Business, type InsertBusiness,
  type Notification, type InsertNotification,
  type Report, type InsertReport,
  type Friend, type InsertFriend,
  type Conversation, type InsertConversation,
  type ConversationParticipant, type InsertConversationParticipant,
  type DirectMessage, type InsertDirectMessage,
  users, parties, partyAttendees, partyRequests, reviews, partyMessages, businesses,
  notifications, reports, friends, conversations, conversationParticipants, directMessages,
} from "@shared/schema";
import { eq, and, count, or, desc, ilike, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getParties(): Promise<Party[]>;
  getPartiesByCity(city: string): Promise<Party[]>;
  getParty(id: string): Promise<Party | undefined>;
  getPartiesByHost(hostId: string): Promise<Party[]>;
  createParty(party: InsertParty): Promise<Party>;
  updateParty(id: string, data: Partial<InsertParty>): Promise<Party | undefined>;
  deleteParty(id: string): Promise<void>;
  getPartyAttendees(partyId: string): Promise<PartyAttendee[]>;
  getAttendeeParties(userId: string): Promise<Party[]>;
  addAttendee(partyId: string, userId: string): Promise<PartyAttendee>;
  removeAttendee(partyId: string, userId: string): Promise<void>;
  getAttendeeCount(partyId: string): Promise<number>;
  getPartyRequests(partyId: string): Promise<PartyRequest[]>;
  getUserRequests(userId: string): Promise<PartyRequest[]>;
  createPartyRequest(request: InsertPartyRequest): Promise<PartyRequest>;
  updateRequestStatus(id: string, status: string): Promise<PartyRequest | undefined>;
  getRequest(id: string): Promise<PartyRequest | undefined>;
  deleteRequest(id: string): Promise<void>;
  getReviewsByTarget(targetId: string): Promise<Review[]>;
  getReviewsByAuthor(authorId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  getPartiesCount(): Promise<number>;
  getPartyRequestByUserAndParty(userId: string, partyId: string): Promise<PartyRequest | undefined>;
  getAllUsers(): Promise<User[]>;
  getAllParties(): Promise<Party[]>;
  deleteReview(id: string): Promise<void>;
  getPartyMessages(partyId: string): Promise<PartyMessage[]>;
  createPartyMessage(message: InsertPartyMessage): Promise<PartyMessage>;
  deletePartyMessage(id: string): Promise<void>;
  getPartyMessage(id: string): Promise<PartyMessage | undefined>;
  getBusinesses(): Promise<Business[]>;
  getBusinessesByCity(city: string): Promise<Business[]>;
  createBusiness(business: InsertBusiness): Promise<Business>;
  getAttendeeByPartyAndUser(partyId: string, userId: string): Promise<PartyAttendee | undefined>;
  updateAttendee(id: string, data: Partial<InsertPartyAttendee>): Promise<PartyAttendee | undefined>;
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  deleteAllNotifications(userId: string): Promise<void>;
  deleteOldNotifications(days: number): Promise<number>;
  createReport(report: InsertReport): Promise<Report>;
  getReports(): Promise<Report[]>;
  getReport(id: string): Promise<Report | undefined>;
  updateReportStatus(id: string, status: string): Promise<Report | undefined>;
  getPartyAttendeesWithAvatars(partyId: string): Promise<{userId: string; avatar: string; fullName: string}[]>;
  sendFriendRequest(userId: string, friendId: string): Promise<Friend>;
  acceptFriendRequest(id: string): Promise<Friend | undefined>;
  getFriendship(userId: string, friendId: string): Promise<Friend | undefined>;
  getFriends(userId: string): Promise<Friend[]>;
  getPendingFriendRequests(userId: string): Promise<Friend[]>;
  getOutgoingFriendRequests(userId: string): Promise<Friend[]>;
  deleteFriend(id: string): Promise<void>;
  searchUsers(query: string, currentUserId: string): Promise<User[]>;
  getUnratedPartiesForUser(userId: string): Promise<{ party: Party; role: "host" | "guest"; usersToRate: { id: string; fullName: string; avatar: string }[] }[]>;
  updateAttendeeRatingFlags(partyId: string, userId: string, flags: { hostRated?: boolean; guestRated?: boolean }): Promise<void>;
  createConversation(data: InsertConversation): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string): Promise<Conversation[]>;
  addConversationParticipant(conversationId: string, userId: string): Promise<ConversationParticipant>;
  getConversationParticipants(conversationId: string): Promise<ConversationParticipant[]>;
  getDirectConversation(userId1: string, userId2: string): Promise<Conversation | undefined>;
  createDirectMessage(data: InsertDirectMessage): Promise<DirectMessage>;
  getConversationMessages(conversationId: string): Promise<DirectMessage[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    if (Object.keys(filteredData).length === 0) {
      return this.getUser(id);
    }
    const [updated] = await db.update(users).set(filteredData).where(eq(users.id, id)).returning();
    return updated;
  }

  async getParties(): Promise<Party[]> {
    return db.select().from(parties);
  }

  async getPartiesByCity(city: string): Promise<Party[]> {
    return db.select().from(parties).where(eq(parties.city, city));
  }

  async getParty(id: string): Promise<Party | undefined> {
    const [party] = await db.select().from(parties).where(eq(parties.id, id));
    return party;
  }

  async getPartiesByHost(hostId: string): Promise<Party[]> {
    return db.select().from(parties).where(eq(parties.hostId, hostId));
  }

  async createParty(party: InsertParty): Promise<Party> {
    const [created] = await db.insert(parties).values(party).returning();
    return created;
  }

  async updateParty(id: string, data: Partial<InsertParty>): Promise<Party | undefined> {
    const [updated] = await db.update(parties).set(data).where(eq(parties.id, id)).returning();
    return updated;
  }

  async deleteParty(id: string): Promise<void> {
    await db.delete(parties).where(eq(parties.id, id));
  }

  async getPartyAttendees(partyId: string): Promise<PartyAttendee[]> {
    return db.select().from(partyAttendees).where(eq(partyAttendees.partyId, partyId));
  }

  async getAttendeeParties(userId: string): Promise<Party[]> {
    const result = await db
      .select({ party: parties })
      .from(partyAttendees)
      .innerJoin(parties, eq(partyAttendees.partyId, parties.id))
      .where(eq(partyAttendees.userId, userId));
    return result.map(r => r.party);
  }

  async addAttendee(partyId: string, userId: string): Promise<PartyAttendee> {
    const [created] = await db.insert(partyAttendees).values({ partyId, userId }).returning();
    return created;
  }

  async removeAttendee(partyId: string, userId: string): Promise<void> {
    await db.delete(partyAttendees).where(
      and(eq(partyAttendees.partyId, partyId), eq(partyAttendees.userId, userId))
    );
  }

  async getAttendeeCount(partyId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(partyAttendees).where(eq(partyAttendees.partyId, partyId));
    return result?.count ?? 0;
  }

  async getPartyRequests(partyId: string): Promise<PartyRequest[]> {
    return db.select().from(partyRequests).where(eq(partyRequests.partyId, partyId));
  }

  async getUserRequests(userId: string): Promise<PartyRequest[]> {
    return db.select().from(partyRequests).where(eq(partyRequests.userId, userId));
  }

  async createPartyRequest(request: InsertPartyRequest): Promise<PartyRequest> {
    const [created] = await db.insert(partyRequests).values(request).returning();
    return created;
  }

  async updateRequestStatus(id: string, status: string): Promise<PartyRequest | undefined> {
    const [updated] = await db.update(partyRequests).set({ status }).where(eq(partyRequests.id, id)).returning();
    return updated;
  }

  async getRequest(id: string): Promise<PartyRequest | undefined> {
    const [request] = await db.select().from(partyRequests).where(eq(partyRequests.id, id));
    return request;
  }

  async deleteRequest(id: string): Promise<void> {
    await db.delete(partyRequests).where(eq(partyRequests.id, id));
  }

  async getReviewsByTarget(targetId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.targetId, targetId));
  }

  async getReviewsByAuthor(authorId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.authorId, authorId));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }

  async getPartiesCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(parties);
    return result?.count ?? 0;
  }

  async getPartyRequestByUserAndParty(userId: string, partyId: string): Promise<PartyRequest | undefined> {
    const [request] = await db.select().from(partyRequests).where(
      and(
        eq(partyRequests.userId, userId),
        eq(partyRequests.partyId, partyId),
        or(eq(partyRequests.status, "pending"), eq(partyRequests.status, "accepted"))
      )
    );
    return request;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getAllParties(): Promise<Party[]> {
    return db.select().from(parties);
  }

  async deleteReview(id: string): Promise<void> {
    await db.delete(reviews).where(eq(reviews.id, id));
  }

  async getPartyMessages(partyId: string): Promise<PartyMessage[]> {
    return db.select().from(partyMessages).where(eq(partyMessages.partyId, partyId));
  }

  async createPartyMessage(message: InsertPartyMessage): Promise<PartyMessage> {
    const [created] = await db.insert(partyMessages).values(message).returning();
    return created;
  }

  async deletePartyMessage(id: string): Promise<void> {
    await db.delete(partyMessages).where(eq(partyMessages.id, id));
  }

  async getPartyMessage(id: string): Promise<PartyMessage | undefined> {
    const [msg] = await db.select().from(partyMessages).where(eq(partyMessages.id, id));
    return msg;
  }

  async getBusinesses(): Promise<Business[]> {
    return db.select().from(businesses);
  }

  async getBusinessesByCity(city: string): Promise<Business[]> {
    return db.select().from(businesses).where(eq(businesses.city, city));
  }

  async createBusiness(business: InsertBusiness): Promise<Business> {
    const [created] = await db.insert(businesses).values(business).returning();
    return created;
  }

  async getAttendeeByPartyAndUser(partyId: string, userId: string): Promise<PartyAttendee | undefined> {
    const [attendee] = await db.select().from(partyAttendees).where(
      and(eq(partyAttendees.partyId, partyId), eq(partyAttendees.userId, userId))
    );
    return attendee;
  }

  async updateAttendee(id: string, data: Partial<InsertPartyAttendee>): Promise<PartyAttendee | undefined> {
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    if (Object.keys(filteredData).length === 0) {
      return undefined;
    }
    const [updated] = await db.update(partyAttendees).set(filteredData).where(eq(partyAttendees.id, id)).returning();
    return updated;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result?.count ?? 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }

  async deleteOldNotifications(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString();
    const result = await db.delete(notifications).where(
      sql`${notifications.createdAt} < ${cutoffStr}`
    ).returning();
    return result.length;
  }

  async createReport(report: InsertReport): Promise<Report> {
    const [created] = await db.insert(reports).values(report).returning();
    return created;
  }

  async getReports(): Promise<Report[]> {
    return db.select().from(reports);
  }

  async getReport(id: string): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(eq(reports.id, id));
    return report;
  }

  async updateReportStatus(id: string, status: string): Promise<Report | undefined> {
    const [updated] = await db.update(reports).set({ status }).where(eq(reports.id, id)).returning();
    return updated;
  }

  async getPartyAttendeesWithAvatars(partyId: string): Promise<{userId: string; avatar: string; fullName: string}[]> {
    const result = await db
      .select({
        userId: partyAttendees.userId,
        avatar: users.avatar,
        fullName: users.fullName,
      })
      .from(partyAttendees)
      .innerJoin(users, eq(partyAttendees.userId, users.id))
      .where(eq(partyAttendees.partyId, partyId))
      .limit(5);
    return result.map(r => ({ userId: r.userId, avatar: r.avatar ?? "", fullName: r.fullName }));
  }

  async sendFriendRequest(userId: string, friendId: string): Promise<Friend> {
    const [created] = await db.insert(friends).values({ userId, friendId, status: "pending" }).returning();
    return created;
  }

  async acceptFriendRequest(id: string): Promise<Friend | undefined> {
    const [updated] = await db.update(friends).set({ status: "accepted" }).where(eq(friends.id, id)).returning();
    return updated;
  }

  async getFriendship(userId: string, friendId: string): Promise<Friend | undefined> {
    const [friendship] = await db.select().from(friends).where(
      or(
        and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
        and(eq(friends.userId, friendId), eq(friends.friendId, userId))
      )
    );
    return friendship;
  }

  async getFriends(userId: string): Promise<Friend[]> {
    return db.select().from(friends).where(
      and(
        eq(friends.status, "accepted"),
        or(eq(friends.userId, userId), eq(friends.friendId, userId))
      )
    );
  }

  async getPendingFriendRequests(userId: string): Promise<Friend[]> {
    return db.select().from(friends).where(
      and(eq(friends.status, "pending"), eq(friends.friendId, userId))
    );
  }

  async getOutgoingFriendRequests(userId: string): Promise<Friend[]> {
    return db.select().from(friends).where(
      and(eq(friends.status, "pending"), eq(friends.userId, userId))
    );
  }

  async deleteFriend(id: string): Promise<void> {
    await db.delete(friends).where(eq(friends.id, id));
  }

  async searchUsers(query: string, currentUserId: string): Promise<User[]> {
    return db.select().from(users).where(
      and(
        or(
          ilike(users.username, `%${query}%`),
          ilike(users.fullName, `%${query}%`)
        ),
        ne(users.id, currentUserId)
      )
    ).limit(20);
  }

  async getUnratedPartiesForUser(userId: string): Promise<{ party: Party; role: "host" | "guest"; usersToRate: { id: string; fullName: string; avatar: string }[] }[]> {
    const results: { party: Party; role: "host" | "guest"; usersToRate: { id: string; fullName: string; avatar: string }[] }[] = [];

    const hostedParties = await db.select().from(parties).where(
      and(eq(parties.hostId, userId), eq(parties.status, "finished"))
    );

    for (const party of hostedParties) {
      const attendees = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          avatar: users.avatar,
        })
        .from(partyAttendees)
        .innerJoin(users, eq(partyAttendees.userId, users.id))
        .where(
          and(
            eq(partyAttendees.partyId, party.id),
            eq(partyAttendees.hostRated, false)
          )
        );

      if (attendees.length > 0) {
        results.push({
          party,
          role: "host",
          usersToRate: attendees.map(a => ({ id: a.id, fullName: a.fullName, avatar: a.avatar ?? "" })),
        });
      }
    }

    const attendedRecords = await db
      .select({ partyId: partyAttendees.partyId })
      .from(partyAttendees)
      .where(
        and(
          eq(partyAttendees.userId, userId),
          eq(partyAttendees.guestRated, false)
        )
      );

    for (const record of attendedRecords) {
      const [party] = await db.select().from(parties).where(
        and(eq(parties.id, record.partyId), eq(parties.status, "finished"))
      );
      if (!party) continue;

      const [host] = await db.select({
        id: users.id,
        fullName: users.fullName,
        avatar: users.avatar,
      }).from(users).where(eq(users.id, party.hostId));

      if (host) {
        results.push({
          party,
          role: "guest",
          usersToRate: [{ id: host.id, fullName: host.fullName, avatar: host.avatar ?? "" }],
        });
      }
    }

    return results;
  }

  async updateAttendeeRatingFlags(partyId: string, userId: string, flags: { hostRated?: boolean; guestRated?: boolean }): Promise<void> {
    const updateData: any = {};
    if (flags.hostRated !== undefined) updateData.hostRated = flags.hostRated;
    if (flags.guestRated !== undefined) updateData.guestRated = flags.guestRated;
    if (Object.keys(updateData).length === 0) return;

    await db.update(partyAttendees).set(updateData).where(
      and(eq(partyAttendees.partyId, partyId), eq(partyAttendees.userId, userId))
    );
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const [created] = await db.insert(conversations).values(data).returning();
    return created;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    const result = await db
      .select({ conversation: conversations })
      .from(conversationParticipants)
      .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
      .where(eq(conversationParticipants.userId, userId));

    const convs = result.map(r => r.conversation);

    const convsWithLastMessage = await Promise.all(convs.map(async (conv) => {
      const [lastMsg] = await db
        .select()
        .from(directMessages)
        .where(eq(directMessages.conversationId, conv.id))
        .orderBy(desc(directMessages.createdAt))
        .limit(1);
      return { conv, lastMsgTime: lastMsg?.createdAt || conv.createdAt || "" };
    }));

    convsWithLastMessage.sort((a, b) => {
      return new Date(b.lastMsgTime).getTime() - new Date(a.lastMsgTime).getTime();
    });

    return convsWithLastMessage.map(c => c.conv);
  }

  async addConversationParticipant(conversationId: string, userId: string): Promise<ConversationParticipant> {
    const [created] = await db.insert(conversationParticipants).values({ conversationId, userId }).returning();
    return created;
  }

  async getConversationParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    return db.select().from(conversationParticipants).where(eq(conversationParticipants.conversationId, conversationId));
  }

  async getDirectConversation(userId1: string, userId2: string): Promise<Conversation | undefined> {
    const user1Convs = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId1));

    for (const { conversationId } of user1Convs) {
      const conv = await this.getConversation(conversationId);
      if (!conv || conv.isGroup) continue;

      const participants = await this.getConversationParticipants(conversationId);
      if (participants.length === 2 && participants.some(p => p.userId === userId2)) {
        return conv;
      }
    }
    return undefined;
  }

  async createDirectMessage(data: InsertDirectMessage): Promise<DirectMessage> {
    const [created] = await db.insert(directMessages).values(data).returning();
    return created;
  }

  async getConversationMessages(conversationId: string): Promise<DirectMessage[]> {
    return db
      .select()
      .from(directMessages)
      .where(eq(directMessages.conversationId, conversationId))
      .orderBy(directMessages.createdAt);
  }
}

export const storage = new DatabaseStorage();
