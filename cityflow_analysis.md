# CityFlow Project Analysis

## Overview
**CityFlow** is a comprehensive, full-stack ride-sharing platform tailored specifically for the Delhi NCR region (covering Delhi, Noida, Gurugram, etc.). It facilitates connections between riders and drivers across various vehicle types, incorporating dynamic pricing, real-time status tracking, and an administrative dashboard for operational oversight.

## Technology Stack
- **Frontend:** React (v19), Vite, React Router DOM, Mapbox GL (for maps and routing), Axios (for API requests), Lucide React (icons), and React Hot Toast (notifications).
- **Backend:** Node.js, Express.js (v5), MySQL (using `mysql2`), JWT for authentication, bcryptjs for password hashing, Zod for validation.
- **Security & Performance:** Helmet (security headers), Express Rate Limit (preventing brute-force attacks and rate-limiting APIs), CORS, and Winston (logging).

## Core Architecture and Roles
The application is structured around three primary user roles, each with their own dedicated dashboard and functionality:

### 1. Rider (Customer)
- **Account Management:** Riders can register, log in, and manage their profiles.
- **Ride Requests:** Riders can request rides by specifying pickup and drop-off locations (coordinates and addresses).
- **Vehicle Selection:** Support for multiple vehicle types (`auto`, `sedan`, `suv`, `xl`, `bike`), each affecting the estimated fare.
- **Payment Preferences:** Riders can choose between multiple payment methods (`cash`, `card`, `wallet`, `upi`).
- **Rating System:** Riders can rate drivers (1 to 5 stars) and leave feedback post-ride.

### 2. Driver
- **Profile & Vehicle Management:** Drivers have specific profiles tied to their licenses and vehicles (make, model, color, year, registration number).
- **Ride Execution Lifecycle:** 
  - Receive assignments (`pending`)
  - Accept or reject requests
  - OTP Verification (`otp_pending`) before starting the ride
  - In-progress tracking
  - Ride completion and fare collection
- **Availability & Tracking:** Drivers can toggle their availability status and their current zone/location is tracked.
- **Earnings:** Drivers have an aggregated view of their total rides, total earnings, and average ratings.

### 3. Admin (Operations Oversight)
- **Zone Management:** The platform divides the operating area into predefined zones (e.g., Connaught Place, Cyber City, Hauz Khas). Admins can monitor these zones and apply dynamic "Surge Multipliers" to adjust pricing based on demand.
- **System Monitoring:** Admins have access to extensive logs, financial summaries, cancellation reports, and driver performance metrics.
- **User Moderation:** Admins can suspend users for specific durations (`1_day`, `3_days`, `1_week`, `permanent`).
- **Promotions:** Management of promo codes (flat or percentage discounts) to incentivize riders.

## Database Schema & Data Flow (MySQL)
The robust relational database (`cityflow_db`) consists of several interconnected tables with strict constraints and automated triggers:
- `users`: Centralized authentication and base user data.
- `rider_profiles` & `driver_profiles`: Role-specific metadata and aggregated statistics.
- `vehicles`: Linked to drivers.
- `zones`: Geographic regions with center coordinates and base/admin surge multipliers.
- `ride_requests`: Initial ride parameters and estimated fares.
- `ride_assignments`: Mapping requests to specific drivers.
- `rides`: Operational tracking (Start/End times, actual kilometers, OTP, ratings).
- `payments`: Financial records detailing base fare, distance fare, surge amounts, discounts, and final totals.
- `cancellations`, `ride_logs`, `notifications`, `promo_codes`: Ancillary tracking and user engagement.

**Automated Database Triggers:**
The database leverages triggers to ensure data consistency without relying entirely on application logic:
1. Automatically logging every status change in a ride to `ride_logs`.
2. Automatically recalculating a driver's average rating whenever a rider submits a new rating.
3. Automatically updating total rides, total spent (for riders), and total earned (for drivers) upon ride completion.
4. Automatically lifting temporary user suspensions when the penalty period expires.

## Payment and Pricing Model
Pricing is calculated dynamically based on:
1. **Base Fare & Distance Fare:** Calculated from vehicle type rates and estimated/actual kilometers.
2. **Zone Surge:** Each zone has a standard surge multiplier (e.g., Cyber City is 1.8x, Connaught Place is 1.5x).
3. **Admin Surge:** Admins can manually override or multiply the surge in specific zones during high-demand events.
4. **Discounts:** Applied via valid promo codes.

## Project Scope Summary
The CityFlow project represents a production-ready blueprint for an urban mobility startup. It encompasses the full lifecycle of ride-hailing: from geographical zoning, real-time ride matching, dynamic surge pricing, OTP-secured ride execution, comprehensive financial ledgering, to administrative oversight and automated statistical aggregations.
