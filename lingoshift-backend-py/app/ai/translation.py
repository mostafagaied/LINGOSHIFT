import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, FewShotChatMessagePromptTemplate
from langchain_core.messages import HumanMessage
from langchain.tools import tool
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from app.ai.documents import generate_docx, generate_pdf, translate_pdf_via_docx

load_dotenv()

model = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    max_retries=3,
    timeout=120,
)

examples = [
    {"input": "Bonjour, comment allez-vous ?", "output": "Hello, how are you?"},
    {"input": "The weather is nice today.", "output": "Il fait beau aujourd'hui."},
    {"input": "I love programming in Python.", "output": "J'adore programmer en Python."},
]

example_prompt = ChatPromptTemplate.from_messages([
    ("human", "{input}"),
    ("ai", "{output}"),
])

few_shot_prompt = FewShotChatMessagePromptTemplate(
    example_prompt=example_prompt,
    examples=examples,
)

final_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a translation engine. Translate the given text to {target_lang}. "
               "Output ONLY the translated text. Do not add explanations, notes, or commentary. "
               "Preserve the original meaning, tone, and formatting exactly."),
    few_shot_prompt,
    ("human", "{input}"),
])

translation_chain = final_prompt | model


def extract_text_content(content) -> str:
    """Handles both plain-string and list-of-parts response shapes from the model."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict) and "text" in part:
                parts.append(part["text"])
            elif isinstance(part, str):
                parts.append(part)
        return "".join(parts)
    return str(content)


# ---------- Per-session file registry ----------
# Mirrors the notebook's reliance on a single global `input_file_path`,
# but scoped per thread_id since a server handles multiple sessions at once.
SESSION_FILES: dict[str, dict] = {}

# Active context read by generate_file_tool during the current agent.invoke() call.
_CURRENT_FILE_CONTEXT: dict = {"input_file_path": None}


def register_session_file(thread_id: str, file_path: str, file_type: str, file_name: str):
    SESSION_FILES[thread_id] = {
        "input_file_path": file_path,
        "file_type": file_type,
        "file_name": file_name,
    }


def _activate_file_context(thread_id: str):
    session = SESSION_FILES.get(thread_id)
    _CURRENT_FILE_CONTEXT["input_file_path"] = session["input_file_path"] if session else None
    _CURRENT_FILE_CONTEXT["rebuild_source_path"] = session.get("rebuild_source_path") if session else None

# ---------- Tools ----------

@tool(return_direct=True)
def translate_tool(text: str, target_lang: str, instruction: str = "") -> str:
    """Translate text into target_lang. If instruction is given, apply it while translating
    (e.g. 'make it more formal', 'change the second sentence to be more casual').
    Returns only the translated/adjusted text, in target_lang."""
    prompt_input = text if not instruction else f"{text}\n\n(Instruction: {instruction})"
    result = translation_chain.invoke({"target_lang": target_lang, "input": prompt_input})
    return extract_text_content(result.content)


@tool(return_direct=True)
def generate_file_tool(translated_text: str, file_type: str, target_lang: str, file_name: str = "") -> str:
    """Save the translated text as a new file (docx or pdf). Only call this once the user
    has confirmed the translation is good. If file_name is omitted, the original uploaded
    file name is used automatically."""
    source_path = _CURRENT_FILE_CONTEXT.get("input_file_path") or ""
    rebuild_source_path = _CURRENT_FILE_CONTEXT.get("rebuild_source_path") or source_path

    if not file_name:
        file_name = os.path.splitext(os.path.basename(source_path))[0] if source_path else "translation"

    paragraphs = [p.strip() for p in translated_text.split("\n\n") if p.strip()]
    output_path = f"uploads/{file_name}_version_{target_lang}.{file_type}"

    if file_type == "docx":
        generate_docx(paragraphs, output_path, target_lang=target_lang, source_path=source_path)

    elif file_type == "pdf":
        if source_path and source_path.lower().endswith(".pdf") and os.path.exists(source_path):
            translate_pdf_via_docx(
                pdf_path=source_path,
                translated_text=translated_text,
                output_pdf_path=output_path,
                target_lang=target_lang,
                pre_converted_docx_path=rebuild_source_path if rebuild_source_path.endswith(".docx") else "",
            )
        else:
            generate_pdf(paragraphs, output_path, target_lang=target_lang)
    else:
        return "Error: file_type must be 'docx' or 'pdf'"

    return output_path
# ---------- Agent ----------

AGENT_SYSTEM_PROMPT = """You are a translation workflow assistant. Your ONLY job is to call translate_tool and return its output.

