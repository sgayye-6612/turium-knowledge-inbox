import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

const API_URL = "http://localhost:8000";

interface KnowledgeItem {
id: number;
title: string;
item_type: "note" | "url";
source_url: string | null;
created_at: string;
}

interface Source {
item_id: number;
title: string;
source_url: string | null;
snippet: string;
relevance_score: number;
}

interface QueryResult {
question: string;
answer: string;
sources: Source[];
}

function App() {
const [items, setItems] = useState<KnowledgeItem[]>([]);
const [itemType, setItemType] = useState<"note" | "url">("note");
const [title, setTitle] = useState("");
const [content, setContent] = useState("");
const [url, setUrl] = useState("");
const [question, setQuestion] = useState("");
const [result, setResult] = useState<QueryResult | null>(null);
const [loading, setLoading] = useState(false);
const [asking, setAsking] = useState(false);
const [error, setError] = useState("");
const [message, setMessage] = useState("");

async function loadItems(): Promise<void> {
try {
const response = await fetch(`${API_URL}/items`);

  if (!response.ok) {
    throw new Error("Could not load saved items.");
  }

  const data: KnowledgeItem[] = await response.json();
  setItems(data);
  setError("");
} catch {
  setError(
    "Cannot connect to the backend. Make sure FastAPI is running at http://localhost:8000.",
  );
}


}

useEffect(() => {
void loadItems();
}, []);

async function handleIngest(
event: FormEvent<HTMLFormElement>,
): Promise<void> {
event.preventDefault();
setLoading(true);
setError("");
setMessage("");


const payload =
  itemType === "note"
    ? { item_type: "note", title: title.trim(), content: content.trim() }
    : {
        item_type: "url",
        title: title.trim() || undefined,
        url: url.trim(),
      };

try {
  const response = await fetch(`${API_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof data.detail === "string"
        ? data.detail
        : "Could not save this item.";

    throw new Error(detail);
  }

  setMessage("Knowledge saved successfully.");
  setTitle("");
  setContent("");
  setUrl("");
  await loadItems();
} catch (err: unknown) {
  setError(
    err instanceof Error ? err.message : "Something went wrong.",
  );
} finally {
  setLoading(false);
}


}

async function handleQuery(
event: FormEvent<HTMLFormElement>,
): Promise<void> {
event.preventDefault();
setAsking(true);
setError("");
setMessage("");
setResult(null);

try {
  const response = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: question.trim() }),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof data.detail === "string"
        ? data.detail
        : "Could not search your knowledge.";

    throw new Error(detail);
  }

  setResult(data as QueryResult);
} catch (err: unknown) {
  setError(
    err instanceof Error ? err.message : "Something went wrong.",
  );
} finally {
  setAsking(false);
}


}

return ( <main className="app-shell"> <header className="topbar"> <a className="brand" href="/"> <span className="brand-mark">K</span> <span>Knowledge Inbox</span> </a> <span className="status"> <span className="status-dot" />
Your personal knowledge space </span> </header>

  <section className="hero">
    <p className="eyebrow">TURIUM AI · KNOWLEDGE INBOX</p>
    <h1>
      Your knowledge,
      <br />
      <span>ready when you need it.</span>
    </h1>
    <p className="hero-copy">
      Save notes and web pages in one place. Ask questions and discover
      relevant information with source snippets you can verify.
    </p>
  </section>

  <section className="workspace">
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">COLLECT</p>
          <h2>Add to your knowledge</h2>
        </div>
        <span className="heading-icon">+</span>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={itemType === "note" ? "tab active" : "tab"}
          onClick={() => setItemType("note")}
        >
          Write a note
        </button>
        <button
          type="button"
          className={itemType === "url" ? "tab active" : "tab"}
          onClick={() => setItemType("url")}
        >
          Save a URL
        </button>
      </div>

      <form className="form-stack" onSubmit={handleIngest}>
        <label htmlFor="title">Title (optional)</label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Give it a memorable name"
          maxLength={300}
        />

        {itemType === "note" ? (
          <>
            <label htmlFor="content">Your note</label>
            <textarea
              id="content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Capture an idea, insight, or something you want to remember..."
              rows={6}
              maxLength={50000}
              required
            />
          </>
        ) : (
          <>
            <label htmlFor="url">Webpage URL</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/article"
              required
            />
            <p className="field-hint">
              Use a publicly accessible webpage.
            </p>
          </>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save to inbox"} <span>→</span>
        </button>
      </form>
    </div>

    <div className="panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">RETRIEVE</p>
          <h2>Ask your knowledge</h2>
        </div>
        <span className="heading-icon">✳</span>
      </div>

      <p className="panel-description">
        Search your saved notes and webpages using natural language.
      </p>

      <form className="form-stack" onSubmit={handleQuery}>
        <label htmlFor="question">What would you like to know?</label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="For example: What did I save about RAG?"
          rows={4}
          minLength={2}
          maxLength={1000}
          required
        />
        <button
          className="primary-button"
          type="submit"
          disabled={asking}
        >
          {asking ? "Searching..." : "Find answers"} <span>→</span>
        </button>
      </form>

      {result !== null ? (
        <div className="answer-section">
          <p className="section-label">SEARCH RESULTS</p>
          <h3>{result.answer}</h3>

          {result.sources.length === 0 ? (
            <p className="muted">No matching passages were found.</p>
          ) : (
            result.sources.map((source, index) => (
              <article
                className="source-card"
                key={`${source.item_id}-${index}`}
              >
                <div className="source-heading">
                  <span className="source-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{source.title}</strong>
                </div>

                <p>{source.snippet}</p>

                <div className="source-footer">
                  <span>
                    Relevance:{" "}
                    {(source.relevance_score * 100).toFixed(1)}%
                  </span>
                  {source.source_url !== null && (
                    <a
                      href={source.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open source ↗
                    </a>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="query-hint">
          <span>✦</span>
          <p>
            Search results include relevant passages from your saved
            knowledge.
          </p>
        </div>
      )}
    </div>
  </section>

  {(error !== "" || message !== "") && (
    <div
      className={error !== "" ? "notice error-notice" : "notice success-notice"}
      role="status"
    >
      {error || message}
    </div>
  )}

  <section className="library-section">
    <div className="library-heading">
      <div>
        <p className="section-label">YOUR LIBRARY</p>
        <h2>
          Saved knowledge <span className="count">{items.length}</span>
        </h2>
      </div>
      <button
        className="refresh-button"
        type="button"
        onClick={() => void loadItems()}
      >
        ↻ Refresh
      </button>
    </div>

    {items.length === 0 ? (
      <div className="empty-state">
        <span>▤</span>
        <h3>Your inbox is ready</h3>
        <p>
          Save your first note or webpage to start building your knowledge
          library.
        </p>
      </div>
    ) : (
      <div className="items-grid">
        {items.map((item) => (
          <article className="item-card" key={item.id}>
            <div className="item-topline">
              <span className={`type-tag ${item.item_type}`}>
                {item.item_type === "note" ? "NOTE" : "WEB PAGE"}
              </span>
              <span className="item-date">
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>

            <h3>{item.title}</h3>

            {item.source_url !== null && (
              <a
                className="item-link"
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
              >
                {item.source_url} ↗
              </a>
            )}
          </article>
        ))}
      </div>
    )}
  </section>

  <footer className="footer">
    <span>Knowledge Inbox</span>
    <span>Save thoughtfully. Find instantly.</span>
  </footer>
</main>


);
}

export default App;
