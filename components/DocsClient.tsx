"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Terminal,
  BookOpen,
  Download,
  Mic,
  HelpCircle,
  Sparkles,
  Layers,
  WifiOff,
  Keyboard,
  ShieldCheck,
  ArrowRight,
  Play,
  Globe,
  Languages,
  X,
  FileText,
} from "lucide-react";

type Category =
  | "all"
  | "learners"
  | "extension"
  | "sdk"
  | "api"
  | "offline"
  | "a11y";

interface CodeBlockProps {
  id: string;
  code: string;
  language?: string;
  title?: string;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}

function CodeBlock({
  id,
  code,
  language = "bash",
  title,
  copiedId,
  onCopy,
}: CodeBlockProps) {
  const isCopied = copiedId === id;

  return (
    <div className="docs-code-card">
      <div className="docs-code-header">
        <span>{title || language}</span>
        <button
          type="button"
          className={`docs-code-copy-btn ${isCopied ? "copied" : ""}`}
          onClick={() => onCopy(id, code)}
          aria-label={isCopied ? "Copied code" : "Copy code"}
        >
          {isCopied ? (
            <>
              <Check size={14} aria-hidden="true" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="docs-code-content">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DocsClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sdkTab, setSdkTab] = useState<
    "webcomponent" | "media" | "react" | "sdk" | "iframe"
  >("webcomponent");

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const categories = [
    { id: "all" as Category, label: "All Docs", icon: Layers, count: 6 },
    { id: "learners" as Category, label: "Learner Guide", icon: BookOpen, count: 4 },
    { id: "extension" as Category, label: "Chrome Extension", icon: Download, count: 3 },
    { id: "sdk" as Category, label: "SDK & Embed", icon: Code2, count: 5 },
    { id: "api" as Category, label: "REST API", icon: Terminal, count: 5 },
    { id: "offline" as Category, label: "Offline PWA", icon: WifiOff, count: 3 },
    { id: "a11y" as Category, label: "Shortcuts & A11y", icon: Keyboard, count: 3 },
  ];

  const searchLower = searchQuery.toLowerCase().trim();

  // Helper to determine if section matches filter
  const matchesSearch = useCallback(
    (keywords: string[]) => {
      if (!searchLower) return true;
      return keywords.some((kw) => kw.toLowerCase().includes(searchLower));
    },
    [searchLower]
  );

  const showLearners =
    (activeCategory === "all" || activeCategory === "learners") &&
    matchesSearch([
      "learner",
      "question",
      "ask",
      "voice",
      "amharic",
      "oromo",
      "tigrinya",
      "tutor",
      "listen",
      "simplify",
      "support",
      "ethiopian",
    ]);

  const showExtension =
    (activeCategory === "all" || activeCategory === "extension") &&
    matchesSearch([
      "extension",
      "chrome",
      "browser",
      "install",
      "hands-free",
      "blind",
      "shortcut",
      "alt+shift+m",
      "ctrl+shift+m",
      "memory",
      "site memory",
      "addis ai",
      "groq",
      "gemini",
    ]);

  const showSdk =
    (activeCategory === "all" || activeCategory === "sdk") &&
    matchesSearch([
      "sdk",
      "embed",
      "web component",
      "db-assistant",
      "mela-course-media",
      "react",
      "iframe",
      "javascript",
      "mount",
      "developer",
      "integration",
    ]);

  const showApi =
    (activeCategory === "all" || activeCategory === "api") &&
    matchesSearch([
      "api",
      "rest",
      "endpoint",
      "ask",
      "tts",
      "courses",
      "escalations",
      "health",
      "curl",
      "openapi",
      "webhook",
    ]);

  const showOffline =
    (activeCategory === "all" || activeCategory === "offline") &&
    matchesSearch([
      "offline",
      "pwa",
      "indexeddb",
      "download",
      "cache",
      "zero cloud",
      "privacy",
      "service worker",
      "consent",
    ]);

  const showA11y =
    (activeCategory === "all" || activeCategory === "a11y") &&
    matchesSearch([
      "shortcut",
      "accessibility",
      "a11y",
      "screen reader",
      "aria",
      "keyboard",
      "talkback",
      "nvda",
      "sign language",
      "ethsl",
    ]);

  const totalVisible = [
    showLearners,
    showExtension,
    showSdk,
    showApi,
    showOffline,
    showA11y,
  ].filter(Boolean).length;

  return (
    <div className="prose" style={{ maxWidth: "1050px" }}>
      {/* Hero Header */}
      <div className="docs-header-card">
        <div className="docs-header-badge">
          <Sparkles size={13} aria-hidden="true" />
          <span>MELA AI Documentation</span>
        </div>
        <h1>Simple &amp; Convenient Developer and Learner Guide</h1>
        <p>
          Everything you need to learn, integrate, or build with MELA AI: local
          zero-cloud search, Ethiopian language voices (Amharic, Afaan Oromoo,
          Tigrinya), Chrome extension, developer Web Components, and REST APIs.
        </p>
      </div>

      {/* Quick Jump Action Grid */}
      <div className="docs-jump-grid">
        <button
          type="button"
          onClick={() => {
            setActiveCategory("learners");
            scrollToSection("section-learners");
          }}
          className="docs-jump-card"
        >
          <div className="jump-title">
            <span>🎓 Learner Guide</span>
            <ArrowRight size={16} aria-hidden="true" />
          </div>
          <p>Ask in English or Amharic, listen out loud, and get human tutor help.</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCategory("extension");
            scrollToSection("section-extension");
          }}
          className="docs-jump-card"
        >
          <div className="jump-title">
            <span>🧩 Chrome Extension</span>
            <ArrowRight size={16} aria-hidden="true" />
          </div>
          <p>Talk to any website, hands-free auto-open for blind learners, and site memory.</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCategory("sdk");
            scrollToSection("section-sdk");
          }}
          className="docs-jump-card"
        >
          <div className="jump-title">
            <span>💻 SDK &amp; Web Component</span>
            <ArrowRight size={16} aria-hidden="true" />
          </div>
          <p>Add <code>&lt;db-assistant&gt;</code> to any LMS or static HTML with 1 script.</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCategory("api");
            scrollToSection("section-api");
          }}
          className="docs-jump-card"
        >
          <div className="jump-title">
            <span>⚡ REST API Reference</span>
            <ArrowRight size={16} aria-hidden="true" />
          </div>
          <p>Query <code>/ask</code>, text-to-speech <code>/tts</code>, and course catalogues.</p>
        </button>
      </div>

      {/* Filter and Instant Search Bar */}
      <div className="docs-filter-bar">
        <div className="docs-search-input-wrap">
          <Search size={18} className="docs-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="docs-search-input"
            placeholder="Search documentation, APIs, keyboard shortcuts, or components... (e.g., 'extension', 'ask', 'amharic', 'curl')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter documentation"
          />
          {searchQuery && (
            <button
              type="button"
              className="docs-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="docs-categories-row" role="tablist" aria-label="Documentation sections">
          {categories.map((cat) => {
            const IconComponent = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`docs-cat-btn ${isActive ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <IconComponent size={14} aria-hidden="true" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search result summary notice if filtering */}
      {searchQuery && (
        <div className="notice" style={{ margin: "0 0 20px" }}>
          Showing <strong>{totalVisible}</strong> documentation section{totalVisible === 1 ? "" : "s"} matching &ldquo;{searchQuery}&rdquo;.
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveCategory("all");
            }}
            style={{
              marginLeft: "12px",
              background: "none",
              border: "none",
              color: "#006b8b",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Reset filters
          </button>
        </div>
      )}

      {/* SECTION 1: LEARNER GUIDE */}
      {showLearners && (
        <section className="content-card section-anchor" id="section-learners">
          <div className="meta-row" style={{ marginBottom: "8px" }}>
            <span className="tag">LEARNER GUIDE</span>
            <span className="pill">Accessibility</span>
            <span className="pill">Multi-language</span>
          </div>
          <h2>Learner Assistant: Ask, Listen, &amp; Learn</h2>
          <p>
            MELA AI provides an inclusive learning companion embedded right on
            course pages. It operates with <strong>zero cloud AI keys required</strong>{" "}
            for local lesson retrieval, ensuring learners can study even on low-bandwidth
            or offline connections.
          </p>

          <div className="cards-grid" style={{ margin: "16px 0" }}>
            <div style={{ padding: "14px", border: "1px solid #e1e7ec", borderRadius: "6px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Languages size={18} color="#006b8b" />
                1. Localized Languages
              </h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                Switch between <strong>English</strong> and <strong>አማርኛ (Amharic)</strong> in Learning options.
                Afaan Oromoo and Tigrinya (ትግርኛ) registries are supported for voice and interface routing.
              </p>
            </div>

            <div style={{ padding: "14px", border: "1px solid #e1e7ec", borderRadius: "6px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Mic size={18} color="#006b8b" />
                2. Voice &amp; Read Aloud
              </h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                Click <strong>Listen</strong> to hear any answer aloud using device voices or Addis AI neural TTS.
                Dictate questions using browser speech recognition or private relay.
              </p>
            </div>

            <div style={{ padding: "14px", border: "1px solid #e1e7ec", borderRadius: "6px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} color="#006b8b" />
                3. Simplify Mode
              </h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                Click <strong>Simplify</strong> to extract key sentences directly from course sections without AI hallucinations,
                or generate simpler explanations with reviewed citations.
              </p>
            </div>

            <div style={{ padding: "14px", border: "1px solid #e1e7ec", borderRadius: "6px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                <HelpCircle size={18} color="#006b8b" />
                4. Human Tutor Escalation
              </h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                When AI is not enough, select <strong>Talk to a person</strong>. Share your screen or conversation context securely
                to connect with a qualified instructor.
              </p>
            </div>
          </div>

          <div className="meta-row">
            <Link className="button primary" href="/learn">
              Access My Learning →
            </Link>
            <Link className="button secondary" href="/support">
              Human Support Portal →
            </Link>
          </div>
        </section>
      )}

      {/* SECTION 2: CHROME EXTENSION */}
      {showExtension && (
        <section className="content-card section-anchor" id="section-extension">
          <div className="meta-row" style={{ marginBottom: "8px" }}>
            <span className="tag">CHROME EXTENSION</span>
            <span className="pill">Hands-free</span>
            <span className="pill">Site Memory</span>
          </div>
          <h2>Chrome Extension: Talk to Any Web Page</h2>
          <p>
            The MELA Chrome extension brings the companion to any website across
            the internet. Designed especially for blind and low-vision learners,
            it can open automatically on visit, announce its greeting out loud,
            and answer questions directly using the text of the active page.
          </p>

          <div style={{ margin: "18px 0" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>Installation in 3 Steps:</h3>
            <ol style={{ paddingLeft: "22px", lineHeight: 1.8 }}>
              <li>
                Download and extract{" "}
                <a href="/downloads/mela-extension.zip" download="mela-extension.zip" style={{ fontWeight: 600 }}>
                  mela-extension.zip
                </a>.
              </li>
              <li>
                Open <code>chrome://extensions</code> in Chrome, Edge, or Brave, and enable <strong>Developer mode</strong> (top-right).
              </li>
              <li>
                Click <strong>Load unpacked</strong>, choose the unzipped folder, and pin MELA to your toolbar.
              </li>
            </ol>
          </div>

          <div style={{ margin: "18px 0" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>Voice Models &amp; Ethiopian Speech Engine:</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Language</th>
                    <th>Speech-to-Text (STT)</th>
                    <th>LLM Reasoning</th>
                    <th>Text-to-Speech (TTS) Voice</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>English</strong></td>
                    <td>Groq Whisper / Browser</td>
                    <td>Groq / Gemini</td>
                    <td>Device Voice or Gemini</td>
                  </tr>
                  <tr>
                    <td><strong>Amharic (አማርኛ)</strong></td>
                    <td>Addis AI Speech</td>
                    <td>Addis AI / Gemini</td>
                    <td>Addis AI &ldquo;Hamen&rdquo;</td>
                  </tr>
                  <tr>
                    <td><strong>Afaan Oromoo</strong></td>
                    <td>Addis AI Speech</td>
                    <td>Addis AI / Gemini</td>
                    <td>Addis AI &ldquo;Bikila&rdquo;</td>
                  </tr>
                  <tr>
                    <td><strong>Tigrinya (ትግርኛ)</strong></td>
                    <td>Addis AI Speech</td>
                    <td>Gemini Relay</td>
                    <td>Addis AI &ldquo;Berhane&rdquo;</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="notice">
            <strong>Site Memory:</strong> While on any article or documentation site, click <em>&ldquo;Remember this site&rdquo;</em> in MELA.
            MELA stores approved page excerpts locally so you can ask <em>&ldquo;What do you remember from earlier?&rdquo;</em> on subsequent visits.
          </div>

          <div className="meta-row" style={{ marginTop: "16px" }}>
            <a className="button primary" href="/downloads/mela-extension.zip" download="mela-extension.zip">
              <Download size={16} aria-hidden="true" /> Download Extension (.zip)
            </a>
            <Link className="button secondary" href="/extension/guide">
              Full Extension Quick Guide →
            </Link>
          </div>
        </section>
      )}

      {/* SECTION 3: DEVELOPER SDK & EMBED */}
      {showSdk && (
        <section className="content-card section-anchor" id="section-sdk">
          <div className="meta-row" style={{ marginBottom: "8px" }}>
            <span className="tag">DEVELOPER INTEGRATION</span>
            <span className="pill">Web Components</span>
            <span className="pill">React</span>
            <span className="pill">Iframe</span>
          </div>
          <h2>SDK &amp; Web Component Integration</h2>
          <p>
            Integrate MELA into your LMS, university portal, or custom web platform.
            The SDK runs independently of React, Tailwind, or Savanna styling using Shadow DOM isolation.
          </p>

          {/* Subtabs for SDK styles */}
          <div style={{ margin: "16px 0 10px" }}>
            <div className="meta-row" style={{ gap: "6px" }}>
              <button
                type="button"
                className={`docs-cat-btn ${sdkTab === "webcomponent" ? "active" : ""}`}
                onClick={() => setSdkTab("webcomponent")}
              >
                1. Web Component
              </button>
              <button
                type="button"
                className={`docs-cat-btn ${sdkTab === "media" ? "active" : ""}`}
                onClick={() => setSdkTab("media")}
              >
                2. Full Course Media
              </button>
              <button
                type="button"
                className={`docs-cat-btn ${sdkTab === "react" ? "active" : ""}`}
                onClick={() => setSdkTab("react")}
              >
                3. React Adapter
              </button>
              <button
                type="button"
                className={`docs-cat-btn ${sdkTab === "sdk" ? "active" : ""}`}
                onClick={() => setSdkTab("sdk")}
              >
                4. JavaScript Mount
              </button>
              <button
                type="button"
                className={`docs-cat-btn ${sdkTab === "iframe" ? "active" : ""}`}
                onClick={() => setSdkTab("iframe")}
              >
                5. Iframe Wrapper
              </button>
            </div>
          </div>

          {sdkTab === "webcomponent" && (
            <div>
              <p style={{ fontSize: "13.5px" }}>
                Add the chat widget to any plain HTML page or template engine (PHP, Django, WordPress, Rails):
              </p>
              <CodeBlock
                id="code-webcomponent"
                language="html"
                title="HTML Embed (<db-assistant>)"
                copiedId={copiedId}
                onCopy={handleCopy}
                code={`<!-- 1. Include MELA assistant script -->
<script src="https://YOUR-MELA-HOST/db-assistant.js" defer></script>

<!-- 2. Place component anywhere on your page -->
<db-assistant
  lang="am"
  api="https://YOUR-MELA-HOST/api/v1"
  content="https://YOUR-MELA-HOST/courses/index.json">
</db-assistant>`}
              />
            </div>
          )}

          {sdkTab === "media" && (
            <div>
              <p style={{ fontSize: "13.5px" }}>
                Synchronized lesson video, visual 3D sign-language teacher, and conversational companion:
              </p>
              <CodeBlock
                id="code-media"
                language="html"
                title="Full Course Media & Assistant"
                copiedId={copiedId}
                onCopy={handleCopy}
                code={`<script src="https://YOUR-MELA-HOST/mela-sdk.js" defer></script>

<main data-mela-context>
  <!-- Video and EthSL Visual Teacher -->
  <mela-course-media
    api="https://YOUR-MELA-HOST/api/v1"
    video-src="https://www.youtube.com/watch?v=9hE5-98ZeCg"
    lesson-id="va-future">
  </mela-course-media>

  <!-- Interactive Assistant -->
  <db-assistant
    api="https://YOUR-MELA-HOST/api/v1"
    content="https://YOUR-MELA-HOST/courses/index.json"
    lang="en">
  </db-assistant>
</main>`}
              />
            </div>
          )}

          {sdkTab === "react" && (
            <div>
              <p style={{ fontSize: "13.5px" }}>
                Use the official React adapter with SSR-safe hydration and full lifecycle props:
              </p>
              <CodeBlock
                id="code-react"
                language="tsx"
                title="React Component (<MelaCompanion />)"
                copiedId={copiedId}
                onCopy={handleCopy}
                code={`import { MelaCompanion } from "@mela-ai/sdk/react";

export function CoursePage() {
  return (
    <div className="course-container">
      <h1>Digital Foundations Lesson</h1>
      <MelaCompanion
        api="https://YOUR-MELA-HOST/api/v1"
        videoUrl="https://www.youtube.com/watch?v=9hE5-98ZeCg"
        lessonId="va-future"
        language="am"
        actions={true}
        onError={(err) => console.error("MELA error:", err)}
      />
    </div>
  );
}`}
              />
            </div>
          )}

          {sdkTab === "sdk" && (
            <div>
              <p style={{ fontSize: "13.5px" }}>
                Imperative JavaScript SDK for programmatic mount and control:
              </p>
              <CodeBlock
                id="code-js-sdk"
                language="javascript"
                title="JavaScript SDK (mount)"
                copiedId={copiedId}
                onCopy={handleCopy}
                code={`import { mount } from "https://YOUR-MELA-HOST/sdk/index.js";

const companion = await mount({
  container: "#assistant-root",
  api: "https://YOUR-MELA-HOST/api/v1",
  videoUrl: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
  lessonId: "va-future",
  language: "am",
  assistant: true,
  actions: true,
});

// Update video or language programmatically:
// companion.setVideo("https://www.youtube.com/watch?v=new-id");
// companion.destroy();`}
              />
            </div>
          )}

          {sdkTab === "iframe" && (
            <div>
              <p style={{ fontSize: "13.5px" }}>
                Completely isolated iframe wrapper for strict CSP hosts or third-party platforms:
              </p>
              <CodeBlock
                id="code-iframe"
                language="html"
                title="Iframe Embed"
                copiedId={copiedId}
                onCopy={handleCopy}
                code={`<iframe
  src="https://YOUR-MELA-HOST/embed?video=9hE5-98ZeCg&lang=am"
  title="MELA Learning Companion"
  width="100%"
  height="820"
  allow="autoplay; fullscreen; microphone"
  allowfullscreen
  loading="lazy"
  style="border: none; border-radius: 8px;">
</iframe>`}
              />
            </div>
          )}

          <div className="notice" style={{ marginTop: "14px" }}>
            <strong>CORS &amp; Origin Configuration:</strong> When embedding MELA on another domain, configure{" "}
            <code>ALLOWED_ORIGINS=https://your-lms-domain.com</code> in the backend environment.
          </div>
        </section>
      )}

      {/* SECTION 4: REST API REFERENCE */}
      {showApi && (
        <section className="content-card section-anchor" id="section-api">
          <div className="meta-row" style={{ marginBottom: "8px" }}>
            <span className="tag">REST API</span>
            <span className="pill">OpenAPI 3.1</span>
            <span className="pill">JSON</span>
          </div>
          <h2>REST API Reference &amp; Endpoints</h2>
          <p>
            Build your own custom frontends or backends using the clean MELA HTTP API.
            All endpoints support CORS when origins are configured.
          </p>

          {/* Endpoint 1: POST /api/v1/ask */}
          <div className="api-endpoint-card">
            <div className="meta-row" style={{ justifyContent: "space-between", marginBottom: "8px" }}>
              <div className="meta-row" style={{ gap: "8px" }}>
                <span className="api-badge post">POST</span>
                <span className="api-path">/api/v1/ask</span>
              </div>
              <span className="pill">Learner Chat</span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "13.5px" }}>
              Submit a learner question with language, optional lesson context, and simplify preferences.
              Returns source-grounded answers with section citations.
            </p>
            <CodeBlock
              id="curl-ask"
              language="bash"
              title="cURL Request"
              copiedId={copiedId}
              onCopy={handleCopy}
              code={`curl -X POST https://YOUR-MELA-HOST/api/v1/ask \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "What is a loop in programming?",
    "language": "am",
    "simplify": false
  }'`}
            />
          </div>

          {/* Endpoint 2: POST /api/v1/tts */}
          <div className="api-endpoint-card">
            <div className="meta-row" style={{ justifyContent: "space-between", marginBottom: "8px" }}>
              <div className="meta-row" style={{ gap: "8px" }}>
                <span className="api-badge post">POST</span>
                <span className="api-path">/api/v1/tts</span>
              </div>
              <span className="pill">Audio / Speech</span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "13.5px" }}>
              Generate spoken audio stream for English, Amharic, or Oromo text via Addis AI or Gemini relay.
            </p>
            <CodeBlock
              id="curl-tts"
              language="bash"
              title="cURL Request"
              copiedId={copiedId}
              onCopy={handleCopy}
              code={`curl -X POST https://YOUR-MELA-HOST/api/v1/tts \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "እንኳን ደህና መጡ! ዛሬ ምን መማር ይፈልጋሉ?",
    "language": "am"
  }' \\
  --output speech.mp3`}
            />
          </div>

          {/* Endpoint 3: GET /api/v1/courses */}
          <div className="api-endpoint-card">
            <div className="meta-row" style={{ justifyContent: "space-between", marginBottom: "8px" }}>
              <div className="meta-row" style={{ gap: "8px" }}>
                <span className="api-badge get">GET</span>
                <span className="api-path">/api/v1/courses</span>
              </div>
              <span className="pill">Catalogue</span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "13.5px" }}>
              List approved public course packs, lesson metadata, and offline pack URLs.
            </p>
            <CodeBlock
              id="curl-courses"
              language="bash"
              title="cURL Request"
              copiedId={copiedId}
              onCopy={handleCopy}
              code={`curl -X GET https://YOUR-MELA-HOST/api/v1/courses \\
  -H "Accept: application/json"`}
            />
          </div>

          {/* Endpoint 4: POST /api/v1/escalations */}
          <div className="api-endpoint-card">
            <div className="meta-row" style={{ justifyContent: "space-between", marginBottom: "8px" }}>
              <div className="meta-row" style={{ gap: "8px" }}>
                <span className="api-badge post">POST</span>
                <span className="api-path">/api/v1/escalations</span>
              </div>
              <span className="pill">Tutor Escalation</span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "13.5px" }}>
              Create an escalation ticket for a human tutor with optional transcript context or screenshot.
            </p>
            <CodeBlock
              id="curl-escalate"
              language="bash"
              title="cURL Request"
              copiedId={copiedId}
              onCopy={handleCopy}
              code={`curl -X POST https://YOUR-MELA-HOST/api/v1/escalations \\
  -H "Content-Type: application/json" \\
  -d '{
    "summary": "Need clarification on conditional statements",
    "language": "en",
    "lessonId": "va-future",
    "shareTranscript": true
  }'`}
            />
          </div>

          {/* Endpoint 5: GET /api/v1/health */}
          <div className="api-endpoint-card">
            <div className="meta-row" style={{ justifyContent: "space-between", marginBottom: "8px" }}>
              <div className="meta-row" style={{ gap: "8px" }}>
                <span className="api-badge get">GET</span>
                <span className="api-path">/api/v1/health</span>
              </div>
              <span className="pill">Monitoring</span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "13.5px" }}>
              Health probe returning database connectivity, redis status, and uptime metrics.
            </p>
          </div>

          <div className="meta-row" style={{ marginTop: "16px" }}>
            <a className="button primary" href="/openapi.yaml" target="_blank" rel="noopener noreferrer">
              <FileText size={16} aria-hidden="true" /> View Full OpenAPI 3.1 Spec (YAML)
            </a>
          </div>
        </section>
      )}

      {/* SECTION 5: OFFLINE PWA & STORAGE */}
      {showOffline && (
        <section className="content-card section-anchor" id="section-offline">
          <div className="meta-row" style={{ marginBottom: "8px" }}>
            <span className="tag">OFFLINE CAPABILITY</span>
            <span className="pill">Service Worker</span>
            <span className="pill">IndexedDB</span>
          </div>
          <h2>Offline-First Learning &amp; Zero-Cloud Mode</h2>
          <p>
            MELA is architected from the ground up for low-connectivity regions.
            Learners can download verified course packages while connected to Wi-Fi
            and continue studying without internet access.
          </p>

          <div className="cards-grid" style={{ margin: "16px 0" }}>
            <div style={{ padding: "14px", border: "1px solid #e1e7ec", borderRadius: "6px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px" }}>💾 Offline Course Packs</h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                Downloads include full lesson text, prepared Amharic translations, Ethiopic fonts, and practice quizzes.
                Saved securely in the browser’s IndexedDB.
              </p>
            </div>
            <div style={{ padding: "14px", border: "1px solid #e1e7ec", borderRadius: "6px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px" }}>⚡ Zero-Cloud Search</h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                The assistant uses client-side keyword and semantic extraction across local lesson documents.
                No third-party AI APIs or cell data needed.
              </p>
            </div>
            <div style={{ padding: "14px", border: "1px solid #e1e7ec", borderRadius: "6px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px" }}>🔒 Privacy &amp; Consent</h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                Audio recordings, page text, and screenshots are never uploaded without an explicit consent prompt.
                Keys remain in your client browser storage.
              </p>
            </div>
            <div style={{ padding: "14px", border: "1px solid #e1e7ec", borderRadius: "6px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px" }}>📦 PWA Installation</h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                Install MELA to your desktop or mobile home screen via Chrome/Edge for instant standalone access
                without browser address bars.
              </p>
            </div>
          </div>

          <div className="meta-row">
            <Link className="button primary" href="/downloads">
              Open Downloaded Courses Library →
            </Link>
          </div>
        </section>
      )}

      {/* SECTION 6: KEYBOARD SHORTCUTS & ACCESSIBILITY */}
      {showA11y && (
        <section className="content-card section-anchor" id="section-a11y">
          <div className="meta-row" style={{ marginBottom: "8px" }}>
            <span className="tag">ACCESSIBILITY &amp; COMMANDS</span>
            <span className="pill">WCAG 2.1 AA</span>
            <span className="pill">Keyboard-First</span>
          </div>
          <h2>Shortcuts &amp; Accessibility Reference</h2>
          <p>
            MELA is fully operable using only the keyboard and is designed to conform with
            WCAG 2.1 AA standards, featuring high contrast focus rings, ARIA live regions,
            and screen reader announcements.
          </p>

          <h3 style={{ fontSize: "16px", margin: "16px 0 10px" }}>Keyboard Navigation Shortcuts:</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="docs-table">
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>Shortcut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd></td>
                  <td>Open / toggle MELA companion on any page</td>
                </tr>
                <tr>
                  <td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> <br /><small style={{ color: "#647888" }}>(⌘ + Shift + M on Mac)</small></td>
                  <td>Start or stop voice input (microphone)</td>
                </tr>
                <tr>
                  <td><kbd>Tab</kbd> / <kbd>Shift</kbd> + <kbd>Tab</kbd></td>
                  <td>Move forward / backward through interactive controls</td>
                </tr>
                <tr>
                  <td><kbd>Enter</kbd></td>
                  <td>Send current question or activate focused button</td>
                </tr>
                <tr>
                  <td><kbd>Shift</kbd> + <kbd>Enter</kbd></td>
                  <td>Insert a new line in message input without sending</td>
                </tr>
                <tr>
                  <td><kbd>Esc</kbd></td>
                  <td>Close MELA chat panel or exit modal</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: "16px", margin: "20px 0 10px" }}>Web Voice Commands:</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="docs-table">
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>Say this command</th>
                  <th>What happens</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><em>&ldquo;read page&rdquo;</em></td>
                  <td>Reads the main section of the current lesson out loud</td>
                </tr>
                <tr>
                  <td><em>&ldquo;scroll down&rdquo; / &ldquo;scroll up&rdquo;</em></td>
                  <td>Scrolls the page smoothly</td>
                </tr>
                <tr>
                  <td><em>&ldquo;speak Amharic&rdquo; / &ldquo;speak Oromo&rdquo;</em></td>
                  <td>Switches language and confirms out loud</td>
                </tr>
                <tr>
                  <td><em>&ldquo;stop&rdquo; / &ldquo;nagaatti&rdquo;</em></td>
                  <td>Halts speech output and pauses hands-free voice mode</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Helpful links footer inside docs */}
      <div className="content-card" style={{ background: "#f8fbfd", borderColor: "#ccdbe4" }}>
        <h3 style={{ marginTop: 0 }}>Need more assistance?</h3>
        <p style={{ marginBottom: "14px" }}>
          Explore interactive demos or chat directly with MELA using the floating assistant button in the bottom right corner.
        </p>
        <div className="meta-row">
          <Link href="/demo/digital-foundations" className="button secondary">
            Try Digital Foundations Demo →
          </Link>
          <Link href="/savanna/pages/offline-first-localized-ai.html" className="button secondary">
            Localized AI Training Lesson →
          </Link>
          <a href="/openapi.yaml" className="button secondary">
            OpenAPI Spec →
          </a>
        </div>
      </div>
    </div>
  );
}
