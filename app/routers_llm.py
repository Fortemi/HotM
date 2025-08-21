from fastapi import APIRouter
from pydantic import BaseModel
from .llm.ollama_client import OllamaClient

router = APIRouter(prefix="/llm", tags=["llm"])
ollama = OllamaClient()


class SummarizeRequest(BaseModel):
    text: str
    instruction: str | None = None


@router.post("/summarize")
def summarize(req: SummarizeRequest):
    instruction = req.instruction or "Summarize the following text in 3-5 bullet points."
    prompt = f"{instruction}\n\nText:\n{req.text}"
    summary = ollama.generate(prompt)
    return {"summary": summary}
