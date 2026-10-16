"""Exercise the release planner in disposable repositories, never this checkout."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("deploy", HERE / "deploy.py")
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class ReleasePlanTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "scripts/release").mkdir(parents=True)
        shutil.copy(HERE / "plan.mjs", self.root / "scripts/release/plan.mjs")
        self.git("init", "-q")
        self.commit("0.0.1")
        self.before = self.git("rev-parse", "HEAD")

    def git(self, *args):
        # Identity applies only to these disposable test repositories.
        return subprocess.check_output(["git", "-c", "user.name=Test", "-c", "user.email=test@example.invalid", *args], cwd=self.root, stderr=subprocess.PIPE, text=True).strip()

    def commit(self, version):
        (self.root / "package.json").write_text(json.dumps({"version": version, "private": True}))
        self.git("add", ".")
        self.git("commit", "-qm", f"Version {version}")

    def plan(self, event_name="push", event=None, succeeds=True):
        event_file = self.root / "event.json"
        output = self.root / "output"
        event_file.write_text(json.dumps(event or {"before": self.before}))
        output.write_text("")
        result = subprocess.run(["node", "scripts/release/plan.mjs"], cwd=self.root, env={**os.environ, "GITHUB_EVENT_NAME": event_name, "GITHUB_EVENT_PATH": str(event_file), "GITHUB_OUTPUT": str(output)}, capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, succeeds, result.stderr)
        return dict(line.split("=", 1) for line in output.read_text().splitlines())

    def test_pr_never_releases(self):
        self.commit("0.0.2")
        self.assertEqual(self.plan("pull_request")["release"], "false")

    def test_unchanged_version_does_not_release(self):
        self.assertEqual(self.plan()["release"], "false")

    def test_version_bump_releases_exact_commit(self):
        self.commit("0.0.2")
        plan = self.plan()
        self.assertEqual(plan["release"], "true")
        self.assertEqual(plan["version"], "0.0.2")
        self.assertEqual(plan["commit"], self.git("rev-parse", "HEAD"))

    def test_decreasing_version_rejected(self):
        self.commit("0.0.0")
        self.plan(succeeds=False)

    def test_invalid_version_rejected(self):
        for version in ["0.0.2-rc.1", "1.02.3", "not-semver"]:
            self.commit(version)
            self.plan(succeeds=False)

    def test_existing_tag_cannot_move(self):
        self.git("tag", "v0.0.2")
        self.commit("0.0.2")
        self.plan(succeeds=False)

    def test_dispatch_requires_existing_matching_tag(self):
        event = {"inputs": {"release_ref": "v0.0.1"}}
        self.plan("workflow_dispatch", event, succeeds=False)
        self.git("tag", "v0.0.1")
        self.assertEqual(self.plan("workflow_dispatch", event)["release"], "true")
        self.plan("workflow_dispatch", {"inputs": {"release_ref": "main"}}, succeeds=False)

    def test_first_push_does_not_invent_release(self):
        self.assertEqual(self.plan(event={"before": "0" * 40})["release"], "false")


class DeployTest(unittest.TestCase):
    def env(self, url="https://deploy.example.invalid/hook"):
        return {"DEPLOY_HOOK_URL": url, "IMAGE_REPOSITORY": "ghcr.io/maxffarrell/base", "IMAGE_DIGEST": "sha256:" + "a" * 64, "RELEASE_VERSION": "0.0.2"}

    def test_payload_uses_immutable_digest(self):
        _, body = deploy.payload(self.env())
        self.assertEqual(json.loads(body)["image"], "ghcr.io/maxffarrell/base@sha256:" + "a" * 64)

    def test_hook_and_digest_validation(self):
        for url in ["", "http://example.invalid", "https://test_not_real@example.invalid"]:
            with self.assertRaises(ValueError):
                deploy.payload(self.env(url))
        with self.assertRaises(ValueError):
            deploy.payload({**self.env(), "IMAGE_DIGEST": "latest"})

    def test_redirect_not_followed(self):
        self.assertIsNone(deploy.NoRedirect().redirect_request(None, None, 302, "Found", {}, "https://example.invalid"))


class WorkspaceVersionTest(unittest.TestCase):
    def test_real_version_command_preserves_sdk(self):
        source = HERE.parent.parent
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for filename in ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc", "CHANGELOG.md"]:
                shutil.copy(source / filename, root / filename)
            for directory in ["packages", ".changeset"]:
                shutil.copytree(source / directory, root / directory, ignore=shutil.ignore_patterns("node_modules", "__pycache__"))
            for pending in (root / ".changeset").glob("*.md"):
                if pending.name != "README.md":
                    pending.unlink()
            shutil.copytree(source / "scripts/release", root / "scripts/release", ignore=shutil.ignore_patterns("__pycache__"))
            sdk_path = Path("packages/integration-sdk/package.json")
            sdk_before = (root / sdk_path).read_bytes()
            version_before = json.loads((root / "package.json").read_text())["version"]
            # Always leave a pending root patch, including after the current changeset is consumed.
            (root / ".changeset/test-version.md").write_text('---\n"base": patch\n---\n\nTest-only patch.\n')
            result = subprocess.run(["pnpm", "release:version"], cwd=root, capture_output=True, text=True, timeout=180)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            after = json.loads((root / "package.json").read_text())
            major, minor, patch = map(int, version_before.split("."))
            self.assertEqual(after["version"], f"{major}.{minor}.{patch + 1}")
            self.assertEqual(after["dependencies"]["@base/integration-sdk"], "workspace:*")
            self.assertEqual((root / sdk_path).read_bytes(), sdk_before)
            self.assertIn(after["version"], (root / "CHANGELOG.md").read_text())
            frozen = subprocess.run(["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"], cwd=root, capture_output=True, text=True, timeout=180)
            self.assertEqual(frozen.returncode, 0, frozen.stdout + frozen.stderr)


if __name__ == "__main__":
    unittest.main()
