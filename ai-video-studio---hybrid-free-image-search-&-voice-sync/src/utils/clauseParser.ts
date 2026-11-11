/**
 * Clause Parser & Keyword Highlighter for Vietnamese & Multilingual Sentences
 * Specializes in dividing sentences into clear Main Clauses (Câu chính) and Subordinate Clauses (Câu phụ)
 */

import { ClauseSegment, KeywordHighlight, HighlightStyle, HeadlineConfig } from "../types.js";

// Stopwords in Vietnamese
export const VIETNAMESE_STOPWORDS = new Set([
  "và", "của", "là", "có", "để", "cho", "các", "những", "một", "này", "khi",
  "với", "trong", "được", "không", "cần", "chỉ", "hơn", "rất", "đã", "sẽ",
  "bạn", "tôi", "mình", "thì", "mà", "ở", "từ", "như", "nên", "cũng",
  "về", "lại", "ra", "vào", "lên", "xuống", "đến", "theo", "sau", "trước",
  "qua", "đang", "hay", "hoặc", "ai", "gì", "nào", "đó", "đây", "kia"
]);

// Subordinate markers with semantic roles
interface SubMarker {
  patterns: RegExp[];
  role: string;
}

const SUBORDINATE_MARKERS: SubMarker[] = [
  {
    patterns: [
      /^(khi|lúc|trong khi|sau khi|trước khi|ngay khi|mỗi khi|đến khi)\b/i,
      /\b(trong khi|sau khi|trước khi|ngay khi)\b/i
    ],
    role: "Thời gian (Time)"
  },
  {
    patterns: [
      /^(nếu|hễ|giá như|miễn là|trừ khi|nếu như)\b/i,
      /\b(miễn là|trừ khi|nếu như)\b/i
    ],
    role: "Điều kiện (Condition)"
  },
  {
    patterns: [
      /^(vì|bởi vì|do|nhờ|tại vì|bởi lẽ|chính vì)\b/i,
      /\b(bởi vì|tại vì|bởi lẽ|chính vì)\b/i
    ],
    role: "Nguyên nhân (Reason)"
  },
  {
    patterns: [
      /^(để|nhằm|cốt để|cho mục đích)\b/i,
      /\b(nhằm|cốt để)\b/i
    ],
    role: "Mục đích (Purpose)"
  },
  {
    patterns: [
      /^(mặc dù|dù|tuy|tuy rằng|dẫu cho|cho dù)\b/i,
      /\b(mặc dù|tuy rằng|dẫu cho|cho dù)\b/i
    ],
    role: "Nhượng bộ (Concession)"
  },
  {
    patterns: [
      /^(thay vì|thay cho|trái lại|ngược lại)\b/i,
      /\b(thay vì|ngược lại)\b/i
    ],
    role: "Đối lập (Contrast)"
  },
  {
    patterns: [
      /^(ngoài ra|hơn nữa|đặc biệt là|thực tế là|nói cách khác)\b/i
    ],
    role: "Bổ trợ (Supplement)"
  }
];

/**
 * Splits a sentence into Main Clauses and Subordinate Clauses.
 * Vietnamese sentences often structure:
 * [Mệnh đề phụ - thời gian/điều kiện/nguyên nhân], [Mệnh đề chính - kết quả/hành động]
 * OR [Mệnh đề chính], [Mệnh đề phụ giải thích]
 */
