import json
import logging
import os
from datetime import datetime

import requests
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST
from django.utils import timezone
from dotenv import load_dotenv

from .models import ChatUser

logger = logging.getLogger(__name__)

load_dotenv()


def get_system_prompt():
    """Return system prompt with live date and time injected."""
    now = datetime.now()
    date_str = now.strftime("%A, %B %d, %Y")
    time_str = now.strftime("%I:%M %p")
    return (
        f"You are NexusAI, a helpful, precise, and friendly AI assistant. "
        f"Today's date is {date_str} and the current time is {time_str}. "
        f"Always use this accurate date and time when the user asks about it. "
        f"Answer the user's question directly and accurately. "
        f"If the user provides an image, analyze it carefully and answer based on the image content. "
        f"If the user asks you to generate, create, or draw an image, YOU MUST reply ONLY with this exact special tag and no other text: "
        f"[GENERATE_IMAGE: <a highly detailed visual description of the image>] "
        f"CRITICAL: If the user asks you to translate a word, phrase, sentence, or text to any language, you MUST respond ONLY with the translated text. Do not include any introductory sentences, conversational filler, or explanatory notes (e.g., do not say 'Here is the translation:' or wrap the output in quotes unless the original text had them). Just output the direct translation."
        f"Format your responses clearly using markdown where appropriate (bold, bullet points, code blocks). "
        f"If you are not sure about something, say so clearly instead of inventing facts."
    )

API_KEYS = {
    "gemini": "GOOGLE_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "groq": "GROQ_API_KEY",
}

ALLOWED_MODELS = {
    "gemini": [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
    ],
    "mistral": [
        "pixtral-12b-2409",
        "pixtral-large-latest",
        "mistral-large-latest",
        "mistral-medium-latest",
        "mistral-small-latest",
        "open-mixtral-8x7b",
        "open-mistral-7b",
    ],
    "groq": [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "llama-3.2-11b-vision-preview",
        "llama-3.2-90b-vision-preview",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "deepseek-r1-distill-llama-70b",
    ],
}


@ensure_csrf_cookie
def home(request):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    return render(request, "myapp/index.html", {"google_client_id": google_client_id})


