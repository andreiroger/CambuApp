import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { insertUserSchema, insertPartySchema, updateUserSchema, updatePartySchema, updateRequestStatusSchema, oceanTestSchema, insertPartyMessageSchema, friends } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from "crypto";
import multer from "multer";
import rateLimit from "express-rate-limit";
const PROFANITY_LIST = [
  "ass", "asshole", "bastard", "bitch", "bullshit", "cock", "crap", "cunt",
  "damn", "dick", "fuck", "fucking", "goddamn", "hell", "motherfucker",
  "nigger", "nigga", "piss", "prick", "pussy", "shit", "slut", "whore",
  "wanker", "twat", "bollocks", "arse", "arsehole", "bellend", "bloody",
  "bugger", "chink", "fag", "faggot", "retard", "retarded", "spic", "kike"
];

class ProfanityFilter {
  private words: Set<string>;
  constructor() {
    this.words = new Set(PROFANITY_LIST.map(w => w.toLowerCase()));
  }
  clean(text: string): string {
    if (!text) return text;
    return text.replace(/\b\w+\b/g, (word) => {
      if (this.words.has(word.toLowerCase())) {
        return "*".repeat(word.length);
      }
      return word;
    });
  }
}

const profanityFilter = new ProfanityFilter();
import express from "express";
import path from "path";
import fs from "fs";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const PgSessionStore = connectPgSimple(session);

function cleanText(text: string | undefined | null): string {
  if (!text) return text as string;
  try {
    return profanityFilter.clean(text);
  } catch {
    return text;
  }
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function updatePartyStatuses() {
  try {
    const allParties = await storage.getAllParties();
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    for (const party of allParties) {
      const partyDate = new Date(party.date);

      if (party.status !== "finished" && partyDate < now) {
        await storage.updateParty(party.id, { status: "finished" });
        const requests = await storage.getPartyRequests(party.id);
        for (const req of requests) {
          if (req.status === "pending") {
            await storage.updateRequestStatus(req.id, "cancelled");
          }
        }
        console.log(`[LIFECYCLE] Party "${party.title}" (${party.id}) marked as finished`);
      } else if (party.status === "upcoming" && partyDate <= twoHoursFromNow && partyDate >= now) {
        await storage.updateParty(party.id, { status: "ongoing" });
        console.log(`[LIFECYCLE] Party "${party.title}" (${party.id}) marked as ongoing`);
      } else if (party.status === "finished" && partyDate > twoHoursFromNow) {
        await storage.updateParty(party.id, { status: "upcoming" });
        console.log(`[LIFECYCLE] Party "${party.title}" (${party.id}) reset to upcoming (future date)`);
      }
    }
  } catch (error) {
    console.error("[LIFECYCLE] Error updating party statuses:", error);
  }
}

async function deleteOldNotifications() {
  try {
    const deleted = await storage.deleteOldNotifications(30);
    if (deleted > 0) {
      console.log(`[CLEANUP] Deleted ${deleted} notifications older than 30 days`);
    }
  } catch (error) {
    console.error("[CLEANUP] Error deleting old notifications:", error);
  }
}

const partyImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = "uploads/parties";
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = "uploads/avatars";
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const idDocStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = "uploads/ids";
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and WebP images are allowed"));
  }
};

