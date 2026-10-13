
# Turium AI Knowledge Inbox

A full-stack AI knowledge management application for saving notes and public webpages, retrieving relevant information semantically, and answering questions with source citations.

## Features

- Save text notes and public webpage URLs.
- Extract readable text from webpages.
- Store knowledge items in SQLite.
- Retrieve relevant passages using semantic embeddings.
- Generate grounded answers using a local Ollama model.
- Display source titles, content snippets, and relevance scores.
- Responsive React and TypeScript frontend.
- FastAPI backend with validation and error handling.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Database:** SQLite, SQLAlchemy
- **Semantic Retrieval:** Sentence Transformers, NumPy
- **AI Generation:** Ollama, Llama 3.2

## Prerequisites

- Python
- Node.js and npm
- Ollama with the `llama3.2` model

## Run Locally

### 1. Start the Backend

From the project root, open a terminal and run:

```powershell
.\.venv\Scripts\Activate.ps1
cd backend
python -m uvicorn main:app --reload
```

API documentation: http://localhost:8000/docs

### 2. Start the Frontend

Open a second terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL displayed by Vite, usually http://localhost:5173.

### 3. Start AI Answer Generation

Ensure Ollama is installed and running. Download the model if needed:

```powershell
ollama pull llama3.2
```

The application uses the local model to generate answers from retrieved passages. If generation is unavailable, the backend can return a retrieval fallback.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check backend health |
| POST | `/ingest` | Save a note or ingest a webpage |
| GET | `/items` | List saved knowledge items |
| POST | `/query` | Retrieve relevant passages and generate an answer |

## Design Decisions

SQLite keeps local setup simple. Sentence Transformers provides semantic retrieval without requiring a paid embedding API. Retrieved passages are supplied to the language model as context, and source snippets help users verify answers. Local Ollama avoids mandatory paid model access.

## Limitations

- Web ingestion is intended for publicly accessible HTML pages.
- Dynamic webpages and PDFs are not supported by the current extractor.
- AI answer generation depends on the local Ollama model.
- This is a minimal assignment implementation, not a production deployment.
