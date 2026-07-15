#!/usr/bin/env python3
"""Publish Fortemi v2026.7.1 tracker closeout comments.

Defaults to dry-run. Use --post with GITEA_TOKEN or GITEA_ACCESS_TOKEN to
write comments to the Gitea tracker.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


DEFAULT_BACKLOG = Path(".aiwg/handoffs/fortemi-v2026-07-tracker-publication-backlog.md")
DEFAULT_API_URL = "https://git.integrolabs.net/api/v1"
DEFAULT_REPO = "Fortemi/HotM"


@dataclass(frozen=True)
class Comment:
    issue: int
    title: str
    body: str


def parse_comments(backlog: Path) -> list[Comment]:
    text = backlog.read_text(encoding="utf-8")
    pattern = re.compile(r"^### #(?P<issue>\d+) (?P<title>.+)$", re.MULTILINE)
    matches = list(pattern.finditer(text))
    comments: list[Comment] = []

    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if not body:
            raise ValueError(f"issue #{match.group('issue')} has an empty comment body")
        comments.append(
            Comment(
                issue=int(match.group("issue")),
                title=match.group("title").strip(),
                body=body,
            )
        )

    if not comments:
        raise ValueError(f"no issue comment sections found in {backlog}")

    return comments


def post_comment(api_url: str, repo: str, token: str, comment: Comment) -> str:
    owner_repo = repo.strip("/")
    url = f"{api_url.rstrip('/')}/repos/{owner_repo}/issues/{comment.issue}/comments"
    request = urllib.request.Request(
        url,
        data=json.dumps({"body": comment.body}).encode("utf-8"),
        headers={
            "Authorization": f"token {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return str(payload.get("html_url") or payload.get("id") or url)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backlog", type=Path, default=DEFAULT_BACKLOG)
    parser.add_argument("--api-url", default=os.environ.get("GITEA_API_URL", DEFAULT_API_URL))
    parser.add_argument("--repo", default=os.environ.get("GITEA_REPO", DEFAULT_REPO))
    parser.add_argument("--token-env", default=None, help="Specific environment variable containing the Gitea token")
    parser.add_argument("--only", action="append", type=int, help="Only publish this issue number; may be repeated")
    parser.add_argument("--post", action="store_true", help="Actually publish comments; default is dry-run")
    args = parser.parse_args()

    comments = parse_comments(args.backlog)
    if args.only:
        wanted = set(args.only)
        comments = [comment for comment in comments if comment.issue in wanted]
        missing = wanted - {comment.issue for comment in comments}
        if missing:
            raise SystemExit(f"requested issues not found in backlog: {sorted(missing)}")

    token_name = args.token_env
    token = os.environ.get(token_name) if token_name else (
        os.environ.get("GITEA_TOKEN") or os.environ.get("GITEA_ACCESS_TOKEN")
    )

    if not args.post:
        print(f"dry-run: {len(comments)} comments ready for {args.repo}")
        for comment in comments:
            first_line = comment.body.splitlines()[0] if comment.body else ""
            print(f"#{comment.issue}: {comment.title} :: {first_line}")
        return 0

    if not token:
        raise SystemExit("missing Gitea token; set GITEA_TOKEN or GITEA_ACCESS_TOKEN, or pass --token-env")

    for comment in comments:
        try:
            receipt = post_comment(args.api_url, args.repo, token, comment)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            print(f"error: failed to publish #{comment.issue}: HTTP {error.code}: {detail}", file=sys.stderr)
            return 1
        print(f"published #{comment.issue}: {receipt}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