const uploadPartyImage = multer({
  storage: partyImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const uploadIdDoc = multer({
  storage: idDocStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const requestCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many party requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => req.path.startsWith("/auth/") || req.originalUrl.startsWith("/api/auth/"),
});

const TERMS_OF_SERVICE = `CambuApp - Terms of Service

Last Updated: February 2026

Welcome to CambuApp. By accessing or using our platform, you agree to be bound by these Terms of Service ("Terms"). Please read them carefully before using the application.

1. ACCEPTANCE OF TERMS

By creating an account, accessing, or using CambuApp ("the Platform," "the Service"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these Terms, you must not use the Platform.

2. ELIGIBILITY AND AGE VERIFICATION

2.1. You must be at least 18 years of age to create an account and use CambuApp.
2.2. CambuApp reserves the right to require age verification through government-issued identification documents at any time.
2.3. By using the Platform, you represent and warrant that you are at least 18 years old and have the legal capacity to enter into these Terms.
2.4. CambuApp may use automated or manual verification processes to confirm your age and identity. Providing false identification information is strictly prohibited and will result in immediate account termination.

3. USER ACCOUNTS

3.1. You are responsible for maintaining the confidentiality of your account credentials.
3.2. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate and complete.
3.3. You are solely responsible for all activities that occur under your account.
3.4. CambuApp reserves the right to suspend or terminate accounts that violate these Terms or engage in suspicious activity.
3.5. You may not create multiple accounts or transfer your account to another person.

4. PARTY HOSTING RULES

4.1. Hosts are solely responsible for ensuring their events comply with all applicable local, state, and federal laws and regulations, including but not limited to noise ordinances, occupancy limits, alcohol licensing requirements, and fire safety codes.
4.2. Hosts must accurately describe their events, including location, date, time, expected attendance, and any costs or requirements.
4.3. Hosts are responsible for the safety and well-being of their guests during the event.
4.4. Hosts must not discriminate against guests based on race, color, religion, sex, national origin, disability, sexual orientation, gender identity, or any other protected characteristic.
4.5. Hosts are responsible for obtaining any necessary permits or permissions for their events.
4.6. Events involving alcohol must comply with all applicable alcohol laws. Hosts must ensure that no alcoholic beverages are served to individuals under the legal drinking age.

5. CODE OF CONDUCT

5.1. Users must treat all other users with respect and courtesy.
5.2. The following behaviors are strictly prohibited:
   a. Harassment, bullying, intimidation, or threatening behavior
   b. Discrimination or hate speech of any kind
   c. Sharing explicit, obscene, or offensive content
   d. Engaging in or promoting illegal activities
   e. Spamming, phishing, or other deceptive practices
   f. Impersonating another person or entity
   g. Posting false or misleading information about events
   h. Engaging in any form of fraud or deception
5.3. Users who violate the Code of Conduct may have their accounts suspended or permanently banned at CambuApp's sole discretion.

6. CONTENT AND INTELLECTUAL PROPERTY

6.1. Users retain ownership of content they create and share on the Platform.
6.2. By posting content on CambuApp, you grant the Platform a non-exclusive, worldwide, royalty-free license to use, display, reproduce, and distribute such content in connection with the Service.
6.3. You represent and warrant that you have all necessary rights to post any content you share on the Platform.
6.4. CambuApp reserves the right to remove any content that violates these Terms or is deemed inappropriate at its sole discretion.

7. LIABILITY AND DISCLAIMERS

7.1. CambuApp is a platform that facilitates connections between party hosts and guests. CambuApp is not responsible for the actions, conduct, or behavior of any user at any event.
7.2. CambuApp does not guarantee the safety, quality, legality, or suitability of any event listed on the Platform.
7.3. Users attend events at their own risk. CambuApp shall not be liable for any injuries, damages, losses, or claims arising from attendance at any event.
7.4. THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
7.5. IN NO EVENT SHALL CAMBUAPP BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM.
7.6. CambuApp's total liability for any claims arising from or related to the Service shall not exceed the amount paid by you to CambuApp in the twelve (12) months preceding the claim.

8. PAYMENTS AND FEES

8.1. Some events may require payment. CambuApp may facilitate payment processing but is not responsible for refunds or disputes between hosts and guests.
8.2. CambuApp reserves the right to charge service fees for the use of certain features.
8.3. All fees are non-refundable unless otherwise stated.

9. TERMINATION

9.1. You may terminate your account at any time by contacting CambuApp support.
9.2. CambuApp reserves the right to suspend or terminate your account at any time, with or without cause, and with or without notice.
9.3. Upon termination, your right to use the Platform will immediately cease. Sections of these Terms that by their nature should survive termination shall survive.

10. GOVERNING LAW

10.1. These Terms shall be governed by and construed in accordance with applicable law, without regard to conflict of law principles.
10.2. Any disputes arising from these Terms or the use of the Platform shall be resolved through binding arbitration.

11. CHANGES TO TERMS

CambuApp reserves the right to modify these Terms at any time. We will notify users of material changes through the Platform. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.

12. CONTACT

For questions about these Terms, please contact us through the CambuApp support channels within the application.`;

const PRIVACY_POLICY = `CambuApp - Privacy Policy

Last Updated: February 2026

CambuApp ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services (collectively, the "Service").

1. INFORMATION WE COLLECT

1.1. Personal Information You Provide:
   - Account registration information (name, email address, phone number, date of birth)
   - Profile information (bio, profile photo, preferences, city, country)
   - Event-related information (party details, descriptions, locations)
   - Communications (messages between users, party requests, reviews)
   - Payment information (if applicable, processed through secure third-party payment processors)

1.2. Information Collected Automatically:
   - Device information (device type, operating system, unique device identifiers)
   - Log data (IP address, browser type, pages visited, time spent)
   - Usage data (features used, interactions, preferences)

2. LOCATION DATA

2.1. CambuApp collects and processes location data to provide location-based party discovery and filtering.
2.2. We collect:
   - Location coordinates you provide when creating events
   - Your general location for discovering nearby events (when you grant permission)
   - City and country information from your profile
2.3. Location data is used to:
   - Show you events near your location
   - Enable location-based search and filtering
   - Provide distance calculations to event venues
2.4. You can control location sharing through your device settings. Disabling location access may limit certain features of the Service.

3. IDENTITY DOCUMENTS AND AGE VERIFICATION

3.1. CambuApp may collect identity documents (government-issued ID, passport, or driver's license) for the purpose of age verification and identity confirmation.
3.2. Identity documents are:
   - Stored securely using industry-standard encryption
   - Used solely for verification purposes
   - Not shared with other users or third parties except as required by law
   - Retained only for as long as necessary to complete the verification process and maintain compliance records
3.3. By submitting identity documents, you consent to our processing of this sensitive information for verification purposes.

4. HOW WE USE YOUR INFORMATION

4.1. We use the information we collect to:
   - Provide, maintain, and improve the Service
   - Create and manage your account
   - Facilitate party discovery, hosting, and attendance
   - Process and manage party requests
   - Enable communication between hosts and guests
   - Verify your identity and age
   - Send notifications about events, requests, and account activity
   - Enforce our Terms of Service and Community Guidelines
   - Detect and prevent fraud, abuse, and security incidents
   - Analyze usage patterns to improve the user experience
   - Comply with legal obligations

5. INFORMATION SHARING AND DISCLOSURE

5.1. We may share your information in the following circumstances:
   - With other users as necessary for the Service (e.g., your profile information visible to party hosts)
   - With service providers who perform services on our behalf
   - In response to legal process or government requests
   - To protect the rights, property, or safety of CambuApp, our users, or others
   - In connection with a merger, acquisition, or sale of assets
5.2. We do not sell your personal information to third parties.

6. COOKIES AND TRACKING TECHNOLOGIES

6.1. CambuApp uses session cookies to maintain your login state and provide a seamless experience.
6.2. We may use analytics tools to understand how users interact with the Service.
6.3. You can control cookie preferences through your browser or device settings.

7. DATA SECURITY

7.1. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
7.2. These measures include:
   - Encryption of sensitive data in transit and at rest
   - Secure password hashing using industry-standard algorithms
   - Regular security assessments and updates
   - Access controls limiting data access to authorized personnel
7.3. No method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.

8. DATA RETENTION

8.1. We retain your personal information for as long as your account is active or as needed to provide the Service.
8.2. We may retain certain information after account deletion for legitimate business purposes, including legal compliance, dispute resolution, and enforcement of our agreements.
8.3. Identity verification documents are retained for the minimum period required by applicable law.

9. YOUR RIGHTS AND CHOICES

9.1. Depending on your jurisdiction, you may have the right to:
   - Access your personal information
   - Correct inaccurate information
   - Delete your account and personal information
   - Object to or restrict certain processing of your information
   - Data portability (receive your data in a structured, commonly used format)
   - Withdraw consent where processing is based on consent
9.2. To exercise these rights, please contact us through the CambuApp support channels.

10. CHILDREN'S PRIVACY

10.1. CambuApp is not intended for individuals under 18 years of age.
10.2. We do not knowingly collect personal information from children under 18.
10.3. If we learn that we have collected personal information from a child under 18, we will take steps to delete such information promptly.

11. INTERNATIONAL DATA TRANSFERS

11.1. Your information may be transferred to and processed in countries other than your country of residence.
11.2. We ensure appropriate safeguards are in place for international data transfers in compliance with applicable data protection laws.

12. CHANGES TO THIS PRIVACY POLICY

We may update this Privacy Policy from time to time. We will notify you of material changes through the Service or by other means. Your continued use of the Service after changes are posted constitutes your acceptance of the updated Privacy Policy.

13. CONTACT US

For questions or concerns about this Privacy Policy or our data practices, please contact us through the CambuApp support channels within the application.`;

const EULA_TEXT = `CambuApp - End User License Agreement (EULA)

Last Updated: February 2026

IMPORTANT: PLEASE READ THIS END USER LICENSE AGREEMENT ("AGREEMENT") CAREFULLY BEFORE USING CAMBUAPP. BY INSTALLING, ACCESSING, OR USING THE APPLICATION, YOU AGREE TO BE BOUND BY THE TERMS OF THIS AGREEMENT.

1. LICENSE GRANT

1.1. Subject to your compliance with this Agreement, CambuApp grants you a limited, non-exclusive, non-transferable, revocable license to:
   a. Download, install, and use the CambuApp application on your personal device(s)
   b. Access and use the CambuApp platform and its features for personal, non-commercial purposes
1.2. This license does not include the right to:
   a. Modify, adapt, translate, reverse engineer, decompile, or disassemble the application
   b. Create derivative works based on the application
   c. Copy, distribute, or publicly display the application or its content
   d. Use the application for any commercial purpose without prior written consent from CambuApp
   e. Remove, alter, or obscure any proprietary notices in the application

2. ACCOUNT AND ACCESS

2.1. To use CambuApp, you must create an account and provide accurate, complete information.
2.2. You are responsible for safeguarding your account credentials and for all activities that occur under your account.
2.3. You must notify CambuApp immediately of any unauthorized use of your account.
2.4. CambuApp reserves the right to disable any account at any time for any reason, including violation of this Agreement.

3. USER CONTENT

3.1. You are solely responsible for any content you create, upload, or share through the application, including but not limited to party descriptions, photos, reviews, and messages.
3.2. You warrant that any content you post does not infringe upon the intellectual property rights, privacy rights, or other rights of any third party.
3.3. CambuApp reserves the right to review, moderate, and remove any user content at its sole discretion.

4. RESTRICTIONS

4.1. You agree not to:
   a. Use the application for any unlawful purpose or in violation of any applicable laws
   b. Interfere with or disrupt the application's servers, networks, or infrastructure
   c. Attempt to gain unauthorized access to any portion of the application or its systems
   d. Use automated scripts, bots, or other means to interact with the application
   e. Harvest, collect, or store personal information of other users without their consent
   f. Use the application to transmit any malicious code, viruses, or harmful content
   g. Engage in any activity that could damage, disable, overburden, or impair the application
   h. Use the application to send unsolicited communications or spam
   i. Circumvent or attempt to circumvent any security features of the application
   j. Use the application in any manner that could interfere with other users' enjoyment of the Service

5. INTELLECTUAL PROPERTY

5.1. CambuApp and its entire contents, features, and functionality (including but not limited to software, text, graphics, logos, icons, images, audio, and video) are owned by CambuApp and are protected by copyright, trademark, patent, and other intellectual property laws.
5.2. The CambuApp name, logo, and all related names, logos, product and service names, designs, and slogans are trademarks of CambuApp. You may not use such marks without the prior written permission of CambuApp.

6. THIRD-PARTY SERVICES

6.1. The application may contain links to or integrate with third-party services, websites, or applications.
6.2. CambuApp is not responsible for the content, accuracy, or practices of any third-party services.
6.3. Your use of third-party services is governed by their respective terms and privacy policies.

7. DISCLAIMER OF WARRANTIES

7.1. THE APPLICATION IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY.
7.2. CAMBUAPP DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND THOSE ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.
7.3. CAMBUAPP DOES NOT WARRANT THAT THE APPLICATION WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.

8. LIMITATION OF LIABILITY

8.1. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CAMBUAPP BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE APPLICATION.
8.2. CAMBUAPP'S TOTAL LIABILITY FOR ALL CLAIMS ARISING FROM OR RELATED TO THIS AGREEMENT SHALL NOT EXCEED THE AMOUNT YOU PAID TO CAMBUAPP IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

9. INDEMNIFICATION

9.1. You agree to indemnify, defend, and hold harmless CambuApp and its officers, directors, employees, agents, and affiliates from and against any claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from:
   a. Your use of the application
   b. Your violation of this Agreement
   c. Your violation of any rights of another party
   d. Any content you create or share through the application

10. TERMINATION

10.1. This Agreement is effective until terminated.
10.2. CambuApp may terminate this Agreement and your access to the application at any time, with or without cause, with or without notice.
10.3. You may terminate this Agreement by deleting your account and ceasing all use of the application.
10.4. Upon termination:
   a. All rights and licenses granted to you under this Agreement shall immediately cease
   b. You must immediately cease all use of the application
   c. CambuApp may delete your account and all associated data
10.5. Sections 5, 7, 8, 9, and 11 shall survive any termination of this Agreement.

11. GENERAL PROVISIONS

11.1. Governing Law: This Agreement shall be governed by applicable law without regard to its conflict of law provisions.
11.2. Severability: If any provision of this Agreement is found to be unenforceable, the remaining provisions shall continue in full force and effect.
11.3. Entire Agreement: This Agreement constitutes the entire agreement between you and CambuApp regarding the use of the application and supersedes all prior agreements and understandings.
11.4. Waiver: No waiver of any term of this Agreement shall be deemed a further or continuing waiver of such term or any other term.
11.5. Assignment: You may not assign or transfer this Agreement without CambuApp's prior written consent. CambuApp may assign this Agreement without restriction.
11.6. Updates: CambuApp may update the application and this Agreement from time to time. Continued use of the application after updates constitutes acceptance of the modified Agreement.

12. CONTACT INFORMATION

For questions about this Agreement, please contact us through the CambuApp support channels within the application.`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  function seededOffset(partyId: string): { latOff: number; lngOff: number } {
    let hash = 0;
    for (let i = 0; i < partyId.length; i++) {
      hash = ((hash << 5) - hash) + partyId.charCodeAt(i);
      hash = hash & hash;
    }
    const latOff = (Math.abs(hash % 1000) / 1000) * 0.027 - 0.0135;
    const lngOff = (Math.abs((hash >> 10) % 1000) / 1000) * 0.027 - 0.0135;
    return { latOff, lngOff };
  }

  app.set("trust proxy", 1);

  app.use(session({
    secret: process.env.SESSION_SECRET || "cambuapp-secret",
    resave: false,
    saveUninitialized: false,
    store: new PgSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: "session",
    }),
    cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: false, sameSite: "lax" as const }
  }));

  app.use("/uploads", express.static("uploads"));

  app.use("/api", generalApiLimiter);

  app.use((req, res, next) => {
    const start = Date.now();
    const originalSend = res.send;
    res.send = function (body) {
      const duration = Date.now() - start;
      console.log(`[REQUEST] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      return originalSend.call(this, body);
    };
    next();
  });

  app.use((err: any, _req: any, res: any, next: any) => {
    if (err) {
      console.error(`[ERROR] ${err.message}`);
      console.error(err.stack);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Internal server error" });
      }
    }
    next(err);
  });

  // Auth Routes
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      if (req.body.agreedToTerms !== true || req.body.agreedToEula !== true) {
        return res.status(400).json({ message: "You must agree to the Terms of Service and EULA to register" });
      }
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      if (parsed.data.bio && parsed.data.bio.length > 500) {
        return res.status(400).json({ message: "Bio must be 500 characters or less" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(parsed.data.email)) {
        return res.status(400).json({ message: "Please provide a valid email address" });
      }
      const existing = await storage.getUserByUsername(parsed.data.username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const existingEmail = await storage.getUserByEmail(parsed.data.email);
      if (existingEmail) {
        return res.status(409).json({ message: "This email is already registered" });
      }
      const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
      const pepper = process.env.PASSWORD_PEPPER || "cambuapp-default-pepper-2026";
      const pepperHash = crypto.createHmac("sha256", pepper).update(hashedPassword).digest("hex");
      const cleanedData = {
        ...parsed.data,
        password: hashedPassword,
        passwordPepper: pepperHash,
        bio: cleanText(parsed.data.bio),
        eulaAcceptedAt: new Date().toISOString(),
        termsAcceptedAt: new Date().toISOString(),
      };
      const user = await storage.createUser(cleanedData);
      req.session.userId = user.id;
      const { password, ...userWithoutPassword } = user;
      return res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      console.error("[ERROR] Registration failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log(`[SECURITY] Failed login attempt - IP: ${req.ip} - Username: ${username} (user not found)`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.isBanned) {
        console.log(`[SECURITY] Banned user login attempt - IP: ${req.ip} - Username: ${username}`);
        return res.status(403).json({ message: "Account has been suspended" });
      }
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        console.log(`[SECURITY] Failed login attempt - IP: ${req.ip} - Username: ${username} (wrong password)`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.passwordPepper) {
        const pepper = process.env.PASSWORD_PEPPER || "cambuapp-default-pepper-2026";
        const expectedPepper = crypto.createHmac("sha256", pepper).update(user.password).digest("hex");
        if (user.passwordPepper !== expectedPepper) {
          console.log(`[SECURITY] Pepper verification failed - IP: ${req.ip} - Username: ${username}`);
          return res.status(401).json({ message: "Invalid credentials" });
        }
      }
      req.session.userId = user.id;
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("[ERROR] Login failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("[ERROR] Auth check failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      return res.json({ message: "Logged out" });
    });
  });

  // Personality Test Route
  app.post("/api/personality/test", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const parsed = oceanTestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.oceanLastTaken) {
        const lastTaken = new Date(user.oceanLastTaken);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastTaken.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 90) {
          const daysLeft = 90 - diffDays;
          return res.status(400).json({ message: `You can retake the test in ${daysLeft} days` });
        }
      }
      const updated = await storage.updateUser(req.session.userId, {
        oceanOpenness: parsed.data.openness,
        oceanConscientiousness: parsed.data.conscientiousness,
        oceanExtraversion: parsed.data.extraversion,
        oceanAgreeableness: parsed.data.agreeableness,
        oceanNeuroticism: parsed.data.neuroticism,
        oceanLastTaken: new Date().toISOString(),
      });
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...userWithoutPassword } = updated;
      return res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("[ERROR] Personality test failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Routes
  app.get("/api/users/search", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const q = req.query.q as string;
      if (!q || typeof q !== "string" || q.trim().length < 2) {
        return res.status(400).json({ message: "Search query must be at least 2 characters" });
      }
      const users = await storage.searchUsers(q.trim(), req.session.userId);
      const sanitized = users.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        nickname: u.nickname,
        avatar: u.avatar,
        bio: u.bio,
        isIdVerified: u.isIdVerified,
        isAgeVerified: u.isAgeVerified,
        guestRating: u.guestRating,
        hostRating: u.hostRating,
      }));
      return res.json(sanitized);
    } catch (error: any) {
      console.error("[ERROR] Search users failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id/stats", async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const attendeeParties = await storage.getAttendeeParties(userId);
      const hostedParties = await storage.getPartiesByHost(userId);
      const reviews = await storage.getReviewsByTarget(userId);

      const filledFields = [
        user.fullName, user.nickname, user.bio, user.avatar,
        user.dob, user.phone, user.city, user.country,
        user.preferredVibe, user.gatheringSizePref
      ].filter(f => f && f.length > 0).length;
      const verifiedCount = user.isAgeVerified ? 1 : 0;
      const profileCompleteness = Math.round(((filledFields + verifiedCount) / 11) * 100);

      return res.json({
        partiesAttended: attendeeParties.length,
        partiesHosted: hostedParties.length,
        reviewCount: reviews.length,
        profileCompleteness,
      });
    } catch (error: any) {
      console.error("[ERROR] User stats failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("[ERROR] Get user failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (req.session.userId !== req.params.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { password, ...bodyWithoutPassword } = req.body;
      const parsed = updateUserSchema.safeParse(bodyWithoutPassword);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      if (parsed.data.bio && parsed.data.bio.length > 500) {
        return res.status(400).json({ message: "Bio must be 500 characters or less" });
      }
      if (parsed.data.latitude != null && (parsed.data.latitude < -90 || parsed.data.latitude > 90)) {
        return res.status(400).json({ message: "Latitude must be between -90 and 90" });
      }
      if (parsed.data.longitude != null && (parsed.data.longitude < -180 || parsed.data.longitude > 180)) {
        return res.status(400).json({ message: "Longitude must be between -180 and 180" });
      }
      const cleanedData = {
        ...parsed.data,
        bio: parsed.data.bio ? cleanText(parsed.data.bio) : parsed.data.bio,
      };
      const updated = await storage.updateUser(req.params.id, cleanedData);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = updated;
      return res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("[ERROR] Update user failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id/reviews", async (req, res) => {
    try {
      const reviews = await storage.getReviewsByTarget(req.params.id);
      return res.json(reviews);
    } catch (error: any) {
      console.error("[ERROR] Get reviews failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Party Routes - specific routes before parameterized routes
  app.get("/api/parties/host/mine", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const allMyParties = await storage.getPartiesByHost(req.session.userId);
      const myParties = allMyParties;
      const enriched = await Promise.all(myParties.map(async (party) => {
        const host = await storage.getUser(party.hostId);
        const attendeeCount = await storage.getAttendeeCount(party.id);
        return {
          ...party,
          hostName: host?.fullName || "Unknown",
          hostAvatar: host?.avatar || "",
          hostVerified: host?.isIdVerified || false,
          attendeeCount,
        };
      }));
      return res.json(enriched);
    } catch (error: any) {
      console.error("[ERROR] Get host parties failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/parties/attending/mine", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const allAttendingParties = await storage.getAttendeeParties(req.session.userId);
      const attendingParties = allAttendingParties;
      const enriched = await Promise.all(attendingParties.map(async (party) => {
        const host = await storage.getUser(party.hostId);
        const attendeeCount = await storage.getAttendeeCount(party.id);
        return {
          ...party,
          hostName: host?.fullName || "Unknown",
          hostAvatar: host?.avatar || "",
          hostVerified: host?.isIdVerified || false,
          attendeeCount,
        };
      }));
      return res.json(enriched);
    } catch (error: any) {
      console.error("[ERROR] Get attending parties failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/parties", async (req, res) => {
    try {
      const city = req.query.city as string | undefined;
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : undefined;
      const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offsetParam = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const limit = Math.min(Math.max(1, limitParam), 100);
      const offset = Math.max(0, offsetParam);

      const countryFilter = req.query.country as string | undefined;
      const regionFilter = req.query.region as string | undefined;

      let allParties = await storage.getParties();

      const statusParam = req.query.status as string | undefined;
      if (statusParam === "finished") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        allParties = allParties.filter(p => p.status === "finished" && new Date(p.date) >= thirtyDaysAgo);
      } else {
        allParties = allParties.filter(p => p.status === "upcoming" || p.status === "ongoing");
      }

      if (countryFilter) {
        allParties = allParties.filter(p => p.country?.toLowerCase() === countryFilter.toLowerCase());
      }
      if (regionFilter) {
        const regionLower = regionFilter.toLowerCase();
        allParties = allParties.filter(p => {
          const loc = (p.locationName || "").toLowerCase();
          const addr = (p.exactAddress || "").toLowerCase();
          const ct = (p.city || "").toLowerCase();
          return loc.includes(regionLower) || addr.includes(regionLower) || ct.includes(regionLower);
        });
      }
      if (city) {
        allParties = allParties.filter(p => p.city?.toLowerCase().includes(city.toLowerCase()));
      }

      if (lat !== undefined && lng !== undefined && radius !== undefined) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return res.status(400).json({ message: "Invalid coordinates" });
        }
        allParties = allParties.filter(party => {
          if (party.latitude === null || party.longitude === null) return false;
          const distance = haversineDistance(lat, lng, party.latitude, party.longitude);
          return distance <= radius;
        });
      }

      const enriched = await Promise.all(allParties.map(async (party) => {
        const [host, attendeeCount, attendeeAvatars] = await Promise.all([
          storage.getUser(party.hostId),
          storage.getAttendeeCount(party.id),
          storage.getPartyAttendeesWithAvatars(party.id),
        ]);
        const { latOff, lngOff } = seededOffset(party.id);
        const enrichedParty = {
          ...party,
          exactAddress: "",
          locationMasked: true,
          hostName: host?.fullName || "Unknown",
          hostAvatar: host?.avatar || "",
          hostVerified: host?.isIdVerified || false,
          attendeeCount,
          attendeeAvatars,
        };
        if (enrichedParty.latitude && enrichedParty.longitude) {
          enrichedParty.latitude = enrichedParty.latitude + latOff;
          enrichedParty.longitude = enrichedParty.longitude + lngOff;
        }
        return enrichedParty;
      }));

      const sort = req.query.sort as string | undefined;
      if (sort === "popular") {
        enriched.sort((a, b) => b.attendeeCount - a.attendeeCount);
      } else if (sort === "price_low") {
        enriched.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      } else if (sort === "price_high") {
        enriched.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      } else if (sort === "date") {
        enriched.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      } else {
        enriched.sort((a, b) => new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime());
      }

      const total = enriched.length;
      const paginatedParties = enriched.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return res.json({ parties: paginatedParties, total, hasMore });
    } catch (error: any) {
      console.error("[ERROR] Get parties failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/parties/:id", async (req, res) => {
    try {
      const party = await storage.getParty(req.params.id);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      const host = await storage.getUser(party.hostId);
      const attendeeCount = await storage.getAttendeeCount(party.id);

      const isHost = req.session.userId === party.hostId;
      let isAttendee = false;
      if (req.session.userId && !isHost) {
        const attendee = await storage.getAttendeeByPartyAndUser(party.id, req.session.userId);
        isAttendee = !!attendee;
      }

      const enrichedParty = {
        ...party,
        hostName: host?.fullName || "Unknown",
        hostAvatar: host?.avatar || "",
        hostVerified: host?.isIdVerified || false,
        attendeeCount,
        locationMasked: false,
      };

      if (!isHost && !isAttendee) {
        enrichedParty.exactAddress = "";
        enrichedParty.locationMasked = true;
        if (enrichedParty.latitude && enrichedParty.longitude) {
          const { latOff, lngOff } = seededOffset(party.id);
          enrichedParty.latitude = enrichedParty.latitude + latOff;
          enrichedParty.longitude = enrichedParty.longitude + lngOff;
        }
      }

      return res.json(enrichedParty);
    } catch (error: any) {
      console.error("[ERROR] Get party failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/parties", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const parsed = insertPartySchema.safeParse({ ...req.body, hostId: req.session.userId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      if (parsed.data.title.length > 100) {
        return res.status(400).json({ message: "Title must be 100 characters or less" });
      }
      if (parsed.data.description.length > 2000) {
        return res.status(400).json({ message: "Description must be 2000 characters or less" });
      }
      if (parsed.data.houseRules && parsed.data.houseRules.length > 1000) {
        return res.status(400).json({ message: "House rules must be 1000 characters or less" });
      }
      if (parsed.data.latitude < -90 || parsed.data.latitude > 90) {
        return res.status(400).json({ message: "Latitude must be between -90 and 90" });
      }
      if (parsed.data.longitude < -180 || parsed.data.longitude > 180) {
        return res.status(400).json({ message: "Longitude must be between -180 and 180" });
      }
      if (!parsed.data.exactAddress || parsed.data.exactAddress.trim().length === 0) {
        return res.status(400).json({ message: "Exact address is required" });
      }
      const partyDate = new Date(parsed.data.date);
      if (partyDate < new Date()) {
        return res.status(400).json({ message: "Party date and time cannot be in the past" });
      }
      if (parsed.data.includesAlcohol) {
        const hostUser = await storage.getUser(req.session.userId);
        if (!hostUser?.isAgeVerified) {
          return res.status(403).json({ message: "Age verification required to host parties with alcohol" });
        }
      }
      let coHostIds: string[] = [];
      if (req.body.coHostIds !== undefined) {
        if (!Array.isArray(req.body.coHostIds)) {
          return res.status(400).json({ message: "coHostIds must be an array of strings" });
        }
        coHostIds = req.body.coHostIds;
        if (coHostIds.some((id: any) => typeof id !== "string")) {
          return res.status(400).json({ message: "coHostIds must be an array of strings" });
        }
        if (coHostIds.length > 5) {
          return res.status(400).json({ message: "You can have at most 5 co-hosts" });
        }
        if (new Set(coHostIds).size !== coHostIds.length) {
          return res.status(400).json({ message: "coHostIds contains duplicate user IDs" });
        }
        if (coHostIds.includes(req.session.userId)) {
          return res.status(400).json({ message: "You cannot add yourself as a co-host" });
        }
        for (const coHostId of coHostIds) {
          const friendship = await storage.getFriendship(req.session.userId, coHostId);
          if (!friendship || friendship.status !== "accepted") {
            return res.status(400).json({ message: `User ${coHostId} is not an accepted friend` });
          }
        }
      }
      const cleanedData = {
        ...parsed.data,
        title: cleanText(parsed.data.title),
        description: cleanText(parsed.data.description),
        houseRules: parsed.data.houseRules ? cleanText(parsed.data.houseRules) : parsed.data.houseRules,
        coHostIds,
      };
      const party = await storage.createParty(cleanedData);
      return res.status(201).json(party);
    } catch (error: any) {
      console.error("[ERROR] Create party failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/parties/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const party = await storage.getParty(req.params.id);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      if (party.hostId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const parsed = updatePartySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      if (parsed.data.title && parsed.data.title.length > 100) {
        return res.status(400).json({ message: "Title must be 100 characters or less" });
      }
      if (parsed.data.description && parsed.data.description.length > 2000) {
        return res.status(400).json({ message: "Description must be 2000 characters or less" });
      }
      if (parsed.data.houseRules && parsed.data.houseRules.length > 1000) {
        return res.status(400).json({ message: "House rules must be 1000 characters or less" });
      }
      if (parsed.data.latitude != null && (parsed.data.latitude < -90 || parsed.data.latitude > 90)) {
        return res.status(400).json({ message: "Latitude must be between -90 and 90" });
      }
      if (parsed.data.longitude != null && (parsed.data.longitude < -180 || parsed.data.longitude > 180)) {
        return res.status(400).json({ message: "Longitude must be between -180 and 180" });
      }
      if (parsed.data.includesAlcohol) {
        const hostUser = await storage.getUser(req.session.userId);
        if (!hostUser?.isAgeVerified) {
          return res.status(403).json({ message: "Age verification required to host parties with alcohol" });
        }
      }
      let coHostIds: string[] | undefined = undefined;
      if (req.body.coHostIds !== undefined) {
        if (!Array.isArray(req.body.coHostIds)) {
          return res.status(400).json({ message: "coHostIds must be an array of strings" });
        }
        coHostIds = req.body.coHostIds;
        if (coHostIds!.some((id: any) => typeof id !== "string")) {
          return res.status(400).json({ message: "coHostIds must be an array of strings" });
        }
        if (coHostIds!.length > 5) {
          return res.status(400).json({ message: "You can have at most 5 co-hosts" });
        }
        if (new Set(coHostIds).size !== coHostIds!.length) {
          return res.status(400).json({ message: "coHostIds contains duplicate user IDs" });
        }
        if (coHostIds!.includes(req.session.userId)) {
          return res.status(400).json({ message: "You cannot add yourself as a co-host" });
        }
        for (const coHostId of coHostIds!) {
          const friendship = await storage.getFriendship(req.session.userId, coHostId);
          if (!friendship || friendship.status !== "accepted") {
            return res.status(400).json({ message: `User ${coHostId} is not an accepted friend` });
          }
        }
      }
      const cleanedData = {
        ...parsed.data,
        title: parsed.data.title ? cleanText(parsed.data.title) : parsed.data.title,
        description: parsed.data.description ? cleanText(parsed.data.description) : parsed.data.description,
        houseRules: parsed.data.houseRules ? cleanText(parsed.data.houseRules) : parsed.data.houseRules,
        ...(coHostIds !== undefined ? { coHostIds } : {}),
      };
      const updated = await storage.updateParty(req.params.id, cleanedData);
      return res.json(updated);
    } catch (error: any) {
      console.error("[ERROR] Update party failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/parties/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const party = await storage.getParty(req.params.id);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      if (party.hostId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteParty(req.params.id);
      return res.json({ message: "Party deleted" });
    } catch (error: any) {
      console.error("[ERROR] Delete party failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/parties/:id/attendees", async (req, res) => {
    try {
      const attendees = await storage.getPartyAttendees(req.params.id);
      const attendeesWithInfo = await Promise.all(
        attendees.map(async (a) => {
          const user = await storage.getUser(a.userId);
          const request = await storage.getPartyRequestByUserAndParty(a.userId, req.params.id);
          const comingWithUsers = request?.comingWith && request.comingWith.length > 0
            ? await Promise.all(request.comingWith.map(async (uid: string) => {
                const u = await storage.getUser(uid);
                return u ? { id: u.id, fullName: u.fullName, avatar: u.avatar || "" } : null;
              }))
            : [];
          return {
            ...a,
            username: user?.username || "",
            fullName: user?.fullName || "",
            avatar: user?.avatar || "",
            isIdVerified: user?.isIdVerified || false,
            comingWithUsers: comingWithUsers.filter(Boolean),
          };
        })
      );
      return res.json(attendeesWithInfo);
    } catch (error: any) {
      console.error("[ERROR] Get attendees failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Party Request Routes
  app.get("/api/requests/mine", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const requests = await storage.getUserRequests(req.session.userId);
      return res.json(requests);
    } catch (error: any) {
      console.error("[ERROR] Get user requests failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/parties/:id/requests", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const party = await storage.getParty(req.params.id);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      if (party.hostId !== req.session.userId && !party.coHostIds?.includes(req.session.userId)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const requests = await storage.getPartyRequests(req.params.id);
      const requestsWithInfo = await Promise.all(
        requests.map(async (r) => {
          const user = await storage.getUser(r.userId);
          const userReviews = user ? await storage.getReviewsByTarget(user.id) : [];
          const comingWithUsers = r.comingWith && r.comingWith.length > 0
            ? await Promise.all(r.comingWith.map(async (uid: string) => {
                const u = await storage.getUser(uid);
                return u ? { id: u.id, fullName: u.fullName, username: u.username, avatar: u.avatar || "" } : null;
              }))
            : [];
          return {
            ...r,
            comingWithUsers: comingWithUsers.filter(Boolean),
            user: user ? {
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              nickname: user.nickname || "",
              avatar: user.avatar || "",
              bio: user.bio || "",
              isIdVerified: user.isIdVerified || false,
              isAgeVerified: user.isAgeVerified || false,
              hostRating: user.hostRating || 0,
              guestRating: user.guestRating || 0,
              oceanOpenness: user.oceanOpenness,
              oceanConscientiousness: user.oceanConscientiousness,
              oceanExtraversion: user.oceanExtraversion,
              oceanAgreeableness: user.oceanAgreeableness,
              oceanNeuroticism: user.oceanNeuroticism,
              reviewCount: userReviews.length,
            } : null,
          };
        })
      );
      return res.json(requestsWithInfo);
    } catch (error: any) {
      console.error("[ERROR] Get party requests failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/parties/:id/requests", requestCreationLimiter, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const partyId = req.params.id as string;
      const party = await storage.getParty(partyId);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      if (party.status === "finished" || party.status === "cancelled") {
        return res.status(400).json({ message: "This party has ended or been cancelled" });
      }
      if (party.hostId === req.session.userId) {
        return res.status(400).json({ message: "You cannot request to join your own party" });
      }
      if (party.includesAlcohol) {
        const user = await storage.getUser(req.session.userId);
        if (!user?.isAgeVerified) {
          return res.status(403).json({ message: "Age verification required for parties that include alcohol" });
        }
      }
      const existingRequest = await storage.getPartyRequestByUserAndParty(req.session.userId, partyId);
      if (existingRequest) {
        return res.status(409).json({ message: "You already have a pending or accepted request for this party" });
      }
      const message = req.body.message || "";
      if (message.length > 500) {
        return res.status(400).json({ message: "Message must be 500 characters or less" });
      }
      let comingWith: string[] = [];
      if (req.body.comingWith !== undefined) {
        if (!Array.isArray(req.body.comingWith)) {
          return res.status(400).json({ message: "comingWith must be an array of user IDs" });
        }
        comingWith = req.body.comingWith;
        if (comingWith.some((id: any) => typeof id !== "string")) {
          return res.status(400).json({ message: "comingWith must be an array of strings" });
        }
        if (comingWith.length > 5) {
          return res.status(400).json({ message: "You can bring at most 5 friends" });
        }
        if (new Set(comingWith).size !== comingWith.length) {
          return res.status(400).json({ message: "comingWith contains duplicate user IDs" });
        }
        if (comingWith.includes(req.session.userId)) {
          return res.status(400).json({ message: "You cannot include yourself in comingWith" });
        }
        for (const friendUserId of comingWith) {
          const friendship = await storage.getFriendship(req.session.userId, friendUserId);
          if (!friendship || friendship.status !== "accepted") {
            return res.status(400).json({ message: `User ${friendUserId} is not an accepted friend` });
          }
        }
        if (comingWith.includes(party.hostId)) {
          return res.status(400).json({ message: "You cannot invite the party host" });
        }
        if (party.includesAlcohol) {
          for (const friendUserId of comingWith) {
            const friendUser = await storage.getUser(friendUserId);
            if (!friendUser || !friendUser.isAgeVerified) {
              const friendName = friendUser?.nickname || friendUser?.fullName || "A friend";
              return res.status(400).json({ message: `${friendName} is not age-verified and cannot attend a party with alcohol` });
            }
          }
        }
      }
      const request = await storage.createPartyRequest({
        partyId: partyId,
        userId: req.session.userId,
        message: cleanText(message),
        pledgedItems: req.body.pledgedItems || "",
        comingWith,
        status: "pending",
      });
      try {
        const requester = await storage.getUser(req.session.userId);
        const requesterName = requester?.nickname || requester?.fullName || "Someone";
        await storage.createNotification({
          userId: party.hostId,
          type: "new_request",
          title: "New Join Request",
          message: `${requesterName} wants to join "${party.title}"`,
          relatedPartyId: party.id,
          relatedUserId: req.session.userId,
        });
        if (comingWith.length > 0) {
          for (const friendId of comingWith) {
            await storage.createNotification({
              userId: friendId,
              type: "coming_with_invite",
              title: "Party Invite",
              message: `${requesterName} wants you to come to "${party.title}"`,
              relatedPartyId: party.id,
              relatedUserId: req.session.userId,
            });
          }
        }
      } catch (e) {
        console.error("[NOTIFICATION] Failed to create join request notification:", e);
      }
      return res.status(201).json(request);
    } catch (error: any) {
      console.error("[ERROR] Create party request failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/requests/:id/status", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const parsed = updateRequestStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Status must be 'accepted' or 'declined'" });
      }
      const { status } = parsed.data;
      const request = await storage.getRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      const party = await storage.getParty(request.partyId);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      if (party.hostId !== req.session.userId && !party.coHostIds?.includes(req.session.userId)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const updatedRequest = await storage.updateRequestStatus(req.params.id, status);
      if (!updatedRequest) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (status === "accepted") {
        await storage.addAttendee(updatedRequest.partyId, updatedRequest.userId);
      }
      try {
        await storage.createNotification({
          userId: updatedRequest.userId,
          type: status === "accepted" ? "request_accepted" : "request_declined",
          title: status === "accepted" ? "Request Accepted" : "Request Declined",
          message: status === "accepted"
            ? `Your request to join "${party.title}" was accepted!`
            : `Your request to join "${party.title}" was declined.`,
          relatedPartyId: party.id,
          relatedUserId: req.session.userId,
        });
        if (status === "accepted" && updatedRequest.comingWith && updatedRequest.comingWith.length > 0) {
          const requester = await storage.getUser(updatedRequest.userId);
          const requesterName = requester?.nickname || requester?.fullName || "Someone";
          for (const friendId of updatedRequest.comingWith) {
            await storage.createNotification({
              userId: friendId,
              type: "coming_with_approved",
              title: "You're Going to a Party!",
              message: `${requesterName}'s request to join "${party.title}" was approved - you're coming along!`,
              relatedPartyId: party.id,
              relatedUserId: updatedRequest.userId,
            });
          }
        }
      } catch (e) {
        console.error("[NOTIFICATION] Failed to create notification:", e);
      }
      return res.json(updatedRequest);
    } catch (error: any) {
      console.error("[ERROR] Update request status failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/requests/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const request = await storage.getRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (request.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (request.status !== "pending") {
        return res.status(400).json({ message: "Can only retract pending requests" });
      }
      await storage.deleteRequest(req.params.id);
      return res.json({ message: "Request retracted" });
    } catch (error: any) {
      console.error("[ERROR] Retract request failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Rating pending route
  app.get("/api/parties/rate/pending", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const pending = await storage.getUnratedPartiesForUser(req.session.userId);
      return res.json(pending);
    } catch (error: any) {
      console.error("[ERROR] Get pending ratings failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Review Routes
  app.post("/api/reviews", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const review = await storage.createReview({
        ...req.body,
        authorId: req.session.userId,
      });

      if (req.body.partyId && req.body.targetId) {
        if (req.body.type === "guest_review") {
          await storage.updateAttendeeRatingFlags(req.body.partyId, req.body.targetId, { hostRated: true });
        } else if (req.body.type === "host_review") {
          await storage.updateAttendeeRatingFlags(req.body.partyId, req.session.userId, { guestRated: true });
        }
      }

      return res.status(201).json(review);
    } catch (error: any) {
      console.error("[ERROR] Create review failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Image Upload Routes
  app.post("/api/upload/party-image", (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  }, uploadPartyImage.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const url = `/uploads/parties/${req.file.filename}`;
    return res.json({ url });
  });

  app.post("/api/upload/avatar", (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  }, uploadAvatar.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const url = `/uploads/avatars/${req.file.filename}`;
    return res.json({ url });
  });

  app.post("/api/upload/id-document", (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  }, uploadIdDoc.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const url = `/uploads/ids/${req.file.filename}`;
    return res.json({ url });
  });

  app.post("/api/verify-age", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ message: "Image data is required" });
      }
      const dir = "uploads/ids";
      fs.mkdirSync(dir, { recursive: true });
      const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
      const detectedMime = mimeMatch ? mimeMatch[1] : "image/png";
      const ext = detectedMime.split("/")[1] || "png";
      const filename = `verify-${req.session.userId}-${Date.now()}.${ext}`;
      const filepath = path.join(dir, filename);
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));
      const idDocumentUrl = `/uploads/ids/${filename}`;

      await storage.updateUser(req.session.userId, { verificationStatus: "pending" });

      let isVerified = false;
      let aiMessage = "Verification pending";
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
          httpOptions: {
            apiVersion: "",
            baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
          },
        });

        const todayStr = new Date().toISOString().split("T")[0];
        const verificationPrompt = `You are an age verification assistant for a party app. Analyze this ID document image carefully.

Your task:
1. Identify the type of document (passport, driver's license, national ID card, birth certificate, or other government-issued ID).
2. Look for ANY date of birth field. It may be labeled as "DOB", "Date of Birth", "Born", "Birthdate", "Fecha de nacimiento", "Date de naissance", or similar in any language.
3. The date may be in any format: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD.MM.YYYY, DD-MMM-YYYY, or written out (e.g. "15 January 2000").
4. Calculate the person's age based on today's date: ${todayStr}.
5. Determine if the person is 18 years old or older.

IMPORTANT: Be thorough. Look at the entire document. Dates may appear in different locations depending on the document type and country.

Respond ONLY with a JSON object:
{"dob": "YYYY-MM-DD", "age": NUMBER, "is18Plus": true/false, "documentType": "passport/license/id_card/birth_certificate/other", "confidence": "high/medium/low"}

If the image is too blurry, upside down, or you truly cannot find any date of birth after careful examination:
{"dob": null, "age": null, "is18Plus": false, "documentType": "unreadable", "confidence": "low", "reason": "brief explanation"}`;

        let response: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: verificationPrompt },
                    {
                      inlineData: {
                        mimeType: detectedMime,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
            });
            break;
          } catch (retryError: any) {
            console.error(`[WARN] Gemini attempt ${attempt + 1} failed:`, retryError.message);
            if (attempt === 2) throw retryError;
          }
        }

        const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text || response?.text || "";
        console.log("[VERIFY] Gemini raw response:", responseText);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log("[VERIFY] Parsed result:", JSON.stringify(parsed));
          isVerified = parsed.is18Plus === true;
          if (isVerified) {
            aiMessage = `Age verified: ${parsed.age} years old (${parsed.documentType})`;
          } else if (parsed.documentType === "unreadable") {
            aiMessage = parsed.reason
              ? `Could not read the document: ${parsed.reason}. Please try again with a clearer, well-lit photo.`
              : "Could not read the document. Please try again with a clearer, well-lit photo.";
          } else {
            aiMessage = `Verification failed: Must be 18+ (detected DOB: ${parsed.dob || "unknown"}, age: ${parsed.age || "unknown"})`;
          }
        } else {
          console.error("[VERIFY] No JSON found in Gemini response:", responseText);
          aiMessage = "Could not process the document. Please try again with a clearer photo.";
        }
      } catch (aiError: any) {
        console.error("[WARN] Gemini AI verification failed, falling back:", aiError.message);
        aiMessage = "AI verification unavailable. Document saved for manual review.";
      }

      await storage.updateUser(req.session.userId, {
        isAgeVerified: isVerified,
        idDocumentUrl,
        verificationStatus: isVerified ? "verified" : "failed",
      });

      return res.json({
        message: aiMessage,
        status: isVerified ? "verified" : "failed",
        isVerified,
        idDocumentUrl,
      });
    } catch (error: any) {
      console.error("[ERROR] Age verification failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Chat Messages Routes
  app.get("/api/parties/:id/messages", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const messages = await storage.getPartyMessages(req.params.id);
      messages.sort((a, b) => new Date(a.createdAt || "").getTime() - new Date(b.createdAt || "").getTime());
      const messagesWithSender = await Promise.all(
        messages.map(async (msg) => {
          const sender = await storage.getUser(msg.senderId);
          return {
            ...msg,
            sender: {
              id: sender?.id || "",
              fullName: sender?.fullName || "",
              avatar: sender?.avatar || "",
              nickname: sender?.nickname || "",
            },
          };
        })
      );
      return res.json(messagesWithSender);
    } catch (error: any) {
      console.error("[ERROR] Get party messages failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/parties/:id/messages", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { message } = req.body;
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ message: "Message text is required" });
      }
      if (message.length > 500) {
        return res.status(400).json({ message: "Message must be 500 characters or less" });
      }
      const cleanedMessage = cleanText(message.trim());
      const created = await storage.createPartyMessage({
        partyId: req.params.id,
        senderId: req.session.userId,
        message: cleanedMessage,
      });
      try {
        const msgParty = await storage.getParty(req.params.id);
        if (msgParty && msgParty.hostId !== req.session.userId) {
          const sender = await storage.getUser(req.session.userId);
          await storage.createNotification({
            userId: msgParty.hostId,
            type: "new_message",
            title: "New Message",
            message: `${sender?.fullName || "Someone"} sent a message in "${msgParty.title}"`,
            relatedPartyId: msgParty.id,
            relatedUserId: req.session.userId,
          });
        }
      } catch (e) {
        console.error("[NOTIFICATION] Failed to create message notification:", e);
      }
      return res.status(201).json(created);
    } catch (error: any) {
      console.error("[ERROR] Create party message failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/messages/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const msg = await storage.getPartyMessage(req.params.id);
      if (!msg) {
        return res.status(404).json({ message: "Message not found" });
      }
      const party = await storage.getParty(msg.partyId);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      if (party.hostId !== req.session.userId && !party.coHostIds?.includes(req.session.userId)) {
        return res.status(403).json({ message: "Only the party host can delete messages" });
      }
      await storage.deletePartyMessage(req.params.id);
      return res.json({ message: "Message deleted" });
    } catch (error: any) {
      console.error("[ERROR] Delete message failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Map Route
  app.get("/api/map", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 50;
      const statusFilter = req.query.status as string | undefined;

      let allParties = await storage.getAllParties();
      if (statusFilter) {
        allParties = allParties.filter(p => p.status === statusFilter);
      } else {
        allParties = allParties.filter(p => p.status === "upcoming" || p.status === "ongoing");
      }

      let allBusinesses = await storage.getBusinesses();

      if (lat !== undefined && lng !== undefined) {
        allParties = allParties.filter(party => {
          if (party.latitude === null || party.longitude === null) return false;
          return haversineDistance(lat, lng, party.latitude, party.longitude) <= radius;
        });
        allBusinesses = allBusinesses.filter(biz => {
          return haversineDistance(lat, lng, biz.latitude, biz.longitude) <= radius;
        });
      }

      const userId = req.session.userId;
      const safeParties = await Promise.all(allParties.map(async ({ exactAddress, ...p }) => {
        const isPartyHost = p.hostId === userId;
        let isPartyAttendee = false;
        if (!isPartyHost && userId) {
          const att = await storage.getAttendeeByPartyAndUser(p.id, userId);
          isPartyAttendee = !!att;
        }
        if (isPartyHost || isPartyAttendee) {
          return { ...p, exactAddress, locationMasked: false };
        }
        const { latOff, lngOff } = seededOffset(p.id);
        return {
          ...p,
          locationMasked: true,
          latitude: p.latitude ? p.latitude + latOff : p.latitude,
          longitude: p.longitude ? p.longitude + lngOff : p.longitude,
        };
      }));
      return res.json({ parties: safeParties, businesses: allBusinesses });
    } catch (error: any) {
      console.error("[ERROR] Map data failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // AI Party Suggestions Route
  app.post("/api/ai/party-suggestions", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { partyId } = req.body;
      if (!partyId) {
        return res.status(400).json({ message: "partyId is required" });
      }
      const party = await storage.getParty(partyId);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      const host = await storage.getUser(party.hostId);
      const attendees = await storage.getPartyAttendees(partyId);
      const attendeeUsers = await Promise.all(
        attendees.map(async (a) => {
          const user = await storage.getUser(a.userId);
          return user?.fullName || "Guest";
        })
      );

      const prompt = `You are a helpful party planning assistant for CambuApp. Based on the following party details, suggest what guests should bring, how to prepare, and any tips for a great experience.

Party Title: ${party.title}
Theme: ${party.theme}
Description: ${party.description}
Vibe: ${party.vibe || "Not specified"}
Date: ${party.date}
Location: ${party.locationName}, ${party.city}, ${party.country}
Max Guests: ${party.maxGuests}
Current Attendees: ${attendeeUsers.length}
What to Bring: ${party.whatToBring?.join(", ") || "Not specified"}
Includes Alcohol: ${party.includesAlcohol ? "Yes" : "No"}
House Rules: ${party.houseRules || "None"}
Host: ${host?.fullName || "Unknown"}

Please provide practical, fun suggestions in a friendly tone. Keep it concise (under 300 words).`;

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
          httpOptions: {
            apiVersion: "",
            baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
          },
        });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        const suggestions = response.text || "Unable to generate suggestions at this time.";
        return res.json({ suggestions });
      } catch (aiError: any) {
        console.error("[WARN] AI suggestions failed:", aiError.message);
        return res.json({ suggestions: "AI suggestions are currently unavailable. Please try again later." });
      }
    } catch (error: any) {
      console.error("[ERROR] AI party suggestions failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin Routes
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allParties = await storage.getAllParties();

      const totalUsers = allUsers.length;
      const totalParties = allParties.length;
      const activeParties = allParties.filter(p => p.status === "upcoming" || p.status === "ongoing").length;
      const finishedParties = allParties.filter(p => p.status === "finished").length;
      const bannedUsers = allUsers.filter(u => u.isBanned).length;
      const verifiedUsers = allUsers.filter(u => u.isIdVerified).length;

      return res.json({
        totalUsers,
        totalParties,
        activeParties,
        finishedParties,
        bannedUsers,
        verifiedUsers,
      });
    } catch (error: any) {
      console.error("[ERROR] Admin stats failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/parties/:id", requireAdmin, async (req, res) => {
    try {
      const party = await storage.getParty(req.params.id);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      await storage.deleteParty(req.params.id);
      console.log(`[ADMIN] Party ${req.params.id} deleted by admin ${req.session.userId}`);
      return res.json({ message: "Party deleted by admin" });
    } catch (error: any) {
      console.error("[ERROR] Admin delete party failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const newBanStatus = !user.isBanned;
      const updated = await storage.updateUser(req.params.id, { isBanned: newBanStatus });
      console.log(`[ADMIN] User ${req.params.id} ${newBanStatus ? "banned" : "unbanned"} by admin ${req.session.userId}`);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...userWithoutPassword } = updated;
      return res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("[ERROR] Admin ban user failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteReview(req.params.id);
      console.log(`[ADMIN] Review ${req.params.id} deleted by admin ${req.session.userId}`);
      return res.json({ message: "Review deleted by admin" });
    } catch (error: any) {
      console.error("[ERROR] Admin delete review failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notification Routes
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const notifs = await storage.getNotifications(req.session.userId);
      return res.json(notifs);
    } catch (error: any) {
      console.error("[ERROR] Get notifications failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const count = await storage.getUnreadNotificationCount(req.session.userId);
      return res.json({ count });
    } catch (error: any) {
      console.error("[ERROR] Get unread count failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const notifications = await storage.getNotifications(req.session.userId);
      const owns = notifications.some(n => n.id === req.params.id);
      if (!owns) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.markNotificationRead(req.params.id);
      return res.json({ message: "Marked as read" });
    } catch (error: any) {
      console.error("[ERROR] Mark notification read failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      await storage.markAllNotificationsRead(req.session.userId);
      return res.json({ message: "All marked as read" });
    } catch (error: any) {
      console.error("[ERROR] Mark all read failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userNotifications = await storage.getNotifications(req.session.userId);
      const owns = userNotifications.some(n => n.id === req.params.id);
      if (!owns) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteNotification(req.params.id);
      return res.json({ message: "Notification deleted" });
    } catch (error: any) {
      console.error("[ERROR] Delete notification failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/notifications", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      await storage.deleteAllNotifications(req.session.userId);
      return res.json({ message: "All notifications deleted" });
    } catch (error: any) {
      console.error("[ERROR] Delete all notifications failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Report Routes
  app.post("/api/reports", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { targetType, targetId, reason, description } = req.body;
      if (!targetType || !targetId || !reason) {
        return res.status(400).json({ message: "targetType, targetId, and reason are required" });
      }
      if (!["user", "party", "message"].includes(targetType)) {
        return res.status(400).json({ message: "targetType must be user, party, or message" });
      }
      const report = await storage.createReport({
        reporterId: req.session.userId,
        targetType,
        targetId,
        reason,
        description: description || "",
      });
      return res.status(201).json(report);
    } catch (error: any) {
      console.error("[ERROR] Create report failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/reports", requireAdmin, async (req, res) => {
    try {
      const reports = await storage.getReports();
      return res.json(reports);
    } catch (error: any) {
      console.error("[ERROR] Get reports failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/reports/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !["reviewed", "resolved", "dismissed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const updated = await storage.updateReportStatus(req.params.id, status);
      if (!updated) {
        return res.status(404).json({ message: "Report not found" });
      }
      return res.json(updated);
    } catch (error: any) {
      console.error("[ERROR] Update report status failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Friends Routes
  app.get("/api/friends", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const friendsList = await storage.getFriends(req.session.userId);
      const result = await Promise.all(
        friendsList.map(async (f) => {
          const otherUserId = f.userId === req.session.userId ? f.friendId : f.userId;
          const user = await storage.getUser(otherUserId);
          return {
            id: f.id,
            user: user ? {
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              nickname: user.nickname,
              avatar: user.avatar,
              bio: user.bio,
              isIdVerified: user.isIdVerified,
              isAgeVerified: user.isAgeVerified,
              guestRating: user.guestRating,
              hostRating: user.hostRating,
            } : null,
            createdAt: f.createdAt,
          };
        })
      );
      return res.json(result);
    } catch (error: any) {
      console.error("[ERROR] Get friends failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/friends/pending", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const pending = await storage.getPendingFriendRequests(req.session.userId);
      const result = await Promise.all(
        pending.map(async (f) => {
          const user = await storage.getUser(f.userId);
          return {
            id: f.id,
            user: user ? {
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              nickname: user.nickname,
              avatar: user.avatar,
              bio: user.bio,
              isIdVerified: user.isIdVerified,
              isAgeVerified: user.isAgeVerified,
              guestRating: user.guestRating,
              hostRating: user.hostRating,
            } : null,
            createdAt: f.createdAt,
          };
        })
      );
      return res.json(result);
    } catch (error: any) {
      console.error("[ERROR] Get pending friend requests failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/friends/outgoing", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const outgoing = await storage.getOutgoingFriendRequests(req.session.userId);
      const result = await Promise.all(
        outgoing.map(async (f) => {
          const user = await storage.getUser(f.friendId);
          return {
            id: f.id,
            user: user ? {
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              nickname: user.nickname,
              avatar: user.avatar,
              bio: user.bio,
              isIdVerified: user.isIdVerified,
              isAgeVerified: user.isAgeVerified,
              guestRating: user.guestRating,
              hostRating: user.hostRating,
            } : null,
            createdAt: f.createdAt,
          };
        })
      );
      return res.json(result);
    } catch (error: any) {
      console.error("[ERROR] Get outgoing friend requests failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/friends/request", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { friendId } = req.body;
      if (!friendId || typeof friendId !== "string") {
        return res.status(400).json({ message: "friendId is required and must be a string" });
      }
      if (friendId === req.session.userId) {
        return res.status(400).json({ message: "You cannot add yourself as a friend" });
      }
      const targetUser = await storage.getUser(friendId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const existing = await storage.getFriendship(req.session.userId, friendId);
      if (existing) {
        return res.status(409).json({ message: "Friendship or request already exists" });
      }
      const friendRecord = await storage.sendFriendRequest(req.session.userId, friendId);
      try {
        const sender = await storage.getUser(req.session.userId);
        const senderName = sender?.nickname || sender?.fullName || "Someone";
        await storage.createNotification({
          userId: friendId,
          type: "friend_request",
          title: "Friend Request",
          message: `${senderName} wants to be your friend`,
          relatedUserId: req.session.userId,
        });
      } catch (e) {
        console.error("[NOTIFICATION] Failed to create friend request notification:", e);
      }
      return res.status(201).json(friendRecord);
    } catch (error: any) {
      console.error("[ERROR] Send friend request failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/friends/:id/accept", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const [friendRecord] = await db.select().from(friends).where(eq(friends.id, req.params.id));
      if (!friendRecord) {
        return res.status(404).json({ message: "Friend request not found" });
      }
      if (friendRecord.friendId !== req.session.userId) {
        return res.status(403).json({ message: "Only the recipient can accept a friend request" });
      }
      if (friendRecord.status !== "pending") {
        return res.status(400).json({ message: "This request is no longer pending" });
      }
      const updated = await storage.acceptFriendRequest(req.params.id);
      try {
        const accepter = await storage.getUser(req.session.userId);
        const accepterName = accepter?.nickname || accepter?.fullName || "Someone";
        await storage.createNotification({
          userId: friendRecord.userId,
          type: "friend_accepted",
          title: "Friend Request Accepted",
          message: `${accepterName} accepted your friend request`,
          relatedUserId: req.session.userId,
        });
      } catch (e) {
        console.error("[NOTIFICATION] Failed to create friend accepted notification:", e);
      }
      return res.json(updated);
    } catch (error: any) {
      console.error("[ERROR] Accept friend request failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/friends/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const [friendRecord] = await db.select().from(friends).where(eq(friends.id, req.params.id));
      if (!friendRecord) {
        return res.status(404).json({ message: "Friend record not found" });
      }
      if (friendRecord.userId !== req.session.userId && friendRecord.friendId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteFriend(req.params.id);
      return res.json({ message: "Friend removed" });
    } catch (error: any) {
      console.error("[ERROR] Delete friend failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Conversation / Chat Routes
  app.get("/api/conversations", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const convs = await storage.getUserConversations(req.session.userId);
      const enriched = await Promise.all(convs.map(async (conv) => {
        const participants = await storage.getConversationParticipants(conv.id);
        const participantUsers = await Promise.all(
          participants.map(async (p) => {
            const u = await storage.getUser(p.userId);
            return u ? { id: u.id, fullName: u.fullName, username: u.username, avatar: u.avatar } : null;
          })
        );
        const messages = await storage.getConversationMessages(conv.id);
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        return {
          ...conv,
          participants: participantUsers.filter(Boolean),
          lastMessage,
        };
      }));
      return res.json(enriched);
    } catch (error: any) {
      console.error("[ERROR] Get conversations failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { participantIds, name, isGroup } = req.body;
      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json({ message: "participantIds is required" });
      }

      for (const pid of participantIds) {
        const friendship = await storage.getFriendship(req.session.userId, pid);
        if (!friendship || friendship.status !== "accepted") {
          return res.status(400).json({ message: "All participants must be accepted friends" });
        }
      }

      if (!isGroup && participantIds.length === 1) {
        const existing = await storage.getDirectConversation(req.session.userId, participantIds[0]);
        if (existing) {
          const participants = await storage.getConversationParticipants(existing.id);
          const participantUsers = await Promise.all(
            participants.map(async (p) => {
              const u = await storage.getUser(p.userId);
              return u ? { id: u.id, fullName: u.fullName, username: u.username, avatar: u.avatar } : null;
            })
          );
          return res.json({ ...existing, participants: participantUsers.filter(Boolean), lastMessage: null });
        }
      }

      const conv = await storage.createConversation({
        name: name || null,
        isGroup: isGroup || false,
        createdBy: req.session.userId,
      });

      await storage.addConversationParticipant(conv.id, req.session.userId);
      for (const pid of participantIds) {
        await storage.addConversationParticipant(conv.id, pid);
      }

      const participants = await storage.getConversationParticipants(conv.id);
      const participantUsers = await Promise.all(
        participants.map(async (p) => {
          const u = await storage.getUser(p.userId);
          return u ? { id: u.id, fullName: u.fullName, username: u.username, avatar: u.avatar } : null;
        })
      );

      return res.status(201).json({ ...conv, participants: participantUsers.filter(Boolean), lastMessage: null });
    } catch (error: any) {
      console.error("[ERROR] Create conversation failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const participants = await storage.getConversationParticipants(req.params.id);
      if (!participants.some(p => p.userId === req.session.userId)) {
        return res.status(403).json({ message: "Not a participant" });
      }
      const messages = await storage.getConversationMessages(req.params.id);
      return res.json(messages);
    } catch (error: any) {
      console.error("[ERROR] Get messages failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { message } = req.body;
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ message: "Message is required" });
      }
      const participants = await storage.getConversationParticipants(req.params.id);
      if (!participants.some(p => p.userId === req.session.userId)) {
        return res.status(403).json({ message: "Not a participant" });
      }
      const dm = await storage.createDirectMessage({
        conversationId: req.params.id,
        senderId: req.session.userId,
        message: cleanText(message.trim()),
      });

      const sender = await storage.getUser(req.session.userId);
      const senderName = sender?.nickname || sender?.fullName || "Someone";
      for (const p of participants) {
        if (p.userId !== req.session.userId) {
          try {
            await storage.createNotification({
              userId: p.userId,
              type: "direct_message",
              title: "New Message",
              message: `${senderName}: ${message.trim().substring(0, 100)}`,
              relatedUserId: req.session.userId,
            });
          } catch (e) {
            console.error("[NOTIFICATION] Failed to create DM notification:", e);
          }
        }
      }

      return res.status(201).json(dm);
    } catch (error: any) {
      console.error("[ERROR] Send message failed:", error.stack || error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Legal Routes
  app.get("/api/legal/terms", (_req, res) => {
    return res.json({ content: TERMS_OF_SERVICE });
  });

  app.get("/api/legal/privacy", (_req, res) => {
    return res.json({ content: PRIVACY_POLICY });
  });

  app.get("/api/legal/eula", (_req, res) => {
    return res.json({ content: EULA_TEXT });
  });

  updatePartyStatuses().catch(console.error);
  deleteOldNotifications().catch(console.error);
  setInterval(() => {
    updatePartyStatuses().catch(console.error);
    deleteOldNotifications().catch(console.error);
  }, 60 * 60 * 1000);

  return httpServer;
}
