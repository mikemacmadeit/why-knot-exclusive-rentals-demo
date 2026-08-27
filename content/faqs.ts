import { brand } from "@/content/brand";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export function getFaqById(id: string): FaqItem | undefined {
  return faqs.find((f) => f.id === id);
}

export const HOMEPAGE_FAQ_IDS = [
  "drive-or-captain",
  "whats-included",
  "fishing-types",
  "sandbar-snorkel",
  "departures",
  "capacity",
  "occasions",
  "bad-weather",
  "how-to-book",
  "captain-braxton",
] as const;

export function getHomepageFaqs(): FaqItem[] {
  return HOMEPAGE_FAQ_IDS.map((id) => getFaqById(id)).filter((f): f is FaqItem => Boolean(f));
}

export const faqs: FaqItem[] = [
  {
    id: "drive-or-captain",
    question: "Can I drive the boat myself, or do I need a captain?",
    answer:
      "Both. Choose a boat rental to explore at your own pace, or book a captained charter for fishing, sandbar, snorkel, or sightseeing. USCG-licensed captains are included on captained trips.",
  },
  {
    id: "whats-included",
    question: "What's included?",
    answer:
      "Boats, safety gear, and local knowledge. Captained charters include a USCG-licensed captain. Sandbar and snorkel trips typically include snorkeling gear. We’ll confirm exactly what’s on your boat when you book.",
  },
  {
    id: "fishing-types",
    question: "What fishing charters do you offer?",
    answer:
      "Offshore, reef & wreck, and backcountry. Whether you’re chasing mahi, dropping on the reef for snapper and grouper, or fishing mangroves and flats, every trip is customized to the conditions.",
  },
  {
    id: "sandbar-snorkel",
    question: "Do you do sandbar and snorkel trips?",
    answer:
      "Yes. Luxury sandbar and snorkel experiences run on boats like The Bougie Girl and the Sea Fox 26.8 Commander — built for comfort, with a captain handling every detail.",
  },
  {
    id: "departures",
    question: "Where do you depart from?",
    answer:
      "Tavernier, Florida Keys (Tavernier Creek). We’ll send exact dock and parking notes after you reserve.",
  },
  {
    id: "capacity",
    question: "How many people can come?",
    answer:
      "Capacity depends on the boat. Tell us your group size when you book and we’ll match you to the right rental or charter.",
  },
  {
    id: "occasions",
    question: "What kind of trips do you run?",
    answer:
      "Fishing, sandbar, snorkeling, sunset cruising, sightseeing, families, and fully customized private charters. From serious anglers to a stress-free Keys day with friends.",
  },
  {
    id: "bad-weather",
    question: "What happens if the weather is bad?",
    answer:
      "We run a flexible weather policy. If the Keys don’t cooperate, we work with you to reschedule. Safety always comes first.",
  },
  {
    id: "how-to-book",
    question: "How do I book?",
    answer: `Reserve online for instant confirmation, or call/text ${brand.phone} to talk through dates, trip type, and group size.`,
  },
  {
    id: "captain-braxton",
    question: "Who is Captain Braxton?",
    answer:
      "Captain Braxton Black is a local waterman who knows Florida Keys waters. Guests rave about communication, sandbar picks, snorkeling, and wildlife — dolphins, turtles, even manatees.",
  },
  {
    id: "life-jackets",
    question: "Are life jackets provided?",
    answer: "Yes. Life jackets and required safety gear are included. We’ll outfit anyone who needs a vest before we leave the dock.",
  },
  {
    id: "cancellation-policy",
    question: "What is your cancellation policy?",
    answer:
      "Cancel up to 7 days before your trip for a full refund. If weather doesn't cooperate, we'll work with you on a rain check or full refund. No-shows without notice are non-refundable.",
  },
  {
    id: "what-to-bring",
    question: "What should we bring?",
    answer:
      "Sunscreen, towels, snacks and drinks, a hat, and a downloaded playlist. We’ll confirm cooler space and any boat-specific notes after you book.",
  },
];
