// Seed data for the initial LiveCom donor interaction workspace scaffold.

import type {
  LiveComContactForm,
  LiveComConversation,
  LiveComInteractionEvent,
  LiveComSurvey,
} from "@/app/components/livecom/livecom-types";

export const LIVECOM_CONVERSATIONS: LiveComConversation[] = [
  {
    id: "conv-1001",
    donorName: "Alyssa Moreno",
    constituentId: "cm2ajx1000001f4ab0101xy12",
    channel: "WEB_CHAT",
    status: "NEW",
    priority: "HIGH",
    messagePreview: "Can I set my monthly gift to every other week instead?",
    receivedAt: "2026-05-11T13:11:00.000Z",
    owner: "Unassigned",
  },
  {
    id: "conv-1002",
    donorName: "Marco Johnson",
    constituentId: "cm2ajx1000002f4ab0101xy13",
    channel: "CONTACT_FORM",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    messagePreview: "I need a tax receipt copy for my March donation.",
    receivedAt: "2026-05-11T12:54:00.000Z",
    owner: "Sarah Miles",
  },
  {
    id: "conv-1003",
    donorName: "Danielle Park",
    constituentId: "cm2ajx1000003f4ab0101xy14",
    channel: "SURVEY",
    status: "WAITING_ON_DONOR",
    priority: "LOW",
    messagePreview: "Follow-up question sent after event satisfaction survey response.",
    receivedAt: "2026-05-11T10:42:00.000Z",
    owner: "Jordan Lee",
  },
  {
    id: "conv-1004",
    donorName: "Priya Gordon",
    constituentId: "cm2ajx1000004f4ab0101xy15",
    channel: "WEB_CHAT",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    messagePreview: "Can someone explain where scholarship fund gifts are used?",
    receivedAt: "2026-05-11T09:13:00.000Z",
    owner: "Sarah Miles",
  },
  {
    id: "conv-1005",
    donorName: "Noah Riley",
    constituentId: "cm2ajx1000005f4ab0101xy16",
    channel: "CONTACT_FORM",
    status: "RESOLVED",
    priority: "LOW",
    messagePreview: "Updated preferred contact method to SMS.",
    receivedAt: "2026-05-10T21:28:00.000Z",
    owner: "Jordan Lee",
  },
];

export const LIVECOM_SURVEYS: LiveComSurvey[] = [
  {
    id: "survey-1001",
    name: "Donor Welcome Follow-up",
    channel: "CAMPAIGN_FOLLOW_UP",
    status: "LIVE",
    responses: 86,
    responseRate: 41,
    updatedAt: "2026-05-11T11:05:00.000Z",
  },
  {
    id: "survey-1002",
    name: "Live Chat Satisfaction",
    channel: "POST_CHAT",
    status: "LIVE",
    responses: 34,
    responseRate: 57,
    updatedAt: "2026-05-11T12:40:00.000Z",
  },
  {
    id: "survey-1003",
    name: "Volunteer Interest Qualifier",
    channel: "WEBSITE_FORM",
    status: "DRAFT",
    responses: 0,
    responseRate: 0,
    updatedAt: "2026-05-10T16:20:00.000Z",
  },
];

export const LIVECOM_CONTACT_FORMS: LiveComContactForm[] = [
  {
    id: "form-1001",
    name: "General Contact",
    sourcePath: "/contact",
    newSubmissions: 6,
    averageResponseMinutes: 22,
    spamBlockedToday: 9,
  },
  {
    id: "form-1002",
    name: "Major Gift Inquiry",
    sourcePath: "/give/major-gifts",
    newSubmissions: 2,
    averageResponseMinutes: 48,
    spamBlockedToday: 1,
  },
  {
    id: "form-1003",
    name: "Planned Giving Interest",
    sourcePath: "/planned-giving",
    newSubmissions: 1,
    averageResponseMinutes: 65,
    spamBlockedToday: 0,
  },
];

export const LIVECOM_INTERACTION_EVENTS: LiveComInteractionEvent[] = [
  {
    id: "event-1001",
    occurredAt: "2026-05-11T13:11:00.000Z",
    channel: "WEB_CHAT",
    donorName: "Alyssa Moreno",
    eventLabel: "Chat Started",
    detail: "Website chat launched from Donate page on desktop.",
  },
  {
    id: "event-1002",
    occurredAt: "2026-05-11T12:54:00.000Z",
    channel: "CONTACT_FORM",
    donorName: "Marco Johnson",
    eventLabel: "Contact Form Submitted",
    detail: "Receipt assistance request submitted from /contact.",
  },
  {
    id: "event-1003",
    occurredAt: "2026-05-11T12:40:00.000Z",
    channel: "SURVEY",
    donorName: "Priya Gordon",
    eventLabel: "Survey Completed",
    detail: "Live chat satisfaction survey submitted with score 5/5.",
  },
  {
    id: "event-1004",
    occurredAt: "2026-05-11T11:29:00.000Z",
    channel: "WEB_CHAT",
    donorName: "Danielle Park",
    eventLabel: "Agent Reply Sent",
    detail: "Designation policy explanation sent by Sarah Miles.",
  },
];
