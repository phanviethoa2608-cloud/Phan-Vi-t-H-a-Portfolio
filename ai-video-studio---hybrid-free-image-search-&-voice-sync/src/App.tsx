/**
 * AI Video Studio - Master Application Entry
 * Hybrid Free Image Search + AI Vision Matching + Voice Synchronization + Clause Segmentation
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Scene,
  ProjectData,
  ImageResult,
  VoiceVisualAsset,
  AspectRatio,
  VideoStyle
} from "./types.js";
import { Header } from "./components/Header.js";
import { StagePreview } from "./components/StagePreview.js";
import { ScriptPanel } from "./components/ScriptPanel.js";
import { SceneEditor } from "./components/SceneEditor.js";
import { ImageReviewWorkspace } from "./components/ImageReviewWorkspace.js";
import { Timeline } from "./components/Timeline.js";
import { SettingsModal } from "./components/SettingsModal.js";
import {
  splitScriptIntoScenes,
  splitSentenceIntoClauses,
  extractKeywords
} from "./utils/clauseParser.js";

const DEFAULT_SCRIPT =
  "Bí quyết gấp đôi hiệu suất làm việc trong 7 ngày.\n" +
  "Khi bạn bắt đầu ngày mới với một kế hoạch rõ ràng, năng suất sẽ tăng vượt bậc.\n" +
  "Chỉ cần 3 bước đơn giản, tiết kiệm 50% thời gian với AI VIDEO STUDIO.";

export default function App() {
  // Project State
  const [project, setProject] = useState<ProjectData>(() => {
    try {
      const saved = localStorage.getItem("aivs_project_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.scenes && parsed.scenes.length > 0) return parsed;
      }
    } catch {}

    const initialScenes = splitScriptIntoScenes(DEFAULT_SCRIPT);
    return {
      id: `proj-${Date.now()}`,
      name: "Video mới",
      version: 2,
      width: 1080,
      height: 1920,
      fps: 30,
      style: "LUANCUT_EDITORIAL",
      aspect: "916",
      audio: { voiceVolume: 1, musicVolume: 0.18 },
      scenes: initialScenes
    };
  });

  const [script, setScript] = useState<string>(() =>
    project.scenes.map((s) => s.text).join("\n")
  );

  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<"scene" | "image">("image");

  // Voice & Audio Buffer
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceAudioBuffer, setVoiceAudioBuffer] = useState<AudioBuffer | null>(null);
  const [voiceInfo, setVoiceInfo] = useState<{
    name: string;
    duration: number;
    pauseCount: number;
    env?: Float32Array;
    pauses?: Array<{ a: number; b: number }>;
    sp0?: number;
    sp1?: number;
    hop?: number;
    thr?: number;
  } | null>(null);
  const [voiceSyncStatus, setVoiceSyncStatus] = useState<string | null>(null);

  // Bitmaps for Canvas Rendering
  const [imageBitmaps, setImageBitmaps] = useState<Record<string, ImageBitmap>>({});

  // Loading States
  const [isAiDirectorLoading, setIsAiDirectorLoading] = useState(false);
  const [isAutoEditRunning, setIsAutoEditRunning] = useState(false);
  const [autoEditStep, setAutoEditStep] = useState(0);
  const [autoEditStepsData, setAutoEditStepsData] = useState<
    Array<{ status: "wait" | "run" | "ok" | "warn"; message: string }>
  >([
    { status: "wait", message: "" },
    { status: "wait", message: "" },
    { status: "wait", message: "" },
    { status: "wait", message: "" },
    { status: "wait", message: "" },
    { status: "wait", message: "" }
  ]);

  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [isVerifyingVision, setIsVerifyingVision] = useState(false);

  // Settings & Pixabay Key
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pixabayKey, setPixabayKey] = useState<string>(() => {
    return localStorage.getItem("aivs_pixabay_key") || "";
  });
  const [serverConfig, setServerConfig] = useState<any>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Save project to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem("aivs_project_v2", JSON.stringify(project));
    } catch {}
  }, [project]);

  // Fetch server config on mount
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setServerConfig(data))
      .catch(() => {});
  }, []);

  // Ensure approved visual assets are decoded as ImageBitmaps for canvas
  useEffect(() => {
    project.scenes.forEach((scene) => {
      const v = scene.visual;
      if (v && v.approved && !imageBitmaps[scene.id]) {
        const url = v.localAssetUrl || v.thumbnailUrl || v.originalUrl;
        if (!url) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        img.onload = async () => {
          try {
            const bmp = await createImageBitmap(img);
            setImageBitmaps((prev) => ({ ...prev, [scene.id]: bmp }));
          } catch {}
        };
      }
    });
  }, [project.scenes, imageBitmaps]);

  const activeScene = project.scenes[selectedSceneIndex] || project.scenes[0];

  // Helper to update active scene
  const updateActiveScene = useCallback(
    (patch: Partial<Scene>) => {
      setProject((prev) => {
        const scenes = [...prev.scenes];
        scenes[selectedSceneIndex] = {
          ...scenes[selectedSceneIndex],
          ...patch
        };
        return { ...prev, scenes };
      });
    },
    [selectedSceneIndex]
  );

  // -------------------------------------------------------------
  // Voice Audio Processing & Silence-based Pause Snapping
  // -------------------------------------------------------------
  const analyzeAudioBuffer = (buffer: AudioBuffer) => {
    const hop = 0.02;
    const channel = buffer.getChannelData(0);
    const numHops = Math.floor(buffer.duration / hop);
    const hopSize = Math.floor(buffer.sampleRate * hop);
    const env = new Float32Array(numHops);

    for (let i = 0; i < numHops; i++) {
      let sumSq = 0;
      for (let j = 0; j < hopSize; j++) {
        const v = channel[i * hopSize + j] || 0;
        sumSq += v * v;
      }
      env[i] = Math.sqrt(sumSq / hopSize);
    }

    const sortedEnv = Array.from(env).sort((a, b) => a - b);
    const thr = Math.max(0.008, sortedEnv[Math.floor(numHops * 0.95)] * 0.1);
    const silence = Array.from(env, (v) => v < thr);

    let sp0 = 0;
    while (sp0 < numHops && silence[sp0]) sp0++;
    let sp1 = numHops - 1;
    while (sp1 > sp0 && silence[sp1]) sp1--;

    const pauses: Array<{ a: number; b: number }> = [];
    for (let i = sp0; i <= sp1; ) {
      if (!silence[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j <= sp1 && silence[j]) j++;
      if ((j - i) * hop >= 0.22) {
        pauses.push({ a: i * hop, b: j * hop });
      }
      i = j;
    }

    return {
      env,
      hop,
      thr,
      sp0: sp0 * hop,
      sp1: (sp1 + 1) * hop,
      pauses
    };
  };

  const handleVoiceUpload = async (file: File) => {
    if (file.size > 40 * 1024 * 1024) {
      alert("File voice quá lớn (tối đa 40 MB).");
      return;
    }

    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);

      const analysis = analyzeAudioBuffer(decoded);

      setVoiceFile(file);
      setVoiceAudioBuffer(decoded);
      setVoiceInfo({
        name: file.name,
        duration: decoded.duration,
        pauseCount: analysis.pauses.length,
        ...analysis
      });

      setVoiceSyncStatus(
        `Đã tải file voice: ${file.name} (${decoded.duration.toFixed(1)}s, ${analysis.pauses.length} khoảng lặng). Bấm "Khớp Voice" để đồng bộ mốc thời gian.`
      );
    } catch (e) {
      alert("Không đọc được file âm thanh. Vui lòng thử file MP3 hoặc WAV khác.");
    }
  };

  const handleVoiceSync = useCallback(() => {
    if (!voiceAudioBuffer || !voiceInfo) {
      alert("Vui lòng tải file voice lên trước khi đồng bộ.");
      return;
    }

    const D = voiceAudioBuffer.duration;
    const S = [...project.scenes];
    const totalChars = S.reduce((sum, s) => sum + s.text.length, 0) || 1;

    const innerPauses = (voiceInfo.pauses || [])
      .filter((p) => p.a > (voiceInfo.sp0 || 0) + 0.1 && p.b < (voiceInfo.sp1 || D) - 0.1)
      .map((p) => ({ m: (p.a + p.b) / 2, used: false }));

    const tol = Math.max(0.6, 0.12 * ((voiceInfo.sp1 || D) - (voiceInfo.sp0 || 0)));
    let cumChars = 0;
    let snappedCount = 0;
    const boundaries = [0];

    for (let i = 0; i < S.length - 1; i++) {
      cumChars += S[i].text.length;
      const targetTime =
        (voiceInfo.sp0 || 0) +
        ((voiceInfo.sp1 || D) - (voiceInfo.sp0 || 0)) * (cumChars / totalChars);

      let best: { m: number; used: boolean } | null = null;
      for (const p of innerPauses) {
        if (!p.used && Math.abs(p.m - targetTime) <= tol) {
          if (!best || Math.abs(p.m - targetTime) < Math.abs(best.m - targetTime)) {
            best = p;
          }
        }
      }

      if (best) {
        best.used = true;
        snappedCount++;
        boundaries.push(best.m);
      } else {
        boundaries.push(targetTime);
      }
    }
    boundaries.push(D);

    // Enforce minimum scene duration
    for (let i = 1; i < boundaries.length; i++) {
      boundaries[i] = Math.max(boundaries[i], boundaries[i - 1] + 0.4);
    }
    boundaries[boundaries.length - 1] = D;

    const FPS = 30;
    const syncedScenes: Scene[] = S.map((s, i) => {
      const startT = boundaries[i];
      const endT = boundaries[i + 1];
      const frames = Math.max(12, Math.round((endT - startT) * FPS));

      return {
        ...s,
        durationInFrames: frames,
        voice: {
          start: Number(startT.toFixed(2)),
          end: Number(endT.toFixed(2)),
          sa: Number(startT.toFixed(2)),
          sb: Number(endT.toFixed(2))
        }
      };
    });

    setProject((prev) => ({
      ...prev,
      voiceSync: {
        file: voiceInfo.name,
        duration: Number(D.toFixed(2)),
        method:
          snappedCount === S.length - 1
            ? "silence"
            : snappedCount > 0
            ? "mixed"
            : "estimated",
        snapped: snappedCount,
        total: S.length - 1
      },
      scenes: syncedScenes
    }));

    setVoiceSyncStatus(
      `Đồng bộ hoàn tất: Khớp ${snappedCount}/${S.length - 1} mốc theo khoảng lặng giọng nói.`
    );
  }, [voiceAudioBuffer, voiceInfo, project.scenes]);

  // -------------------------------------------------------------
  // Script Breakdown & Clause Splitting
  // -------------------------------------------------------------
  const handleSplitScript = () => {
    if (!script.trim()) return;
    const newScenes = splitScriptIntoScenes(script);
    setProject((prev) => ({ ...prev, scenes: newScenes }));
    setSelectedSceneIndex(0);
    setCurrentFrame(0);
  };

  const handleSplitClauses = () => {
    setProject((prev) => {
      const updatedScenes = prev.scenes.map((s) => ({
        ...s,
        clauses: splitSentenceIntoClauses(s.text)
      }));
      return { ...prev, scenes: updatedScenes };
    });
  };

  const handleAiDirector = async () => {
    if (!script.trim()) {
      alert("Vui lòng nhập kịch bản trước.");
      return;
    }

    setIsAiDirectorLoading(true);
    try {
      const res = await fetch("/api/gemini/ai-director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script })
      });

      if (!res.ok) throw new Error("AI Director endpoint failed");
      const data = await res.json();

      if (Array.isArray(data.scenes) && data.scenes.length > 0) {
        const mappedScenes: Scene[] = data.scenes.map((c: any, i: number) => {
          const durSec = Math.max(3, Math.min(12, Number(c.durationSeconds) || 5));
          return {
            id: `scene-${String(i + 1).padStart(2, "0")}`,
            title: c.title || `SCENE ${i + 1}`,
            text: c.text,
            narration: c.narration || c.text,
            durationInFrames: Math.round(durSec * 30),
            template: c.template || "feature-card",
            accent: c.accent || "#7c3aed",
            headline: c.headline || { small: "", main: c.title, tag: "" },
            clauses: c.clauses || splitSentenceIntoClauses(c.text),
            keywords: (c.keywords || []).map((k: any) => ({
              text: k.text,
              style: k.style || "editorial",
              start: Number(k.startSeconds) || 0,
              end: Number(k.endSeconds) || durSec,
              est: true
            })),
            clauseDisplayMode: "two-tier"
          };
        });

        setProject((prev) => ({ ...prev, scenes: mappedScenes }));
        setSelectedSceneIndex(0);
        setCurrentFrame(0);
      }
    } catch (e) {
      console.warn("AI Director fallback:", e);
      handleSplitScript();
    } finally {
      setIsAiDirectorLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Image Search & AI Vision Verification
  // -------------------------------------------------------------
  const searchImagesForScene = async (queryText: string, sceneIdx = selectedSceneIndex) => {
    if (!queryText.trim()) return;

    setIsSearchingImages(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (pixabayKey.trim()) {
        headers["x-pixabay-key"] = pixabayKey.trim();
      }

      const res = await fetch("/api/images/search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: queryText,
          options: { limit: 12, orientation: project.aspect === "916" ? "vertical" : "horizontal" }
        })
      });

      if (!res.ok) throw new Error("Search API error");
      const data = await res.json();

      const results: ImageResult[] = data.results || [];

      setProject((prev) => {
        const scenes = [...prev.scenes];
        if (scenes[sceneIdx]) {
          scenes[sceneIdx] = {
            ...scenes[sceneIdx],
            candidates: results
          };
        }
        return { ...prev, scenes };
      });
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsSearchingImages(false);
    }
  };

  const verifyCandidatesWithVision = async (sceneIdx = selectedSceneIndex) => {
    const sceneToVerify = project.scenes[sceneIdx];
    if (!sceneToVerify || !sceneToVerify.candidates?.length) return;

    setIsVerifyingVision(true);
    try {
      const res = await fetch("/api/vision/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentText: sceneToVerify.text,
          visualIntent: sceneToVerify.analysis?.intent || sceneToVerify.text,
          candidates: sceneToVerify.candidates.map((c) => ({
            id: c.id,
            title: c.title,
            thumbnailUrl: c.thumbnailUrl,
            description: c.description,
            tags: c.tags
          }))
        })
      });

      if (!res.ok) throw new Error("Vision API error");
      const data = await res.json();
      const evaluations = data.evaluations || {};

      setProject((prev) => {
        const scenes = [...prev.scenes];
        const currentCandidates = scenes[sceneIdx].candidates || [];

        const updatedCandidates = currentCandidates.map((c) => {
          const evalItem = evaluations[c.id];
          if (evalItem) {
            return {
              ...c,
              matchScore: evalItem.scoreBreakdown.totalScore,
              scoreBreakdown: evalItem.scoreBreakdown,
              matchMethod: evalItem.matchMethod,
              recommendationReason: evalItem.scoreBreakdown.reason
            };
          }
          return c;
        });

        // Sort candidates by matchScore descending
        updatedCandidates.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

        scenes[sceneIdx] = {
          ...scenes[sceneIdx],
          candidates: updatedCandidates
        };
        return { ...prev, scenes };
      });
    } catch (e) {
      console.error("Vision match failed:", e);
    } finally {
      setIsVerifyingVision(false);
    }
  };

  // Select & Approve Image into Scene
  const handleSelectAndApprove = async (img: ImageResult) => {
    try {
      // 1. Download image safely to server storage with SSRF protection
      const dlRes = await fetch("/api/assets/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: img.imageUrl || img.thumbnailUrl,
          name: img.title
        })
      });

      let localAssetUrl = img.thumbnailUrl;
      let dataUrl = img.thumbnailUrl;

      if (dlRes.ok) {
        const dlData = await dlRes.json();
        localAssetUrl = dlData.localAssetUrl;
        dataUrl = dlData.dataUrl;
      }

      // 2. Create ImageBitmap for immediate canvas drawing
      const imgElem = new Image();
      imgElem.crossOrigin = "anonymous";
      imgElem.src = dataUrl;
      await new Promise((resolve) => {
        imgElem.onload = resolve;
        imgElem.onerror = resolve;
      });

      const bitmap = await createImageBitmap(imgElem);
      setImageBitmaps((prev) => ({
        ...prev,
        [activeScene.id]: bitmap
      }));

      // 3. Update Visual Asset in Scene state
      const visualAsset: VoiceVisualAsset = {
        id: `vis-${Date.now()}`,
        projectId: project.id,
        segmentId: activeScene.id,
        assetId: `asset-${Date.now()}`,
        provider: img.provider,
        sourceUrl: img.sourcePageUrl,
        originalUrl: img.imageUrl || img.thumbnailUrl,
        thumbnailUrl: img.thumbnailUrl,
        localAssetUrl,
        name: img.title,
        creator: img.creator,
        creatorUrl: img.creatorUrl,
        license: img.license || "Creative Commons",
        licenseUrl: img.licenseUrl,
        attribution: img.attribution,
        relevanceScore: img.matchScore,
        scoreBreakdown: img.scoreBreakdown,
        matchMethod: img.matchMethod || "metadata_only",
        selected: true,
        approved: true, // User clicked to select & approve!
        licenseVerified: !!img.license,
        startTime: activeScene.voice?.start || 0,
        endTime: activeScene.voice?.end || activeScene.durationInFrames / 30,
        fitMode: "cover",
        width: bitmap.width,
        height: bitmap.height
      };

      updateActiveScene({ visual: visualAsset });
    } catch (e) {
      console.error("Select and approve image failed:", e);
      alert("Không thể lưu ảnh đã chọn. Vui lòng thử lại.");
    }
  };

  // Manual File Upload Handler
  const handleUploadImageFile = async (file: File) => {
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/assets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Data,
          mimeType: file.type,
          filename: file.name
        })
      });

      if (!res.ok) throw new Error("Upload error");
      const data = await res.json();

      const imgElem = new Image();
      imgElem.src = base64Data;
      await new Promise((r) => (imgElem.onload = r));
      const bitmap = await createImageBitmap(imgElem);

      setImageBitmaps((prev) => ({
        ...prev,
        [activeScene.id]: bitmap
      }));

      const visualAsset: VoiceVisualAsset = {
        id: `vis-${Date.now()}`,
        projectId: project.id,
        segmentId: activeScene.id,
        assetId: data.assetId,
        provider: "manual",
        localAssetUrl: data.localAssetUrl,
        originalUrl: data.dataUrl,
        name: file.name,
        creator: "Người dùng tải lên",
        license: "Bản quyền người dùng",
        licenseVerified: true,
        matchMethod: "manual_selection",
        selected: true,
        approved: true,
        startTime: activeScene.voice?.start || 0,
        endTime: activeScene.voice?.end || activeScene.durationInFrames / 30,
        fitMode: "cover",
        width: bitmap.width,
        height: bitmap.height
      };

      updateActiveScene({ visual: visualAsset });
    } catch (e) {
      console.error("Upload failed:", e);
      alert("Lỗi khi tải ảnh lên.");
    }
  };

  // -------------------------------------------------------------
  // Master Auto-Edit Pipeline
  // -------------------------------------------------------------
  const handleAutoEdit = async () => {
    if (isAutoEditRunning) return;
    setIsAutoEditRunning(true);

    const steps = [
      { status: "wait", message: "" },
      { status: "wait", message: "" },
      { status: "wait", message: "" },
      { status: "wait", message: "" },
      { status: "wait", message: "" },
      { status: "wait", message: "" }
    ] as Array<{ status: "wait" | "run" | "ok" | "warn"; message: string }>;

    setAutoEditStepsData(steps);

    try {
      // Step 0: Input Validation
      setAutoEditStep(0);
      steps[0] = {
        status: "ok",
        message: `${project.scenes.length} cảnh · ${
          voiceAudioBuffer ? `Voice ${voiceAudioBuffer.duration.toFixed(1)}s` : "Chưa có voice"
        }`
      };
      setAutoEditStepsData([...steps]);

      // Step 1: Voice Sync & Segment Analyzer
      setAutoEditStep(1);
      steps[1] = { status: "run", message: "Đang đồng bộ voice & phân tích nội dung..." };
      setAutoEditStepsData([...steps]);

      if (voiceAudioBuffer && voiceInfo) {
        handleVoiceSync();
      }

      // Analyze each scene with Gemini Segment Analyzer
      const analyzedScenes: Scene[] = [];
      for (const s of project.scenes) {
        try {
          const res = await fetch("/api/gemini/analyze-segment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: s.text })
          });
          if (res.ok) {
            const anData = await res.json();
            analyzedScenes.push({
              ...s,
              analysis: anData,
              clauses: anData.clauses || splitSentenceIntoClauses(s.text)
            });
            continue;
          }
        } catch {}
        analyzedScenes.push({
          ...s,
          clauses: splitSentenceIntoClauses(s.text)
        });
      }

      setProject((prev) => ({ ...prev, scenes: analyzedScenes }));
      steps[1] = { status: "ok", message: "Đã phân tách câu chính phụ & sinh queries." };
      setAutoEditStepsData([...steps]);

      // Step 2: Multi-Provider Search
      setAutoEditStep(2);
      steps[2] = { status: "run", message: "Đang tìm kiếm Openverse, Wiki, Pixabay..." };
      setAutoEditStepsData([...steps]);

      const searchedScenes: Scene[] = [];
      for (let i = 0; i < analyzedScenes.length; i++) {
        const sc = analyzedScenes[i];
        const query =
          sc.analysis?.queries?.[0] ||
          sc.clauses?.find((c) => c.type === "main")?.text ||
          sc.text.split(/\s+/).slice(0, 6).join(" ");

        try {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (pixabayKey.trim()) headers["x-pixabay-key"] = pixabayKey.trim();

          const sRes = await fetch("/api/images/search", {
            method: "POST",
            headers,
            body: JSON.stringify({
              query,
              options: { limit: 8, orientation: project.aspect === "916" ? "vertical" : "horizontal" }
            })
          });
          if (sRes.ok) {
            const sData = await sRes.json();
            searchedScenes.push({ ...sc, candidates: sData.results || [] });
            continue;
          }
        } catch {}
        searchedScenes.push(sc);
      }

      setProject((prev) => ({ ...prev, scenes: searchedScenes }));
      steps[2] = { status: "ok", message: "Đã thu thập kho ảnh ứng viên đa nguồn." };
      setAutoEditStepsData([...steps]);

      // Step 3: AI Vision Matching & Ranking
      setAutoEditStep(3);
      steps[3] = { status: "run", message: "Gemini AI Vision đang đối soát hình ảnh..." };
      setAutoEditStepsData([...steps]);

      for (let i = 0; i < searchedScenes.length; i++) {
        await verifyCandidatesWithVision(i);
      }

      steps[3] = { status: "ok", message: "Đã chấm điểm theo chủ thể, hành động, bối cảnh." };
      setAutoEditStepsData([...steps]);

      // Step 4: User Approval Gate
      setAutoEditStep(4);
      const approvedCount = searchedScenes.filter((s) => s.visual?.approved).length;
      steps[4] = {
        status: approvedCount === searchedScenes.length ? "ok" : "warn",
        message: `${approvedCount}/${searchedScenes.length} cảnh đã duyệt ảnh. Hãy chọn ảnh ứng viên.`
      };
      setAutoEditStepsData([...steps]);

      // Step 5: Timeline Synced
      setAutoEditStep(5);
      steps[5] = {
        status: "ok",
        message: "Timeline sẵn sàng. Có thể xem trước hoặc xuất video."
      };
      setAutoEditStepsData([...steps]);
    } catch (e) {
      console.error("Auto edit error:", e);
      alert("Auto edit gặp sự cố. Bạn có thể duyệt và tìm ảnh thủ công.");
    } finally {
      setIsAutoEditRunning(false);
    }
  };

  // -------------------------------------------------------------
  // Export WebM Video (Audio + Canvas MediaRecorder)
  // -------------------------------------------------------------
  const handleExportWebM = async () => {
    if (isExporting) return;
    if (!window.MediaRecorder) {
      alert("Trình duyệt không hỗ trợ MediaRecorder.");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setIsPlaying(false);

    try {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("Canvas not found");

      const stream = canvas.captureStream(30);

      let audioSource: AudioBufferSourceNode | null = null;
      let audioCtx: AudioContext | null = null;

      if (voiceAudioBuffer) {
        audioCtx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        await audioCtx.resume();
        const dest = audioCtx.createMediaStreamDestination();
        audioSource = audioCtx.createBufferSource();
        audioSource.buffer = voiceAudioBuffer;
        audioSource.connect(dest);
        dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      }

      const mimeType = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
      ].find((m) => MediaRecorder.isTypeSupported(m));

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6000000
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };

      const recorderDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
      });

      const totalFrames = project.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
      const startTime = performance.now();

      recorder.start();
      if (audioSource) audioSource.start(0);

      // Frame by frame stepping
      await new Promise<void>((resolve) => {
        const step = () => {
          const elapsed = (performance.now() - startTime) / 1000;
          const frame = Math.floor(elapsed * 30);
          if (frame >= totalFrames) {
            resolve();
            return;
          }
          setCurrentFrame(frame);
          setExportProgress(Math.round((frame / totalFrames) * 100));
          requestAnimationFrame(step);
        };
        step();
      });

      recorder.stop();
      if (audioSource) {
        try {
          audioSource.stop();
        } catch {}
      }

      const videoBlob = await recorderDone;

      // Trigger file download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(videoBlob);
      a.download = `${(project.name || "video").replace(/[\\/:*?"<>|]+/g, "").trim()}.webm`;
      a.click();
    } catch (e) {
      console.error("Export error:", e);
      alert("Xuất video thất bại.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setCurrentFrame(0);
    }
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `${(project.name || "project").replace(/[\\/:*?"<>|]+/g, "").trim()}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Header */}
      <Header
        projectName={project.name}
        onProjectNameChange={(name) => setProject((p) => ({ ...p, name }))}
        style={project.style}
        onStyleChange={(style) => setProject((p) => ({ ...p, style }))}
        aspect={project.aspect}
        onAspectChange={(aspect) => setProject((p) => ({ ...p, aspect }))}
        onExportWebM={handleExportWebM}
        onExportJson={handleExportJson}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isExporting={isExporting}
        exportProgress={exportProgress}
      />

      {/* Main Studio 3-Column Layout */}
      <div className="flex-1 max-w-[1720px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Script & Audio Sync (3.5 cols) */}
        <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-4">
          <ScriptPanel
            script={script}
            onScriptChange={setScript}
            onSplitScript={handleSplitScript}
            onSplitClauses={handleSplitClauses}
            onAiDirector={handleAiDirector}
            onAutoEdit={handleAutoEdit}
            onVoiceUpload={handleVoiceUpload}
            onVoiceSync={handleVoiceSync}
            voiceInfo={voiceInfo}
            voiceSyncStatus={voiceSyncStatus}
            isAiDirectorLoading={isAiDirectorLoading}
            isAutoEditRunning={isAutoEditRunning}
            autoEditStep={autoEditStep}
            autoEditStepsData={autoEditStepsData}
            scenes={project.scenes}
          />
        </div>

        {/* Center Column: Video Stage Preview (5 cols) */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col items-center gap-4 sticky top-16 z-20">
          <StagePreview
            scenes={project.scenes}
            selectedSceneIndex={selectedSceneIndex}
            onSelectScene={setSelectedSceneIndex}
            aspect={project.aspect}
            style={project.style}
            voiceAudioBuffer={voiceAudioBuffer}
            currentFrame={currentFrame}
            onCurrentFrameChange={setCurrentFrame}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            imageBitmaps={imageBitmaps}
          />

          {/* Timeline below canvas */}
          <div className="w-full">
            <Timeline
              scenes={project.scenes}
              selectedSceneIndex={selectedSceneIndex}
              onSelectScene={setSelectedSceneIndex}
              currentFrame={currentFrame}
              onSeekFrame={setCurrentFrame}
            />
          </div>
        </div>

        {/* Right Column: Scene Editor & Image Review Workspace (3.5-4 cols) */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3">
          {/* Tabs for switching between Scene Properties and Image Workspace */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("image")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "image"
                  ? "bg-violet-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Không gian duyệt ảnh (Image Studio)
            </button>
            <button
              onClick={() => setActiveTab("scene")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "scene"
                  ? "bg-violet-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Cấu hình phân cảnh &amp; Câu chính phụ
            </button>
          </div>

          {activeTab === "image" ? (
            <ImageReviewWorkspace
              scene={activeScene}
              sceneIndex={selectedSceneIndex}
              onUpdateScene={updateActiveScene}
              onSearchImages={(q) => searchImagesForScene(q, selectedSceneIndex)}
              onVerifyWithAiVision={() => verifyCandidatesWithVision(selectedSceneIndex)}
              onSelectAndApproveImage={handleSelectAndApprove}
              onUploadImageFile={handleUploadImageFile}
              isSearching={isSearchingImages}
              isVerifying={isVerifyingVision}
              candidateImages={activeScene.candidates || []}
              activeBitmap={imageBitmaps[activeScene.id]}
            />
          ) : (
            <SceneEditor
              scene={activeScene}
              sceneIndex={selectedSceneIndex}
              totalScenes={project.scenes.length}
              onUpdateScene={updateActiveScene}
              onAddScene={() => {
                const newScene: Scene = {
                  id: `scene-${Date.now().toString(36)}`,
                  title: "SCENE",
                  text: "Nội dung phân cảnh mới",
                  narration: "Nội dung phân cảnh mới",
                  durationInFrames: 120,
                  template: "feature-card",
                  accent: "#38bdf8",
                  headline: { small: "MỚI", main: "Nội dung mới", tag: "" },
                  keywords: [],
                  clauseDisplayMode: "two-tier"
                };
                setProject((p) => {
                  const scenes = [...p.scenes];
                  scenes.splice(selectedSceneIndex + 1, 0, newScene);
                  return { ...p, scenes };
                });
                setSelectedSceneIndex(selectedSceneIndex + 1);
              }}
              onDeleteScene={() => {
                if (project.scenes.length <= 1) return;
                setProject((p) => {
                  const scenes = p.scenes.filter((_, i) => i !== selectedSceneIndex);
                  return { ...p, scenes };
                });
                setSelectedSceneIndex((i) => Math.max(0, i - 1));
              }}
              isVoiceLocked={!!activeScene.voice}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        pixabayKey={pixabayKey}
        onSavePixabayKey={(k) => {
          setPixabayKey(k);
          localStorage.setItem("aivs_pixabay_key", k);
        }}
        serverConfig={serverConfig}
      />
    </div>
  );
}
