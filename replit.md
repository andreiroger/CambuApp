# CambuApp - The Party Vibe Network

## Overview
CambuApp is a social platform designed to connect people through local parties and events. It aims to be the "Tinder for parties," allowing users to discover, host, and attend gatherings with a strong emphasis on trust and verified interactions. The platform facilitates location-based party discovery, streamlined party creation, and a comprehensive review system for both hosts and guests. Key capabilities include multi-step onboarding with personality assessment, AI-powered assistance, and robust social features like friend networks and co-hosting. The business vision is to create a vibrant, safe community for social events, enhancing real-world connections and fostering positive party experiences.

## User Preferences
I prefer iterative development, with a focus on delivering stable and tested features in stages. I value clear and concise communication. Please ask for clarification if anything is unclear before making significant architectural changes or implementing complex features. Ensure that all database migrations are handled carefully, and data integrity is maintained.

## System Architecture
The application follows a client-server architecture with a React + TypeScript frontend and an Express.js backend. Data is persisted in a PostgreSQL database managed with Drizzle ORM.

**Frontend:**
- **Frameworks:** React + TypeScript, `wouter` for routing, `@tanstack/react-query` for data fetching.
- **UI/UX:** Dark-first design theme with purple (hue 280) primary colors, utilizing `shadcn/ui` and Tailwind CSS for a modern, responsive interface.
- **Mapping:** `Leaflet` and `react-leaflet` are integrated for interactive, location-based party discovery.
- **Mobile:** Features a mobile-first approach with a dedicated bottom navigation bar.

**Backend:**
- **Framework:** Express.js.
- **Authentication:** `bcrypt` for password hashing (10 rounds) combined with a SHA-256 pepper layer for enhanced security. `express-session` with `connect-pg-simple` ensures persistent sessions.
- **Database:** PostgreSQL with Drizzle ORM for type-safe and efficient data access.
- **Security:** Rate limiting, profanity filtering, server-side validation, and secure cookie flags (`httpOnly`, `sameSite=lax`).
- **Party Lifecycle:** Automated mechanisms to update party statuses (upcoming, ongoing, finished, cancelled).
- **Location:** Geocoding for party locations using OpenStreetMap Nominatim API.

**Key Features & Design Patterns:**
- **Trust System:** Incorporates host and guest ratings, ID verification, and a comprehensive user profile displaying trust signals, personality traits, and review counts.
- **Social Graph:** Implements a friends system with requests, an individual and group chat system, and co-hosting capabilities.
- **AI Integration:** Leverages Google Gemini for ID verification, party suggestions, and an AI party assistant.
- **Notifications:** A robust notification system with unread badges, dedicated notification pages, and auto-triggered alerts for various events.
- **Reporting & Moderation:** Functionality to report parties or users, with admin routes for management.
- **Location Privacy:** Exact party addresses are hidden from non-attendees and obfuscated for initial discovery, revealed only upon acceptance.
- **User Onboarding:** A multi-step onboarding process includes personal info, vibe preferences, location setup, and an OCEAN personality test.
- **Data Optimization:** Optimized Drizzle ORM queries, including efficient JOINs to prevent N+1 issues.
- **Robust Validation:** Comprehensive client and server-side input validation, including unique email constraints, date checks, and content filters.

## External Dependencies
- **PostgreSQL:** Primary database for all application data.
- **Drizzle ORM:** TypeScript ORM for interacting with PostgreSQL.
- **Google Gemini (via Replit AI Integrations):** Used for AI-powered ID verification and party suggestions.
- **OpenStreetMap Nominatim API:** Utilized for geocoding party locations.
- **bcrypt:** For secure password hashing.
- **express-session & connect-pg-simple:** For managing and persisting user sessions.
- **@tanstack/react-query:** For efficient data fetching and caching in the frontend.
- **shadcn/ui & Tailwind CSS:** Frontend UI component library and utility-first CSS framework.
- **Leaflet & react-leaflet:** For interactive map functionalities.