@require_POST
def chat_api(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
        provider = payload.get("provider", "gemini")
        model = payload.get("model", "")
        messages = payload.get("messages", [])

        if provider not in ALLOWED_MODELS or model not in ALLOWED_MODELS[provider]:
            return JsonResponse({"reply": "Please select a valid AI provider and model."})

        api_key = os.getenv(API_KEYS[provider])
        if not api_key:
            return JsonResponse(
                {"reply": f"API key for '{provider}' is not configured on the server. Please check your .env file."}
            )

        # Try requested model first, then fallback to other models on 503/overload
        models_to_try = [model] + [m for m in ALLOWED_MODELS[provider] if m != model]
        last_error = None

        for attempt_model in models_to_try:
            try:
                reply = call_provider(provider, attempt_model, messages, api_key)
                if attempt_model != model:
                    reply = f"ℹ️ *Note: '{model}' is currently overloaded, responded using '{attempt_model}'.*\n\n" + reply
                return JsonResponse({"reply": reply})
            except requests.exceptions.HTTPError as e:
                status_code = e.response.status_code if e.response is not None else 0
                if status_code in (503, 529, 500):
                    logger.warning("Model %s returned %s, trying fallback...", attempt_model, status_code)
                    last_error = e
                    continue  # Try next model
                # Non-retriable error — raise immediately
                raise e

        # All models failed
        if last_error is not None:
            raise last_error
        return JsonResponse({"reply": "❌ All models are currently unavailable. Please try again later."})

    except requests.exceptions.HTTPError as e:
        logger.error("HTTP error from AI provider: %s | Response: %s", e, getattr(e.response, 'text', ''))
        status_code = e.response.status_code if e.response is not None else 0
        if status_code == 401:
            return JsonResponse({"reply": "❌ Invalid API key. Please check your API key in the .env file."})
        elif status_code == 429:
            return JsonResponse({"reply": "⚠️ Rate limit reached. Please wait a moment and try again."})
        elif status_code == 400:
            return JsonResponse({"reply": f"❌ Bad request to AI provider. Details: {getattr(e.response, 'text', str(e))}"})
        elif status_code in (503, 529):
            return JsonResponse({"reply": "⚠️ All AI models are currently overloaded. Please wait a minute and try again."})
        else:
            return JsonResponse({"reply": f"❌ AI provider returned error {status_code}. Please try again."})
    except requests.exceptions.ConnectionError:
        logger.error("Connection error reaching AI provider")
        return JsonResponse({"reply": "❌ Cannot connect to the AI provider. Please check your internet connection."})
    except requests.exceptions.Timeout:
        logger.error("Timeout reaching AI provider")
        return JsonResponse({"reply": "⏱️ The AI provider took too long to respond. Please try again."})
    except Exception as e:
        logger.exception("Unexpected error in chat_api: %s", e)
        return JsonResponse({"reply": f"❌ Unexpected error: {str(e)}. Please try again."})


def has_video_file(messages):
    for msg in messages:
        images = msg.get("images") or []
        if not images and msg.get("image"):
            images = [msg["image"]]
        for img in images:
            mime = img.get("mimeType") or ""
            if mime.startswith("video/"):
                return True
    return False


def call_provider(provider, model, messages, api_key):
    system_prompt = get_system_prompt()
    if has_video_file(messages):
        system_prompt += (
            " If the user uploads a video file, you MUST analyze both its visual content and its audio content. "
            "In your response, you must always provide: 1) A detailed description of the video's visual content, and "
            "2) A complete and accurate text transcription (audio script) of all spoken dialogue/audio in the video. "
            "Clearly label these sections."
        )
    if provider == "gemini":
        reply = call_gemini(model, messages, api_key, system_prompt)
    elif provider == "mistral":
        reply = call_mistral(model, messages, api_key, system_prompt)
    elif provider == "groq":
        reply = call_groq(model, messages, api_key, system_prompt)
    else:
        raise ValueError("Unknown provider")

    import re
    match = re.search(r"\[GENERATE_IMAGE:\s*(.*?)\]", reply, re.DOTALL | re.IGNORECASE)
    if match:
        image_prompt = match.group(1).strip()
        if image_prompt.endswith(']'):
            image_prompt = image_prompt[:-1]
        image_prompt = image_prompt.strip()
        
        if not image_prompt:
            image_prompt = "A beautiful aesthetic digital art landscape"
            
        return generate_openai_image(image_prompt)
        
    return reply

def generate_openai_image(prompt):
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        return "❌ Error: OPENAI_API_KEY is not configured in the server's .env file for image generation."
    
    openai_key = openai_key.strip(' "\'')
    
    url = "https://api.openai.com/v1/images/generations"
    headers = {
        "Authorization": f"Bearer {openai_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024"
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        image_url = data["data"][0]["url"]
        return f"Here is the generated image based on your request:\n\n![Generated Image]({image_url})"
    except requests.exceptions.HTTPError as e:
        error_message = e.response.text
        try:
            error_message = e.response.json().get('error', {}).get('message', error_message)
        except Exception:
            pass
        logger.error("DALL-E API HTTP Error: %s", error_message)
        
        import urllib.parse
        encoded_prompt = urllib.parse.quote(prompt)
        fallback_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
        return (
            f"⚠️ **Notice:** OpenAI API failed ({error_message}).\n\n"
            f"Generating an alternative image for you:\n\n"
            f"![Generated Image]({fallback_url})"
        )
    except Exception as e:
        logger.error("DALL-E API Error: %s", e)
        import urllib.parse
        encoded_prompt = urllib.parse.quote(prompt)
        fallback_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
        return (
            f"⚠️ **Notice:** OpenAI API error ({str(e)}).\n\n"
            f"Generating an alternative image for you:\n\n"
            f"![Generated Image]({fallback_url})"
        )


def call_gemini(model, messages, api_key, system_prompt):
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    contents = []
    for msg in messages:
        role = msg.get("role")
        if role not in {"user", "assistant"}:
            continue

        parts = []
        # Add text part
        if msg.get("content"):
            parts.append({"text": msg["content"]})

        # Add image parts (only for user messages)
        if role == "user":
            images = msg.get("images") or []
            if not images and msg.get("image"):
                images = [msg["image"]]
            
            for img in images:
                img_data = img.get("data") or ""
                img_mime = img.get("mimeType") or ""
                # Strip data URL prefix if present
                if "," in img_data:
                    img_data = img_data.split(",", 1)[1]
                if img_data and img_mime:
                    parts.append(
                        {
                            "inline_data": {
                                "mime_type": img_mime,
                                "data": img_data,
                            }
                        }
                    )

        if parts:
            contents.append(
                {
                    "role": "user" if role == "user" else "model",
                    "parts": parts,
                }
            )

    if not contents:
        contents.append({"role": "user", "parts": [{"text": "Hello"}]})

    response = requests.post(
        url,
        params={"key": api_key},
        json={
            "contents": contents,
            "generationConfig": {"temperature": 0.3, "topP": 0.95, "maxOutputTokens": 4096},
            "systemInstruction": {"parts": [{"text": system_prompt}]},
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates", [])
    if not candidates:
        # Check for prompt feedback (blocked content)
        feedback = data.get("promptFeedback", {})
        block_reason = feedback.get("blockReason", "")
        if block_reason:
            return f"⚠️ The request was blocked by the AI safety filter: {block_reason}."
        return "No response generated."
    return (
        candidates[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "No response generated.")
    )


def call_mistral(model, messages, api_key, system_prompt):
    return call_openai_compatible(
        "https://api.mistral.ai/v1/chat/completions", model, messages, api_key, system_prompt
    )


def call_groq(model, messages, api_key, system_prompt):
    return call_openai_compatible(
        "https://api.groq.com/openai/v1/chat/completions", model, messages, api_key, system_prompt
    )


def call_openai_compatible(url, model, messages, api_key, system_prompt):
    chat_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        role = msg.get("role")
        if role not in {"user", "assistant"}:
            continue

        content_text = msg.get("content", "").strip()
        
        # Check for images in user messages
        images = msg.get("images") or []
        if not images and msg.get("image"):
            images = [msg["image"]]
            
        if role == "user" and images:
            # Construct content as a list of parts
            content_parts = []
            if content_text:
                content_parts.append({"type": "text", "text": content_text})
            for img in images:
                img_data = img.get("data") or ""
                img_mime = img.get("mimeType") or ""
                if "," in img_data:
                    img_data = img_data.split(",", 1)[1]
                if img_data and img_mime:
                    content_parts.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{img_mime};base64,{img_data}"
                        }
                    })
            if content_parts:
                chat_messages.append({"role": role, "content": content_parts})
        else:
            if content_text:
                chat_messages.append({"role": role, "content": content_text})

    if len(chat_messages) == 1:
        # Only system prompt - add a placeholder user message
        chat_messages.append({"role": "user", "content": "Hello"})

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": chat_messages,
            "temperature": 0.3,
            "max_tokens": 4096,
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    result = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return result if result else "No response generated."


@require_POST
def login_user(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
        email = payload.get("email", "").strip()
        name = payload.get("name", "").strip()
        
        if not email:
            return JsonResponse({"status": "error", "message": "Email is required."}, status=400)
            
        chat_user, created = ChatUser.objects.get_or_create(email=email)
        if name and chat_user.name != name:
            chat_user.name = name
        
        chat_user.last_login = timezone.now()
        chat_user.save()
        
        return JsonResponse({
            "status": "success",
            "message": "User logged in/registered successfully.",
            "user": {
                "email": chat_user.email,
                "name": chat_user.name,
                "created": created
            }
        })
    except Exception as e:
        logger.exception("Unexpected error in login_user: %s", e)
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
