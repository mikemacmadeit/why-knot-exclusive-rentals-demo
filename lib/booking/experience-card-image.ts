/**
 * Pick a still image URL for listing/category cards (Next/Image).
 * Video heroes and empty heroes fall back to the first non-video gallery URL.
 * Skips founder/portrait URLs so people photos never become fleet card covers.
 */

const LIKELY_VIDEO_RE = /youtube\.com|youtu\.be|vimeo\.com|\.mp4(\?|$)/i;
/** People / story shots that should not be listing covers when a boat photo exists. */
const NON_LISTING_IMAGE_RE = /founder|portrait|welcome[-_]?photo|headshot|about[-_]?us/i;

function isLikelyVideoUrl(url: string): boolean {
  return LIKELY_VIDEO_RE.test(url);
}

function isNonListingPeoplePhoto(url: string): boolean {
  return NON_LISTING_IMAGE_RE.test(url);
}

function firstUsableGalleryImage(gallery?: string[] | null | undefined): string | null {
  const g = (gallery ?? []).find(
    (u) => typeof u === "string" && u.trim() !== "" && !isLikelyVideoUrl(u.trim()) && !isNonListingPeoplePhoto(u.trim())
  );
  return g?.trim() ?? null;
}

export function experienceCardImageUrl(
  heroMedia: { type?: "image" | "video"; url?: string } | null | undefined,
  gallery?: string[] | null | undefined,
): string | null {
  const raw = heroMedia?.url?.trim() ?? "";
  const type = heroMedia?.type;

  if (type === "image" && raw && !isNonListingPeoplePhoto(raw)) return raw;
  if (type === "image" && raw && isNonListingPeoplePhoto(raw)) {
    return firstUsableGalleryImage(gallery) ?? raw;
  }

  if (type === "video") {
    return firstUsableGalleryImage(gallery);
  }

  if (raw) {
    if (!isLikelyVideoUrl(raw) && !isNonListingPeoplePhoto(raw)) return raw;
    return firstUsableGalleryImage(gallery) ?? (isLikelyVideoUrl(raw) ? null : raw);
  }

  return firstUsableGalleryImage(gallery);
}
