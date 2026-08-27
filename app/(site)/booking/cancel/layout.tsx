import type { Metadata } from "next";
import { brand } from "@/content/brand";

export const metadata: Metadata = {
  title: "Booking cancelled",
  description: `Your booking was not completed. Try again anytime. ${brand.companyName}, South Lake Tahoe.`,
};

export default function CancelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
