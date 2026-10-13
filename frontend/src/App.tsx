import { useCallback, useEffect, useState, type FormEvent } from "react";
import "./App.css";

const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

type KnowledgeItem = {
  id: number;
  title: string;
  content: string;
  source_url?: string | null;
  item_type: string;
  created_at?: string;
};

type Source = {
  item_id?: number;
  title: string;
  text: string;
  source_url?: string | null;
  item_type?: string;
  score?: number;
};

type QueryResult = {
  answer: string;
  sources: Source[];
};

type ApiError = {
  detail?: string | { msg?: string }[];
};

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot connect to the backend at ${API_URL}. Make sure the FastAPI server is running.`,
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const error = (await response.json()) as ApiError;

      if (typeof error.detail === "string") {
        message = error.detail;
      } else if (Array.isArray(error.detail)) {
        message = error.detail
          .map((item) => item.msg ?? "Invalid request")
          .join(", ");
      }
    } catch {
      // Keep the HTTP status message when the response isn't JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function formatDate(value?: string): string {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function App() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [askingQuestion, setAskingQuestion] = useState(false);

  const [itemType, setItemType] = useState<"note" | "url">("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const [question, setQuestion] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadItems = useCallback(async () => {
    setLoadingItems(true);

    try {
      const data = await apiRequest<KnowledgeItem[]>("/items");
      setItems(data);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load your library.",
      );
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    const cleanUrl = sourceUrl.trim();

    if (!cleanTitle) {
      setError("Please enter a title.");
      return;
    }

    if (itemType === "note" && !cleanContent) {
      setError("Please enter the note content.");
      return;
    }

    if (itemType === "url") {
      if (!cleanUrl) {
        setError("Please enter a URL.");
        return;
      }

      try {
        const parsedUrl = new URL(cleanUrl);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          setError("Only HTTP and HTTPS URLs are supported.");
          return;
        }
      } catch {
        setError("Please enter a valid URL.");
        return;
      }
    }

    setSubmittingItem(true);

    try {
      const payload =
        itemType === "note"
          ? {
              title: cleanTitle,
              content: cleanContent,
              item_type: "note",
              source_url: null,
            }
          : {
              title: cleanTitle,
              content: "",
              item_type: "url",
              source_url: cleanUrl,
            };

      await apiRequest<KnowledgeItem>("/ingest", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setTitle("");
      setContent("");
      setSourceUrl("");
      setSuccess(
        itemType === "note"
          ? "Note saved successfully."
          : "URL processed successfully.",
      );

      await loadItems();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save the item.",
      );
    } finally {
      setSubmittingItem(false);
    }
  }

  async function handleAskQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanQuestion = question.trim();

    if (!cleanQuestion) {
      setError("Enter a question first.");
      return;
    }

    setError("");
    setSuccess("");
    setAskingQuestion(true);
    setQueryResult(null);

    try {
      const result = await apiRequest<QueryResult>("/query", {
        method: "POST",
        body: JSON.stringify({ question: cleanQuestion }),
      });

      setQueryResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to answer your question.",
      );
    } finally {
      setAskingQuestion(false);
    }
  }

  return (
    <main className="app-container">
      <header className="app-header">
        <div>
          <p className="eyebrow">TURIUM AI</p>
          <h1>Knowledge Inbox</h1>
          <p className="subtitle">
            Save useful information, find it later, and ask questions about
            your knowledge.
          </p>
        </div>

        <div className="library-count">
          <span>{items.length}</span>
          <small>Saved items</small>
        </div>
      </header>

      {error && (
        <div className="message error-message" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="message-close"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="message success-message" role="status">
          <span>{success}</span>
          <button
            type="button"
            className="message-close"
            onClick={() => setSuccess("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <section className="workspace">
        <div className="panel add-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CAPTURE</p>
              <h2>Add to your inbox</h2>
            </div>
          </div>

          <div className="type-switch" role="group" aria-label="Item type">
            <button
              type="button"
              className={itemType === "note" ? "type-button active" : "type-button"}
              onClick={() => setItemType("note")}
              aria-pressed={itemType === "note"}
            >
              Note
            </button>

            <button
              type="button"
              className={itemType === "url" ? "type-button active" : "type-button"}
              onClick={() => setItemType("url")}
              aria-pressed={itemType === "url"}
            >
              Web URL
            </button>
          </div>

          <form onSubmit={handleAddItem} className="form-stack">
            <label htmlFor="item-title">Title</label>
            <input
              id="item-title"
              type="text"
              placeholder="Give this item a title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />

            {itemType === "note" ? (
              <>
                <label htmlFor="item-content">Content</label>
                <textarea
                  id="item-content"
                  placeholder="Write or paste your notes here..."
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={6}
                  required
                />
              </>
            ) : (
              <>
                <label htmlFor="item-url">Web address</label>
                <input
                  id="item-url"
                  type="url"
                  placeholder="https://example.com/article"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  required
                />
                <p className="field-hint">
                  The backend will retrieve the page content if the URL is
                  accessible.
                </p>
              </>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={submittingItem}
            >
              {submittingItem
                ? "Saving..."
                : itemType === "note"
                  ? "Save note"
                  : "Save URL"}
            </button>
          </form>
        </div>

        <div className="panel query-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RETRIEVE</p>
              <h2>Ask your knowledge</h2>
            </div>
          </div>

          <p className="panel-description">
            Ask a question about the information you have saved. Answers are
            generated using relevant retrieved passages.
          </p>

          <form onSubmit={handleAskQuestion} className="form-stack">
            <label htmlFor="question">Your question</label>
            <textarea
              id="question"
              placeholder="What would you like to know?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              required
            />

            <button
              type="submit"
              className="primary-button"
              disabled={askingQuestion}
            >
              {askingQuestion ? "Searching your knowledge..." : "Ask question"}
            </button>
          </form>

          {askingQuestion && (
            <p className="field-hint" role="status">
              Finding relevant passages and generating an answer...
            </p>
          )}

          {queryResult && (
            <section className="answer-section" aria-live="polite">
              <p className="eyebrow">AI RESPONSE</p>
              <h2>Answer</h2>
              <div className="answer-content">
                {queryResult.answer}
              </div>

              <div className="sources-heading">
                <h3>Sources</h3>
                <span>{queryResult.sources.length}</span>
              </div>

              {queryResult.sources.length === 0 ? (
                <p className="empty-state">
                  No source passages were returned for this answer.
                </p>
              ) : (
                <div className="source-list">
                  {queryResult.sources.map((source, index) => (
                    <article
                      className="source-card"
                      key={`${source.item_id ?? source.title}-${index}`}
                    >
                      <div className="source-card-header">
                        <h4>{source.title}</h4>
                        {typeof source.score === "number" && (
                          <span className="source-score">
                            Relevance: {source.score.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <p className="source-snippet">{source.text}</p>

                      {source.source_url && (
                        <a
                          className="source-link"
                          href={source.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open original source ↗
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </section>

      <section className="panel library-panel">
        <div className="section-heading library-heading">
          <div>
            <p className="eyebrow">YOUR COLLECTION</p>
            <h2>Your Library</h2>
            <p className="panel-description">
              Notes and web pages available for retrieval.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadItems()}
            disabled={loadingItems}
          >
            {loadingItems ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingItems ? (
          <p className="empty-state">Loading your library...</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h3>Your inbox is empty</h3>
            <p>Add a note or URL to start building your knowledge library.</p>
          </div>
        ) : (
          <div className="library-list">
            {items.map((item) => (
              <article className="library-item" key={item.id}>
                <div className="library-item-top">
                  <span className="item-type">
                    {item.item_type === "url" ? "WEB PAGE" : "NOTE"}
                  </span>
                  <span className="item-date">
                    {formatDate(item.created_at)}
                  </span>
                </div>

                <h3>{item.title}</h3>

                <p className="library-content">
                  {item.content
                    ? item.content.length > 240
                      ? `${item.content.slice(0, 240)}…`
                      : item.content
                    : "No content preview available."}
                </p>

                {item.source_url && (
                  <a
                    className="source-link"
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit original page ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="app-footer">
        Turium AI Knowledge Inbox · Retrieval grounded in your saved content
      </footer>
    </main>
  );
}

export default App;
