# Joyride product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Staff at a rental counter managing toy car rentals while rides are in progress. The user confirmed that active rides and payment status matter most on their main screen.

## Product Purpose

Track a company's toy car fleet, start timed rentals, record whether rides were paid, and return cars to availability when payment is collected.

## Operating Context

Operators need to see active rides and time remaining, check which cars are available, and resolve payment at the end of a ride. Settings holds car editing and removal.

## Capabilities and Constraints

- Static HTML, CSS, and JavaScript web app.
- Firebase Authentication and company-scoped Firestore documents for signed-in accounts.
- A local demo mode for testing without Firebase.
- Responsive desktop and mobile layouts.

## Brand Commitments

The product is named Joyride. The user confirmed there is no fixed visual style to preserve.

## Evidence on Hand

The repository contains an image of three toy ride-on cars at `assets/toy-cars-hero.webp`. No real customer data, testimonials, or operating metrics were supplied.

## Product Principles

- Make active rides and payment state immediately visible.
- Keep rental actions clear and quick.
- Make account and company data boundaries understandable.
- Show weekly paid-rental patterns, plus today's and this month's collected totals. The user calls these profit for now; operating expenses are not recorded.
- Use Turkish throughout the app. Keep the weekly chart simple and provide month-by-month and year-by-year payment detail below it.
