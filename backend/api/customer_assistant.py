import json
import logging
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

TOPIC_PATTERNS = {
    "about_pharmacy_desk": (
        r"\b(what is|what does|about|features|how does)\b.{0,50}\b(pharmacy desk|app|platform)\b",
        r"\b(app|platform)\b.{0,40}\b(about|purpose|features|does)\b",
        r"\b(à propos|a propos|qu['’]est-ce que|fonctionnalités|fonctionnalites|"
        r"comment fonctionne)\b.{0,50}\b(pharmacy desk|application|plateforme)\b",
        r"\b(pharmacy desk ni iki|ibyerekeye pharmacy desk)\b",
    ),
    "create_customer_account": (
        r"\b(create|register|sign up|open)\b.{0,40}\b(account|customer)\b",
        r"\b(account|customer)\b.{0,40}\b(create|register|sign up)\b",
        r"\b(créer|creer|inscrire|inscription)\b.{0,40}\b(compte)\b",
        r"\b(kwiyandikisha|konti nshya)\b",
    ),
    "sign_in": (
        r"\b(sign in|log ?in|login|forgot password|password)\b",
        r"\b(connexion|connecter|mot de passe)\b",
        r"\b(kwinjira|ijambo ry'ibanga)\b",
    ),
    "update_profile": (
        r"\b(profile|change|update|edit)\b.{0,40}\b(profile|name|email|phone|contact)\b",
        r"\b(profile|name|email|phone|contact)\b.{0,40}\b(change|update|edit)\b",
        r"\b(profil|modifier|changer)\b.{0,40}\b(profil|nom|email|téléphone|telephone)\b",
        r"\b(umwirondoro|hindura|amazina|telefone)\b",
    ),
    "cancel_customer_order": (
        r"\b(cancel|cancellation|annuler|annulation|guhagarika)\b.{0,40}\b(order|request|commande|demande|icyo nasabye)\b",
        r"\b(order|request|commande|demande)\b.{0,40}\b(cancel|cancellation|annuler|guhagarika)\b",
        r"\bguhagarika\b.{0,40}\b(ibyo nasabye|icyo nasabye)\b",
    ),
    "track_customer_order": (
        r"\b(track|tracking|status|check|see|view)\b.{0,40}\b(order|request|commande|demande)\b",
        r"\b(order|request|commande|demande)\b.{0,40}\b(track|tracking|status|check|see|view)\b",
        r"\b(suivre|statut|voir)\b.{0,40}\b(commande|demande)\b",
        r"\b(commande|demande)\b.{0,40}\b(suivre|statut|voir)\b",
        r"\b(my orders|mes commandes|ibyo nasabye)\b",
    ),
    "request_pickup": (
        r"\b(order|request|pickup|pick up|commande|retrait|saba)\b",
        r"\b(reserve|reservation|réserver|réservation)\b",
        r"\bgusaba\b",
    ),
    "browse_medicines": (
        r"\b(browse|catalog|catalogue|search|find|available|see)\b.{0,40}\b(medicine|medicines|products|medicament|médicament|imiti)\b",
        r"\b(medicine|medicines|products|medicament|médicament|imiti)\b.{0,40}\b(browse|catalog|catalogue|search|find|available|see)\b",
        r"\b(browse medicines|parcourir les médicaments|reba imiti)\b",
    ),
    "contact_support": (
        r"\b(contact|support|phone|telephone|email|address|location|help)\b",
        r"\b(contacter|assistance|téléphone|telephone|adresse)\b",
        r"\b(twandikire|ubufasha|aho muri|telefone)\b",
    ),
}

HEALTH_QUESTION_PATTERNS = (
    r"\b(dose|dosage|side effect|symptom|diagnos\w*|pregnan\w*|allerg\w*|treat\w*|"
    r"should i take|can i take|what (?:medicine|medication)|(?:medicine|medication) for|"
    r"antibiotic|prescription|pain|fever|sick|illness|poison\w*)\b",
    r"\b(posologie|dose|effet secondaire|sympt[oô]me|diagnostic|grossesse|enceinte|"
    r"allergie|traitement|antibiotique|ordonnance|douleur|fi[eè]vre|malade)\b",
    r"\b(ingaruka|ibimenyetso|gusuzuma indwara|gutwita|allergie|ububabare|umuriro|"
    r"indwara|uburozi|dose y'umuti|umuti wa)\b",
)

OUT_OF_SCOPE_REPLIES = {
    "en": (
        "I can help with Pharmacy Desk accounts, orders, pickup requests, and app features. "
        "For other Pharmacy Desk questions, call +250 790 222 835 or email "
        "pharmacydesk@gmail.com."
    ),
    "rw": (
        "Nshobora kugufasha gukoresha konti, ibyo wasabye n'izindi serivisi za Pharmacy Desk. "
        "Ku bindi bibazo, hamagara +250 790 222 835 cyangwa wandikire "
        "pharmacydesk@gmail.com."
    ),
    "fr": (
        "Je peux vous aider avec les comptes, les commandes, les demandes de retrait et "
        "l’application Pharmacy Desk. Pour les autres questions, appelez le +250 790 222 835 "
        "ou écrivez à pharmacydesk@gmail.com."
    ),
}

