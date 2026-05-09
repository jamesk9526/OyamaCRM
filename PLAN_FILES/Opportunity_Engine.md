The research points toward using a first-party model first: recency, frequency, gift size, event engagement, communication response, pledge history, and relationship notes. I’d avoid making this feel like “wealth targeting”; it should be framed as stewardship timing and donor care.

Thought for 50s

Yes — I would build this as a smart layer over the entire Donor CRM called:

Steward Signals

Under that umbrella you would have:

Generosity Score — ranks donor relationship strength and likelihood to give again.
Lapse Radar — detects donors at risk, lapsing, lapsed, lost, or cadence-broken.
Opportunity Engine — recommends the right donor, right message, right time, and right channel.
Steward Paths — turns those insights into automations, tasks, emails, letters, or staff follow-up.

The important framing is this: this should not feel like “AI pressuring donors.” It should feel like better stewardship. AFP’s Donor Bill of Rights says donor information should be handled with respect and confidentiality, and recent fundraising AI guidance stresses transparency, consent, and keeping human care visible instead of “outsourcing empathy to algorithms.”

Core idea

Build a background analytics system that quietly watches donor activity across the CRM and produces signals, not automatic decisions.

It should look at:

giving history
gift recency
giving frequency
average gift amount
largest gift
recurring giving behavior
campaign interest
event attendance
table purchases
sponsorships
email opens/clicks
thank-you history
notes and staff interactions
missed follow-ups
pledge history
import history
donor communication preferences
donor status changes

Then it should calculate a score and create suggested opportunities.

The research-backed foundation is RFM scoring: Recency, Frequency, and Monetary value. RFM is widely used in nonprofit fundraising to segment donors by how recently they gave, how often they give, and how much they give. DonorPerfect describes a donor score as a 0–100 score based on recency, frequency, and monetary value, with an example formula of 40% recency, 30% frequency, and 30% monetary value. Dataro also describes RFM as one of the easiest and most useful starting points for nonprofit donor segmentation.

But for Oyama, I would go beyond basic RFM.

The right model for Oyama

You should not make one single magic score that pretends to know everything. Instead, build four separate scores and combine them carefully.

1. Generosity Score

This is the donor’s overall relationship/giving strength.

Example score range:

90–100: Deeply engaged / high stewardship priority
75–89: Strong active donor
55–74: Healthy donor
35–54: Weakening or inconsistent donor
1–34: Low engagement or likely lapsed
0: No giving history yet

Suggested formula:

Generosity Score =
  20% Giving Recency
+ 20% Giving Frequency
+ 15% Monetary Fit
+ 15% Giving Consistency
+ 15% Engagement / Affinity
+ 10% Momentum Signals
+  5% Relationship Depth

This should be relative to your organization, not national averages. A $100 donor may be very meaningful for one center, while another organization may consider that a smaller gift. DonorPerfect makes this same point when explaining why donor scores should be compared against the organization’s own donor base instead of fixed universal thresholds.

2. Propensity to Give

This is different from generosity. It answers:

“How likely is this donor to give in the next 30, 60, or 90 days?”

This should look at timing patterns, recent engagement, past campaign behavior, event attendance, email clicks, and giving cadence.

Example:

Propensity to Give: 82%
Window: Next 45 days
Reason: Gift anniversary approaching, opened last 2 newsletters, attended gala, gave after gala last year.
3. Lapse Risk Score

This answers:

“How likely is this donor to stop giving or need re-engagement?”

Blackbaud defines “at-risk” donors as those who have not given in 12–15 months, “lapsing” as 15–24 months, “lapsed” as two to five years, and “lost” as over five years. That is a useful baseline, but Oyama should also calculate each donor’s personal giving cadence instead of treating everyone the same.

For example, a donor who gives every December is not necessarily lapsed in June. But a donor who gives every month and suddenly stops for 90 days should be flagged quickly.

4. Opportunity Score

This answers:

“Is now the right time to reach out?”

This is where the system becomes powerful.

Examples:

A donor’s gift anniversary is coming up.
A donor attended an event but has not received a follow-up.
A donor opened three emails about ultrasounds but has not given to that fund.
A donor gave last year during Sanctity of Human Life month but not this year.
A donor gave after the gala last year and just attended this year’s gala.
A donor has slowly increased giving over the last three gifts.
A donor used to give monthly but has stopped.
A donor gave once and never received the 7-day follow-up.
A donor is mail-only and needs a printed letter task instead of email.

This turns the CRM into a daily action screen.

Why this matters now

Current fundraising trends make this kind of tool important. The Fundraising Effectiveness Project reported that total charitable dollars grew by about 5.0% in 2025, while the number of donors declined by about 3.6%. That means many nonprofits are raising more from fewer people, making retention, reactivation, and thoughtful stewardship even more important.

