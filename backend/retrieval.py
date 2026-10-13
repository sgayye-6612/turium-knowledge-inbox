
from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def get_model():
    """Load and cache the sentence-transformer model."""
    return SentenceTransformer("all-MiniLM-L6-v2")


def split_into_chunks(
    text: str,
    chunk_size: int = 800,
    overlap: int = 150,
) -> list[str]:
    """Split text into overlapping chunks."""
    text = " ".join(text.split())

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])

        if end == len(text):
            break

        start = end - overlap

    return chunks


def retrieve_relevant_chunks(
    question: str,
    items: list,
    top_k: int = 3,
) -> list[dict]:
    """Retrieve the most relevant unique passages for a question."""
    passages = []
    seen_content = set()

    for item in items:
        for chunk in split_into_chunks(item.content):
            normalized_content = chunk.casefold().strip()

            if not normalized_content:
                continue

            # Avoid returning identical passages from duplicate notes.
            if normalized_content in seen_content:
                continue

            seen_content.add(normalized_content)

            passages.append(
                {
                    "item_id": item.id,
                    "title": item.title,
                    "source_url": item.source_url,
                    "item_type": item.item_type,
                    "text": chunk,
                }
            )

    if not passages:
        return []

    model = get_model()

    question_embedding = model.encode(
        [question],
        normalize_embeddings=True,
    )[0]

    passage_embeddings = model.encode(
        [passage["text"] for passage in passages],
        normalize_embeddings=True,
    )

    scores = np.dot(passage_embeddings, question_embedding)
    best_indices = np.argsort(scores)[::-1][:top_k]

    results = []

    for index in best_indices:
        passage = passages[int(index)]

        results.append(
            {
                **passage,
                "score": round(float(scores[index]), 4),
            }
        )

    return results