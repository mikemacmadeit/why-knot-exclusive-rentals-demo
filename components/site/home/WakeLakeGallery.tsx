"use client";

import InteractiveImageBentoGallery from "@/components/ui/bento-gallery";

const P = "/photos/whyknot";

/** One unique Why Knot photo per tile — fishing, sandbar, snorkel, and rental stay on-topic. */
const lakeMoments = [
  { id: 1, title: "Sandbar day", desc: "Clear Keys water, anchored up.", url: `${P}/sandbar-contender.jpg`, span: "row-span-2" },
  { id: 2, title: "Boat rental", desc: "Explore at your own pace.", url: `${P}/boat-day.png`, span: "row-span-1" },
  { id: 3, title: "Swordfish", desc: "Offshore, reef, backcountry.", url: `${P}/catch-swordfish.jpg`, span: "row-span-1" },
  { id: 4, title: "The Bougie Girl", desc: "Comfort-first sandbar charter.", url: `${P}/bougie-girl.jpg`, span: "row-span-2" },
  { id: 5, title: "Cheers", desc: "Why Knot on the sandbar.", url: `${P}/sandbar-cheers.jpg`, span: "row-span-1" },
  { id: 6, title: "Crew day", desc: "Show up and make memories.", url: `${P}/gallery-4.jpg`, span: "row-span-1" },
  { id: 7, title: "The catch", desc: "The shot everyone sends home.", url: `${P}/gallery-3.jpg`, span: "row-span-2" },
  { id: 8, title: "Snorkel", desc: "Gear on the sandbar trips.", url: `${P}/gallery-2.jpg`, span: "row-span-1" },
  { id: 9, title: "On the bite", desc: "Customized to conditions.", url: `${P}/gallery-6.jpg`, span: "row-span-1" },
  { id: 10, title: "Queen snapper", desc: "Deep water, real fish.", url: `${P}/catch-snapper.jpg`, span: "row-span-2" },
  { id: 11, title: "Barracuda", desc: "Dockside after a Keys day.", url: `${P}/catch-barracuda.jpg`, span: "row-span-1" },
  { id: 12, title: "Lobster", desc: "The cooler tells the story.", url: `${P}/catch-lobsters.jpg`, span: "row-span-1" },
  { id: 13, title: "On the water", desc: "Tavernier sandbar scene.", url: `${P}/hero.jpg`, span: "row-span-2" },
];

export function WakeLakeGallery() {
  return (
    <InteractiveImageBentoGallery
      imageItems={lakeMoments}
      eyebrow="Life on the water"
      title="In the Keys"
      description="Nothing sells a Florida Keys day better than seeing one. Drag to explore — click any shot to go full screen."
      className="w-full -mt-px"
    />
  );
}