Blackbaud also emphasizes donor retention rate, lifetime value, and attrition rate as key metrics, and notes that donors may stop giving because of communication problems, lack of engagement, or trust issues.

So the goal of Steward Signals should be:

Help the organization notice people before they drift away.

How Lapse Radar should work

Do not just create one “lapsed” checkbox. Build a full lifecycle system.

Donor lifecycle statuses
Never Given
New Donor
New Donor Needs Second Gift
Active Donor
Recurring Donor
At Risk
Cadence Broken
Lapsing
Lapsed
Long-Term Lapsed
Lost
Reactivated
Do Not Solicit
Deceased / Archived
Basic date-based lapse rules

Use configurable defaults:

At Risk: no gift in 12–15 months
Lapsing: no gift in 15–24 months
Lapsed: no gift in 24–60 months
Lost: no gift in 60+ months
Advanced cadence-based lapse rules

This is better than basic rules.

For each donor, calculate:

average_days_between_gifts
median_days_between_gifts
usual_giving_months
last_gift_date
expected_next_gift_date
days_overdue
cadence_confidence

Example:

Donor A gives every December.
Last gift: December 14, 2025.
Expected next gift: December 2026.
Status in May 2026: Active, not lapsed.

Donor B gives every month.
Last gift: January 5, 2026.
Expected next gift: February 2026.
Status in May 2026: Cadence Broken / At Risk.

That is the type of intelligence that will make Oyama feel better than a normal CRM.

Opportunity Engine logic

The Opportunity Engine should create recommended actions.

Each opportunity should include:

Donor
Opportunity Type
Priority
Reason
Suggested Action
Suggested Channel
Suggested Timing
Confidence Level
Related Records
Steward Explanation
Staff Owner
Due Date
Status

Example opportunity:

Opportunity: Monthly Giving Invitation
Donor: Jane Smith
Priority: High
Reason: Donor has given 4 times in the last 12 months, average gift is $75, opened the last 3 ministry update emails, and gave after last year’s gala.
Suggested Action: Send a personal monthly giving invitation.
Suggested Channel: Email first, then phone call if no response in 7 days.
Confidence: 84%
Opportunity types

Use these as first built-in types:

Thank-You Needed
Receipt Needed
First-Time Donor Welcome
Second Gift Invitation
Monthly Giving Invitation
Lapsed Donor Reconnect
Cadence Broken Follow-Up
Major Gift Conversation
Event Follow-Up
Sponsor Renewal
Table Host Follow-Up
Year-End Appeal
Sanctity of Human Life Follow-Up
Newsletter Re-Engagement
Mail-Only Letter Needed
Phone Call Recommended
Data Cleanup Needed
Duplicate Donor Review
Data architecture

Since Oyama is using MySQL, I would create a clean analytics layer that does not corrupt source donor records.

Core tables
donor_score_snapshots
donor_score_components
donor_lapse_status_history
donor_opportunities
donor_opportunity_events
donor_signal_events
donor_signal_rules
donor_score_model_versions
donor_score_feedback
donor_score_audit_logs
donor_score_snapshots

Stores the latest score for each donor.

id
donor_id
generosity_score
propensity_30_day
propensity_60_day
propensity_90_day
lapse_risk_score
opportunity_score
confidence_score
lifecycle_status
last_calculated_at
model_version
explanation_summary
donor_score_components

Stores why the score is what it is.

id
donor_id
score_snapshot_id
component_name
component_score
component_weight
component_explanation

Example components:

Giving Recency: 78
Giving Frequency: 65
Monetary Fit: 42
Engagement: 81
Momentum: 74
Relationship Depth: 55
donor_opportunities

This powers the daily action screen.

id
donor_id
opportunity_type
priority
score
reason
suggested_action
suggested_channel
due_date
assigned_to
status
created_at
resolved_at
dismissed_reason
donor_signal_events

This stores raw facts the engine can use.

id
donor_id
signal_type
source_type
source_id
signal_date
signal_value
metadata_json
created_at

Signal examples:

gift_created
email_opened
email_clicked
event_registered
event_attended
pledge_created
pledge_missed
thank_you_sent
phone_call_logged
note_added
recurring_gift_failed
address_missing
email_bounced
How calculations should run

Use three layers.

1. Real-time event updates

When a gift is entered, email is opened, appointment/event attendance is logged, or staff adds a donor note, create a donor_signal_event.

This keeps the system aware.

2. Nightly score rebuild

Run a nightly Redis queue job:

Recalculate all active donor scores.
Update lifecycle statuses.
Create new opportunities.
Expire old opportunities.
Update dashboard widgets.
Write audit logs.
3. On-demand recalculation

