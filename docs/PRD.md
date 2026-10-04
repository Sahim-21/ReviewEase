# PRD: Review Assistant (working name: ReviewEase)

## 1. Problem
Happy restaurant customers rarely leave Google reviews because writing is effort. Restaurants get few, low-quality reviews and no structured feedback while the customer is still on the premises.

## 2. Product vision
A QR-scan experience that helps a customer turn what they actually experienced into a well-phrased review in under 60 seconds, then hands them to Google to post. Owners also get private feedback and insights.

**Positioning rule:** we are a *review assistant*, not a *review generator*. Every claim in a draft must come from the customer's own input.

## 3. Users
| Persona | Need |
|---|---|
| Diner | Fast, fun, no login, supports Hinglish/Kannada/English |
| Restaurant owner/manager | More genuine reviews, alerts on problems, simple setup |
| Admin (us) | Onboard restaurants, generate QR codes, monitor usage and abuse |

## 4. Goals and success metrics
- Scan-to-draft completion rate >= 50%
- Draft-to-"Open Google" click rate >= 60% of completions
- Median time scan to draft < 60s
- Draft edit rate tracked (low edits = good grounding)
- Private feedback submitted per 100 scans
- LLM cost: Rs 0 on free tiers at pilot scale

## 5. Scope

### MVP (v1)
1. Admin creates a restaurant: name, Google Place ID, menu items, keyword/tag bank, branding colour.
2. Permanent QR per restaurant (and optional per table) pointing to `/r/{slug}?t={table}`.
3. Diner PWA flow:
   - Pick dishes had (from menu)
   - Tap-rate aspects: food, service, ambience, value
   - Pick tags (from keyword bank, optional)
   - Optional free text / broken words (any language)
   - Choose tone: casual / detailed / short
4. LLM drafts a review grounded only in those inputs. Diner can edit or regenerate.
5. "Copy and open Google" button (copies text, opens Google write-review URL for the Place ID).
6. Always-visible "Send private feedback instead/also" option.
7. Basic gamification: animated progress steps, emoji rating cards, a post-flow "meal journey" summary card.
8. Owner dashboard (read-only): scans, completions, Google click-throughs, private feedback list.

### v2
- Voice input, multilingual output toggle
- Sentiment/theme analytics, per-dish insights
- AI-drafted replies to Google reviews (owner copies and posts)
- Weekly WhatsApp/email summary
- Return-visit badges (tied to visits, never to posting a review)

### Non-goals (explicit)
- Auto-posting to Google (no public API allows it)
- Rewards, discounts or points conditional on posting a review
- Review gating (sending only happy customers to Google)
- Generating review content from restaurant keywords alone

## 6. Functional requirements
| ID | Requirement |
|---|---|
| FR1 | QR landing loads in < 2s on 4G, no login or install |
| FR2 | Diner can complete flow with taps only (no typing) |
| FR3 | Free-text accepts Hinglish/Kannada/Hindi/English; output language selectable |
| FR4 | Draft length 40-120 words, uses only provided facts |
| FR5 | Draft is always editable before copy |
| FR6 | Same input should produce varied phrasing across sessions |
| FR7 | Private feedback available to every diner regardless of rating |
| FR8 | Rate limit per device/IP/restaurant; abuse flagged |
| FR9 | Owner sees metrics and feedback in dashboard |
| FR10 | If the LLM fails, fall back to a template-based draft from selections |

## 7. Compliance and policy guardrails
- Google review policies: no fake or incentivized content, no gating. Diner must tap Submit on Google themselves.
- Show a short notice: "AI helped phrase this from your inputs. Edit freely."
- Store minimal personal data: no names/phones unless the diner volunteers them in private feedback.
- Privacy note on the landing page; deletion on request.

## 8. UX notes (gamified, safe)
- Step-by-step card flow with progress bar and micro-animations.
- Emoji/slider rating, swipe-style dish rating.
- End screen: "Your meal journey" summary (dishes, ratings), shareable. Reward = participation, not posting.

## 9. Risks
| Risk | Mitigation |
|---|---|
| Reviews look templated, flagged by Google | Variation control, customer-sourced facts only, editable draft |
| LLM hallucinates dishes/claims | Grounded prompt plus post-check against inputs |
| Free-tier rate limits | Provider fallback chain, caching, template fallback |
| Clients expect auto-posting | Set expectations in sales pitch: one-tap handoff |
| Abuse/spam sessions | Rate limits, per-QR throttles, token on session |

## 10. Roadmap
1. Week 1-2: MVP flow with one pilot restaurant
2. Week 3: Private feedback + dashboard
3. Week 4: Multilingual, voice, polish, pilot with 3-5 restaurants
4. Later: analytics, reply drafting, badges, billing