Rules you must always follow:
1. When you call translate_tool, your response to the user must be ONLY the exact text it returned — no greetings, no explanations, no "Here is the translation:", no commentary before or after.
2. After showing a translation, do nothing else — wait for the user's next message. They will either:
   - give another instruction (change tone, change a word, change a part, retranslate a section) → call translate_tool again with that instruction, and again reply with ONLY the new translated text
   - confirm they are satisfied (e.g. "looks good", "confirm", "approve", "save it") → if a file was requested, call generate_file_tool now
3. Never translate into a different language than the one fixed at the start of the conversation.
4. Never ask the user questions. Never add filler sentences. Your replies are either: the raw translated text, or the result of generate_file_tool.
"""

agent = create_agent(
    model=model,
    system_prompt=AGENT_SYSTEM_PROMPT,
    tools=[translate_tool, generate_file_tool],
    checkpointer=InMemorySaver(),
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                "translate_tool": False,
                "generate_file_tool": {"allowed_decisions": ["approve", "reject"]},
            }
        )
    ],
)


# ---------- Session helpers ----------

def start_session(thread_id: str, content: str, target_lang: str, file_type: str = None, file_name: str = None, instruction: str = ""):
    """Call this ONCE at the start of a session. target_lang is fixed from here on."""
    config = {"configurable": {"thread_id": thread_id}}
    _activate_file_context(thread_id)

    msg = f"Translate this text to {target_lang}."
    if instruction and instruction.strip():
        msg += f" Instruction: {instruction.strip()}."
    if file_type:
        msg += f" Once I confirm it's good, save it as a {file_type} file using target_lang='{target_lang}' and file_name='{file_name}'."
    msg += f"\n\nText:\n{content}"

    result = agent.invoke({"messages": [HumanMessage(content=msg)]}, config=config)
    return result, config


def send_instruction(thread_id: str, instruction: str):
    """Call this any number of times: to request changes, or to say 'approve, generate the file'."""
    config = {"configurable": {"thread_id": thread_id}}
    _activate_file_context(thread_id)

    result = agent.invoke({"messages": [HumanMessage(content=instruction)]}, config=config)
    return result


def approve_file(thread_id: str):
    """Sends the confirmation trigger, then immediately approves the resulting file-generation pause."""
    config = {"configurable": {"thread_id": thread_id}}
    _activate_file_context(thread_id)

    # Step 1: tell the agent the user is satisfied — this should trigger generate_file_tool, which pauses
    agent.invoke({"messages": [HumanMessage(content="this is good, please save it")]}, config=config)

    # Step 2: immediately resume/approve that pause
    return agent.invoke(Command(resume={"decisions": [{"type": "approve"}]}), config=config)




def get_last_message_text(result) -> str:
    if "__interrupt__" in result:
        return ""
    last_message = result["messages"][-1]
    return extract_text_content(last_message.content)


def register_session_file(thread_id: str, file_path: str, file_type: str, file_name: str, rebuild_source_path: str = ""):
    SESSION_FILES[thread_id] = {
        "input_file_path": file_path,
        "file_type": file_type,
        "file_name": file_name,
        "rebuild_source_path": rebuild_source_path or file_path,
    }