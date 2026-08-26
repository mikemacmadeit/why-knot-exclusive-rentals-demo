"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, X, Loader2 } from "lucide-react";
import Image from "next/image";

export type SocialPlatform = "linkedin" | "instagram";

export interface Story {
  id: string;
  platform: SocialPlatform;
  mediaUrl: string;
  linkUrl: string;
  caption?: string;
  duration?: number;
}

interface SocialStoriesProps {
  stories: Story[];
  profile: {
    name: string;
    avatarUrl: string;
  };
  defaultDuration?: number;
  className?: string;
}

const isVideo = (url: string) =>
  /\.(mp4|webm|ogg)$/i.test(url) || url.includes("/video/");

export function SocialStories({
  stories = [],
  profile,
  defaultDuration = 5,
  className,
}: SocialStoriesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  const activeProgressBarRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastProgressRef = useRef<number>(0);

  const currentStory = stories[currentIndex];
  const currentIsVideo = isVideo(currentStory?.mediaUrl ?? "");
  const durationMs = ((currentStory?.duration ?? defaultDuration) as number) * 1000;

  useEffect(() => {
    setMounted(true);
  }, []);

  const setProgress = (value: number) => {
    lastProgressRef.current = Math.max(0, Math.min(1, value));
    if (activeProgressBarRef.current) {
      activeProgressBarRef.current.style.transform = `scaleX(${lastProgressRef.current})`;
    }
  };

  const stopAnimation = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const resetTiming = useCallback((clearProgress = true) => {
    startTimeRef.current = null;
    pausedAtRef.current = null;
    if (clearProgress) setProgress(0);
    setIsMediaReady(false);
  }, []);

  const goNext = useCallback(() => {
    stopAnimation();
    resetTiming();
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setIsOpen(false);
      setCurrentIndex(0);
    }
  }, [currentIndex, stories.length, resetTiming]);

  const goPrev = useCallback(() => {
    if (currentIndex === 0) return;
    stopAnimation();
    resetTiming();
    setCurrentIndex((i) => i - 1);
  }, [currentIndex, resetTiming]);

  useEffect(() => {
    if (!isOpen || !isMediaReady || currentIsVideo) return;

    const animate = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;

      if (!isPaused) {
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(elapsed / durationMs, 1);
        setProgress(progress);

        if (progress >= 1) {
          stopAnimation();
          requestAnimationFrame(goNext);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    stopAnimation();
    rafRef.current = requestAnimationFrame(animate);
    return () => stopAnimation();
  }, [isOpen, isPaused, isMediaReady, durationMs, goNext, currentIsVideo]);

  useEffect(() => {
    if (!currentIsVideo || !isOpen) return;
    const video = videoRef.current;

    const sync = () => {
      if (!video || !video.duration) {
        rafRef.current = requestAnimationFrame(sync);
        return;
      }
      setProgress(video.currentTime / video.duration);
      rafRef.current = requestAnimationFrame(sync);
    };

    if (isMediaReady && !isPaused) {
      stopAnimation();
      rafRef.current = requestAnimationFrame(sync);
    }
    return () => stopAnimation();
  }, [currentIsVideo, isPaused, isOpen, isMediaReady]);

  useEffect(() => {
    if (isPaused) {
      if (pausedAtRef.current === null) pausedAtRef.current = performance.now();
      videoRef.current?.pause();
      stopAnimation();
    } else {
      if (pausedAtRef.current !== null && startTimeRef.current !== null) {
        startTimeRef.current += performance.now() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
      if (currentIsVideo) videoRef.current?.play().catch(() => {});
    }
  }, [isPaused, currentIsVideo]);

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const { width } = e.currentTarget.getBoundingClientRect();
    e.nativeEvent.offsetX < width / 3 ? goPrev() : goNext();
  };

  if (!mounted || stories.length === 0) return null;

  return (
    <>
      <div className={`relative h-12 w-12 cursor-pointer z-10 sm:h-16 sm:w-16 ${className ?? ""}`}>
        {!isOpen && (
          <motion.div
            layoutId="story-trigger"
            onClick={() => setIsOpen(true)}
            className="absolute inset-0 rounded-full p-[4px]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 rounded-full border-[3px] border-brand-secondary shadow-[0_0_15px_rgba(255,107,43,0.45)]" />
            <div className="absolute inset-[6px] overflow-hidden rounded-full bg-brand-dark ring-2 ring-white">
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                fill
                sizes="64px"
                className="object-cover"
                priority
              />
            </div>
          </motion.div>
        )}
      </div>

      {createPortal(
        <AnimatePresence>
          {isOpen && currentStory && (
            <div className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center">
              <motion.div
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                onClick={() => setIsOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />

              <motion.div
                layoutId="story-card-modal"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="relative flex aspect-[9/16] h-auto max-h-[85vh] w-[90vw] max-w-[420px] flex-col overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-2xl md:rounded-[30px]"
              >
                <div
                  className="relative h-full w-full flex-1"
                  onMouseDown={() => setIsPaused(true)}
                  onMouseUp={handleTap}
                  onMouseLeave={() => setIsPaused(false)}
                  onTouchStart={() => setIsPaused(true)}
                  onTouchEnd={() => setIsPaused(false)}
                >
                  {!isMediaReady && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900">
                      <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-zinc-900">
                    {currentIsVideo ? (
                      <video
                        ref={videoRef}
                        src={currentStory.mediaUrl}
                        playsInline
                        autoPlay
                        className="h-full w-full object-cover"
                        onLoadedData={() => {
                          setIsMediaReady(true);
                          if (!isPaused) videoRef.current?.play().catch(() => {});
                        }}
                        onEnded={goNext}
                      />
                    ) : (
                      <Image
                        src={currentStory.mediaUrl}
                        alt={currentStory.caption || "Story"}
                        fill
                        sizes="420px"
                        className="object-cover"
                        priority
                        onLoad={() => setIsMediaReady(true)}
                      />
                    )}
                  </div>

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />

                  <div className="absolute left-4 right-4 top-4 z-20 flex gap-1.5">
                    {stories.map((_, i) => (
                      <div key={i} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30">
                        <div
                          ref={i === currentIndex ? activeProgressBarRef : null}
                          className="h-full origin-left bg-white"
                          style={{
                            transform: i < currentIndex ? "scaleX(1)" : "scaleX(0)",
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="absolute left-4 right-4 top-8 z-20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20">
                        <Image
                          src={profile.avatarUrl}
                          alt={profile.name}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold leading-none text-white drop-shadow-sm">
                          {profile.name}
                        </span>
                        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-white/70">
                          {currentStory.platform}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                      }}
                      className="rounded-full bg-white/10 p-2 backdrop-blur-md transition-colors hover:bg-white/20"
                      aria-label="Close story"
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                  </div>

                  <div className="absolute bottom-6 left-5 right-5 z-20 flex items-end justify-between gap-4">
                    <div className="flex-1">
                      {currentStory.caption ? (
                        <p className="line-clamp-2 text-[15px] font-medium leading-relaxed text-white drop-shadow-md">
                          {currentStory.caption}
                        </p>
                      ) : null}
                    </div>
                    {currentStory.linkUrl ? (
                      <a
                        href={currentStory.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/20 backdrop-blur-md transition-all hover:scale-105 hover:bg-white/30"
                        aria-label="Open on Instagram"
                      >
                        <ArrowUpRight className="h-5 w-5 text-white" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
