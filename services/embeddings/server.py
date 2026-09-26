from fastapi import FastAPI
from pydantic import BaseModel
from fastembed import TextEmbedding

app = FastAPI(title="SAGE Embedding Service")

MODEL_NAME = "BAAI/bge-small-en-v1.5"

model = TextEmbedding(model_name=MODEL_NAME)


class EmbedRequest(BaseModel):
    text: str
    type: str = "query"


class EmbedResponse(BaseModel):
    embedding: list[float]
    dimensions: int
    model: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "sage-embeddings",
        "model": MODEL_NAME,
        "dimensions": 384,
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    text = request.text.strip()

    if not text:
        raise ValueError("Text cannot be empty")

    # BGE recommends distinguishing documents from queries.
    prefix = "passage: " if request.type == "document" else "query: "

    embeddings = list(model.embed([prefix + text]))
    vector = embeddings[0].tolist()

    return {
        "embedding": vector,
        "dimensions": len(vector),
        "model": MODEL_NAME,
    }


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)

