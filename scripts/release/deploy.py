"""Opt-in deployment hook. The protected environment owns the destination."""
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def payload(env):
    url = env.get("DEPLOY_HOOK_URL", "")
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Configure an HTTPS deployment hook in the protected environment")
    digest = env.get("IMAGE_DIGEST", "")
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", digest):
        raise ValueError("Missing immutable image digest")
    return url, json.dumps({"image": f"{env['IMAGE_REPOSITORY']}@{digest}",
                            "version": env["RELEASE_VERSION"]}).encode()


def main():
    try:
        url, body = payload(os.environ)
        request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            if not 200 <= response.status < 300:
                raise ValueError("Deployment hook failed")
    except (ValueError, KeyError, urllib.error.URLError):
        # Hook URLs may contain credentials; never print exception strings or response bodies.
        raise SystemExit("Deployment hook failed; verify protected environment configuration") from None


if __name__ == "__main__":
    main()
