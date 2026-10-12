
import logging
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from datetime import timezone
from retrieval import retrieve_relevant_chunks

import httpx
from bs4 import BeautifulSoup
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from models import KnowledgeItem

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("turium")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("Knowledge Inbox database initialized")
    yield


app = FastAPI(
    title="Turium AI Knowledge Inbox",
    description="Save notes and web articles for AI-powered knowledge retrieval.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class IngestRequest(BaseModel):
    item_type: str = Field(pattern="^(note|url)$")
    title: str | None = Field(default=None, max_length=300)
    content: str | None = Field(default=None, max_length=50000)
    url: HttpUrl | None = None


def serialize_item(item: KnowledgeItem):
    created_at = item.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return {
        "id": item.id,
        "title": item.title,
        "item_type": item.item_type,
        "source_url": item.source_url,
        "created_at": created_at.isoformat(),
    }


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "message": "Turium AI Knowledge Inbox API is running",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


@app.post("/ingest", status_code=201, tags=["Knowledge"])
async def ingest_item(
    payload: IngestRequest,
    db: Session = Depends(get_db),
):
    source_url = None

    if payload.item_type == "note":
        content = (payload.content or "").strip()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Content is required for a note.",
            )

        title = (payload.title or content[:60]).strip()

        if not title:
            raise HTTPException(
                status_code=400,
                detail="A title is required.",
            )

    else:
        if not payload.url:
            raise HTTPException(
                status_code=400,
                detail="A URL is required for a URL item.",
            )

        source_url = str(payload.url)
        parsed = urlparse(source_url)

        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise HTTPException(
                status_code=400,
                detail="Only valid HTTP and HTTPS URLs are supported.",
            )

        # Basic protection against requests to local services.
        hostname = parsed.hostname.lower()
        if (
            hostname == "localhost"
            or hostname.endswith(".localhost")
            or hostname.endswith(".local")
            or hostname in {
                "127.0.0.1",
                "0.0.0.0",
                "::1",
                "169.254.169.254",
            }
            or hostname.startswith("10.")
            or hostname.startswith("192.168.")
            or hostname.startswith("172.16.")
        ):
            raise HTTPException(
                status_code=400,
                detail="This URL is not allowed.",
            )

        try:
            async with httpx.AsyncClient(
                timeout=15.0,
                follow_redirects=False,
                trust_env=False,
            ) as client:
                response = await client.get(
                    source_url,
                    headers={
                        "User-Agent": "TuriumKnowledgeInbox/1.0"
                    },
                )
                response.raise_for_status()

            content_type = response.headers.get("content-type", "")

            if "text/html" not in content_type.lower():
                raise HTTPException(
                    status_code=415,
                    detail="The URL must return an HTML page.",
                )

            soup = BeautifulSoup(response.text, "html.parser")

            for tag in soup(
                ["script", "style", "nav", "footer", "header", "noscript"]
            ):
                tag.decompose()

            page_title = (
                soup.title.get_text(strip=True)
                if soup.title
                else None
            )

            content = soup.get_text(" ", strip=True)[:50000]
            title = (
                (payload.title or "").strip()
                or page_title
                or parsed.hostname
            )

            if not content:
                raise HTTPException(
                    status_code=422,
                    detail="No readable text was found at this URL.",
                )

        except HTTPException:
            raise
        except httpx.HTTPError as exc:
            logger.warning(
                "URL ingestion failed: %s",
                type(exc).__name__,
            )
            raise HTTPException(
                status_code=422,
                detail="Could not fetch the URL. Check that it is publicly accessible.",
            ) from exc

    item = KnowledgeItem(
        title=title,
        item_type=payload.item_type,
        content=content,
        source_url=source_url,
    )

    try:
        db.add(item)
        db.commit()
        db.refresh(item)
    except Exception:
        db.rollback()
        logger.exception("Failed to save knowledge item")
        raise HTTPException(
            status_code=500,
            detail="Could not save the knowledge item.",
        )

    logger.info(
        "Created knowledge item id=%s type=%s",
        item.id,
        item.item_type,
    )

    return serialize_item(item)


@app.get("/items", tags=["Knowledge"])
def list_items(db: Session = Depends(get_db)):
    items = (
        db.query(KnowledgeItem)
        .order_by(KnowledgeItem.created_at.desc())
        .all()
    )
    return [serialize_item(item) for item in items]

class QueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


@app.post("/query", tags=["Knowledge"])
def query_knowledge(
    payload: QueryRequest,
    db: Session = Depends(get_db),
):
    question = payload.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Please enter a question.",
        )

    items = db.query(KnowledgeItem).all()

    if not items:
        raise HTTPException(
            status_code=404,
            detail="No saved knowledge found. Add a note or webpage first.",
        )

    try:
        matches = retrieve_relevant_chunks(question, items)

    except Exception as exc:
        logger.exception("Knowledge retrieval failed")
        raise HTTPException(
            status_code=500,
            detail="Knowledge retrieval failed. Please try again.",
        ) from exc

    sources = [
        {
            "item_id": match["item_id"],
            "title": match["title"],
            "source_url": match["source_url"],
            "snippet": match["text"],
            "relevance_score": match["score"],
        }
        for match in matches
    ]

    return {
        "question": question,
        "answer": (
            "Here are the most relevant passages from your saved knowledge."
            if sources
            else "No relevant passages were found."
        ),
        "sources": sources,
    }