Add a button on each donor profile:

Recalculate Steward Signals

This is helpful after imports or manual corrections.

Rules before machine learning

I would not start with heavy machine learning. Start with explainable rules and formulas first.

Phase 1 should be:

RFM score
Lifecycle status
Lapse detection
Opportunity rules
Dashboard cards
Steward explanations

Then later add ML.

Why? Because a pregnancy care center or small nonprofit needs something staff can understand and trust. AFP’s ethics guidance emphasizes integrity, public trust, and putting philanthropic mission above personal gain. AI should support stewardship, not become an opaque black box.

Later machine learning layer

After you have enough data, add an optional model.

The ML model can predict:

likely_to_give_next_30_days
likely_to_give_next_90_days
likely_to_lapse
likely_to_become_monthly_donor
likely_to_respond_to_email
likely_to_respond_to_mail
best_ask_range
best_contact_channel

But this should always show reasons like:

Top reasons:
- Gave during this campaign last year
- Recently clicked ultrasound impact email
- Attended gala
- Has given 3 times in the last 12 months
- Last gift was 11 months ago

No score should be shown without a reason.

Steward UI design

Inside Oyama, add a new Donor CRM area:

Steward Signals Dashboard

Cards:

High Opportunity Donors
At-Risk Donors
Lapsing Donors
Lapsed Donors
Monthly Giving Candidates
Thank-Yous Needed
Event Follow-Ups Needed
Mail-Only Follow-Ups
Data Quality Warnings

Each card opens a filtered list.

Donor profile widget

On each donor profile, show:

Generosity Score: 82
Propensity: High
Lapse Risk: Low
Lifecycle: Active Donor
Best Next Step: Invite to monthly giving
Best Channel: Personal email
Confidence: 76%

Then a short explanation:

Steward sees this donor as highly engaged because they gave 3 times in the last year, attended the gala, opened the last two newsletters, and gave after last year’s SOHL campaign.
Opportunity list

Use columns:

Priority
Donor
Opportunity
Reason
Suggested Action
Due Date
Owner
Status

Buttons:

Create Task
Draft Email
Print Letter
Mark Done
Dismiss
Open Donor
Privacy and safety rules

This is very important.

The scoring engine should:

Never use Client / Compassion CRM private client data to score donors.
Never expose sensitive client stories unless deliberately approved for donor communication.
Never send donor PII to an external hosted AI unless the organization explicitly configures that.
Always prefer local AI for sensitive data.
Keep human approval before sending emails, letters, or making donor decisions.
Let admins disable scoring fields.
Let admins hide scores from non-authorized users.
Audit all score changes and AI-suggested actions.
Let staff override or dismiss recommendations.
Never describe donors in insulting or manipulative terms.

DonorPerfect’s AI guidance warns against entering personally identifiable donor data into outside AI tools and recommends keeping humans in the lead, using AI as a helper rather than a decision-maker. That aligns perfectly with how Steward should work.

Best names inside the app

I would name the full tool:

Steward Signals

Then inside it:

Generosity Score
Lapse Radar
Opportunity Engine
Steward Paths
Relationship Timeline
Signal History

Example product wording:

Steward Signals helps your team see which donors need attention, which relationships are growing, which supporters may be drifting away, and when the right next step should happen.

Implementation phases
Phase 1: Foundation

Build the database tables, score snapshots, signal events, and nightly recalculation job.

Deliverables:

donor_signal_events table
donor_score_snapshots table
donor_score_components table
donor_lapse_status_history table
donor_opportunities table
nightly score worker
manual donor recalculation button
Phase 2: Basic scoring

Build the first explainable score.

Include:

RFM scoring
organization-relative percentile scoring
basic lifecycle status
basic lapse detection
donor profile score widget
Phase 3: Lapse Radar

Add advanced lapse detection.

Include:

expected next gift date
average giving cadence
gift anniversary detection
at-risk/lapsing/lapsed/lost statuses
LYBUNT/SYBUNT reports
re-engagement opportunities

LYBUNT and SYBUNT are standard fundraising categories: LYBUNT means donors who gave last year but not this year, while SYBUNT means donors who gave some year but not this year.

Phase 4: Opportunity Engine

Create actionable recommendations.

Include:

daily opportunity list
priority sorting
reason explanations
suggested channel
suggested action
create task button
draft email button
print letter button
dismiss button
Phase 5: Steward AI explanations

Connect Steward to explain the score.

Examples:

“Why is this donor at risk?”
“What should I do next?”
“Draft a warm re-engagement letter.”
“Show me donors likely to give this month.”
Phase 6: Automation

