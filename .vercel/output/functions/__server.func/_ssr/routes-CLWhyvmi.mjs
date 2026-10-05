import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { D as Slot, N as require_jsx_runtime, a as Overlay2, c as Title2, d as DialogContent, f as DialogDescription, h as DialogTitle, i as Description2, l as Dialog, m as DialogPortal, n as Cancel, o as Portal2, p as DialogOverlay, r as Content2, s as Root2, t as Action, u as DialogClose } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { a as Search, c as Activity, i as Shield, n as Users, o as FileText, s as Ellipsis, t as X } from "../_libs/lucide-react.mjs";
import { a as number, i as literal, n as array, o as object, r as boolean, s as string, t as _enum } from "../_libs/zod.mjs";
import { n as formatDistance, r as format, t as formatDistanceToNowStrict } from "../_libs/date-fns.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { a as Trigger, i as Root2$1, n as Item2, r as Portal2$1, t as Content2$1 } from "../_libs/@radix-ui/react-dropdown-menu+[...].mjs";
import { n as SwitchThumb, t as Switch } from "../_libs/radix-ui__react-switch.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { i as Tooltip, n as Area, r as ResponsiveContainer, t as AreaChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CLWhyvmi.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MONTH_MS = 2592e6;
var NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
var seq = 0;
function makeEvent(now, userName, kind, detail) {
	seq += 1;
	return {
		id: `e-${now}-${seq}`,
		at: now,
		userName,
		kind,
		detail
	};
}
function blockingExpiry(user) {
	return Math.min(user.expiresAt ?? Number.POSITIVE_INFINITY, user.certExpiresAt);
}
function accessOf(user, now) {
	if (user.revoked) return "revoked";
	const exp = blockingExpiry(user);
	if (exp !== Number.POSITIVE_INFINITY && exp <= now) return "expired";
	if (user.quotaBytes != null && user.usedBytes >= user.quotaBytes) return "quota";
	return "active";
}
function effectiveCap(user, server) {
	if (!server.duplicateCn) return 1;
	return Math.max(1, user.maxConcurrent);
}
function ipInVpnSubnet(ip) {
	const match = /^10\.8\.0\.(\d{1,3})$/.exec(ip.trim());
	if (!match) return false;
	const n = Number(match[1]);
	return n >= 2 && n <= 254;
}
var REAL_POOL = [
	"203.0.113.14",
	"203.0.113.22",
	"203.0.113.48",
	"198.51.100.10",
	"198.51.100.23",
	"198.51.100.77",
	"192.0.2.15",
	"192.0.2.44",
	"192.0.2.90"
];
function nextVirtualIp(sessions) {
	const used = new Set(sessions.map((s) => s.virtualAddress));
	for (let n = 2; n <= 254; n += 1) {
		const ip = `10.8.0.${n}`;
		if (!used.has(ip)) return ip;
	}
	return "10.8.0.254";
}
function newSession(userId, now, sessions, rates) {
	const host = REAL_POOL[Math.floor(Math.random() * REAL_POOL.length)];
	const port = 2e4 + Math.floor(Math.random() * 4e4);
	const rateOut = rates?.rateOut ?? (40 + Math.floor(Math.random() * 180)) * 1024;
	const rateIn = rates?.rateIn ?? (4 + Math.floor(Math.random() * 36)) * 1024;
	return {
		id: `s-${now}-${seq + 1}-${port}`,
		userId,
		realAddress: `${host}:${port}`,
		virtualAddress: nextVirtualIp(sessions),
		connectedAt: now,
		bytesIn: 0,
		bytesOut: 0,
		rateIn,
		rateOut
	};
}
function pushFresh(existing, fresh) {
	return fresh.slice().reverse().concat(existing).slice(0, 80);
}
function step(state, now, opts) {
	const users = state.users.map((u) => ({ ...u }));
	let sessions = state.sessions.map((s) => ({ ...s }));
	const fresh = [];
	const byId = new Map(users.map((u) => [u.id, u]));
	let bps = 0;
	if (opts.accrue) for (const s of sessions) {
		const user = byId.get(s.userId);
		if (!user) continue;
		s.bytesIn += s.rateIn;
		s.bytesOut += s.rateOut;
		user.usedBytes += s.rateIn + s.rateOut;
		bps += s.rateIn + s.rateOut;
	}
	for (const user of users) {
		if (user.quotaCycle !== "monthly" || user.quotaBytes == null) continue;
		let hops = 0;
		while (now >= user.quotaAnchor + 2592e6 && hops < 36) {
			user.quotaAnchor += MONTH_MS;
			hops += 1;
		}
		if (hops > 0) {
			user.usedBytes = 0;
			if (user.hold === "quota") user.hold = null;
			fresh.push(makeEvent(now, user.name, "quota-reset", "Monthly data cycle reset. Usage counter cleared."));
		}
	}
	const blocked = /* @__PURE__ */ new Set();
	for (const user of users) {
		const access = accessOf(user, now);
		if (access === "active") {
			if (user.hold) {
				const prev = user.hold;
				user.hold = null;
				fresh.push(makeEvent(now, user.name, "enable", `Cleared ${prev} hold. CCD disable would be removed; the client may connect again.`));
			}
			continue;
		}
		blocked.add(user.id);
		const had = sessions.some((s) => s.userId === user.id);
		sessions = sessions.filter((s) => s.userId !== user.id);
		if (user.hold !== access) {
			user.hold = access;
			fresh.push(makeEvent(now, user.name, blockKind(access), blockDetail(access, had)));
		}
	}
	for (const user of users) {
		if (blocked.has(user.id)) continue;
		const cap = effectiveCap(user, state.server);
		const mine = sessions.filter((s) => s.userId === user.id);
		if (mine.length <= cap) continue;
		const oldestFirst = mine.slice().sort((a, b) => a.connectedAt - b.connectedAt);
		const drop = state.server.concurrentPolicy === "keep-oldest" ? oldestFirst.slice(cap) : oldestFirst.slice(0, mine.length - cap);
		const dropIds = new Set(drop.map((s) => s.id));
		sessions = sessions.filter((s) => !dropIds.has(s.id));
		const native = !state.server.duplicateCn && user.maxConcurrent > 1;
		fresh.push(makeEvent(now, user.name, "kill-concurrent", native ? `Disconnected ${drop.length} extra session${drop.length === 1 ? "" : "s"}. Without duplicate-cn the hard cap is 1 (policy allows ${user.maxConcurrent}).` : `Disconnected ${drop.length} extra session${drop.length === 1 ? "" : "s"} (cap ${cap}, ${state.server.concurrentPolicy === "keep-newest" ? "keep newest" : "keep oldest"}).`));
	}
	const known = new Set(users.map((u) => u.id));
	sessions = sessions.filter((s) => known.has(s.userId));
	return {
		...state,
		users,
		sessions,
		events: pushFresh(state.events, fresh),
		samples: opts.sample ? state.samples.concat({
			t: now,
			bps
		}).slice(-48) : state.samples,
		now
	};
}
function blockKind(access) {
	if (access === "quota") return "block-quota";
	if (access === "revoked") return "block-revoked";
	return "block-expiry";
}
function blockDetail(access, hadSessions) {
	const killed = hadSessions ? " Live sessions killed via the management socket." : "";
	if (access === "quota") return `Data cap reached. Agent writes "disable" to the client CCD file.${killed}`;
	if (access === "revoked") return `Certificate revoked. Run openvpn-install.sh client revoke so the CRL matches.${killed}`;
	return `Date reached (policy or certificate, whichever is sooner). Agent writes "disable" to CCD.${killed}`;
}
function applyConnect(state, userId, now) {
	const user = state.users.find((u) => u.id === userId);
	if (!user) return {
		state,
		message: "Unknown client.",
		ok: false
	};
	const access = accessOf(user, now);
	if (access !== "active") {
		const message = access === "quota" ? `${user.name} is over the data cap.` : access === "expired" ? `${user.name} is past the expiry date.` : `${user.name} is revoked.`;
		return {
			ok: false,
			message,
			state: {
				...state,
				now,
				events: pushFresh(state.events, [makeEvent(now, user.name, "refused", message)])
			}
		};
	}
	let sessions = state.sessions.slice();
	const fresh = [];
	const mine = sessions.filter((s) => s.userId === userId);
	if (!state.server.duplicateCn) {
		if (mine.length >= 1) {
			sessions = sessions.filter((s) => s.userId !== userId);
			fresh.push(makeEvent(now, user.name, "kill-concurrent", user.maxConcurrent > 1 ? "New login replaced the existing one. OpenVPN without duplicate-cn allows only one session, so a cap above 1 cannot be honored." : "New login replaced the previous session (OpenVPN default when duplicate-cn is off)."));
		}
	} else if (mine.length >= user.maxConcurrent) {
		if (state.server.concurrentPolicy === "keep-oldest") {
			const message = `${user.name} is at the concurrent cap (${user.maxConcurrent}). Oldest sessions are kept, so this login was refused.`;
			return {
				ok: false,
				message,
				state: {
					...state,
					now,
					events: pushFresh(state.events, [makeEvent(now, user.name, "refused", message)])
				}
			};
		}
		const oldest = mine.slice().sort((a, b) => a.connectedAt - b.connectedAt)[0];
		if (oldest) {
			sessions = sessions.filter((s) => s.id !== oldest.id);
			fresh.push(makeEvent(now, user.name, "kill-concurrent", `Cap is ${user.maxConcurrent}. Dropped the oldest session so this login can stay (keep newest).`));
		}
	}
	const session = newSession(userId, now, sessions);
	sessions = sessions.concat(session);
	fresh.push(makeEvent(now, user.name, "connect", `Session from ${session.realAddress} on ${session.virtualAddress}.`));
	return {
		ok: true,
		message: `${user.name} connected from ${session.realAddress}.`,
		state: {
			...state,
			sessions,
			events: pushFresh(state.events, fresh),
			now
		}
	};
}
var KB = 1024;
var MB = 1024 * KB;
var GB$1 = 1024 * MB;
var TB = 1024 * GB$1;
function formatBytes(n) {
	const v = Math.max(0, n);
	if (v < KB) return `${Math.round(v)} B`;
	const units = [
		{
			s: KB,
			l: "KB"
		},
		{
			s: MB,
			l: "MB"
		},
		{
			s: GB$1,
			l: "GB"
		},
		{
			s: TB,
			l: "TB"
		}
	];
	let pick = units[0];
	for (const u of units) if (v >= u.s) pick = u;
	const num = v / pick.s;
	const digits = num >= 100 ? 0 : num >= 10 ? 1 : 2;
	return `${num.toFixed(digits)} ${pick.l}`;
}
function formatDay(ms) {
	return format(ms, "d MMM yyyy");
}
function expiryPhrase(user, now) {
	const t = blockingExpiry(user);
	if (t == null) return "No expiry";
	const kind = expiryKind(user);
	const tail = kind ? ` · ${kind}` : "";
	if (t <= now) return `Expired ${formatDistanceToNowStrict(t, { addSuffix: true })}${tail}`;
	return `Expires ${formatDistanceToNowStrict(t, { addSuffix: true })}${tail}`;
}
function expiryKind(user) {
	if (blockingExpiry(user) == null) return null;
	if (user.expiresAt != null && user.expiresAt <= user.certExpiresAt) return "policy";
	return "certificate";
}
function formatRemain(sec) {
	const s = Math.max(0, Math.ceil(sec));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const r = s % 60;
	if (m < 60) return `${m}m ${String(r).padStart(2, "0")}s`;
	return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function toDateInput(ms) {
	if (ms == null) return "";
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** End of the chosen local day, so the date itself still allows access. */
function fromDateInput(value) {
	if (!value) return null;
	const [y, m, d] = value.split("-").map(Number);
	if (!y || !m || !d) return null;
	return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}
function bytesToGbInput(bytes) {
	const gb = bytes / GB$1;
	const digits = gb >= 10 ? 1 : 2;
	return String(Number(gb.toFixed(digits)));
}
var GB_BYTES = GB$1;
var MB_BYTES = MB;
var DAY = 864e5;
var GB = 1024 * MB_BYTES;
var DEFAULT_SERVER = {
	hostname: "edge-ams-01",
	publicIp: "203.0.113.40",
	port: 1194,
	protocol: "udp",
	subnet: "10.8.0.0/24",
	netmask: "255.255.255.0",
	dns: "Cloudflare",
	cipher: "AES-128-GCM",
	authMode: "pki",
	duplicateCn: true,
	concurrentPolicy: "keep-newest",
	tlsCrypt: true
};
var HOST_PATHS = {
	status: "/var/log/openvpn/status.log",
	socket: "/var/run/openvpn-server/server.sock",
	ccd: "/etc/openvpn/server/ccd",
	conf: "/etc/openvpn/server/server.conf",
	install: "/root/openvpn-install.sh",
	policy: "/etc/gatehouse/clients.json",
	state: "/var/lib/gatehouse/state.json",
	agent: "/usr/local/sbin/gatehouse-agent.py",
	unit: "openvpn-server@server"
};
function user(partial) {
	return partial;
}
var INITIAL_SNAP = createSeed(Date.UTC(2026, 9, 5, 10, 0, 0));
function createSeed(now) {
	const users = [
		user({
			id: "alice",
			name: "alice",
			createdAt: now - 180 * DAY,
			expiresAt: now + 200 * DAY,
			certExpiresAt: now + 3400 * DAY,
			quotaBytes: 50 * GB,
			quotaCycle: "monthly",
			quotaAnchor: now - 10 * DAY,
			usedBytes: 18.4 * GB,
			maxConcurrent: 2,
			revoked: false,
			hold: null,
			note: "Staff laptop and phone",
			staticIp: "",
			passwordProtected: false
		}),
		user({
			id: "bob.field",
			name: "bob.field",
			createdAt: now - 20 * DAY,
			expiresAt: now + 4 * DAY,
			certExpiresAt: now + 800 * DAY,
			quotaBytes: 10 * GB,
			quotaCycle: "none",
			quotaAnchor: now - 20 * DAY,
			usedBytes: 9.15 * GB,
			maxConcurrent: 1,
			revoked: false,
			hold: null,
			note: "Contractor, site survey",
			staticIp: "",
			passwordProtected: true
		}),
		user({
			id: "pilot-phone",
			name: "pilot-phone",
			createdAt: now - 2 * DAY,
			expiresAt: now + 30 * DAY,
			certExpiresAt: now + 365 * DAY,
			quotaBytes: 64 * MB_BYTES,
			quotaCycle: "none",
			quotaAnchor: now - 2 * DAY,
			usedBytes: 60 * MB_BYTES,
			maxConcurrent: 1,
			revoked: false,
			hold: null,
			note: "Trial handset — data cap demo",
			staticIp: "",
			passwordProtected: false
		}),
		user({
			id: "week-pass",
			name: "week-pass",
			createdAt: now - 6 * DAY,
			expiresAt: now + 45e3,
			certExpiresAt: now + 365 * DAY,
			quotaBytes: null,
			quotaCycle: "none",
			quotaAnchor: now,
			usedBytes: 1.2 * GB,
			maxConcurrent: 1,
			revoked: false,
			hold: null,
			note: "Short pass — date expiry demo",
			staticIp: "",
			passwordProtected: false
		}),
		user({
			id: "noc-jump",
			name: "noc-jump",
			createdAt: now - 400 * DAY,
			expiresAt: null,
			certExpiresAt: now + 2e3 * DAY,
			quotaBytes: null,
			quotaCycle: "none",
			quotaAnchor: now,
			usedBytes: 220 * GB,
			maxConcurrent: 3,
			revoked: false,
			hold: null,
			note: "Operations jump host",
			staticIp: "",
			passwordProtected: true
		}),
		user({
			id: "kiosk-lobby",
			name: "kiosk-lobby",
			createdAt: now - 60 * DAY,
			expiresAt: now + 120 * DAY,
			certExpiresAt: now + 700 * DAY,
			quotaBytes: 5 * GB,
			quotaCycle: "none",
			quotaAnchor: now - 60 * DAY,
			usedBytes: 5 * GB,
			maxConcurrent: 1,
			revoked: false,
			hold: "quota",
			note: "Lobby kiosk, prepaid 5 GB",
			staticIp: "10.8.0.50",
			passwordProtected: false
		}),
		user({
			id: "maria.cruz",
			name: "maria.cruz",
			createdAt: now - 90 * DAY,
			expiresAt: now + 40 * DAY,
			certExpiresAt: now + 400 * DAY,
			quotaBytes: 20 * GB,
			quotaCycle: "monthly",
			quotaAnchor: now - 5 * DAY,
			usedBytes: 2 * GB,
			maxConcurrent: 1,
			revoked: true,
			hold: "revoked",
			note: "Left the team",
			staticIp: "",
			passwordProtected: false
		}),
		user({
			id: "ci-runner",
			name: "ci-runner",
			createdAt: now - 14 * DAY,
			expiresAt: now + 60 * DAY,
			certExpiresAt: now + 12 * DAY,
			quotaBytes: 2 * GB,
			quotaCycle: "none",
			quotaAnchor: now - 14 * DAY,
			usedBytes: .4 * GB,
			maxConcurrent: 1,
			revoked: false,
			hold: null,
			note: "Build agent — certificate is the sooner clock",
			staticIp: "",
			passwordProtected: false
		})
	];
	const sessions = [
		{
			id: "s-alice",
			userId: "alice",
			realAddress: "203.0.113.14:41820",
			virtualAddress: "10.8.0.2",
			connectedAt: now - 72e5,
			bytesIn: 86 * MB_BYTES,
			bytesOut: 1.4 * GB,
			rateIn: 18432,
			rateOut: 163840
		},
		{
			id: "s-bob",
			userId: "bob.field",
			realAddress: "198.51.100.23:33310",
			virtualAddress: "10.8.0.6",
			connectedAt: now - 15e5,
			bytesIn: 40 * MB_BYTES,
			bytesOut: 610 * MB_BYTES,
			rateIn: 22528,
			rateOut: 92160
		},
		{
			id: "s-pilot",
			userId: "pilot-phone",
			realAddress: "192.0.2.44:25110",
			virtualAddress: "10.8.0.14",
			connectedAt: now - 18e4,
			bytesIn: 2 * MB_BYTES,
			bytesOut: 8 * MB_BYTES,
			rateIn: 24576,
			rateOut: 204800
		},
		{
			id: "s-week",
			userId: "week-pass",
			realAddress: "203.0.113.48:19002",
			virtualAddress: "10.8.0.21",
			connectedAt: now - 24e5,
			bytesIn: 12 * MB_BYTES,
			bytesOut: 90 * MB_BYTES,
			rateIn: 8192,
			rateOut: 40960
		},
		{
			id: "s-noc-a",
			userId: "noc-jump",
			realAddress: "198.51.100.10:41002",
			virtualAddress: "10.8.0.8",
			connectedAt: now - 18e6,
			bytesIn: 400 * MB_BYTES,
			bytesOut: 380 * MB_BYTES,
			rateIn: 30720,
			rateOut: 28672
		},
		{
			id: "s-noc-b",
			userId: "noc-jump",
			realAddress: "198.51.100.77:41088",
			virtualAddress: "10.8.0.9",
			connectedAt: now - 3e6,
			bytesIn: 20 * MB_BYTES,
			bytesOut: 22 * MB_BYTES,
			rateIn: 12288,
			rateOut: 14336
		}
	];
	const samples = Array.from({ length: 32 }, (_, i) => ({
		t: now - (32 - i) * 1e3,
		bps: Math.round(532480 + 81920 * Math.sin(i / 3))
	}));
	return {
		seeded: true,
		users,
		sessions,
		events: [
			makeEvent(now - 2 * DAY, "kiosk-lobby", "block-quota", "Data cap reached. Agent writes \"disable\" to the client CCD file."),
			makeEvent(now - 1 * DAY, "maria.cruz", "revoke", "Revoked. On the server: /root/openvpn-install.sh client revoke maria.cruz"),
			makeEvent(now - 6 * DAY, "week-pass", "add", "Issued week-pass. Policy expiry is under a minute from this demo clock."),
			makeEvent(now - 2 * DAY, "pilot-phone", "add", "Issued pilot-phone with a 64 MB cap so the quota block is visible.")
		],
		samples,
		server: { ...DEFAULT_SERVER },
		now
	};
}
function replayFixtures(users, sessions, now) {
	const nextUsers = users.map((u) => ({ ...u }));
	const ensure = (id, factory) => {
		const idx = nextUsers.findIndex((u) => u.id === id);
		const built = factory(idx >= 0 ? nextUsers[idx] : void 0);
		if (idx >= 0) nextUsers[idx] = built;
		else nextUsers.push(built);
	};
	ensure("pilot-phone", (current) => ({
		id: "pilot-phone",
		name: "pilot-phone",
		createdAt: current?.createdAt ?? now,
		expiresAt: now + 30 * DAY,
		certExpiresAt: current?.certExpiresAt ?? now + 365 * DAY,
		quotaBytes: 64 * MB_BYTES,
		quotaCycle: "none",
		quotaAnchor: now,
		usedBytes: 60 * MB_BYTES,
		maxConcurrent: 1,
		revoked: false,
		hold: null,
		note: current?.note || "Trial handset — data cap demo",
		staticIp: "",
		passwordProtected: false
	}));
	ensure("week-pass", (current) => ({
		id: "week-pass",
		name: "week-pass",
		createdAt: current?.createdAt ?? now,
		expiresAt: now + 45e3,
		certExpiresAt: current?.certExpiresAt ?? now + 365 * DAY,
		quotaBytes: null,
		quotaCycle: "none",
		quotaAnchor: now,
		usedBytes: current?.usedBytes ?? 0,
		maxConcurrent: current?.maxConcurrent ?? 1,
		revoked: false,
		hold: null,
		note: current?.note || "Short pass — date expiry demo",
		staticIp: "",
		passwordProtected: false
	}));
	const rest = sessions.filter((s) => s.userId !== "pilot-phone" && s.userId !== "week-pass");
	const demoSessions = [{
		id: `s-pilot-${now}`,
		userId: "pilot-phone",
		realAddress: "192.0.2.44:25110",
		virtualAddress: rest.some((s) => s.virtualAddress === "10.8.0.14") ? "10.8.0.61" : "10.8.0.14",
		connectedAt: now,
		bytesIn: 0,
		bytesOut: 0,
		rateIn: 24576,
		rateOut: 204800
	}, {
		id: `s-week-${now}`,
		userId: "week-pass",
		realAddress: "203.0.113.48:19002",
		virtualAddress: rest.some((s) => s.virtualAddress === "10.8.0.21") ? "10.8.0.62" : "10.8.0.21",
		connectedAt: now,
		bytesIn: 0,
		bytesOut: 0,
		rateIn: 8192,
		rateOut: 40960
	}];
	return {
		users: nextUsers,
		sessions: rest.concat(demoSessions)
	};
}
var empty = () => ({
	seeded: false,
	users: [],
	sessions: [],
	events: [],
	samples: [],
	server: { ...DEFAULT_SERVER },
	now: 0
});
function commit(state, next, now) {
	return step(next, now, {
		accrue: false,
		sample: false
	});
}
var useVpn = create()(persist((set) => ({
	...empty(),
	tick: (now) => set((state) => step(state, now, {
		accrue: true,
		sample: true
	})),
	connect: (userId) => {
		let result = {
			ok: false,
			message: "Not connected."
		};
		set((state) => {
			const applied = applyConnect(state, userId, Date.now());
			result = {
				ok: applied.ok,
				message: applied.message
			};
			return applied.state;
		});
		return result;
	},
	killSession: (sessionId) => set((state) => {
		const now = Date.now();
		const session = state.sessions.find((s) => s.id === sessionId);
		if (!session) return state;
		const user = state.users.find((u) => u.id === session.userId);
		return {
			...state,
			now,
			sessions: state.sessions.filter((s) => s.id !== sessionId),
			events: [makeEvent(now, user?.name ?? session.userId, "disconnect", `Killed ${session.realAddress} via management socket.`), ...state.events].slice(0, 80)
		};
	}),
	disconnectUser: (userId) => set((state) => {
		const now = Date.now();
		const user = state.users.find((u) => u.id === userId);
		const n = state.sessions.filter((s) => s.userId === userId).length;
		if (!user || n === 0) return state;
		return {
			...state,
			now,
			sessions: state.sessions.filter((s) => s.userId !== userId),
			events: [makeEvent(now, user.name, "disconnect", `Disconnected ${n} session${n === 1 ? "" : "s"}.`), ...state.events].slice(0, 80)
		};
	}),
	addUser: (input) => set((state) => {
		const now = Date.now();
		const row = {
			id: input.name,
			name: input.name,
			createdAt: now,
			expiresAt: input.expiresAt,
			certExpiresAt: input.certExpiresAt,
			quotaBytes: input.quotaBytes,
			quotaCycle: input.quotaCycle,
			quotaAnchor: now,
			usedBytes: 0,
			maxConcurrent: input.maxConcurrent,
			revoked: false,
			hold: null,
			note: input.note,
			staticIp: input.staticIp,
			passwordProtected: input.passwordProtected
		};
		const event = makeEvent(now, row.name, "add", `Issued ${row.name}. On the server this is openvpn-install.sh client add.`);
		return commit(state, {
			...state,
			users: state.users.concat(row),
			events: [event, ...state.events]
		}, now);
	}),
	updateUser: (id, patch) => set((state) => {
		const now = Date.now();
		const current = state.users.find((u) => u.id === id);
		if (!current) return state;
		const users = state.users.map((u) => u.id === id ? {
			...u,
			...patch
		} : u);
		const event = makeEvent(now, current.name, "update", "Updated expiry, quota, or concurrent cap.");
		return commit(state, {
			...state,
			users,
			events: [event, ...state.events]
		}, now);
	}),
	revokeUser: (id) => set((state) => {
		const now = Date.now();
		const current = state.users.find((u) => u.id === id);
		if (!current || current.revoked) return state;
		const users = state.users.map((u) => u.id === id ? {
			...u,
			revoked: true,
			hold: "revoked"
		} : u);
		const event = makeEvent(now, current.name, "revoke", `Revoked. On the server: ${state.server.hostname} → /root/openvpn-install.sh client revoke ${current.name}`);
		return commit(state, {
			...state,
			users,
			sessions: state.sessions.filter((s) => s.userId !== id),
			events: [event, ...state.events]
		}, now);
	}),
	reissueUser: (id) => set((state) => {
		const now = Date.now();
		const current = state.users.find((u) => u.id === id);
		if (!current) return state;
		const certExpiresAt = now + 31536e6;
		const users = state.users.map((u) => u.id === id ? {
			...u,
			revoked: false,
			hold: null,
			certExpiresAt
		} : u);
		const event = makeEvent(now, current.name, "reissue", `Reissued. On the server: /root/openvpn-install.sh client add ${current.name}`);
		return commit(state, {
			...state,
			users,
			events: [event, ...state.events]
		}, now);
	}),
	renewCert: (id) => set((state) => {
		const now = Date.now();
		const current = state.users.find((u) => u.id === id);
		if (!current) return state;
		const certExpiresAt = Math.max(now, current.certExpiresAt) + 31536e6;
		const users = state.users.map((u) => u.id === id ? {
			...u,
			certExpiresAt
		} : u);
		const event = makeEvent(now, current.name, "renew", `Certificate extended 365 days. On the server: /root/openvpn-install.sh client renew ${current.name} --cert-days 365`);
		return commit(state, {
			...state,
			users,
			events: [event, ...state.events]
		}, now);
	}),
	resetUsage: (id) => set((state) => {
		const now = Date.now();
		const current = state.users.find((u) => u.id === id);
		if (!current) return state;
		const users = state.users.map((u) => u.id === id ? {
			...u,
			usedBytes: 0,
			quotaAnchor: now,
			hold: u.hold === "quota" ? null : u.hold
		} : u);
		const event = makeEvent(now, current.name, "reset-usage", "Usage counter reset to zero.");
		return commit(state, {
			...state,
			users,
			events: [event, ...state.events]
		}, now);
	}),
	setServer: (patch) => set((state) => {
		const now = Date.now();
		return commit(state, {
			...state,
			server: {
				...state.server,
				...patch
			}
		}, now);
	}),
	resetDemo: () => set(createSeed(Date.now())),
	replayDemos: () => set((state) => {
		const now = Date.now();
		const fixtures = replayFixtures(state.users, state.sessions, now);
		const event = makeEvent(now, "week-pass", "update", "Replayed the live demos: week-pass expires in 45s, pilot-phone has 4 MB of cap left.");
		return commit(state, {
			...state,
			...fixtures,
			events: [event, ...state.events]
		}, now);
	}),
	importUsers: (users, serverPatch) => set((state) => {
		const now = Date.now();
		const kept = new Set(users.map((u) => u.id));
		const event = makeEvent(now, "policy", "update", `Imported ${users.length} clients from clients.json.`);
		return commit(state, {
			...state,
			users,
			server: {
				...state.server,
				...serverPatch
			},
			sessions: state.sessions.filter((s) => kept.has(s.userId)),
			events: [event, ...state.events]
		}, now);
	})
}), {
	name: "gatehouse.v1",
	skipHydration: true,
	partialize: (state) => ({
		seeded: state.seeded,
		users: state.users,
		sessions: state.sessions,
		events: state.events,
		samples: state.samples,
		server: state.server,
		now: state.now
	})
}));
var frozen = {
	...INITIAL_SNAP,
	tick: () => {},
	connect: () => ({
		ok: false,
		message: ""
	}),
	killSession: () => {},
	disconnectUser: () => {},
	addUser: () => {},
	updateUser: () => {},
	revokeUser: () => {},
	reissueUser: () => {},
	renewCert: () => {},
	resetUsage: () => {},
	setServer: () => {},
	resetDemo: () => {},
	replayDemos: () => {},
	importUsers: () => {}
};
var ApiContext = (0, import_react.createContext)(frozen);
function useApi() {
	return (0, import_react.useContext)(ApiContext);
}
function LiveApi({ children }) {
	const api = useVpn();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApiContext.Provider, {
		value: api,
		children
	});
}
var gatehouse_agent_default = "#!/usr/bin/env python3\n\"\"\"Gatehouse agent — per-client expiry, data quota, and concurrent caps.\n\nCompanion to https://github.com/angristan/openvpn-install\nThis does not replace that script. Certificates are still issued with:\n\n    ./openvpn-install.sh client add <name>\n    ./openvpn-install.sh client revoke <name>\n    ./openvpn-install.sh client renew <name> --cert-days 365\n\nWhat this enforces (from /etc/gatehouse/clients.json, exported by the panel)\n--------------------------------------------------------------------\n* Date expiry     policy expiresAt or certExpiresAt, whichever is sooner.\n                  Writes `disable` into the client CCD file and kills sessions.\n                  The certificate is left in place until you revoke it.\n* Data quota      Lifetime upload+download, measured as deltas of the OpenVPN\n                  status file. On cap, same CCD disable + kill.\n                  quotaCycle \"monthly\" resets the counter every 30 days.\n* Concurrent cap  Requires `duplicate-cn` in server.conf. Without it OpenVPN\n                  itself allows only one session (a new login kicks the old).\n                  With it, this agent kills extras by real address:port.\n                  concurrentPolicy: keep-newest (default) or keep-oldest.\n\nLayout from angristan/openvpn-install (OpenVPN 2.x, systemd):\n    /etc/openvpn/server/server.conf\n    /etc/openvpn/server/ccd/<common-name>\n    /var/log/openvpn/status.log\n    /var/run/openvpn-server/server.sock\n    /root/<name>.ovpn\n\nUsage\n    sudo python3 gatehouse-agent.py --once\n    sudo python3 gatehouse-agent.py --once --dry-run\n    sudo python3 gatehouse-agent.py --watch 60\n\nsystemd\n    cp gatehouse-agent.py /usr/local/sbin/gatehouse-agent.py\n    cp clients.json /etc/gatehouse/clients.json\n    # gatehouse-agent.service + gatehouse-agent.timer, then:\n    systemctl enable --now gatehouse-agent.timer\n\"\"\"\n\nfrom __future__ import annotations\n\nimport argparse\nimport datetime as dt\nimport fcntl\nimport json\nimport os\nimport re\nimport socket\nimport sys\nimport time\nfrom pathlib import Path\n\nMONTH_MS = 30 * 24 * 60 * 60 * 1000\nNAME_RE = re.compile(r\"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$\")\nMARKER = \"# gatehouse:managed\"\nLOG_PATH = Path(\"/var/log/gatehouse-agent.log\")\n\n\ndef log(message: str) -> None:\n    line = f\"{dt.datetime.now().isoformat(timespec='seconds')} {message}\"\n    print(line, flush=True)\n    try:\n        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)\n        with LOG_PATH.open(\"a\", encoding=\"utf-8\") as handle:\n            handle.write(line + \"\\n\")\n    except OSError:\n        pass\n\n\ndef now_ms() -> int:\n    return int(time.time() * 1000)\n\n\nclass LiveSession:\n    def __init__(self, cn: str, real: str, bytes_in: int, bytes_out: int, since: str) -> None:\n        self.cn = cn\n        self.real = real\n        self.bytes_in = bytes_in\n        self.bytes_out = bytes_out\n        self.since = since\n\n    @property\n    def total(self) -> int:\n        return self.bytes_in + self.bytes_out\n\n    @property\n    def key(self) -> str:\n        return f\"{self.real}|{self.since}\"\n\n\ndef parse_status(text: str) -> list[LiveSession]:\n    sessions: list[LiveSession] = []\n    mode: str | None = None\n    for raw in text.splitlines():\n        line = raw.strip()\n        if not line:\n            continue\n        if line.startswith(\"CLIENT_LIST\\t\"):\n            cols = line.split(\"\\t\")\n            _take_client(sessions, cols, indexed=True)\n            continue\n        if line.startswith(\"CLIENT_LIST,\"):\n            cols = line.split(\",\", 8)\n            _take_client(sessions, cols, indexed=True)\n            continue\n        if line.startswith(\"OpenVPN CLIENT LIST\"):\n            mode = \"v1\"\n            continue\n        if mode == \"v1\" and (\n            line.startswith(\"ROUTING TABLE\") or line.startswith(\"GLOBAL\") or line == \"END\"\n        ):\n            mode = None\n            continue\n        if mode != \"v1\":\n            continue\n        if line.startswith(\"Updated,\") or line.startswith(\"Common Name,\"):\n            continue\n        cols = line.split(\",\", 4)\n        if len(cols) < 5:\n            continue\n        cn, real, bin_, bout, since = cols\n        if cn in (\"UNDEF\", \"Common Name\"):\n            continue\n        try:\n            sessions.append(LiveSession(cn, real, int(bin_), int(bout), since.strip()))\n        except ValueError:\n            continue\n    return sessions\n\n\ndef _take_client(sessions: list[LiveSession], cols: list[str], indexed: bool) -> None:\n    # CLIENT_LIST, cn, real, virt, virt6, bytes_in, bytes_out, since, ...\n    if len(cols) < 8:\n        return\n    cn = cols[1]\n    if cn in (\"UNDEF\", \"Common Name\"):\n        return\n    try:\n        sessions.append(LiveSession(cn, cols[2], int(cols[5]), int(cols[6]), cols[7].strip()))\n    except ValueError:\n        return\n\n\ndef parse_since(value: str) -> float:\n    value = value.strip()\n    try:\n        return float(value)\n    except ValueError:\n        pass\n    for fmt in (\"%a %b %d %H:%M:%S %Y\", \"%Y-%m-%d %H:%M:%S\", \"%Y-%m-%d %H:%M:%S.%f\"):\n        try:\n            return dt.datetime.strptime(value, fmt).timestamp()\n        except ValueError:\n            continue\n    return 0.0\n\n\ndef conf_has_duplicate_cn(path: Path) -> bool:\n    try:\n        lines = path.read_text(encoding=\"utf-8\", errors=\"replace\").splitlines()\n    except OSError:\n        return False\n    for line in lines:\n        stripped = line.strip()\n        if not stripped or stripped[0] in \"#;\":\n            continue\n        if stripped.split()[0] == \"duplicate-cn\":\n            return True\n    return False\n\n\ndef mgmt_kill(sock_path: Path, targets: list[str], dry_run: bool) -> None:\n    if not targets:\n        return\n    if dry_run:\n        for target in targets:\n            log(f\"DRY-RUN kill {target}\")\n        return\n    if not sock_path.exists():\n        log(f\"management socket missing at {sock_path} — CCD disable still blocks the next login\")\n        return\n    try:\n        conn = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)\n        conn.settimeout(4)\n        conn.connect(str(sock_path))\n        _read_some(conn)\n        for target in targets:\n            conn.sendall(f\"kill {target}\\n\".encode())\n            reply = _read_some(conn)\n            if \"ERROR\" in reply.upper():\n                log(f\"management kill {target} rejected: {reply.strip()}\")\n            else:\n                log(f\"killed {target}\")\n        conn.sendall(b\"quit\\n\")\n        conn.close()\n    except OSError as exc:\n        log(f\"management socket error: {exc}\")\n\n\ndef _read_some(conn: socket.socket) -> str:\n    conn.settimeout(1.2)\n    chunks: list[bytes] = []\n    try:\n        while True:\n            data = conn.recv(4096)\n            if not data:\n                break\n            chunks.append(data)\n            if len(data) < 4096:\n                break\n    except socket.timeout:\n        pass\n    return b\"\".join(chunks).decode(\"utf-8\", \"replace\")\n\n\ndef update_ccd(path: Path, disable: bool, static_ip: str, netmask: str, dry_run: bool) -> None:\n    original = path.read_text(encoding=\"utf-8\").splitlines() if path.exists() else []\n    managed = any(line.strip() == MARKER for line in original)\n    if not disable and not static_ip and not managed:\n        return\n    preserved: list[str] = []\n    for line in original:\n        stripped = line.strip()\n        if stripped == MARKER or stripped == \"disable\" or stripped.startswith(\"ifconfig-push \"):\n            continue\n        if stripped == \"\":\n            continue\n        preserved.append(line.rstrip())\n    new_lines: list[str] = []\n    if disable or static_ip or preserved:\n        new_lines.append(MARKER)\n        if disable:\n            new_lines.append(\"disable\")\n        if static_ip:\n            new_lines.append(f\"ifconfig-push {static_ip} {netmask}\")\n        new_lines.extend(preserved)\n    new = (\"\\n\".join(new_lines) + \"\\n\") if new_lines else \"\"\n    old = (\"\\n\".join(original) + \"\\n\") if original else \"\"\n    if new == old:\n        return\n    action = \"remove\" if not new else \"write\"\n    log(f\"{'DRY-RUN ' if dry_run else ''}{action} {path}\")\n    if dry_run:\n        return\n    if not new:\n        path.unlink(missing_ok=True)\n        return\n    path.parent.mkdir(parents=True, exist_ok=True)\n    tmp = path.with_suffix(\".tmp\")\n    tmp.write_text(new, encoding=\"utf-8\")\n    os.chmod(tmp, 0o644)\n    tmp.replace(path)\n\n\ndef load_json(path: Path) -> dict:\n    return json.loads(path.read_text(encoding=\"utf-8\"))\n\n\ndef save_json(path: Path, payload: dict, dry_run: bool) -> None:\n    if dry_run:\n        return\n    path.parent.mkdir(parents=True, exist_ok=True)\n    tmp = path.with_suffix(\".tmp\")\n    tmp.write_text(json.dumps(payload, indent=2) + \"\\n\", encoding=\"utf-8\")\n    os.chmod(tmp, 0o600)\n    tmp.replace(path)\n\n\ndef run_once(args: argparse.Namespace) -> int:\n    config_path = Path(args.config)\n    state_path = Path(args.state)\n    status_path = Path(args.status)\n    ccd_dir = Path(args.ccd)\n    if not config_path.is_file():\n        log(f\"missing policy file {config_path}\")\n        return 2\n    try:\n        policy = load_json(config_path)\n    except (OSError, json.JSONDecodeError) as exc:\n        log(f\"policy unreadable: {exc}\")\n        return 2\n    if policy.get(\"version\") != 1 or not isinstance(policy.get(\"clients\"), list):\n        log(\"policy version must be 1 with a clients array\")\n        return 2\n\n    server = policy.get(\"server\") if isinstance(policy.get(\"server\"), dict) else {}\n    netmask = str(server.get(\"netmask\") or \"255.255.255.0\")\n    policy_name = str(server.get(\"concurrentPolicy\") or \"keep-newest\")\n    keep_newest = policy_name != \"keep-oldest\"\n    duplicate = conf_has_duplicate_cn(Path(args.server_conf))\n\n    try:\n        status_text = status_path.read_text(encoding=\"utf-8\", errors=\"replace\")\n    except OSError as exc:\n        log(f\"status log unreadable ({status_path}): {exc}\")\n        return 1\n    live = parse_status(status_text)\n    by_cn: dict[str, list[LiveSession]] = {}\n    for sess in live:\n        by_cn.setdefault(sess.cn, []).append(sess)\n\n    state = {\"users\": {}}\n    if state_path.is_file():\n        try:\n            loaded = load_json(state_path)\n            if isinstance(loaded.get(\"users\"), dict):\n                state = loaded\n        except (OSError, json.JSONDecodeError):\n            log(\"state file corrupt — starting counters from zero\")\n    users_state: dict = state.setdefault(\"users\", {})\n\n    clock = now_ms()\n    kills: list[str] = []\n\n    for client in policy[\"clients\"]:\n        if not isinstance(client, dict):\n            continue\n        name = str(client.get(\"name\") or \"\")\n        if not NAME_RE.fullmatch(name):\n            log(f\"skip illegal common name {name!r}\")\n            continue\n        entry = users_state.setdefault(name, {\"used\": 0, \"sessions\": {}, \"hold\": None})\n        sessions_mem = entry.setdefault(\"sessions\", {})\n        used = int(entry.get(\"used\") or 0)\n\n        quota = client.get(\"quotaBytes\")\n        quota = int(quota) if isinstance(quota, (int, float)) and quota is not None else None\n        cycle = client.get(\"quotaCycle\") or \"none\"\n        if cycle == \"monthly\" and quota is not None:\n            anchor = int(entry.get(\"cycleAnchor\") or client.get(\"quotaAnchor\") or clock)\n            hops = 0\n            while clock >= anchor + MONTH_MS and hops < 36:\n                anchor += MONTH_MS\n                hops += 1\n            if hops:\n                used = 0\n                log(f\"{name}: monthly quota reset\")\n                if entry.get(\"hold\") == \"quota\":\n                    entry[\"hold\"] = None\n            entry[\"cycleAnchor\"] = anchor\n\n        seen: set[str] = set()\n        for sess in by_cn.get(name, []):\n            seen.add(sess.key)\n            previous = sessions_mem.get(sess.key)\n            if previous is None:\n                delta = sess.total\n            else:\n                prev_total = int(previous)\n                delta = sess.total - prev_total if sess.total >= prev_total else sess.total\n            used += max(0, delta)\n            sessions_mem[sess.key] = sess.total\n        for key in list(sessions_mem):\n            if key not in seen:\n                sessions_mem.pop(key, None)\n        entry[\"used\"] = used\n\n        expires = client.get(\"expiresAt\")\n        cert_expires = client.get(\"certExpiresAt\")\n        times = [int(v) for v in (expires, cert_expires) if isinstance(v, (int, float))]\n        expired = any(clock >= t for t in times)\n        revoked = bool(client.get(\"revoked\"))\n        over = quota is not None and used >= quota\n        if revoked:\n            hold = \"revoked\"\n        elif expired:\n            hold = \"expired\"\n        elif over:\n            hold = \"quota\"\n        else:\n            hold = None\n\n        prev_hold = entry.get(\"hold\")\n        if hold != prev_hold:\n            if hold:\n                log(f\"{name}: blocked ({hold}), used={used}\")\n            else:\n                log(f\"{name}: hold cleared (was {prev_hold}), used={used}\")\n        entry[\"hold\"] = hold\n\n        static_ip = str(client.get(\"staticIp\") or \"\").strip()\n        update_ccd(ccd_dir / name, disable=hold is not None, static_ip=static_ip, netmask=netmask, dry_run=args.dry_run)\n\n        connected = by_cn.get(name, [])\n        if hold:\n            kills.extend(sess.real for sess in connected)\n            continue\n\n        try:\n            cap = int(client.get(\"maxConcurrent\") or 1)\n        except (TypeError, ValueError):\n            cap = 1\n        cap = max(1, cap)\n        if not duplicate:\n            if cap > 1:\n                log(f\"{name}: policy allows {cap} sessions but {args.server_conf} has no duplicate-cn — cap stays 1\")\n            cap = 1\n        if len(connected) <= cap:\n            continue\n        ordered = sorted(connected, key=lambda s: parse_since(s.since), reverse=keep_newest)\n        extras = ordered[cap:]\n        for sess in extras:\n            log(f\"{name}: over concurrent cap {cap}, dropping {sess.real}\")\n            kills.append(sess.real)\n\n    save_json(state_path, state, args.dry_run)\n    # De-duplicate kill targets while keeping order.\n    unique: list[str] = []\n    seen_kills: set[str] = set()\n    for target in kills:\n        if target in seen_kills:\n            continue\n        seen_kills.add(target)\n        unique.append(target)\n    mgmt_kill(Path(args.socket), unique, args.dry_run)\n    return 0\n\n\ndef main() -> int:\n    parser = argparse.ArgumentParser(description=\"Enforce Gatehouse limits on an angristan OpenVPN server\")\n    parser.add_argument(\"--config\", default=\"/etc/gatehouse/clients.json\")\n    parser.add_argument(\"--state\", default=\"/var/lib/gatehouse/state.json\")\n    parser.add_argument(\"--status\", default=\"/var/log/openvpn/status.log\")\n    parser.add_argument(\"--ccd\", default=\"/etc/openvpn/server/ccd\")\n    parser.add_argument(\"--socket\", default=\"/var/run/openvpn-server/server.sock\")\n    parser.add_argument(\"--server-conf\", default=\"/etc/openvpn/server/server.conf\")\n    parser.add_argument(\"--once\", action=\"store_true\")\n    parser.add_argument(\"--watch\", type=int, default=0, metavar=\"SECONDS\")\n    parser.add_argument(\"--dry-run\", action=\"store_true\")\n    args = parser.parse_args()\n    if args.watch < 0:\n        parser.error(\"--watch must be >= 0\")\n    if not args.once and args.watch <= 0:\n        args.once = True\n\n    lock_path = Path(args.state).with_suffix(\".lock\")\n    lock_path.parent.mkdir(parents=True, exist_ok=True)\n    lock = lock_path.open(\"a\", encoding=\"utf-8\")\n    try:\n        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)\n    except OSError:\n        log(\"another gatehouse-agent run is in progress\")\n        return 0\n\n    if args.watch > 0:\n        while True:\n            code = run_once(args)\n            if code != 0 and args.once:\n                return code\n            time.sleep(args.watch)\n    return run_once(args)\n\n\nif __name__ == \"__main__\":\n    sys.exit(main())\n";
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var controlClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-primary";
var TONE = {
	active: "bg-ok/15 text-ok",
	expired: "bg-danger/15 text-danger",
	quota: "bg-danger/15 text-danger",
	revoked: "bg-surface-2 text-muted",
	warn: "bg-primary/15 text-primary"
};
var LABEL = {
	active: "Active",
	expired: "Expired",
	quota: "Data cap",
	revoked: "Revoked"
};
function statusTone(user, now) {
	const access = accessOf(user, now);
	if (access !== "active") return {
		label: LABEL[access],
		tone: access
	};
	if (Math.min(user.expiresAt ?? Number.POSITIVE_INFINITY, user.certExpiresAt) - now < 6048e5) return {
		label: "Expiring",
		tone: "warn"
	};
	if (user.quotaBytes != null && user.usedBytes / user.quotaBytes >= .85) return {
		label: "Near cap",
		tone: "warn"
	};
	return {
		label: "Active",
		tone: "active"
	};
}
function StatusPill({ user, now }) {
	const status = statusTone(user, now);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium", TONE[status.tone]),
		children: status.label
	});
}
function QuotaBar({ used, cap }) {
	if (cap == null) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "text-sm text-muted",
		children: [
			"Unlimited · ",
			formatBytes(used),
			" moved"
		]
	});
	const pct = Math.min(100, cap === 0 ? 100 : used / cap * 100);
	const bar = pct >= 100 ? "bg-danger" : pct >= 85 ? "bg-primary" : "bg-ok";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex justify-between gap-3 text-xs text-muted tabular-nums",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatBytes(used) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatBytes(cap) })]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("h-full rounded-full", bar),
			style: { width: `${pct}%` }
		})
	})] });
}
function Panel({ title, action, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn("rounded-lg bg-surface p-4 shadow-card", className),
		children: [title ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-3 flex items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-semibold",
				children: title
			}), action]
		}) : null, children]
	});
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-primary", {
	variants: {
		variant: {
			primary: "bg-primary text-primary-fg hover:bg-primary/90",
			outline: "bg-surface text-fg shadow-card hover:bg-surface-2",
			ghost: "bg-transparent text-fg hover:bg-surface-2",
			danger: "bg-danger/15 text-danger hover:bg-danger/25"
		},
		size: {
			md: "h-11 px-4 text-sm",
			icon: "size-11"
		}
	},
	defaultVariants: {
		variant: "primary",
		size: "md"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
function addCommand(server, name, certDays, password) {
	const parts = [
		HOST_PATHS.install,
		"client",
		"add",
		name,
		"--client-cert-days",
		String(certDays)
	];
	if (password) parts.push("--password");
	return parts.join(" ");
}
function revokeCommand(name) {
	return `${HOST_PATHS.install} client revoke ${name}`;
}
function renewCommand(name) {
	return `${HOST_PATHS.install} client renew ${name} --cert-days 365`;
}
function policyDocument(server, users) {
	return {
		version: 1,
		exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
		note: "Policy for gatehouse-agent.py. The agent keeps its own usage counters in /var/lib/gatehouse/state.json — do not put usedBytes here.",
		server: {
			concurrentPolicy: server.concurrentPolicy,
			duplicateCn: server.duplicateCn,
			subnet: server.subnet,
			netmask: server.netmask
		},
		clients: users.map((u) => ({
			name: u.name,
			expiresAt: u.expiresAt,
			certExpiresAt: u.certExpiresAt,
			quotaBytes: u.quotaBytes,
			quotaCycle: u.quotaCycle,
			quotaAnchor: u.quotaAnchor,
			maxConcurrent: u.maxConcurrent,
			staticIp: u.staticIp,
			revoked: u.revoked,
			note: u.note,
			passwordProtected: u.passwordProtected
		}))
	};
}
function ovpnProfile(server, user) {
	return [
		"# Gatehouse demo profile — NOT a live certificate.",
		`# Real file on the server: /root/${user.name}.ovpn`,
		`# Produced by: ${addCommand(server, user.name, 3650, user.passwordProtected)}`,
		"# The blocks below are markers. openvpn-install.sh replaces them with CA, cert, key, and tls-crypt-v2.",
		"client",
		`proto ${server.protocol}`,
		server.protocol === "udp" ? "explicit-exit-notify" : null,
		`remote ${server.publicIp} ${server.port}`,
		"dev tun",
		"resolv-retry infinite",
		"nobind",
		"persist-key",
		"persist-tun",
		"remote-cert-tls server",
		"verify-x509-name server name",
		"auth SHA256",
		"auth-nocache",
		`cipher ${server.cipher}`,
		"ignore-unknown-option data-ciphers",
		`data-ciphers ${server.cipher}`,
		"tls-client",
		"tls-version-min 1.2",
		"verb 3",
		"",
		"<ca>",
		"# DEMO — easy-rsa CA from the OpenVPN host",
		"DEMO-CA",
		"</ca>",
		"<cert>",
		`# DEMO — certificate CN=${user.name}`,
		"DEMO-CERT",
		"</cert>",
		"<key>",
		user.passwordProtected ? "# DEMO — private key is password protected" : "# DEMO — private key",
		"DEMO-KEY",
		"</key>",
		server.tlsCrypt ? "<tls-crypt-v2>\nDEMO-TLS-CRYPT-V2\n</tls-crypt-v2>" : null,
		""
	].filter((line) => line != null).join("\n");
}
var SYSTEMD_SERVICE = `[Unit]
Description=Gatehouse OpenVPN policy agent
After=network-online.target openvpn-server@server.service

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/sbin/gatehouse-agent.py --once
`;
var SYSTEMD_TIMER = `[Unit]
Description=Run Gatehouse agent every minute

[Timer]
OnBootSec=30
OnUnitActiveSec=60
AccuracySec=10
Persistent=true

[Install]
WantedBy=timers.target
`;
function downloadText(filename, text, type = "text/plain") {
	const blob = new Blob([text], { type });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
var fileSchema = object({
	version: literal(1),
	server: object({
		concurrentPolicy: _enum(["keep-newest", "keep-oldest"]).optional(),
		duplicateCn: boolean().optional()
	}).optional(),
	clients: array(object({
		name: string().regex(NAME_RE),
		expiresAt: number().nullable().optional(),
		certExpiresAt: number(),
		quotaBytes: number().nullable().optional(),
		quotaCycle: _enum(["none", "monthly"]).optional(),
		quotaAnchor: number().optional(),
		maxConcurrent: number().int().min(1).max(50),
		staticIp: string().optional(),
		revoked: boolean().optional(),
		note: string().optional(),
		passwordProtected: boolean().optional()
	}))
});
function parsePolicyFile(text, existing, now) {
	const parsed = fileSchema.parse(JSON.parse(text));
	const seen = /* @__PURE__ */ new Set();
	const ips = /* @__PURE__ */ new Set();
	const users = parsed.clients.map((row) => {
		if (seen.has(row.name)) throw new Error(`Duplicate client ${row.name}`);
		seen.add(row.name);
		const staticIp = (row.staticIp ?? "").trim();
		if (staticIp) {
			if (!ipInVpnSubnet(staticIp)) throw new Error(`${row.name}: static IP must be inside 10.8.0.0/24`);
			if (ips.has(staticIp)) throw new Error(`Static IP ${staticIp} is used twice`);
			ips.add(staticIp);
		}
		const prev = existing.find((u) => u.id === row.name);
		return {
			id: row.name,
			name: row.name,
			createdAt: prev?.createdAt ?? now,
			expiresAt: row.expiresAt ?? null,
			certExpiresAt: row.certExpiresAt,
			quotaBytes: row.quotaBytes ?? null,
			quotaCycle: row.quotaCycle ?? "none",
			quotaAnchor: row.quotaAnchor ?? prev?.quotaAnchor ?? now,
			usedBytes: prev?.usedBytes ?? 0,
			maxConcurrent: row.maxConcurrent,
			revoked: row.revoked ?? false,
			hold: null,
			note: row.note ?? "",
			staticIp,
			passwordProtected: row.passwordProtected ?? false
		};
	});
	const serverPatch = {};
	if (parsed.server?.concurrentPolicy) serverPatch.concurrentPolicy = parsed.server.concurrentPolicy;
	if (typeof parsed.server?.duplicateCn === "boolean") serverPatch.duplicateCn = parsed.server.duplicateCn;
	return {
		users,
		serverPatch
	};
}
function AgentView() {
	const { server, users, events, now, setServer, resetDemo, importUsers } = useApi();
	const fileRef = (0, import_react.useRef)(null);
	const overOne = users.filter((u) => u.maxConcurrent > 1).length;
	function exportPolicy() {
		downloadText("clients.json", JSON.stringify(policyDocument(server, users), null, 2), "application/json");
		toast.success("Exported clients.json");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-lg bg-surface p-4 shadow-card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold",
					children: "This preview is the control plane"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm text-muted",
					children: [
						"Gatehouse follows the same client names",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "text-primary underline decoration-primary/40 underline-offset-2",
							href: "https://github.com/angristan/openvpn-install",
							target: "_blank",
							rel: "noreferrer",
							children: "angristan/openvpn-install"
						}),
						" ",
						"puts on certificates. The preview simulates ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-xs",
							children: "status.log"
						}),
						" so you can watch a data cap and a date expiry fire. On the VPS, export the policy and run the agent beside the install script — this page does not open a shell on your server."
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 rounded-lg bg-surface p-4 shadow-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold",
						children: "Host profile"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "grid gap-1.5 text-sm font-medium",
								children: ["Hostname", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: controlClass,
									value: server.hostname,
									onChange: (e) => setServer({ hostname: e.target.value })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "grid gap-1.5 text-sm font-medium",
								children: ["Public address", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: controlClass,
									value: server.publicIp,
									onChange: (e) => setServer({ publicIp: e.target.value }),
									spellCheck: false
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "grid gap-1.5 text-sm font-medium",
								children: ["Port", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: controlClass,
									inputMode: "numeric",
									value: String(server.port),
									onChange: (e) => {
										const port = Number(e.target.value);
										if (Number.isInteger(port) && port > 0 && port < 65536) setServer({ port });
									}
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "grid gap-1.5 text-sm font-medium",
								children: ["Protocol", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									className: controlClass,
									value: server.protocol,
									onChange: (e) => setServer({ protocol: e.target.value }),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "udp",
										children: "udp"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "tcp",
										children: "tcp"
									})]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: "duplicate-cn"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mt-0.5 block text-muted",
								children: [
									overOne,
									" client",
									overOne === 1 ? "" : "s",
									" allow more than one session. Angristan leaves this off."
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: server.duplicateCn,
							onCheckedChange: (duplicateCn) => setServer({ duplicateCn }),
							className: "relative h-6 w-11 shrink-0 rounded-full bg-surface-2 data-[state=checked]:bg-primary",
							"aria-label": "duplicate-cn",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: "block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-fg" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "whitespace-pre-wrap break-all rounded-md bg-bg px-3 py-2 font-mono text-xs text-muted",
						children: server.duplicateCn ? `# ${HOST_PATHS.conf}\nduplicate-cn\nsystemctl restart ${HOST_PATHS.unit}` : `# ${HOST_PATHS.conf}\n# duplicate-cn is not set — one session per certificate`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "grid gap-1.5 text-sm font-medium",
						children: ["When a client is over their cap", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							className: controlClass,
							value: server.concurrentPolicy,
							onChange: (e) => setServer({ concurrentPolicy: e.target.value }),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "keep-newest",
								children: "Keep newest — drop the oldest tunnel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "keep-oldest",
								children: "Keep oldest — refuse the new login"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted",
						children: [
							server.subnet,
							" · ",
							server.cipher,
							" · DNS ",
							server.dns,
							" · ",
							server.authMode,
							" · tls-crypt-v2"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-3 rounded-lg bg-surface p-4 shadow-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold",
						children: "Drop on the server"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
						className: "grid list-decimal gap-2 pl-5 text-sm text-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Install OpenVPN with openvpn-install.sh. Leave client add / revoke / renew to that script." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Copy ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-xs",
									children: "gatehouse-agent.py"
								}),
								" to ",
								HOST_PATHS.agent,
								". It only needs Python 3."
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Export ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-xs",
									children: "clients.json"
								}),
								" to ",
								HOST_PATHS.policy,
								". Re-export when limits change."
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"If anyone has a cap above 1, add ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-xs",
									children: "duplicate-cn"
								}),
								" and restart ",
								HOST_PATHS.unit,
								"."
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Enable the timer. Each pass reads the status log, adds new bytes to the quota, writes CCD, and kills extra or blocked sessions. The first time a live session is seen, the bytes already in the status file count." })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								onClick: () => downloadText("gatehouse-agent.py", gatehouse_agent_default),
								children: "Download agent"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "outline",
								onClick: exportPolicy,
								children: "Export clients.json"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => downloadText("gatehouse-agent.service", SYSTEMD_SERVICE),
								children: "service"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => downloadText("gatehouse-agent.timer", SYSTEMD_TIMER),
								children: "timer"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "ghost",
								onClick: () => fileRef.current?.click(),
								children: "Import JSON"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								ref: fileRef,
								type: "file",
								accept: "application/json,.json",
								className: "sr-only",
								onChange: async (event) => {
									const file = event.target.files?.[0];
									event.target.value = "";
									if (!file) return;
									try {
										const parsed = parsePolicyFile(await file.text(), users, Date.now());
										importUsers(parsed.users, parsed.serverPatch);
										toast.success(`Imported ${parsed.users.length} clients`);
									} catch (err) {
										toast.error(err instanceof Error ? err.message : "Could not import that file");
									}
								}
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "break-all font-mono text-xs text-muted",
						children: [
							"python3 ",
							HOST_PATHS.agent,
							" --once --dry-run"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-lg bg-surface p-4 shadow-card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold",
						children: "Enforcement log"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "ghost",
						onClick: () => {
							resetDemo();
							toast("Demo host restored");
						},
						children: "Reset demo"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "grid gap-3",
					children: events.map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "border-b border-border pb-3 last:border-0 last:pb-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "truncate text-sm font-medium",
								children: [event.userName, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 font-normal text-muted",
									children: event.kind
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 text-xs text-muted tabular-nums",
								children: formatDistance(event.at, now, { addSuffix: true })
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: event.detail
						})]
					}, event.id))
				})]
			})
		]
	});
}
function ClientDialog({ mode, userId, onClose }) {
	const api = useApi();
	const user = api.users.find((u) => u.id === userId);
	const { users, server, addUser, updateUser, renewCert, now } = api;
	const [name, setName] = (0, import_react.useState)(user?.name ?? "");
	const [noDate, setNoDate] = (0, import_react.useState)(user ? user.expiresAt == null : false);
	const [date, setDate] = (0, import_react.useState)(user?.expiresAt != null ? toDateInput(user.expiresAt) : toDateInput(now + 7776e6));
	const [certDays, setCertDays] = (0, import_react.useState)("3650");
	const [unlimited, setUnlimited] = (0, import_react.useState)(user ? user.quotaBytes == null : false);
	const [quotaGb, setQuotaGb] = (0, import_react.useState)(user?.quotaBytes != null ? bytesToGbInput(user.quotaBytes) : "20");
	const [cycle, setCycle] = (0, import_react.useState)(user?.quotaCycle ?? "none");
	const [maxConcurrent, setMaxConcurrent] = (0, import_react.useState)(String(user?.maxConcurrent ?? 1));
	const [staticIp, setStaticIp] = (0, import_react.useState)(user?.staticIp ?? "");
	const [note, setNote] = (0, import_react.useState)(user?.note ?? "");
	const [password, setPassword] = (0, import_react.useState)(user?.passwordProtected ?? false);
	const [error, setError] = (0, import_react.useState)("");
	const capWarning = !server.duplicateCn && Number(maxConcurrent) > 1;
	function save() {
		const concurrent = Number(maxConcurrent);
		const quota = unlimited ? null : Math.round(Number(quotaGb) * GB_BYTES);
		const expiresAt = noDate ? null : fromDateInput(date);
		const ip = staticIp.trim();
		if (mode === "new" && !NAME_RE.test(name)) {
			setError("Name must start with a letter or digit and use only letters, digits, dot, underscore, hyphen.");
			return;
		}
		if (mode === "new" && users.some((u) => u.name === name)) {
			setError("That common name already exists.");
			return;
		}
		if (!noDate && expiresAt == null) {
			setError("Pick a policy expiry date, or mark it unlimited.");
			return;
		}
		if (!unlimited && (!Number.isFinite(quota) || (quota ?? 0) <= 0)) {
			setError("Data cap must be a positive number of gigabytes.");
			return;
		}
		if (!Number.isInteger(concurrent) || concurrent < 1 || concurrent > 20) {
			setError("Concurrent sessions must be a whole number from 1 to 20.");
			return;
		}
		if (ip && !ipInVpnSubnet(ip)) {
			setError("Static IP must be inside 10.8.0.2–10.8.0.254 (topology subnet).");
			return;
		}
		if (ip && users.some((u) => u.staticIp === ip && u.id !== userId)) {
			setError("That static IP is already assigned.");
			return;
		}
		const days = Number(certDays);
		if (mode === "new" && (!Number.isInteger(days) || days < 1 || days > 3650)) {
			setError("Certificate lifetime must be 1–3650 days (Easy-RSA default is 3650).");
			return;
		}
		const shared = {
			expiresAt,
			certExpiresAt: mode === "new" ? Date.now() + days * 24 * 60 * 60 * 1e3 : user?.certExpiresAt ?? Date.now(),
			quotaBytes: quota,
			quotaCycle: unlimited ? "none" : cycle,
			maxConcurrent: concurrent,
			note: note.trim(),
			staticIp: ip,
			passwordProtected: password
		};
		if (mode === "new") {
			const input = {
				name,
				...shared
			};
			addUser(input);
			toast.success(`Issued ${name}`);
		} else if (user) {
			updateUser(user.id, shared);
			toast.success(`Updated ${user.name}`);
		}
		onClose();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open: true,
		onOpenChange: (open) => !open && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-40 bg-bg/70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "fixed inset-x-3 top-4 z-50 max-h-[85vh] overflow-y-auto rounded-lg bg-surface p-5 shadow-pop outline-none md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
					className: "text-lg font-semibold",
					children: mode === "new" ? "Issue client" : user?.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
					className: "mt-1 text-sm text-muted",
					children: mode === "new" ? "Same identity openvpn-install.sh uses as the certificate common name." : "Limits apply on the next agent pass. The certificate name stays put."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
					className: "flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg",
					"aria-label": "Close",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-5 grid gap-4",
				onSubmit: (event) => {
					event.preventDefault();
					save();
				},
				children: [
					mode === "new" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "grid gap-1.5 text-sm font-medium",
						children: ["Common name", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: controlClass,
							value: name,
							onChange: (e) => setName(e.target.value),
							autoComplete: "off",
							spellCheck: false
						})]
					}) : user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							"Certificate ends ",
							formatDay(user.certExpiresAt),
							". Policy date",
							" ",
							user.expiresAt ? formatDay(user.expiresAt) : "is not set",
							"."
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-medium",
							children: "No policy date"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: noDate,
							onCheckedChange: setNoDate,
							className: "relative h-6 w-11 rounded-full bg-surface-2 data-[state=checked]:bg-primary",
							"aria-label": "No policy date",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: "block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-fg" })
						})]
					}),
					!noDate ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "grid gap-1.5 text-sm font-medium",
						children: ["Access ends", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: controlClass,
							type: "date",
							value: date,
							onChange: (e) => setDate(e.target.value)
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Access still ends when the certificate expires. Renew it before then."
					}),
					mode === "new" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "grid gap-1.5 text-sm font-medium",
						children: ["Certificate lifetime (days)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: controlClass,
							inputMode: "numeric",
							value: certDays,
							onChange: (e) => setCertDays(e.target.value)
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-medium",
							children: "Unlimited data"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: unlimited,
							onCheckedChange: setUnlimited,
							className: "relative h-6 w-11 rounded-full bg-surface-2 data-[state=checked]:bg-primary",
							"aria-label": "Unlimited data",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: "block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-fg" })
						})]
					}),
					!unlimited ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "grid gap-1.5 text-sm font-medium",
							children: ["Data cap (GB)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: controlClass,
								inputMode: "decimal",
								value: quotaGb,
								onChange: (e) => setQuotaGb(e.target.value)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "grid gap-1.5 text-sm font-medium",
							children: ["Cycle", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: controlClass,
								value: cycle,
								onChange: (e) => setCycle(e.target.value),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "none",
									children: "Until raised or reset"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "monthly",
									children: "Reset every 30 days"
								})]
							})]
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "grid gap-1.5 text-sm font-medium",
						children: ["Concurrent sessions", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: controlClass,
							inputMode: "numeric",
							value: maxConcurrent,
							onChange: (e) => setMaxConcurrent(e.target.value)
						})]
					}),
					capWarning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-primary",
						children: "This host has duplicate-cn off, so OpenVPN will only keep one session. Turn it on under Agent before a cap above 1 can stick."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Above 1 needs duplicate-cn. Keep-newest drops the oldest login; keep-oldest refuses the new one."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "grid gap-1.5 text-sm font-medium",
						children: ["Static VPN address", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: controlClass,
							value: staticIp,
							placeholder: "10.8.0.20",
							onChange: (e) => setStaticIp(e.target.value),
							spellCheck: false
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "grid gap-1.5 text-sm font-medium",
						children: ["Note", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: controlClass,
							value: note,
							onChange: (e) => setNote(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: "Password on the private key"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-0.5 block text-muted",
								children: "Passed as --password. The secret is not stored here."
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: password,
							onCheckedChange: setPassword,
							className: "relative h-6 w-11 shrink-0 rounded-full bg-surface-2 data-[state=checked]:bg-primary",
							"aria-label": "Password protected key",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: "block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-fg" })
						})]
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-danger",
						children: error
					}) : null,
					mode === "new" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "break-all rounded-md bg-bg px-3 py-2 font-mono text-xs text-muted",
						children: addCommand(server, name || "name", Number(certDays) || 3650, password)
					}) : user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "break-all rounded-md bg-bg px-3 py-2 font-mono text-xs text-muted",
							children: renewCommand(user.name)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => {
									renewCert(user.id);
									toast.success(`Renewed ${user.name}`);
								},
								children: "Renew +365 days"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => downloadText(`${user.name}.ovpn`, ovpnProfile(server, user)),
								children: "Demo profile"
							})]
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2 pt-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							children: mode === "new" ? "Issue client" : "Save limits"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							onClick: onClose,
							children: "Cancel"
						})]
					})
				]
			})]
		})] })
	});
}
var FILTERS = [
	"all",
	"online",
	"expiring",
	"blocked",
	"revoked"
];
function Clients({ query, onQuery, onEdit, onCreate }) {
	const { users, sessions, server, now, connect, disconnectUser, resetUsage, revokeUser, reissueUser } = useApi();
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [revokeId, setRevokeId] = (0, import_react.useState)(null);
	const revokeTarget = users.find((u) => u.id === revokeId) ?? null;
	const rows = (0, import_react.useMemo)(() => {
		const q = query.trim().toLowerCase();
		return users.filter((user) => {
			if (q && !`${user.name} ${user.note}`.toLowerCase().includes(q)) return false;
			const access = accessOf(user, now);
			const online = sessions.some((s) => s.userId === user.id);
			if (filter === "online") return online;
			if (filter === "blocked") return access === "expired" || access === "quota";
			if (filter === "revoked") return access === "revoked";
			if (filter === "expiring") {
				const sooner = Math.min(user.expiresAt ?? Number.POSITIVE_INFINITY, user.certExpiresAt);
				return access === "active" && sooner - now < 6048e5;
			}
			return true;
		});
	}, [
		users,
		query,
		filter,
		now,
		sessions
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: `${controlClass} pl-9`,
						value: query,
						onChange: (e) => onQuery(e.target.value),
						placeholder: "Search clients",
						"aria-label": "Search clients"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					onClick: onCreate,
					children: "Issue client"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: FILTERS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setFilter(item),
					className: `h-11 rounded-full px-4 text-sm capitalize ${filter === item ? "bg-primary text-primary-fg" : "bg-surface text-muted shadow-card"}`,
					children: item
				}, item))
			}),
			rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-lg bg-surface p-6 text-sm text-muted shadow-card",
				children: "No clients match."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid gap-3 xl:grid-cols-2",
				children: rows.map((user) => {
					const mine = sessions.filter((s) => s.userId === user.id);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg bg-surface p-4 shadow-card",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
												className: "truncate font-medium",
												children: user.name
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, {
												user,
												now
											}),
											user.passwordProtected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs text-muted",
												children: "key password"
											}) : null
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-sm text-muted",
										children: user.note || "No note"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RowMenu, {
									user,
									onEdit: () => onEdit(user.id),
									onProfile: () => downloadText(`${user.name}.ovpn`, ovpnProfile(server, user)),
									onDisconnect: () => {
										disconnectUser(user.id);
										toast(`Disconnected ${user.name}`);
									},
									onReset: () => {
										resetUsage(user.id);
										toast(`Reset usage for ${user.name}`);
									},
									onRevoke: () => setRevokeId(user.id),
									onReissue: () => {
										reissueUser(user.id);
										toast(`Reissued ${user.name}`);
									}
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 grid gap-4 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mb-1 text-xs text-muted",
									children: ["Data", user.quotaCycle === "monthly" && user.quotaBytes != null ? " · resets every 30 days" : ""]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuotaBar, {
									used: user.usedBytes,
									cap: user.quotaBytes
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid content-start gap-1 text-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-muted",
											children: "Sessions"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "font-medium tabular-nums",
											children: [
												mine.length,
												" / ",
												user.maxConcurrent,
												!server.duplicateCn && user.maxConcurrent > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-normal text-muted",
													children: " · server allows 1"
												}) : null
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-muted",
											children: expiryPhrase(user, now)
										}),
										user.staticIp ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-mono text-xs text-muted",
											children: user.staticIp
										}) : null
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 flex flex-wrap gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									onClick: () => {
										const result = connect(user.id);
										if (result.ok) toast.success(result.message);
										else toast.error(result.message);
									},
									children: "Connect"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "outline",
									onClick: () => onEdit(user.id),
									children: "Limits"
								})]
							})
						]
					}, user.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root2, {
				open: revokeTarget != null,
				onOpenChange: (open) => !open && setRevokeId(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Portal2, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay2, { className: "fixed inset-0 z-40 bg-bg/70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Content2, {
					className: "fixed inset-x-3 top-24 z-50 rounded-lg bg-surface p-5 shadow-pop outline-none md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Title2, {
							className: "text-lg font-semibold",
							children: [
								"Revoke ",
								revokeTarget?.name,
								"?"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Description2, {
							className: "mt-2 text-sm text-muted",
							children: "This is the destructive path. On the server it updates the CRL and disconnects the client. A date or data block only writes disable and can be undone."
						}),
						revokeTarget ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 break-all rounded-md bg-bg px-3 py-2 font-mono text-xs text-muted",
							children: revokeCommand(revokeTarget.name)
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-wrap gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Action, {
								asChild: true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "danger",
									onClick: () => {
										if (!revokeTarget) return;
										revokeUser(revokeTarget.id);
										toast.success(`Revoked ${revokeTarget.name}`);
										setRevokeId(null);
									},
									children: "Revoke certificate"
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cancel, {
								asChild: true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "ghost",
									children: "Keep"
								})
							})]
						})
					]
				})] })
			})
		]
	});
}
function RowMenu({ user, onEdit, onProfile, onDisconnect, onReset, onRevoke, onReissue }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Root2$1, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			type: "button",
			variant: "ghost",
			size: "icon",
			"aria-label": `Actions for ${user.name}`,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ellipsis, { className: "size-4" })
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal2$1, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Content2$1, {
		className: "z-50 min-w-44 rounded-md bg-surface p-1 shadow-pop",
		align: "end",
		sideOffset: 6,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, {
				onSelect: onEdit,
				children: "Edit limits"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, {
				onSelect: onProfile,
				children: "Download demo profile"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, {
				onSelect: onDisconnect,
				children: "Disconnect sessions"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, {
				onSelect: onReset,
				children: "Reset data counter"
			}),
			user.revoked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, {
				onSelect: onReissue,
				children: "Reissue access"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item, {
				onSelect: onRevoke,
				children: "Revoke…"
			})
		]
	}) })] });
}
function Item({ children, onSelect }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item2, {
		onSelect,
		className: "flex h-11 cursor-pointer items-center rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-surface-2",
		children
	});
}
function Overview({ onOpenUser }) {
	const { users, sessions, samples, events, now, replayDemos: replay } = useApi();
	const onlineUsers = new Set(sessions.map((s) => s.userId)).size;
	const blocked = users.filter((u) => accessOf(u, now) !== "active").length;
	const expiring = users.filter((u) => {
		if (accessOf(u, now) !== "active") return false;
		return blockingExpiry(u) - now < 6048e5;
	}).length;
	const bps = samples.at(-1)?.bps ?? sessions.reduce((sum, s) => sum + s.rateIn + s.rateOut, 0);
	const live = users.flatMap((user) => {
		const lines = [];
		if (user.quotaBytes != null && accessOf(user, now) === "active") {
			const left = user.quotaBytes - user.usedBytes;
			const rate = sessions.filter((s) => s.userId === user.id).reduce((sum, s) => sum + s.rateIn + s.rateOut, 0);
			if (left > 0 && rate > 0) {
				const sec = left / rate;
				if (sec < 180) lines.push({
					id: `${user.id}-q`,
					text: `${user.name} hits its data cap in ${formatRemain(sec)}`
				});
			}
		}
		if (accessOf(user, now) === "active") {
			const left = (blockingExpiry(user) - now) / 1e3;
			if (left > 0 && left < 180) lines.push({
				id: `${user.id}-d`,
				text: `${user.name} expires in ${formatRemain(left)}`
			});
		}
		return lines;
	});
	const attention = users.filter((user) => {
		if (accessOf(user, now) !== "active") return true;
		if (blockingExpiry(user) - now < 6048e5) return true;
		if (user.quotaBytes != null && user.usedBytes / user.quotaBytes >= .85) return true;
		return false;
	}).slice(0, 6);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [
			live.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium text-primary",
					children: "Enforcement is running on this demo host"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1 grid gap-0.5 text-sm text-fg",
					children: live.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "tabular-nums",
						children: line.text
					}, line.id))
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "outline",
					onClick: replay,
					children: "Replay limits"
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Sessions",
						value: String(sessions.length),
						hint: `${onlineUsers} clients`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Throughput",
						value: formatBytes(bps),
						hint: "per second"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Expiring",
						value: String(expiring),
						hint: "inside 7 days"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Blocked",
						value: String(blocked),
						hint: "date, data, or revoke"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Traffic on the simulated status log",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-40 w-full min-w-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
							data: samples,
							margin: {
								top: 8,
								right: 0,
								left: 0,
								bottom: 0
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
								formatter: (value) => [`${formatBytes(Number(value))}/s`, "Throughput"],
								labelFormatter: () => "",
								contentStyle: {
									background: "var(--color-surface-2)",
									border: "1px solid var(--color-border)",
									borderRadius: 8,
									color: "var(--color-fg)",
									fontSize: 12
								}
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
								type: "monotone",
								dataKey: "bps",
								stroke: "var(--color-primary)",
								fill: "var(--color-primary)",
								fillOpacity: .18,
								strokeWidth: 2,
								isAnimationActive: false
							})]
						})
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Needs a look",
					children: attention.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Nothing is close to a limit."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "grid gap-2",
						children: attention.map((user) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => onOpenUser(user.name),
							className: "flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate font-medium",
									children: user.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate text-sm text-muted",
									children: expiryPhrase(user, now)
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, {
								user,
								now
							})]
						}) }, user.id))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Recent enforcement",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "grid gap-3",
						children: events.slice(0, 5).map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "grid gap-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate text-sm font-medium",
									children: event.userName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "shrink-0 text-xs text-muted tabular-nums",
									children: formatDistance(event.at, now, { addSuffix: true })
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: event.detail
							})]
						}, event.id))
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 md:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rule, {
						title: "Date expiry",
						body: "The sooner of the policy date and the certificate end. The agent writes disable into ccd/ and kills the tunnel. Revoke is separate — that burns the cert via openvpn-install.sh."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rule, {
						title: "Data cap",
						body: "Upload plus download. Hit the cap and the same disable lands until you raise it, reset the counter, or the 30-day cycle rolls."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rule, {
						title: "Concurrent cap",
						body: "Each client has its own number. Caps above 1 need duplicate-cn, which angristan does not turn on. The agent then kills the extras."
					})
				]
			})
		]
	});
}
function Stat({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-surface p-4 shadow-card",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 truncate text-2xl font-semibold tabular-nums",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: hint
			})
		]
	});
}
function Rule({ title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-lg bg-surface p-4 shadow-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-sm font-semibold",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: body
		})]
	});
}
function Sessions() {
	const { sessions, users, now, killSession } = useApi();
	const nameOf = (id) => users.find((u) => u.id === id)?.name ?? id;
	if (sessions.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "rounded-lg bg-surface p-6 text-sm text-muted shadow-card",
		children: "Nobody is connected. Issue a client or press Connect on someone who is still allowed in."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "grid gap-3",
		children: sessions.slice().sort((a, b) => b.connectedAt - a.connectedAt).map((session) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "rounded-lg bg-surface p-4 shadow-card",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "truncate font-medium",
						children: nameOf(session.userId)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-mono text-xs text-muted",
						children: [
							session.realAddress,
							" → ",
							session.virtualAddress
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "danger",
					onClick: () => {
						killSession(session.id);
						toast(`Killed ${session.realAddress}`);
					},
					children: "Kill"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "Up",
						value: formatBytes(session.bytesIn)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "Down",
						value: formatBytes(session.bytesOut)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "Rate",
						value: `${formatBytes(session.rateIn + session.rateOut)}/s`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
						label: "Since",
						value: formatDistance(session.connectedAt, now, { addSuffix: true })
					})
				]
			})]
		}, session.id))
	});
}
function Cell({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
		className: "text-xs text-muted",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
		className: "tabular-nums",
		children: value
	})] });
}
var TABS = [
	{
		id: "overview",
		label: "Overview",
		icon: Shield
	},
	{
		id: "clients",
		label: "Clients",
		icon: Users
	},
	{
		id: "sessions",
		label: "Live",
		icon: Activity
	},
	{
		id: "agent",
		label: "Agent",
		icon: FileText
	}
];
function Console() {
	const [view, setView] = (0, import_react.useState)("overview");
	const [query, setQuery] = (0, import_react.useState)("");
	const [editing, setEditing] = (0, import_react.useState)(null);
	const { server, sessions, samples } = useApi();
	const bps = samples.at(-1)?.bps ?? 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen md:grid md:grid-cols-[15rem_minmax(0,1fr)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "border-b border-border bg-bg md:min-h-screen md:border-r md:border-b-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 px-4 py-4 md:px-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-11 items-center justify-center rounded-md bg-primary text-primary-fg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
							className: "size-5",
							"aria-hidden": true
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-base font-semibold leading-tight",
							children: "Gatehouse"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "block truncate font-mono text-xs text-muted",
							children: [
								server.hostname,
								" · ",
								server.protocol,
								"/",
								server.port
							]
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "grid grid-cols-4 gap-1 px-3 pb-3 md:flex md:flex-col md:px-3",
					"aria-label": "Sections",
					children: TABS.map((tab) => {
						const Icon = tab.icon;
						const active = view === tab.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setView(tab.id),
							className: cn("flex h-14 flex-col items-center justify-center gap-0.5 rounded-md text-xs md:h-11 md:flex-row md:justify-start md:gap-2 md:px-3 md:text-sm", active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-4",
								"aria-hidden": true
							}), tab.label]
						}, tab.id);
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "min-w-0 truncate text-sm text-muted",
						children: [
							"Simulated host · ",
							sessions.length,
							" live ·",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "tabular-nums text-fg",
								children: [formatBytes(bps), "/s"]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "hidden text-xs text-muted sm:block",
						children: "per-user date, data, and session caps"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
					className: "px-4 py-4 md:px-6 md:py-6",
					children: [
						view === "overview" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overview, { onOpenUser: (name) => {
							setQuery(name);
							setView("clients");
						} }) : null,
						view === "clients" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clients, {
							query,
							onQuery: setQuery,
							onCreate: () => setEditing("new"),
							onEdit: (id) => setEditing(id)
						}) : null,
						view === "sessions" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sessions, {}) : null,
						view === "agent" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AgentView, {}) : null
					]
				})]
			}),
			editing === "new" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClientDialog, {
				mode: "new",
				onClose: () => setEditing(null)
			}) : null,
			editing && editing !== "new" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClientDialog, {
				mode: "edit",
				userId: editing,
				onClose: () => setEditing(null)
			}, editing) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				theme: "dark",
				position: "top-center",
				toastOptions: { className: "bg-surface text-fg border border-border" }
			})
		]
	});
}
function GatehouseApp() {
	const [booted, setBooted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		let timer = 0;
		const boot = async () => {
			try {
				await useVpn.persist.rehydrate();
			} catch {}
			if (cancelled) return;
			if (!useVpn.getState().seeded) useVpn.setState(createSeed(Date.now()));
			useVpn.getState().tick(Date.now());
			timer = window.setInterval(() => useVpn.getState().tick(Date.now()), 1e3);
			setBooted(true);
		};
		boot();
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, []);
	if (!booted) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Console, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveApi, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Console, {}) });
}
var SplitComponent = GatehouseApp;
//#endregion
export { SplitComponent as component };