export function splitSentenceIntoClauses(sentence: string): ClauseSegment[] {
  const cleaned = sentence.trim();
  if (!cleaned) return [];

  // Split on commas, semicolons, em-dashes, or colons
  const parts = cleaned
    .split(/(?<=[,;:\-–—])\s+|\s+(?:[-–—])\s+/)
    .map(p => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    // Single clause sentence: inspect if it starts with a subordinate marker
    const marker = matchSubordinateMarker(cleaned);
    return [
      {
        id: "c-1",
        text: cleaned,
        type: marker ? "subordinate" : "main",
        role: marker ? marker.role : "Mệnh đề chính"
      }
    ];
  }

  const clauses: ClauseSegment[] = [];

  parts.forEach((part, idx) => {
    // Strip trailing punctuation for check
    const marker = matchSubordinateMarker(part);
    const hasConnectorThì = /^(thì|sẽ|hãy|chắc chắn|liền)\b/i.test(part);

    let type: "main" | "subordinate" = "main";
    let role = "Mệnh đề chính (Main)";

    if (marker) {
      type = "subordinate";
      role = marker.role;
    } else if (hasConnectorThì && idx > 0) {
      // "thì ..." is typically the main clause following an "if/when" clause
      type = "main";
      role = "Hệ quả / Mệnh đề chính";
    } else if (idx === 0 && parts.length > 1 && !marker) {
      // First part without sub marker might be main, or second might be subordinate
      const nextMarker = matchSubordinateMarker(parts[idx + 1] || "");
      if (nextMarker) {
        type = "main";
        role = "Mệnh đề chính";
      } else {
        // Default first part to main
        type = "main";
        role = "Ý mở đầu";
      }
    } else if (idx > 0 && !marker) {
      // Check if previous was subordinate
      const prev = clauses[idx - 1];
      if (prev && prev.type === "subordinate") {
        type = "main";
        role = "Mệnh đề chính (Kết quả)";
      } else {
        type = "subordinate";
        role = "Mệnh đề bổ trợ";
      }
    }

    clauses.push({
      id: `c-${idx + 1}`,
      text: part,
      type,
      role
    });
  });

  // Ensure there is at least one main clause
  const hasMain = clauses.some(c => c.type === "main");
  if (!hasMain && clauses.length > 0) {
    clauses[clauses.length - 1].type = "main";
    clauses[clauses.length - 1].role = "Mệnh đề chính";
  }

  return clauses;
}

function matchSubordinateMarker(text: string): SubMarker | null {
  for (const m of SUBORDINATE_MARKERS) {
    for (const pat of m.patterns) {
      if (pat.test(text)) {
        return m;
      }
    }
  }
  return null;
}

/**
 * Extracts and styles keywords from sentence text with duration estimation
 */
export function extractKeywords(text: string, durationSeconds: number): KeywordHighlight[] {
  const result: KeywordHighlight[] = [];
  const added = new Set<string>();

  const add = (raw: string, style: HighlightStyle, clauseType: "main" | "subordinate" = "main") => {
    const clean = (raw || "").trim();
    if (!clean || added.has(clean.toLowerCase()) || !text.toLowerCase().includes(clean.toLowerCase())) {
      return;
    }
    added.add(clean.toLowerCase());
    result.push({
      id: `kw-${result.length + 1}`,
      text: clean,
      style,
      start: 0,
      end: 0,
      est: true,
      clauseType
    });
  };

  // 1. Match numbers and percentages (number style)
  const numberMatches = [...text.matchAll(/\d+(?:[.,]\d+)?(?:\s?%|\s?(?:ngày|bước|giây|phút|giờ|k|tr|triệu|tỷ))?/gi)];
  for (const m of numberMatches.slice(0, 2)) {
    add(m[0], "number");
  }

  // 2. Match acronyms / capitalized brand entities (glass style)
  const capsMatches = text.match(/\b\p{Lu}{2,}(?:\s+\p{Lu}{2,})*\b/u);
  if (capsMatches) {
    add(capsMatches[0], "glass");
  }

  // 3. Find strongest editorial phrase (noun phrases, non-stopwords)
  const clauses = splitSentenceIntoClauses(text);
  const mainClause = clauses.find(c => c.type === "main")?.text || text;

  const rawWords = mainClause.split(/\s+/);
  const cleanWord = (w: string) => w.replace(/[.,!?;:()""'']/g, "");

  let bestPhrase = "";
  for (let i = 0; i < rawWords.length - 1; i++) {
    const w1 = cleanWord(rawWords[i]);
    const w2 = cleanWord(rawWords[i + 1]);
    if (
      VIETNAMESE_STOPWORDS.has(w1.toLowerCase()) ||
      VIETNAMESE_STOPWORDS.has(w2.toLowerCase()) ||
      /\d/.test(w1 + w2) ||
      w1.length < 2 || w2.length < 2
    ) {
      continue;
    }
    const candidate = `${w1} ${w2}`;
    if (candidate.length >= bestPhrase.length) {
      bestPhrase = candidate;
    }
  }

  if (bestPhrase) {
    add(bestPhrase, "editorial", "main");
  } else {
    // Single longest salient word
    const singleBest = rawWords
      .map(cleanWord)
      .filter(w => w.length >= 4 && !VIETNAMESE_STOPWORDS.has(w.toLowerCase()))
      .sort((a, b) => b.length - a.length)[0];
    if (singleBest) {
      add(singleBest, "editorial", "main");
    }
  }

  // 4. Secondary ocean accent keyword in subordinate clause if present
  const subClause = clauses.find(c => c.type === "subordinate");
  if (subClause) {
    const subWords = subClause.text.split(/\s+/).map(cleanWord).filter(w => w.length >= 3 && !VIETNAMESE_STOPWORDS.has(w.toLowerCase()));
    if (subWords.length > 0) {
      add(subWords[0], "ocean", "subordinate");
    }
  }

  // Calculate timing across the duration
  result.forEach(k => {
    const idx = text.toLowerCase().indexOf(k.text.toLowerCase());
    const ratio = idx >= 0 ? idx / Math.max(1, text.length) : 0;
    const dur = Math.max(1, durationSeconds);
    k.start = Number(Math.min(ratio * dur * 0.85, Math.max(0, dur - 1.5)).toFixed(1));
    k.end = Number(Math.min(dur - 0.1, k.start + Math.min(2.5, Math.max(1.2, 0.4 * k.text.split(/\s+/).length + 0.8))).toFixed(1));
  });

  return result.slice(0, 4);
}

