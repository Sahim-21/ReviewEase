import re

_INJECTION = re.compile(
    r"ignore (all |previous |the )?instructions|system prompt|you are now|"
    r"forget the json|reveal the (system )?prompt|as an ai|discount code|"
    r"pretend ratings|marketing bot|pwned|ignore rules",
    re.IGNORECASE,
)


def looks_like_instruction(text: str) -> bool:
    return bool(_INJECTION.search(text or ""))
