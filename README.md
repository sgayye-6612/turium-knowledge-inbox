# Turium AI Knowledge Inbox

A full-stack knowledge management application that lets users save notes and public webpages, search saved content semantically, and ask questions with source snippets.

## Features

* Save notes and public HTML webpages.
* Extract readable text from webpages.
* Store knowledge items in SQLite.
* Retrieve relevant passages using Sentence Transformers.
* Generate grounded answers with a local Ollama model.
* Return source titles, snippets, and relevance scores.
* React and TypeScript user interface.
* FastAPI endpoints, validation, error handling, and logging.

## Tech stack

* Frontend: React, TypeScript, Vite
* Backend: Python, FastAPI
* Database: SQLite, SQLAlchemy
* Semantic retrieval: Sentence Transformers, NumPy
* Answer generation: Ollama with Llama 3.2

## Run locally

### Backend

From the project root, activate the existing virtual environment and start the API:

```
.venv\Scripts\Activate.ps1
cd backend
python -m uvicorn main:app --reload
```

API documentation: http://localhost:8000/docs

### Frontend

Open a separate terminal:

```
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, usually http://localhost:5173.

### AI model

Install Ollama and download the model:

```
ollama pull llama3.2
```

Ensure Ollama is running when you want generated answers. If generation is unavailable, the API returns relevant source passages with a fallback response.

## API endpoints

* `POST /ingest` — save a note or ingest a webpage.
* `GET /items` — list saved knowledge items.
* `POST /query` — retrieve relevant passages and generate an answer.
* `GET /health` — health check.

## Design decisions

SQLite keeps local setup simple. Sentence Transformer embeddings enable semantic retrieval without requiring a paid embedding API. Retrieved passages are provided to the language model as context, and the response includes source snippets to support verification. Local Ollama avoids mandatory paid model access.

## Limitations

* Web ingestion requires publicly accessible HTML pages.
* Dynamic webpages and PDFs are not supported by the current extractor.
* AI answer generation depends on the local Ollama model.
* This is a minimal assignment implementation, not a production deployment.
