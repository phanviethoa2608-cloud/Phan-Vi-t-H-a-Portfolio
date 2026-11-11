/**
 * Core type definitions for AI Video Studio
 * Hybrid Free Image Search + AI Vision Matching + Voice Synchronization + Clause Segmentation
 */

export type AspectRatio = "916" | "169";
export type VideoStyle = "LUANCUT_EDITORIAL" | "DEFAULT";
export type SceneTemplate = "kinetic-title" | "feature-card" | "quote" | "end-card";
export type HighlightStyle = "editorial" | "ocean" | "number" | "glass" | "subordinate";

export interface KeywordHighlight {
  id?: string;
  text: string;
  style: HighlightStyle;
  start: number; // seconds from scene start
  end: number;   // seconds from scene start
  est?: boolean; // estimated timestamp vs voice-aligned
  clauseType?: "main" | "subordinate";
}

export interface ClauseSegment {
  id: string;
  text: string;
  type: "main" | "subordinate";
  role?: string; // e.g. "Thời gian", "Điều kiện", "Mục đích", "Nguyên nhân", "Ý chính"
  start?: number;
  end?: number;
  highlightWords?: string[];
}

export interface HeadlineConfig {
  small: string; // lead-in dòng dẫn
  main: string;  // headline chính nổi bật
  tag: string;   // tag nhãn
}

export interface VoiceTimestamp {
  start: number; // scene start in audio seconds
  end: number;   // scene end in audio seconds
  sa: number;    // speech active start in audio seconds
  sb: number;    // speech active end in audio seconds
}

export interface SegmentAnalysis {
  ai: boolean;
  subject?: string;
  secondary?: string;
  entities?: string[];
  action?: string;
  object?: string;
  environment?: string;
  intent?: string;
  emotion?: string;
  importance?: string;
  queries: string[];
  clauses?: ClauseSegment[];
}

export interface MatchScoreBreakdown {
  subjectScore: number;    // max 30
  actionScore: number;     // max 25
  contextScore: number;    // max 20
  entityScore: number;     // max 15
  compositionScore: number;// max 10
  totalScore: number;      // max 100
  reason: string;
  contradiction: boolean;
  misleading: boolean;
}

export interface VoiceVisualAsset {
  id: string;
  projectId: string;
  segmentId: string;
  assetId: string;

  provider: "openverse" | "wikimedia" | "pixabay" | "google_manual" | "manual";
  sourceUrl?: string;
  originalUrl?: string;
  thumbnailUrl?: string;
  localAssetUrl?: string; // cached locally on server or base64
  name?: string;
  license?: string;
  licenseUrl?: string;
  creator?: string;
  creatorUrl?: string;
  attribution?: string;

  relevanceScore?: number;
  scoreBreakdown?: MatchScoreBreakdown;
  matchMethod: "vision_verified" | "metadata_only" | "manual_selection";

  selected: boolean;
  approved: boolean;
  licenseVerified: boolean;

  startTime: number;
  endTime: number;

  fitMode: "cover" | "contain";
  focalPoint?: {
    x: number;
    y: number;
  };

  width?: number;
  height?: number;
}

export interface Scene {
  id: string;
  title: string;
  text: string;
  narration?: string;
  durationInFrames: number;
  template: SceneTemplate;
  accent: string;
  headline?: HeadlineConfig;
  keywords: KeywordHighlight[];
  clauses?: ClauseSegment[];
  clauseDisplayMode?: "split" | "inline" | "two-tier"; // how main vs subordinate is rendered
  voice?: VoiceTimestamp;
  analysis?: SegmentAnalysis;
  visual?: VoiceVisualAsset;
  candidates?: ImageResult[];
}

export interface ProjectData {
  id: string;
  name: string;
  version: number;
  width: number;
  height: number;
  fps: number;
  style: VideoStyle;
  aspect: AspectRatio;
  audio: {
    voiceVolume: number;
    musicVolume: number;
  };
  voiceSync?: {
    file: string;
    duration: number;
    method: "silence" | "mixed" | "estimated";
    snapped: number;
    total: number;
  };
  scenes: Scene[];
}

export interface ImageResult {
  id: string;
  provider: "openverse" | "wikimedia" | "pixabay" | "google_manual" | "manual";
  title: string;
  thumbnailUrl: string;
  imageUrl?: string;
  sourcePageUrl: string;
  creator?: string;
  creatorUrl?: string;
  license?: string;
  licenseUrl?: string;
  attribution?: string;
  width?: number;
  height?: number;
  description?: string;
  tags?: string[];

  // Populated during AI ranking:
  matchScore?: number;
  scoreBreakdown?: MatchScoreBreakdown;
  matchMethod?: "vision_verified" | "metadata_only";
  recommendationReason?: string;
  evaluating?: boolean;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  orientation?: "horizontal" | "vertical" | "square";
  minWidth?: number;
  minHeight?: number;
  language?: string;
}

export interface VisionCapabilities {
  supportsImageInput: boolean;
  supportsMultipleImages: boolean;
  supportsStructuredOutput: boolean;
  model: string;
  provider: string;
}
