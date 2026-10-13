import hashlib
import logging
import re
from functools import lru_cache
from pathlib import Path

import chromadb
import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

VECTOR_DB_PATH = Path(__file__).resolve().parent / "chroma_db"
COLLECTION_NAME = "knowledge_chunks"


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    """Load the embedding model once per process."""
    return SentenceTransformer("all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def get_collection():
    """Return the persistent ChromaDB collection."""
    client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))

    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def split_into_chunks(
    text: str,
    chunk_size: int = 800,
    overlap: int = 150,
) -> list[str]:
    """Split text on word boundaries with intentional overlap."""
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        return []

    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero.")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be between zero and chunk_size.")

    words = text.split(" ")
    chunks = []
    current_words = []
    current_length = 0

    for word in words:
        extra_length = len(word) + (1 if current_words else 0)

        if current_words and current_length + extra_length > chunk_size:
            chunks.append(" ".join(current_words))

            overlap_words = []
            overlap_length = 0

            for previous_word in reversed(current_words):
                added_length = len(previous_word) + (
                    1 if overlap_words else 0
                )

                if overlap_words and overlap_length + added_length > overlap:
                    break

                if not overlap_words and len(previous_word) > overlap:
                    break

                overlap_words.insert(0, previous_word)
                overlap_length += added_length

            current_words = overlap_words
            current_length = len(" ".join(current_words))

        if current_words:
            current_length += 1

        current_words.append(word)
        current_length += len(word)

    if current_words:
        chunks.append(" ".join(current_words))

    return chunks


def _content_hash(text: str) -> str:
    """Identify changes to a passage without storing duplicate embeddings."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _build_passages(items: list) -> list[dict]:
    """Convert saved items into uniquely identified text passages."""
    passages = []

    for item in items:
        for chunk_index, chunk in enumerate(split_into_chunks(item.content)):
            passages.append(
                {
                    "id": f"item-{item.id}-chunk-{chunk_index}",
                    "item_id": int(item.id),
                    "title": str(item.title),
                    "source_url": str(item.source_url or ""),
                    "item_type": str(item.item_type),
                    "text": chunk,
                    "content_hash": _content_hash(chunk),
                }
            )

    return passages


def _sync_vector_store(passages: list[dict]) -> None:
    """Insert new vectors and update only passages whose text has changed."""
    collection = get_collection()

    existing = collection.get(include=["metadatas"])
    existing_ids = set(existing["ids"])
    existing_metadata = dict(
        zip(existing["ids"], existing["metadatas"] or [])
    )

    current_ids = {passage["id"] for passage in passages}

    stale_ids = existing_ids - current_ids
    if stale_ids:
        collection.delete(ids=list(stale_ids))
        logger.info("Removed %d stale vector chunks", len(stale_ids))

    changed = [
        passage
        for passage in passages
        if existing_metadata.get(passage["id"], {}).get("content_hash")
        != passage["content_hash"]
    ]

    if not changed:
        return

    model = get_model()
    embeddings = model.encode(
        [passage["text"] for passage in changed],
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    collection.upsert(
        ids=[passage["id"] for passage in changed],
        embeddings=np.asarray(embeddings).tolist(),
        documents=[passage["text"] for passage in changed],
        metadatas=[
            {
                "item_id": passage["item_id"],
                "title": passage["title"],
                "source_url": passage["source_url"],
                "item_type": passage["item_type"],
                "content_hash": passage["content_hash"],
            }
            for passage in changed
        ],
    )

    logger.info("Indexed %d new or changed vector chunks", len(changed))


def retrieve_relevant_chunks(
    question: str,
    items: list,
    top_k: int = 3,
) -> list[dict]:
    """Retrieve relevant passages using persistent vector embeddings."""
    if not question.strip() or not items or top_k <= 0:
        return []

    passages = _build_passages(items)

    if not passages:
        return []

    _sync_vector_store(passages)

    collection = get_collection()

    if collection.count() == 0:
        return []

    model = get_model()
    question_embedding = model.encode(
        [question],
        normalize_embeddings=True,
        show_progress_bar=False,
    )[0]

    result = collection.query(
        query_embeddings=[np.asarray(question_embedding).tolist()],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    ids = result["ids"][0]
    documents = result["documents"][0]
    metadatas = result["metadatas"][0]
    distances = result["distances"][0]

    retrieved = []

    for chunk_id, document, metadata, distance in zip(
        ids, documents, metadatas, distances
    ):
        retrieved.append(
            {
                "chunk_id": chunk_id,
                "item_id": metadata["item_id"],
                "title": metadata["title"],
                "source_url": metadata.get("source_url") or None,
                "item_type": metadata["item_type"],
                "text": document,
                "score": round(1.0 - float(distance), 4),
            }
        )

    return retrieved
