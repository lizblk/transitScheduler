# NYC Transit Scheduler — Google Calendar Extension

---

## 1. Project Title, Team Members & Category

**Project Title:** NYC Transit Scheduler  
**Team:** Safwan Chowdhury, Liz Black  
**Category:** Productivity Tools / Urban Transit Technology

---

## 2. Problem Statement

New Yorkers who rely on the subway often have to manually cross reference their Google Calendar events with MTA schedules, leading to missed trains and poor commute planning. There is no native tool that automatically suggests when to leave for an event based on real-time subway conditions.

---

## 3. Solution

Our MVP is a Google Calendar browser extension that uses Google route data to calculate commute blocks between calendar events with locations. Instead of only adding a note to an existing event, the extension previews and creates real Google Calendar events such as "Commute: Class -> Work" between scheduled commitments. MTA Real-Time Subway feeds are planned as a later enhancement for NYC-specific delay awareness once the base calendar workflow is reliable.

---

## 4. Target Market

Our primary users are NYC-based professionals, students, and commuters who manage their schedules through Google Calendar — a population of over 3.5 million daily subway riders in New York City. Even capturing a fraction of Google Calendar's ~500M global users who are NYC-based represents a substantial addressable market.

---

## 5. Why It's Valuable

Missing a meeting because of a delayed F train is a universal NYC frustration that no existing calendar tool addresses natively. This extension eliminates the cognitive overhead of manually checking transit times by bringing real-time subway intelligence directly into the user's existing workflow.

---

## 6. How You'll Make Money

The base extension will be free (freemium), with a premium tier (~$3–5/month) offering features like multi-stop commute chaining, saved home/work locations, and push notifications for service alerts affecting upcoming events.

---

## 7. MVP Features

- **Event Location Detection:** Parse Google Calendar event locations to identify destinations
- **Route Calculation:** Use the Google Routes API to compute commute time between consecutive calendar event locations
- **Commute Event Creation:** Add real "Commute: Event A -> Event B" blocks to Google Calendar
- **Home Commutes:** Optionally add home-to-first-event and last-event-to-home commute blocks
- **Chrome Extension UI:** Popup for settings, route preview, and adding commute events
- **Future MTA Delay Integration:** Pull live GTFS-RT feeds from MTA Developer Tools to flag delays on subway routes

---

## 8. Timeline & Division of Work

| Week | Milestone |
|------|-----------|
| Week 1–2 | Project setup, OAuth 2.0 for Google Calendar API, basic extension scaffold |
| Week 3–4 | Google Routes API integration, parse event locations |
| Week 5–6 | MTA GTFS-RT feed integration, delay detection logic |
| Week 7–8 | Combine transit data with calendar event injection, UI polish |
| Week 9 | User testing, bug fixes, demo prep |
| Week 10 | Final demo & submission |

---

## 9. Team Roles & Responsibilities

| Name | Primary Role | Responsibilities | Est. Codebase % |
|------|-------------|-----------------|-----------------|
| Liz | Lead Developer | Google Calendar API integration, Chrome extension architecture, OAuth flow, backend logic | 50% |
| Safwan | Developer / Tester | MTA feed parsing, Google Maps API integration, UI & QA | 50% |

---

## 10. Viability

**User Testing:** We'll conduct informal tests with 5–10 NYC-based students/commuters, measuring whether the "depart by" suggestions are accurate and useful in real scenarios.  
**Competitive Analysis:** Existing tools like Citymapper and Google Maps already show transit routes, but neither integrates directly into Google Calendar as a scheduling layer. Our solution is differentiated by living inside the calendar rather than requiring the user to switch apps.  
**Success Metrics:** Departure time accuracy within ±5 minutes, successful calendar event injection for 90%+ of events with valid NYC addresses, and positive usability feedback from testers.

**API Feasibility & Authentication Strategy:** A key technical concern is orchestrating Google Calendar, Google Routes, and eventually MTA GTFS-RT within a single Chrome extension. Google Calendar access uses OAuth 2.0 through Chrome's `chrome.identity` API. Google Routes requests use a restricted Google Maps Platform API key. The MTA GTFS-RT feed can be added later with a free MTA API key and no OAuth flow. API calls are centralized in the extension's background service worker so the popup can stay focused on settings and user actions.

---

## 11. Scalability

- **Phase 1 (Now — Semester):** Chrome extension using Google Calendar + Google Routes APIs, free tier, desktop-only
- **Phase 2 (6 months):** Support for NJ Transit and LIRR feeds, saved home/work locations, premium subscription launch, and multi-origin support. A mobile-friendly web app companion (not native) will be explored as a lighter-weight alternative to a full native mobile build, given the scope constraints of a 2-person team.
- **Phase 3 (12 months):** Expand to other major US transit cities (Chicago CTA, DC Metro, SF BART), native mobile app development once the core product is stable, and corporate/team calendar integrations

> **Note on Mobile Timeline:** Developing a full native mobile platform within the initial 2-month scope is not realistic for a 2-person team alongside coursework. Our roadmap intentionally scopes Phase 1 to a Chrome extension only. Mobile is deferred to Phase 2, where a progressive web app (PWA) approach will be evaluated first as a lower-overhead path to mobile support before committing to native iOS/Android development.

---

## 12. Sources & References

- MTA Developer Tools & GTFS-RT Feeds: https://api.mta.info/
- Google Calendar API: https://developers.google.com/calendar/api/guides/overview
- Google Routes API Transit Routes: https://developers.google.com/maps/documentation/routes/transit-route
- Chrome Identity API (OAuth): https://developer.chrome.com/docs/extensions/reference/api/identity
- MTA Daily Ridership Data: https://new.mta.info/agency/new-york-city-transit/subway-bus-ridership-2023
- Google Calendar User Statistics: https://backlinko.com/google-workspace-users
- Chrome Extensions Developer Guide: https://developer.chrome.com/docs/extensions/
- Progressive Web Apps Overview: https://web.dev/progressive-web-apps/
