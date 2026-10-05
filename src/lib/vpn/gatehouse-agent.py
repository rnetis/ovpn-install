#!/usr/bin/env python3
"""Gatehouse agent — per-client expiry, data quota, and concurrent caps.

Companion to https://github.com/angristan/openvpn-install
This does not replace that script. Certificates are still issued with:

    ./openvpn-install.sh client add <name>
    ./openvpn-install.sh client revoke <name>
    ./openvpn-install.sh client renew <name> --cert-days 365

What this enforces (from /etc/gatehouse/clients.json, exported by the panel)
--------------------------------------------------------------------
* Date expiry     policy expiresAt or certExpiresAt, whichever is sooner.
                  Writes `disable` into the client CCD file and kills sessions.
                  The certificate is left in place until you revoke it.
* Data quota      Lifetime upload+download, measured as deltas of the OpenVPN
                  status file. On cap, same CCD disable + kill.
                  quotaCycle "monthly" resets the counter every 30 days.
* Concurrent cap  Requires `duplicate-cn` in server.conf. Without it OpenVPN
                  itself allows only one session (a new login kicks the old).
                  With it, this agent kills extras by real address:port.
                  concurrentPolicy: keep-newest (default) or keep-oldest.

Layout from angristan/openvpn-install (OpenVPN 2.x, systemd):
    /etc/openvpn/server/server.conf
    /etc/openvpn/server/ccd/<common-name>
    /var/log/openvpn/status.log
    /var/run/openvpn-server/server.sock
    /root/<name>.ovpn

Usage
    sudo python3 gatehouse-agent.py --once
    sudo python3 gatehouse-agent.py --once --dry-run
    sudo python3 gatehouse-agent.py --watch 60

systemd
    cp gatehouse-agent.py /usr/local/sbin/gatehouse-agent.py
    cp clients.json /etc/gatehouse/clients.json
    # gatehouse-agent.service + gatehouse-agent.timer, then:
    systemctl enable --now gatehouse-agent.timer
"""

from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import json
import os
import re
import socket
import sys
import time
from pathlib import Path

MONTH_MS = 30 * 24 * 60 * 60 * 1000
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
MARKER = "# gatehouse:managed"
LOG_PATH = Path("/var/log/gatehouse-agent.log")


def log(message: str) -> None:
    line = f"{dt.datetime.now().isoformat(timespec='seconds')} {message}"
    print(line, flush=True)
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass


def now_ms() -> int:
    return int(time.time() * 1000)


class LiveSession:
    def __init__(self, cn: str, real: str, bytes_in: int, bytes_out: int, since: str) -> None:
        self.cn = cn
        self.real = real
        self.bytes_in = bytes_in
        self.bytes_out = bytes_out
        self.since = since

    @property
    def total(self) -> int:
        return self.bytes_in + self.bytes_out

    @property
    def key(self) -> str:
        return f"{self.real}|{self.since}"


def parse_status(text: str) -> list[LiveSession]:
    sessions: list[LiveSession] = []
    mode: str | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("CLIENT_LIST\t"):
            cols = line.split("\t")
            _take_client(sessions, cols, indexed=True)
            continue
        if line.startswith("CLIENT_LIST,"):
            cols = line.split(",", 8)
            _take_client(sessions, cols, indexed=True)
            continue
        if line.startswith("OpenVPN CLIENT LIST"):
            mode = "v1"
            continue
        if mode == "v1" and (
            line.startswith("ROUTING TABLE") or line.startswith("GLOBAL") or line == "END"
        ):
            mode = None
            continue
        if mode != "v1":
            continue
        if line.startswith("Updated,") or line.startswith("Common Name,"):
            continue
        cols = line.split(",", 4)
        if len(cols) < 5:
            continue
        cn, real, bin_, bout, since = cols
        if cn in ("UNDEF", "Common Name"):
            continue
        try:
            sessions.append(LiveSession(cn, real, int(bin_), int(bout), since.strip()))
        except ValueError:
            continue
    return sessions


def _take_client(sessions: list[LiveSession], cols: list[str], indexed: bool) -> None:
    # CLIENT_LIST, cn, real, virt, virt6, bytes_in, bytes_out, since, ...
    if len(cols) < 8:
        return
    cn = cols[1]
    if cn in ("UNDEF", "Common Name"):
        return
    try:
        sessions.append(LiveSession(cn, cols[2], int(cols[5]), int(cols[6]), cols[7].strip()))
    except ValueError:
        return