/**
 * Generates editorial headline hierarchy
 */
export function generateHeadline(text: string, title?: string, keywords?: KeywordHighlight[]): HeadlineConfig {
  const clauses = splitSentenceIntoClauses(text);
  const subClause = clauses.find(c => c.type === "subordinate");
  const mainClause = clauses.find(c => c.type === "main");

  // Editorial small line: either title or subordinate lead-in
  let small = (title || "").trim();
  if (!small && subClause) {
    small = subClause.text.slice(0, 24).replace(/[,;]+$/, "");
  }

  // Headline main: either editorial keyword or first 3-4 words of main clause
  const edKw = (keywords || []).find(k => k.style === "editorial");
  let main = "";
  if (edKw) {
    main = edKw.text;
  } else if (mainClause) {
    main = mainClause.text.split(/\s+/).slice(0, 4).join(" ").replace(/[,;]+$/, "");
  } else {
    main = text.split(/\s+/).slice(0, 4).join(" ").replace(/[,;]+$/, "");
  }

  // Capitalize first letter
  main = main.charAt(0).toUpperCase() + main.slice(1);

  return {
    small: small.toUpperCase(),
    main,
    tag: ""
  };
}

/**
 * Splits full script into scenes by line breaks or sentence endings
 */
export function splitScriptIntoScenes(script: string, fps = 30) {
  const rawSegments = script
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map(t => t.trim())
    .filter(Boolean);

  const ACCENTS = ["#a78bfa", "#38bdf8", "#f59e0b", "#34d399", "#fb7185"];
  const TEMPLATES: Array<"kinetic-title" | "feature-card" | "quote" | "end-card"> = [
    "kinetic-title",
    "feature-card",
    "quote",
    "end-card"
  ];

  return rawSegments.map((text, i, arr) => {
    const isFirst = i === 0;
    const isLast = i === arr.length - 1;
    const title = isFirst ? "INTRO" : isLast ? "OUTRO" : `SCENE ${i + 1}`;
    const durationInFrames = Math.max(90, Math.min(270, Math.ceil(text.length / 5) * 15));
    const durationSeconds = durationInFrames / fps;

    const clauses = splitSentenceIntoClauses(text);
    const keywords = extractKeywords(text, durationSeconds);
    const headline = generateHeadline(text, title, keywords);

    return {
      id: `scene-${String(i + 1).padStart(2, "0")}`,
      title,
      text,
      narration: text,
      durationInFrames,
      template: isLast ? "end-card" : TEMPLATES[Math.min(i, 3)],
      accent: ACCENTS[i % ACCENTS.length],
      headline,
      keywords,
      clauses,
      clauseDisplayMode: "two-tier" as const
    };
  });
}
