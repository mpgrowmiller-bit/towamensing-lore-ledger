import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Camera,
  Cloud,
  CloudOff,
  Download,
  FileUp,
  Flame,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Heat = "watch" | "avoid" | "friction" | "redeemable";
type SyncState = "local" | "locked" | "loading" | "shared" | "saving" | "error";

type Person = {
  id: string;
  name: string;
  aliases: string;
  face: string;
  role: string;
  location: string;
  heat: Heat;
  lastSeen: string;
  summary: string;
  offense: string;
  receipts: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type SharedConfig = {
  url: string;
  key: string;
  book: string;
};

const storageKey = "towamensing-lore-ledger-v1";
const configKey = "towamensing-lore-ledger-shared-config";
const passcodeKey = "towamensing-lore-ledger-passcode";

const envConfig: SharedConfig = {
  url: import.meta.env.VITE_SUPABASE_URL ?? "",
  key: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  book: import.meta.env.VITE_LORE_BOOK_ID ?? "",
};

const heatLabels: Record<Heat, string> = {
  watch: "Watch List",
  avoid: "Avoid",
  friction: "High Friction",
  redeemable: "Redeemable",
};

const emptyPerson = (): Person => ({
  id: crypto.randomUUID(),
  name: "",
  aliases: "",
  face: "",
  role: "",
  location: "",
  heat: "watch",
  lastSeen: "",
  summary: "",
  offense: "",
  receipts: "",
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const seedPeople: Person[] = [
  {
    id: "sample-pool-paul",
    name: "Pool Gate Paul",
    aliases: "That visor guy",
    face: "",
    role: "Pool orbit / clipboard energy",
    location: "Pool gate, usually near the loungers",
    heat: "avoid",
    lastSeen: "Saturday afternoon",
    summary: "Recognizable by the tactical sun visor and the confidence of a man who has corrected strangers for sport.",
    offense: "Allegedly questioned guest passes with the intensity of a federal hearing.",
    receipts: "Ask Chris about the Fourth of July wristband incident.",
    tags: ["pool", "guest-pass", "lore"],
    createdAt: "2026-08-19T12:00:00.000Z",
    updatedAt: "2026-08-19T12:00:00.000Z",
  },
  {
    id: "sample-committee-karen",
    name: "Committee Karen",
    aliases: "K-dawg, Minutes Lady",
    face: "",
    role: "Meeting regular",
    location: "Community meeting back row",
    heat: "watch",
    lastSeen: "Last HOA meeting",
    summary: "Knows bylaws, names, and which snacks were missing from the last event.",
    offense: "No problem confirmed yet. Monitor the vibes and verify before repeating anything.",
    receipts: "Receipts pending. Do not escalate without confirmation. Yes, the app has standards.",
    tags: ["meetings", "bylaws", "pending"],
    createdAt: "2026-08-19T12:00:00.000Z",
    updatedAt: "2026-08-19T12:00:00.000Z",
  },
];

function encodeJson(value: unknown) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

function decodeJson<T>(encoded: string): T | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded)))) as T;
  } catch {
    return null;
  }
}

function getHashParams() {
  return new URLSearchParams(location.hash.replace(/^#/, ""));
}

function getInitialConfig(): SharedConfig {
  const params = getHashParams();
  const packed = params.get("s");
  if (packed) {
    const decoded = decodeJson<SharedConfig>(packed);
    if (decoded?.url && decoded.key && decoded.book) {
      localStorage.setItem(configKey, JSON.stringify(decoded));
      return decoded;
    }
  }

  if (envConfig.url && envConfig.key && envConfig.book) return envConfig;

  const stored = localStorage.getItem(configKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as SharedConfig;
      if (parsed.url && parsed.key && parsed.book) return parsed;
    } catch {
      localStorage.removeItem(configKey);
    }
  }

  return { url: "", key: "", book: "" };
}

function getInitialPeople() {
  const fromHash = getHashParams().get("data");
  if (fromHash) {
    const decoded = decodeJson<{ people: Person[] }>(fromHash);
    if (decoded?.people) return normalizePeople(decoded.people) ?? seedPeople;
  }

  const stored = localStorage.getItem(storageKey);
  if (!stored) return seedPeople;

  try {
    return normalizePeople(JSON.parse(stored)) ?? seedPeople;
  } catch {
    return seedPeople;
  }
}

function normalizePeople(value: unknown): Person[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is Partial<Person> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      ...emptyPerson(),
      ...item,
      id: item.id || crypto.randomUUID(),
      heat: item.heat === "enemy" ? "friction" : item.heat ?? "watch",
      tags: Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string") : [],
      updatedAt: item.updatedAt || new Date().toISOString(),
    }));
}