Connect opportunities to Steward Paths.

Examples:

New Donor Welcome Path
7-Day Monthly Giving Invitation Path
Lapsed Donor Reconnect Path
Gala Follow-Up Path
Mail-Only Thank-You Path
Sponsor Renewal Path
Strong Copilot prompt
Build a new smart donor analytics layer for Oyama CRM called Steward Signals. This system should run over the Donor CRM as a non-destructive analytics layer that monitors donor activity, calculates internal scores, detects lapse risk, and creates recommended donor opportunities.

The system must include four main concepts:

1. Generosity Score
2. Lapse Radar
3. Opportunity Engine
4. Steward Paths integration

Do not build this as a generic AI chatbot. Build it as an explainable donor stewardship engine. Every score must have visible reasons, component scores, model versioning, and audit logs. The system should help staff prioritize care, follow-up, gratitude, reactivation, and relationship-building. It must never feel manipulative or like wealth targeting.

Use a first-party data model only for the first version. Use donor giving history, gift recency, gift frequency, average gift, largest gift, recurring gift behavior, campaign participation, event attendance, sponsorships, email engagement, communication history, staff notes, tasks, pledge history, and donor preferences. Do not use Client / Compassion CRM private data in donor scoring. Keep client and donor data strictly separated.

Create these tables or equivalent MySQL models:

- donor_signal_events
- donor_score_snapshots
- donor_score_components
- donor_lapse_status_history
- donor_opportunities
- donor_opportunity_events
- donor_signal_rules
- donor_score_model_versions
- donor_score_feedback
- donor_score_audit_logs

Create a score calculation service that can run nightly through the queue and also run on demand from a donor profile. The first version should use explainable rules and weighted scoring, not opaque machine learning. Add model versioning so future score changes do not corrupt old score history.

Generosity Score should be 0–100 and calculated from components such as giving recency, giving frequency, monetary fit, giving consistency, engagement/affinity, momentum signals, and relationship depth. Also calculate separate fields for propensity to give, lapse risk, opportunity score, and confidence score. Do not mix confidence into the generosity score.

Build Lapse Radar with configurable lifecycle statuses:

- Never Given
- New Donor
- New Donor Needs Second Gift
- Active Donor
- Recurring Donor
- At Risk
- Cadence Broken
- Lapsing
- Lapsed
- Long-Term Lapsed
- Lost
- Reactivated
- Do Not Solicit
- Deceased / Archived

Do not rely only on a hard 12-month lapsed rule. Add cadence-based detection using average days between gifts, median days between gifts, expected next gift date, usual giving months, days overdue, and cadence confidence. A donor who gives every December should not be treated the same as a monthly donor who suddenly stopped giving.

Build the Opportunity Engine so it creates recommended donor actions with:

- donor_id
- opportunity_type
- priority
- score
- reason
- suggested_action
- suggested_channel
- due_date
- assigned_to
- status
- dismissed_reason
- related records

Opportunity types should include thank-you needed, receipt needed, first-time donor welcome, second gift invitation, monthly giving invitation, lapsed donor reconnect, cadence broken follow-up, major gift conversation, event follow-up, sponsor renewal, table host follow-up, year-end appeal, Sanctity of Human Life follow-up, newsletter re-engagement, mail-only letter needed, phone call recommended, data cleanup needed, and duplicate donor review.

Add a Steward Signals dashboard inside the Donor CRM with cards for high opportunity donors, at-risk donors, lapsing donors, lapsed donors, monthly giving candidates, thank-yous needed, event follow-ups needed, mail-only follow-ups, and data quality warnings.

Add a donor profile widget showing:

- Generosity Score
- Propensity
- Lapse Risk
- Lifecycle Status
- Best Next Step
- Best Channel
- Confidence
- Explanation

Add buttons for:

- Recalculate Steward Signals
- Create Task
- Draft Email
- Print Letter
- Mark Opportunity Done
- Dismiss Opportunity
- Open Signal History

Every AI-assisted or score-assisted action must be permission-aware and audit-logged. Steward may draft, explain, summarize, and recommend, but it must not send emails, merge records, change donor status, or bulk update donors without human confirmation.

Update AGENTS.md and create documentation:

- STEWARD_SIGNALS_PLAN.md
- DONOR_SCORING_MODEL.md
- LAPSE_RADAR_PLAN.md
- OPPORTUNITY_ENGINE_PLAN.md

Label any incomplete feature clearly with a warning popup. Do not pretend partial features are complete.

The simple vision statement:

Steward Signals turns donor data into careful next steps. It watches giving patterns, engagement, events, and follow-up history so staff can see who needs thanks, who may be drifting away, who is ready for a deeper invitation, and when the right moment has arrived.