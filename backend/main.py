import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from db import (
    save_message, get_recent_messages, get_or_create_user,
    create_agent, get_agents, get_agent, update_agent, delete_agent,
    get_agent_messages, save_agent_message,
    get_agent_memories, upsert_memory, delete_memory,
)
from agent import run_agent, run_agent_chat, generate_system_prompt
from memory import extract_memories
from models import MessageRequest, CreateAgentRequest, UpdateAgentRequest, ChatRequest

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "sudo running"}


@app.get("/messages/{user_id}")
async def messages(user_id: str):
    rows = await get_recent_messages(user_id)
    return {"messages": rows}


@app.post("/message")
async def handle_message(req: MessageRequest):
    user = await get_or_create_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await save_message(req.user_id, "user", req.content)
    reply = await run_agent(req.user_id, req.content)
    await save_message(req.user_id, "assistant", reply)

    return {"reply": reply}


# --- Agent endpoints ---

@app.post("/agents")
async def create_agent_endpoint(req: CreateAgentRequest):
    await get_or_create_user(req.user_id)
    system_prompt = await generate_system_prompt(req.description)
    try:
        agent = await create_agent(req.user_id, req.name, req.description, system_prompt)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return agent


@app.get("/agents")
async def list_agents(user_id: str):
    agents = await get_agents(user_id)
    return {"agents": agents}


@app.get("/agents/{agent_id}")
async def get_agent_endpoint(agent_id: str):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.patch("/agents/{agent_id}")
async def update_agent_endpoint(agent_id: str, req: UpdateAgentRequest):
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    agent = await update_agent(agent_id, updates)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.delete("/agents/{agent_id}")
async def delete_agent_endpoint(agent_id: str):
    success = await delete_agent(agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"ok": True}


@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, req: ChatRequest):
    agent = await get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await save_agent_message(agent_id, req.user_id, "user", req.message)

    reply = await run_agent_chat(agent_id, req.message)

    await save_agent_message(agent_id, req.user_id, "assistant", reply)

    # Extract and save memories (non-critical, don't fail the response)
    try:
        existing = await get_agent_memories(agent_id)
        memories = await extract_memories(req.message, reply, existing)
        for mem in memories:
            await upsert_memory(agent_id, mem["key"], mem["value"])
    except Exception:
        pass

    return {"reply": reply}


@app.get("/agents/{agent_id}/messages")
async def get_agent_messages_endpoint(agent_id: str, limit: int = 50):
    messages = await get_agent_messages(agent_id, limit)
    return {"messages": messages}


# --- Memory endpoints ---

@app.get("/agents/{agent_id}/memory")
async def get_memories(agent_id: str):
    memories = await get_agent_memories(agent_id)
    return {"memories": memories}


@app.delete("/agents/{agent_id}/memory/{memory_id}")
async def delete_memory_endpoint(agent_id: str, memory_id: str):
    success = await delete_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"ok": True}