def parse_since(value: str) -> float:
    value = value.strip()
    try:
        return float(value)
    except ValueError:
        pass
    for fmt in ("%a %b %d %H:%M:%S %Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return dt.datetime.strptime(value, fmt).timestamp()
        except ValueError:
            continue
    return 0.0


def conf_has_duplicate_cn(path: Path) -> bool:
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return False
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped[0] in "#;":
            continue
        if stripped.split()[0] == "duplicate-cn":
            return True
    return False


def mgmt_kill(sock_path: Path, targets: list[str], dry_run: bool) -> None:
    if not targets:
        return
    if dry_run:
        for target in targets:
            log(f"DRY-RUN kill {target}")
        return
    if not sock_path.exists():
        log(f"management socket missing at {sock_path} — CCD disable still blocks the next login")
        return
    try:
        conn = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        conn.settimeout(4)
        conn.connect(str(sock_path))
        _read_some(conn)
        for target in targets:
            conn.sendall(f"kill {target}\n".encode())
            reply = _read_some(conn)
            if "ERROR" in reply.upper():
                log(f"management kill {target} rejected: {reply.strip()}")
            else:
                log(f"killed {target}")
        conn.sendall(b"quit\n")
        conn.close()
    except OSError as exc:
        log(f"management socket error: {exc}")


def _read_some(conn: socket.socket) -> str:
    conn.settimeout(1.2)
    chunks: list[bytes] = []
    try:
        while True:
            data = conn.recv(4096)
            if not data:
                break
            chunks.append(data)
            if len(data) < 4096:
                break
    except socket.timeout:
        pass
    return b"".join(chunks).decode("utf-8", "replace")


def update_ccd(path: Path, disable: bool, static_ip: str, netmask: str, dry_run: bool) -> None:
    original = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    managed = any(line.strip() == MARKER for line in original)
    if not disable and not static_ip and not managed:
        return
    preserved: list[str] = []
    for line in original:
        stripped = line.strip()
        if stripped == MARKER or stripped == "disable" or stripped.startswith("ifconfig-push "):
            continue
        if stripped == "":
            continue
        preserved.append(line.rstrip())
    new_lines: list[str] = []
    if disable or static_ip or preserved:
        new_lines.append(MARKER)
        if disable:
            new_lines.append("disable")
        if static_ip:
            new_lines.append(f"ifconfig-push {static_ip} {netmask}")
        new_lines.extend(preserved)
    new = ("\n".join(new_lines) + "\n") if new_lines else ""
    old = ("\n".join(original) + "\n") if original else ""
    if new == old:
        return
    action = "remove" if not new else "write"
    log(f"{'DRY-RUN ' if dry_run else ''}{action} {path}")
    if dry_run:
        return
    if not new:
        path.unlink(missing_ok=True)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(new, encoding="utf-8")
    os.chmod(tmp, 0o644)
    tmp.replace(path)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: dict, dry_run: bool) -> None:
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def run_once(args: argparse.Namespace) -> int:
    config_path = Path(args.config)
    state_path = Path(args.state)
    status_path = Path(args.status)
    ccd_dir = Path(args.ccd)
    if not config_path.is_file():
        log(f"missing policy file {config_path}")
        return 2
    try:
        policy = load_json(config_path)
    except (OSError, json.JSONDecodeError) as exc:
        log(f"policy unreadable: {exc}")
        return 2
    if policy.get("version") != 1 or not isinstance(policy.get("clients"), list):
        log("policy version must be 1 with a clients array")
        return 2

    server = policy.get("server") if isinstance(policy.get("server"), dict) else {}
    netmask = str(server.get("netmask") or "255.255.255.0")
    policy_name = str(server.get("concurrentPolicy") or "keep-newest")
    keep_newest = policy_name != "keep-oldest"
    duplicate = conf_has_duplicate_cn(Path(args.server_conf))

    try:
        status_text = status_path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        log(f"status log unreadable ({status_path}): {exc}")
        return 1
    live = parse_status(status_text)
    by_cn: dict[str, list[LiveSession]] = {}
    for sess in live:
        by_cn.setdefault(sess.cn, []).append(sess)

    state = {"users": {}}
    if state_path.is_file():
        try:
            loaded = load_json(state_path)
            if isinstance(loaded.get("users"), dict):
                state = loaded
        except (OSError, json.JSONDecodeError):
            log("state file corrupt — starting counters from zero")
    users_state: dict = state.setdefault("users", {})

    clock = now_ms()
    kills: list[str] = []

    for client in policy["clients"]:
        if not isinstance(client, dict):
            continue
        name = str(client.get("name") or "")
        if not NAME_RE.fullmatch(name):
            log(f"skip illegal common name {name!r}")
            continue
        entry = users_state.setdefault(name, {"used": 0, "sessions": {}, "hold": None})
        sessions_mem = entry.setdefault("sessions", {})
        used = int(entry.get("used") or 0)

        quota = client.get("quotaBytes")
        quota = int(quota) if isinstance(quota, (int, float)) and quota is not None else None
        cycle = client.get("quotaCycle") or "none"
        if cycle == "monthly" and quota is not None:
            anchor = int(entry.get("cycleAnchor") or client.get("quotaAnchor") or clock)
            hops = 0
            while clock >= anchor + MONTH_MS and hops < 36:
                anchor += MONTH_MS
                hops += 1
            if hops:
                used = 0
                log(f"{name}: monthly quota reset")
                if entry.get("hold") == "quota":
                    entry["hold"] = None
            entry["cycleAnchor"] = anchor

        seen: set[str] = set()
        for sess in by_cn.get(name, []):
            seen.add(sess.key)
            previous = sessions_mem.get(sess.key)
            if previous is None:
                delta = sess.total
            else:
                prev_total = int(previous)
                delta = sess.total - prev_total if sess.total >= prev_total else sess.total
            used += max(0, delta)
            sessions_mem[sess.key] = sess.total
        for key in list(sessions_mem):
            if key not in seen:
                sessions_mem.pop(key, None)
        entry["used"] = used

        expires = client.get("expiresAt")
        cert_expires = client.get("certExpiresAt")
        times = [int(v) for v in (expires, cert_expires) if isinstance(v, (int, float))]
        expired = any(clock >= t for t in times)
        revoked = bool(client.get("revoked"))
        over = quota is not None and used >= quota
        if revoked:
            hold = "revoked"
        elif expired:
            hold = "expired"
        elif over:
            hold = "quota"
        else:
            hold = None

        prev_hold = entry.get("hold")
        if hold != prev_hold:
            if hold:
                log(f"{name}: blocked ({hold}), used={used}")
            else:
                log(f"{name}: hold cleared (was {prev_hold}), used={used}")
        entry["hold"] = hold

        static_ip = str(client.get("staticIp") or "").strip()
        update_ccd(ccd_dir / name, disable=hold is not None, static_ip=static_ip, netmask=netmask, dry_run=args.dry_run)

        connected = by_cn.get(name, [])
        if hold:
            kills.extend(sess.real for sess in connected)
            continue

        try:
            cap = int(client.get("maxConcurrent") or 1)
        except (TypeError, ValueError):
            cap = 1
        cap = max(1, cap)
        if not duplicate:
            if cap > 1:
                log(f"{name}: policy allows {cap} sessions but {args.server_conf} has no duplicate-cn — cap stays 1")
            cap = 1
        if len(connected) <= cap:
            continue
        ordered = sorted(connected, key=lambda s: parse_since(s.since), reverse=keep_newest)
        extras = ordered[cap:]
        for sess in extras:
            log(f"{name}: over concurrent cap {cap}, dropping {sess.real}")
            kills.append(sess.real)

    save_json(state_path, state, args.dry_run)
    # De-duplicate kill targets while keeping order.
    unique: list[str] = []
    seen_kills: set[str] = set()
    for target in kills:
        if target in seen_kills:
            continue
        seen_kills.add(target)
        unique.append(target)
    mgmt_kill(Path(args.socket), unique, args.dry_run)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Enforce Gatehouse limits on an angristan OpenVPN server")
    parser.add_argument("--config", default="/etc/gatehouse/clients.json")
    parser.add_argument("--state", default="/var/lib/gatehouse/state.json")
    parser.add_argument("--status", default="/var/log/openvpn/status.log")
    parser.add_argument("--ccd", default="/etc/openvpn/server/ccd")
    parser.add_argument("--socket", default="/var/run/openvpn-server/server.sock")
    parser.add_argument("--server-conf", default="/etc/openvpn/server/server.conf")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--watch", type=int, default=0, metavar="SECONDS")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.watch < 0:
        parser.error("--watch must be >= 0")
    if not args.once and args.watch <= 0:
        args.once = True

    lock_path = Path(args.state).with_suffix(".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock = lock_path.open("a", encoding="utf-8")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        log("another gatehouse-agent run is in progress")
        return 0

    if args.watch > 0:
        while True:
            code = run_once(args)
            if code != 0 and args.once:
                return code
            time.sleep(args.watch)
    return run_once(args)


if __name__ == "__main__":
    sys.exit(main())