function makeClient(config: SharedConfig): SupabaseClient | null {
  if (!config.url || !config.key || !config.book) return null;
  return createClient(config.url, config.key, { auth: { persistSession: false } });
}

async function loadShared(client: SupabaseClient, config: SharedConfig, passcode: string) {
  const { data, error } = await client.rpc("lore_load", {
    p_book_id: config.book,
    p_passcode: passcode,
  });
  if (error) throw error;
  return normalizePeople(data) ?? [];
}

async function saveShared(client: SupabaseClient, config: SharedConfig, passcode: string, people: Person[]) {
  const { data, error } = await client.rpc("lore_save", {
    p_book_id: config.book,
    p_passcode: passcode,
    p_entries: people,
  });
  if (error) throw error;
  return normalizePeople(data) ?? people;
}

function App() {
  const [people, setPeople] = useState<Person[]>(getInitialPeople);
  const [selectedId, setSelectedId] = useState(people[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [heat, setHeat] = useState<Heat | "all">("all");
  const [toast, setToast] = useState("");
  const [config, setConfig] = useState<SharedConfig>(getInitialConfig);
  const [passcode, setPasscode] = useState(() => getHashParams().get("code") ?? localStorage.getItem(passcodeKey) ?? "");
  const [syncState, setSyncState] = useState<SyncState>(() => (makeClient(getInitialConfig()) ? "locked" : "local"));
  const [syncMessage, setSyncMessage] = useState("Local-only mode.");
  const [lastSaved, setLastSaved] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [setupDraft, setSetupDraft] = useState<SharedConfig>(config);
  const saveTimer = useRef<number | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const client = useMemo(() => makeClient(config), [config]);
  const selected = people.find((person) => person.id === selectedId) ?? people[0];
  const isShared = Boolean(client && passcode && (syncState === "shared" || syncState === "saving"));

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(people));
  }, [people]);

  useEffect(() => {
    if (!selected && people[0]) setSelectedId(people[0].id);
  }, [people, selected]);

  useEffect(() => {
    if (!client || !passcode || syncState === "loading" || syncState === "locked") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSyncState("saving");
      saveShared(client, config, passcode, people)
        .then(() => {
          const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          setLastSaved(time);
          setSyncMessage(`Shared book saved at ${time}.`);
          setSyncState("shared");
        })
        .catch((error) => {
          setSyncState("error");
          setSyncMessage(error.message || "Could not save shared book.");
        });
    }, 800);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [client, config, passcode, people, syncState]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people
      .filter((person) => heat === "all" || person.heat === heat)
      .filter((person) => {
        if (!needle) return true;
        return [
          person.name,
          person.aliases,
          person.role,
          person.location,
          person.summary,
          person.offense,
          person.receipts,
          person.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
  }, [heat, people, query]);

  const stats = useMemo(
    () => ({
      total: people.length,
      friction: people.filter((person) => person.heat === "friction").length,
      unidentified: people.filter((person) => !person.face).length,
    }),
    [people],
  );

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function unlockShared(event?: FormEvent) {
    event?.preventDefault();
    if (!client || !passcode) {
      flash("Shared book needs config and passcode.");
      return;
    }

    setSyncState("loading");
    setSyncMessage("Opening shared book...");
    try {
      const remote = await loadShared(client, config, passcode);
      setPeople(remote.length ? remote : people);
      setSelectedId(remote[0]?.id ?? people[0]?.id ?? "");
      localStorage.setItem(passcodeKey, passcode);
      setSyncState("shared");
      setSyncMessage("Shared book connected.");
      flash("Shared book connected.");
    } catch (error) {
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : "Could not open shared book.");
    }
  }

  async function refreshShared() {
    if (!client || !passcode) return;
    setSyncState("loading");
    try {
      const remote = await loadShared(client, config, passcode);
      setPeople(remote);
      setSelectedId(remote[0]?.id ?? "");
      setSyncState("shared");
      setSyncMessage("Shared book refreshed.");
    } catch (error) {
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : "Could not refresh shared book.");
    }
  }

  async function forceSave() {
    if (!client || !passcode) {
      flash("Saved locally.");
      return;
    }

    setSyncState("saving");
    try {
      await saveShared(client, config, passcode, people);
      const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setLastSaved(time);
      setSyncState("shared");
      setSyncMessage(`Shared book saved at ${time}.`);
      flash("Shared book saved.");
    } catch (error) {
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : "Could not save shared book.");
    }
  }

  function updateSelected(updates: Partial<Person>) {
    if (!selected) return;
    setPeople((current) =>
      current.map((person) =>
        person.id === selected.id
          ? {
              ...person,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : person,
      ),
    );
  }

  function addPerson() {
    const next = {
      ...emptyPerson(),
      name: "Unnamed entry",
      summary: "Face and lore pending.",
      offense: "Unknown. Add context before sharing.",
      tags: ["new"],
    };
    setPeople((current) => [next, ...current]);
    setSelectedId(next.id);
  }

  function deleteSelected() {
    if (!selected) return;
    const next = people.filter((person) => person.id !== selected.id);
    setPeople(next);
    setSelectedId(next[0]?.id ?? "");
    flash("Entry removed.");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(people, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `towamensing-lore-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    flash("Export downloaded.");
  }

  function createShareLink(includePasscode = false) {
    const url = new URL(location.href);
    url.hash = `s=${encodeJson(config)}${includePasscode && passcode ? `&code=${encodeURIComponent(passcode)}` : ""}`;
    navigator.clipboard.writeText(url.toString());
    flash(includePasscode ? "One-tap link copied." : "Shared book link copied.");
  }

  function createSnapshotLink() {
    const url = new URL(location.href);
    url.hash = `data=${encodeJson({ people, exportedAt: new Date().toISOString() })}`;
    navigator.clipboard.writeText(url.toString());
    flash("Snapshot link copied.");
  }

  function saveSetup(event: FormEvent) {
    event.preventDefault();
    if (!setupDraft.url || !setupDraft.key || !setupDraft.book) {
      flash("Fill in all shared setup fields.");
      return;
    }

    localStorage.setItem(configKey, JSON.stringify(setupDraft));
    setConfig(setupDraft);
    setSyncState("locked");
    setSyncMessage("Shared setup saved. Enter passcode to open.");
    setShowSetup(false);
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const next = normalizePeople(parsed);
        if (!next) throw new Error("Invalid file");
        setPeople(next);
        setSelectedId(next[0]?.id ?? "");
        flash(isShared ? "Import loaded. Saving shared book." : "Import complete.");
      } catch {
        flash("That file was not a Burn Book export.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSelected({ face: String(reader.result) });
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    forceSave();
  }

  return (
    <main className="app">
      <section className="sidebar" aria-label="Lore ledger roster">
        <div className="brand">
          <div className="mark">
            <Flame size={25} />
          </div>
          <div>
            <p>Towamensing Trails</p>
            <h1>Burn Book</h1>
          </div>
        </div>

        <div className={`sync-card ${syncState}`}>
          {isShared ? <Cloud size={19} /> : <CloudOff size={19} />}
          <div>
            <strong>{isShared ? "Shared book" : client ? "Locked shared book" : "Local-only book"}</strong>
            <span>{syncMessage}</span>
          </div>
        </div>

        {client && !isShared ? (
          <form className="unlock" onSubmit={unlockShared}>
            <label>
              <KeyRound size={17} />
              <input
                autoComplete="current-password"
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="Group passcode"
                type="password"
                value={passcode}
              />
            </label>
            <button type="submit">Open</button>
          </form>
        ) : null}

        <div className="notice">
          <ShieldAlert size={18} />
          <span>One face, one nickname, one story. Keep receipts before the lore mutates.</span>
        </div>

        <div className="stats" aria-label="Book stats">
          <div>
            <strong>{stats.total}</strong>
            <span>entries</span>
          </div>
          <div>
            <strong>{stats.friction}</strong>
            <span>friction</span>
          </div>
          <div>
            <strong>{stats.unidentified}</strong>
            <span>need faces</span>
          </div>
        </div>

        <label className="search">
          <Search size={17} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search names, lore, tags"
            value={query}
          />
        </label>

        <div className="filters" aria-label="Heat filters">
          {(["all", "watch", "avoid", "friction", "redeemable"] as const).map((option) => (
            <button
              className={heat === option ? "active" : ""}
              key={option}
              onClick={() => setHeat(option)}
              type="button"
            >
              {option === "all" ? "All" : heatLabels[option]}
            </button>
          ))}
        </div>

        <div className="roster">
          {filtered.map((person) => (
            <button
              className={`roster-card ${selected?.id === person.id ? "selected" : ""}`}
              key={person.id}
              onClick={() => setSelectedId(person.id)}
              type="button"
            >
              <Avatar person={person} />
              <span>
                <strong>{person.aliases || person.name || "Unnamed entry"}</strong>
                <small>{person.name || "Real name pending"}</small>
              </span>
              <em className={`heat ${person.heat}`}>{heatLabels[person.heat]}</em>
            </button>
          ))}
        </div>

        <div className="sidebar-actions">
          <button onClick={addPerson} type="button" title="Add entry">
            <Plus size={18} />
            <span>Add</span>
          </button>
          <button onClick={exportData} type="button" title="Export data">
            <Download size={18} />
            <span>Export</span>
          </button>
          <button onClick={() => importRef.current?.click()} type="button" title="Import data">
            <FileUp size={18} />
            <span>Import</span>
          </button>
        </div>
        <input accept="application/json" hidden onChange={importData} ref={importRef} type="file" />
      </section>

      <section className="workspace" aria-label="Selected entry">
        {selected ? (
          <>
            <header className="topbar">
              <div>
                <p>Burn page</p>
                <h2>{selected.aliases || selected.name || "Unnamed entry"}</h2>
              </div>
              <div className="topbar-actions">
                {isShared ? (
                  <button onClick={refreshShared} type="button" title="Refresh shared book">
                    <RefreshCw size={18} />
                    <span>Refresh</span>
                  </button>
                ) : null}
                <button onClick={() => (client ? createShareLink(false) : createSnapshotLink())} type="button" title="Copy link">
                  <Share2 size={18} />
                  <span>Share</span>
                </button>
                {client && passcode ? (
                  <button onClick={() => createShareLink(true)} type="button" title="Copy one-tap link">
                    <KeyRound size={18} />
                    <span>One-tap</span>
                  </button>
                ) : null}
                <button className="danger" onClick={deleteSelected} type="button" title="Delete entry">
                  <Trash2 size={18} />
                </button>
              </div>
            </header>

            {showSetup ? (
              <form className="setup-panel" onSubmit={saveSetup}>
                <Field label="Supabase URL">
                  <input
                    onChange={(event) => setSetupDraft({ ...setupDraft, url: event.target.value.trim() })}
                    placeholder="https://example.supabase.co"
                    value={setupDraft.url}
                  />
                </Field>
                <Field label="Supabase publishable / anon key">
                  <input
                    onChange={(event) => setSetupDraft({ ...setupDraft, key: event.target.value.trim() })}
                    placeholder="eyJ..."
                    value={setupDraft.key}
                  />
                </Field>
                <Field label="Book ID">
                  <input
                    onChange={(event) => setSetupDraft({ ...setupDraft, book: event.target.value.trim() })}
                    placeholder="UUID from setup SQL"
                    value={setupDraft.book}
                  />
                </Field>
                <div className="command-row">
                  <button className="primary" type="submit">
                    <Save size={18} />
                    <span>Save setup</span>
                  </button>
                  <button className="ghost" onClick={() => setShowSetup(false)} type="button">
                    <X size={17} />
                    <span>Close</span>
                  </button>
                </div>
              </form>
            ) : null}

            <form className="profile" onSubmit={submitProfile}>
              <section className="face-panel">
                <div className="photo">
                  <Avatar person={selected} large />
                </div>
                <label className="upload">
                  <Upload size={18} />
                  <span>{selected.face ? "Replace face" : "Add face"}</span>
                  <input accept="image/*" hidden onChange={handlePhoto} type="file" />
                </label>
                {selected.face ? (
                  <button className="ghost" onClick={() => updateSelected({ face: "" })} type="button">
                    <X size={17} />
                    <span>Clear photo</span>
                  </button>
                ) : null}
                <button className="ghost" onClick={() => setShowSetup(true)} type="button">
                  <Cloud size={17} />
                  <span>Shared setup</span>
                </button>
              </section>

              <section className="editor">
                <div className="grid two">
                  <Field label="Nickname">
                    <input
                      onChange={(event) => updateSelected({ aliases: event.target.value })}
                      placeholder="Chat nickname, shorthand, or what everyone calls them"
                      value={selected.aliases}
                    />
                  </Field>
                  <Field label="Real name">
                    <input onChange={(event) => updateSelected({ name: event.target.value })} value={selected.name} />
                  </Field>
                  <Field label="Heat level">
                    <select onChange={(event) => updateSelected({ heat: event.target.value as Heat })} value={selected.heat}>
                      <option value="watch">Watch List</option>
                      <option value="avoid">Avoid</option>
                      <option value="friction">High Friction</option>
                      <option value="redeemable">Redeemable</option>
                    </select>
                  </Field>
                  <Field label="Where they show up">
                    <input
                      onChange={(event) => updateSelected({ location: event.target.value })}
                      placeholder="Pool, clubhouse, meeting, group chat"
                      value={selected.location}
                    />
                  </Field>
                </div>

                <Field label="What did they do?">
                  <textarea
                    onChange={(event) => updateSelected({ offense: event.target.value })}
                    placeholder="The short version. Keep it clear enough that future-you knows why the group made that face."
                    value={selected.offense}
                  />
                </Field>

                <Field label="Receipts / who knows the story">
                  <textarea
                    onChange={(event) => updateSelected({ receipts: event.target.value })}
                    placeholder="Names, dates, screenshots to find later, or who to ask before repeating."
                    value={selected.receipts}
                  />
                </Field>

                <div className="command-row">
                  <button className="primary" type="submit">
                    <Save size={18} />
                    <span>{isShared ? "Save shared" : "Save"}</span>
                  </button>
                  <p>
                    <AlertTriangle size={16} />
                    {isShared ? `Central book. ${lastSaved ? `Last saved ${lastSaved}.` : "Autosave on."}` : "Local fallback. Connect shared setup for one central book."}
                  </p>
                </div>
              </section>
            </form>
          </>
        ) : (
          <div className="empty">
            <Camera size={42} />
            <h2>No entries yet</h2>
            <button onClick={addPerson} type="button">
              <Plus size={18} />
              <span>Add the first entry</span>
            </button>
          </div>
        )}
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Avatar({ large = false, person }: { large?: boolean; person: Person }) {
  if (person.face) {
    return <img alt="" className={large ? "avatar large" : "avatar"} src={person.face} />;
  }

  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return <span className={large ? "avatar large placeholder" : "avatar placeholder"}>{initials || "?"}</span>;
}

createRoot(document.getElementById("root")!).render(<App />);
