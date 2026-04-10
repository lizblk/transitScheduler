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

Our MVP is a Google Calendar browser extension that integrates MTA Real-Time Subway feeds and Google Maps transit data to automatically calculate and insert "depart by" reminders into calendar events based on the user's origin, the event location, and live subway conditions. The three core features are: (1) automatic transit route calculation using Google Maps API, (2) real-time MTA delay awareness via MTA Developer Tools GTFS-RT feeds, and (3) smart calendar event annotations that suggest optimal departure times.

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
- **Route Calculation:** Use Google Maps Directions API (transit mode) to compute the best subway route from a user-defined home/origin
- **Real-Time Delay Integration:** Pull live GTFS-RT feeds from MTA Developer Tools to flag delays on the user's route
- **Departure Reminder Injection:** Automatically add a "Leave by [time]" note or secondary event to the calendar
- **Chrome Extension UI:** Simple popup for setting home address and toggling the extension on/off

---

## 8. Timeline & Division of Work

| Week | Milestone |
|------|-----------|
| Week 1–2 | Project setup, OAuth 2.0 for Google Calendar API, basic extension scaffold |
| Week 3–4 | Google Maps Directions API integration, parse event locations |
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

**API Feasibility & Authentication Strategy:** A key technical concern is orchestrating three external APIs — Google Calendar, Google Maps, and MTA GTFS-RT — within a single Chrome extension. We've planned for this explicitly. Google Calendar and Google Maps both use Google's OAuth 2.0 system, meaning a single OAuth consent flow gives the user access to both APIs under one token, significantly reducing authentication complexity. Chrome extensions have native support for `chrome.identity` to manage this OAuth flow seamlessly. The MTA GTFS-RT feed is a public API requiring only a free API key with no OAuth flow at all. It is a straightforward authenticated HTTP request. All three API calls will be handled in the extension's background service worker, which acts as a lightweight backend, keeping credentials secure and calls centralized.

---

## 11. Scalability

- **Phase 1 (Now — Semester):** Chrome extension for NYC subway using MTA feeds + Google APIs, free tier, desktop-only
- **Phase 2 (6 months):** Support for NJ Transit and LIRR feeds, saved home/work locations, premium subscription launch, and multi-origin support. A mobile-friendly web app companion (not native) will be explored as a lighter-weight alternative to a full native mobile build, given the scope constraints of a 2-person team.
- **Phase 3 (12 months):** Expand to other major US transit cities (Chicago CTA, DC Metro, SF BART), native mobile app development once the core product is stable, and corporate/team calendar integrations

> **Note on Mobile Timeline:** Developing a full native mobile platform within the initial 2-month scope is not realistic for a 2-person team alongside coursework. Our roadmap intentionally scopes Phase 1 to a Chrome extension only. Mobile is deferred to Phase 2, where a progressive web app (PWA) approach will be evaluated first as a lower-overhead path to mobile support before committing to native iOS/Android development.

---

## 12. Sources & References

- MTA Developer Tools & GTFS-RT Feeds: https://api.mta.info/
- Google Calendar API: https://developers.google.com/calendar/api/guides/overview
- Google Maps Directions API (Transit Mode): https://developers.google.com/maps/documentation/directions/get-directions
- Chrome Identity API (OAuth): https://developer.chrome.com/docs/extensions/reference/api/identity
- MTA Daily Ridership Data: https://new.mta.info/agency/new-york-city-transit/subway-bus-ridership-2023
- Google Calendar User Statistics: https://backlinko.com/google-workspace-users
- Chrome Extensions Developer Guide: https://developer.chrome.com/docs/extensions/
- Progressive Web Apps Overview: https://web.dev/progressive-web-apps/
