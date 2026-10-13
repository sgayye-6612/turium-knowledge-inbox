
# Turium AI Knowledge Inbox

A full-stack AI knowledge management application for saving notes and public webpages, retrieving relevant information semantically, and answering questions with source citations.

## Features

- Save text notes and public webpage URLs.
- Extract readable text from publicly accessible webpages.
- Store knowledge items in SQLite.
- Retrieve relevant passages using semantic embeddings.
- Generate answers using a local Ollama language model.
- Display source titles, content snippets, and relevance scores.
- Responsive React and TypeScript frontend.
- FastAPI backend with input validation and error handling.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Database:** SQLite, SQLAlchemy
- **Semantic Retrieval:** Sentence Transformers, NumPy
- **AI Generation:** Ollama, Llama 3.2

## Prerequisites

Install the following before running the application:

- Python 3.11 or a compatible version
- Node.js and npm
- [Ollama](https://ollama.com/) for local AI answer generation
- Git

## Setup and Installation

### 1. Clone the repository

```bash
git clone https://github.com/sgayye-6612/turium-knowledge-inbox.git
cd turium-knowledge-inbox
```

### 2. Create a Python virtual environment

**Windows PowerShell:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install backend dependencies

Run this command from the project root after activating the virtual environment:

```bash
python -m pip install -r backend/requirements.txt
```

On the first run, Sentence Transformers downloads the `all-MiniLM-L6-v2` embedding model. The download is approximately 90 MB and may take a few minutes depending on your connection.

### 4. Start the backend

From the project root:

```bash
cd backend
python -m uvicorn main:app --reload
```

The API will be available at:

- API: http://localhost:8000
- Interactive API documentation: http://localhost:8000/docs
- Health check: http://localhost:8000/health

Keep this terminal running.

### 5. Start the frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, usually http://localhost:5173.

### 6. Enable AI answer generation

Install and start Ollama, then download the model:

```bash
ollama pull llama3.2
```

Make sure Ollama is running and the model is available locally. The application uses the model to generate answers based on retrieved passages.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Backend welcome response |
| GET | `/health` | Check backend health |
| POST | `/ingest` | Save a note or ingest a webpage |
| GET | `/items` | List saved knowledge items |
| POST | `/query` | Retrieve relevant passages and generate an answer |

## Design Decisions

- **SQLite:** Keeps local setup simple without requiring a separate database server.
- **Sentence Transformers:** Creates semantic embeddings locally instead of requiring a paid embedding API.
- **Semantic retrieval:** Finds saved passages relevant to a user's question.
- **Source citations:** Displays retrieved content so users can verify the information used in an answer.
- **Local LLM:** Ollama allows answer generation without mandatory paid model access.

## Limitations

- Web ingestion is intended for publicly accessible HTML pages.
- Dynamic webpages and PDFs are not supported by the current extractor.
- Some websites may block automated requests or restrict access.
- AI answer generation depends on the local Ollama model being available.
- The current implementation is a minimal interview assignment, not a production-ready service.
