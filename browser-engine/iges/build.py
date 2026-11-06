"""Reproduce the optional converter from a pinned public OCCT build image."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
IMAGE = "ghcr.io/taucad/opencascade.js@sha256:deb9be8470038652c060b47f2d2e7e2e46d899bb896ecabb007bf60307ee2d54"
DEST = ROOT / "generated"


def main():
    env = dict(os.environ)
    for key in ("DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"):
        env.pop(key, None)
    with tempfile.TemporaryDirectory(prefix="nilicad-iges-") as directory:
        work = Path(directory)
        for name in ("converter.cpp", "custom-build.yml"):
            shutil.copyfile(ROOT / name, work / name)
        subprocess.run([
            "docker", "--host=unix:///var/run/docker.sock", "run", "--rm",
            "--platform=linux/amd64", "--network=none",
            "--mount", f"type=bind,src={work},dst=/src",
            "--user", f"{os.getuid()}:{os.getgid()}",
            IMAGE, "link", "custom-build.yml",
        ], env=env, check=True)
        DEST.mkdir(parents=True, exist_ok=True)
        manifest = {"image": IMAGE, "files": {}, "source": {}}
        for name in ("converter.cpp", "custom-build.yml"):
            manifest["source"][name] = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
        for name in ("nilicad_iges.js", "nilicad_iges.wasm", "nilicad_iges.d.ts"):
            data = (work / name).read_bytes()
            manifest["files"][name] = {"size": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            (DEST / (name + ".gz")).write_bytes(gzip.compress(data, mtime=0))
        (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