HEALTH_REPLIES = {
    "en": (
        "I can’t provide medicine or health advice. Please speak with a pharmacist or "
        "healthcare professional. For urgent symptoms, seek emergency medical care."
    ),
    "rw": (
        "Sinatanga inama ku miti cyangwa ku buzima. Vugana n'umufarumasiye cyangwa "
        "undi mukozi w'ubuzima. Niba bikomeye cyangwa byihutirwa, shaka ubutabazi "
        "bwihutirwa."
    ),
    "fr": (
        "Je ne peux pas donner de conseils sur les médicaments ou la santé. Consultez un "
        "pharmacien ou un professionnel de santé. En cas d’urgence, cherchez des soins "
        "médicaux d’urgence."
    ),
}

TOPIC_FACTS = {
    "about_pharmacy_desk": (
        "Pharmacy Desk is a pharmacy operations and customer portal. Pharmacy teams manage "
        "medicine stock and counter sales. Customers can browse listed medicines and prices, "
        "send pickup requests, and follow their request statuses. Pharmacists review pickup "
        "requests. The assistant does not provide medical advice."
    ),
    "create_customer_account": (
        "Customers can create an account from the customer registration page. No staff "
        "access code is needed. Email confirmation depends on the pharmacy's Supabase settings."
    ),
    "sign_in": (
        "Customers sign in from the Pharmacy Desk sign-in page using their account. "
        "For account access problems, contact Pharmacy Desk support."
    ),
    "update_profile": (
        "Customers can open My profile to update their name and phone number. "
        "Changing an email requires confirmation from the new email inbox."
    ),
    "cancel_customer_order": (
        "Customers can open My orders and cancel a pending or approved pickup request. "
        "A pharmacist must review and approve a request before stock is reserved."
    ),
    "track_customer_order": (
        "Customers can open My orders to see their pickup requests and current statuses. "
        "This assistant cannot access an individual customer's orders."
    ),
    "request_pickup": (
        "Customers can browse medicines and submit a pickup request. A request does not "
        "reserve stock. A pharmacist reviews it and approves it before stock is reserved."
    ),
    "browse_medicines": (
        "Open Browse medicines in the customer portal to see the current catalog and listed "
        "prices. This assistant cannot check live stock or recommend medicines."
    ),
    "contact_support": (
        "Pharmacy Desk support is in Kigali, Rwanda. Email pharmacydesk@gmail.com or call "
        "+250 790 222 835."
    ),
}


class AssistantConfigurationError(Exception):
    pass


class AssistantProviderError(Exception):
    pass


def classify_customer_question(message):
    normalized = message.casefold()
    if is_health_question(normalized):
        return None

    for topic, patterns in TOPIC_PATTERNS.items():
        if any(re.search(pattern, normalized) for pattern in patterns):
            return topic
    return None


def is_health_question(message):
    normalized = message.casefold()
    return any(re.search(pattern, normalized) for pattern in HEALTH_QUESTION_PATTERNS)


def out_of_scope_reply(language):
    return OUT_OF_SCOPE_REPLIES[language]


def health_reply(language):
    return HEALTH_REPLIES[language]


def generate_gemini_answer(topic, language):
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise AssistantConfigurationError

    model = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
    if not re.fullmatch(r"[A-Za-z0-9._-]+", model):
        raise AssistantConfigurationError

    language_names = {"en": "English", "rw": "Kinyarwanda", "fr": "French"}
    prompt = (
        "You are Pharmacy Desk's automated software-support assistant, not a pharmacist. "
        "Answer only the supplied Pharmacy Desk help topic using the verified facts below. "
        "Do not give medical, medicine, diagnosis, dosage, or treatment advice. Do not claim "
        "access to a customer's account, orders, live inventory, or private information. "
        "Do not ask for personal, order, payment, or health details. If the facts do not "
        "answer the topic, direct the customer to Pharmacy Desk support. Keep the answer "
        "concise and answer in "
        f"{language_names[language]}.\n\n"
        f"Help topic: {topic}\n"
        f"Verified facts: {TOPIC_FACTS[topic]}"
    )
    body = json.dumps(
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 400},
        }
    ).encode("utf-8")
    request = Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=20) as response:
            result = json.loads(response.read())
    except HTTPError as error:
        logger.warning("Gemini customer assistant returned HTTP %s", error.code)
        raise AssistantProviderError from error
    except (
        URLError,
        TimeoutError,
        OSError,
        UnicodeDecodeError,
        json.JSONDecodeError,
    ) as error:
        logger.warning(
            "Gemini customer assistant request failed: %s",
            type(error).__name__,
        )
        raise AssistantProviderError from error

    try:
        answer = result["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError, AttributeError) as error:
        logger.warning("Gemini customer assistant returned an invalid response")
        raise AssistantProviderError from error

    if not answer:
        logger.warning("Gemini customer assistant returned an empty response")
        raise AssistantProviderError
    return answer[:2000]
