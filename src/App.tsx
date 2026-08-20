import {
  AlertTriangle,
  Camera,
  Download,
  FileUp,
  Flame,
  Plus,
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

const storageKey = "towamensing-lore-ledger-v1";

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

function encodeSnapshot(people: Person[]) {
  const payload = JSON.stringify({ people, exportedAt: new Date().toISOString() });
  return btoa(unescape(encodeURIComponent(payload)));
}

function decodeSnapshot(encoded: string): Person[] | null {
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    return Array.isArray(payload.people) ? payload.people : null;
  } catch {
    return null;
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
      tags: Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string") : [],
      updatedAt: new Date().toISOString(),
    }));
}

function App() {
  const [people, setPeople] = useState<Person[]>(() => {
    const fromHash = new URLSearchParams(location.hash.replace(/^#/, "")).get("data");
    if (fromHash) {
      const decoded = decodeSnapshot(fromHash);
      if (decoded) return decoded;
    }

    const stored = localStorage.getItem(storageKey);
    if (!stored) return seedPeople;

    try {
      const parsed = JSON.parse(stored);
      return normalizePeople(parsed) ?? seedPeople;
    } catch {
      return seedPeople;
    }
  });
  const [selectedId, setSelectedId] = useState(people[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [heat, setHeat] = useState<Heat | "all">("all");
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement | null>(null);

  const selected = people.find((person) => person.id === selectedId) ?? people[0];

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(people));
  }, [people]);

  useEffect(() => {
    if (!selected && people[0]) setSelectedId(people[0].id);
  }, [people, selected]);

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

  function createShareLink() {
    const url = new URL(location.href);
    url.hash = `data=${encodeSnapshot(people)}`;
    navigator.clipboard.writeText(url.toString());
    flash("Snapshot link copied.");
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
        flash("Import complete.");
      } catch {
        flash("That file was not a burn book export.");
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
    flash("Saved locally.");
  }

  return (
    <main className="app">
      <section className="sidebar" aria-label="Burn book roster">
        <div className="brand">
          <div className="mark">
            <Flame size={25} />
          </div>
          <div>
            <p>Towamensing Trails</p>
            <h1>Lore Ledger</h1>
          </div>
        </div>

        <div className="notice">
          <ShieldAlert size={18} />
          <span>Keep notes factual, useful, and backed up before the lore mutates.</span>
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search names, lore, tags"
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
                <strong>{person.name || "Unnamed entry"}</strong>
                <small>{person.role || person.location || "Lore pending"}</small>
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
                <p>Selected dossier</p>
                <h2>{selected.name || "Unnamed entry"}</h2>
              </div>
              <div className="topbar-actions">
                <button onClick={createShareLink} type="button" title="Copy snapshot link">
                  <Share2 size={18} />
                  <span>Share</span>
                </button>
                <button className="danger" onClick={deleteSelected} type="button" title="Delete entry">
                  <Trash2 size={18} />
                </button>
              </div>
            </header>

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
              </section>

              <section className="editor">
                <div className="grid two">
                  <Field label="Name">
                    <input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
                  </Field>
                  <Field label="Aliases">
                    <input
                      value={selected.aliases}
                      onChange={(event) => updateSelected({ aliases: event.target.value })}
                      placeholder="Nicknames, chat shorthand"
                    />
                  </Field>
                  <Field label="Role / how we know them">
                    <input
                      value={selected.role}
                      onChange={(event) => updateSelected({ role: event.target.value })}
                      placeholder="Neighbor, board person, pool regular"
                    />
                  </Field>
                  <Field label="Typical habitat">
                    <input
                      value={selected.location}
                      onChange={(event) => updateSelected({ location: event.target.value })}
                      placeholder="Where their face usually appears"
                    />
                  </Field>
                  <Field label="Heat level">
                    <select value={selected.heat} onChange={(event) => updateSelected({ heat: event.target.value as Heat })}>
                      <option value="watch">Watch List</option>
                      <option value="avoid">Avoid</option>
                      <option value="friction">High Friction</option>
                      <option value="redeemable">Redeemable</option>
                    </select>
                  </Field>
                  <Field label="Last seen">
                    <input
                      value={selected.lastSeen}
                      onChange={(event) => updateSelected({ lastSeen: event.target.value })}
                      placeholder="Pool, clubhouse, chat screenshot..."
                    />
                  </Field>
                </div>

                <Field label="Face card / recognition notes">
                  <textarea
                    value={selected.summary}
                    onChange={(event) => updateSelected({ summary: event.target.value })}
                    placeholder="What they look like, their vibe, and how to recognize them later."
                  />
                </Field>

                <Field label="Why does the group have context?">
                  <textarea
                    value={selected.offense}
                    onChange={(event) => updateSelected({ offense: event.target.value })}
                    placeholder="The short lore. Bonus points for clarity; fewer points for exaggeration."
                  />
                </Field>

                <Field label="Receipts / who knows the story">
                  <textarea
                    value={selected.receipts}
                    onChange={(event) => updateSelected({ receipts: event.target.value })}
                    placeholder="Names, dates, screenshots to find later, or who to ask before repeating."
                  />
                </Field>

                <Field label="Tags">
                  <input
                    value={selected.tags.join(", ")}
                    onChange={(event) =>
                      updateSelected({
                        tags: event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="pool, parking, clubhouse"
                  />
                </Field>

                <div className="command-row">
                  <button className="primary" type="submit">
                    <Save size={18} />
                    <span>Save</span>
                  </button>
                  <p>
                    <AlertTriangle size={16} />
                    Stored in this browser. Use Export or Share to move the book.
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
